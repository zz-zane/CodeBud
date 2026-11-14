/**
 * DeepTutor Native TypeScript Harness (ported & adapted from DeepTutor packages/chat-engine).
 *
 * 核心特性：
 * 1. 纯 TypeScript 零外部 CLI 依赖：直接在 Electron 主进程内通过受控 Keep-Alive 连接池完成流式调用，彻底免除 spawn claude CLI 冷启动与本地安装门槛。
 * 2. 双协议原生支持：同时支持 OpenAI 兼容 (/v1/chat/completions) 与 Anthropic 兼容 (/v1/messages) SSE 流。
 * 3. ThinkFilter 思考流分离：支持跨 chunk 边界的 <think>...</think> 标签切分以及 DeepSeek reasoning_content / Anthropic thinking_delta。
 * 4. 多轮会话内存管理与截断自动续写 (continue_truncated)：当输出因 max_tokens/length 截断时自动衔接续写，确保长代码与可视化 JSON 块完整闭合。
 * 5. 严格安全红线：禁止重定向泄露凭证、拒绝非 http/https 或含内嵌账号密码的 URL、清洗错误输出防止泄露 API Key。
 */
import { Agent as HttpAgent, request as httpRequest } from 'node:http'
import { Agent as HttpsAgent, request as httpsRequest } from 'node:https'
import { Readable } from 'node:stream'
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib'
import type { AiFailReason, AiProtocol } from '../../shared/types'
import { resolveAnthropicMessagesUrl, resolveOpenAiChatUrl } from './endpoint-url'
import { normalizeProviderUsage, type ProviderUsage } from '../study/usage'

/** 一轮对话的入参。原先定义在 claude-runner.ts（已退役），本 harness 是唯一使用者 */
export interface RunTurnParams {
  sessionId?: string
  isResume?: boolean
  prompt: string
  /** 仅本轮替换配置里的系统提示词（一次性专用问答用）；不传则沿用配置 */
  systemPrompt?: string
  timeoutMs?: number
  signal?: AbortSignal
  onChunk?: (delta: string) => void
  onUsage?: (usage: ProviderUsage) => void
}

export interface RunTurnResult {
  sessionId: string
  text: string
  costUsd?: number
  durationMs?: number
}

export type HarnessResult =
  | { ok: true; data: RunTurnResult }
  | { ok: false; reason: AiFailReason | 'aborted'; detail?: string }

const agentOptions = {
  keepAlive: true,
  maxSockets: 64,
  maxTotalSockets: 64,
  maxFreeSockets: 8,
  timeout: 30_000
}

const httpAgent = new HttpAgent(agentOptions)
const httpsAgent = new HttpsAgent(agentOptions)

const MAX_LINE_BYTES = 4_194_304
const MAX_TURN_BYTES = 16_777_216
const MAX_SESSION_MESSAGES = 24
const MAX_CONTINUATION_ROUNDS = 2

/**
 * 跨 SSE 分块边界切分 <think>...</think> 标签（移植自 DeepTutor packages/chat-engine/src/providers/think-filter.ts）
 */
export class ThinkFilter {
  private pending = ''
  private thinking = false
  private thinkingBuffer = ''

  public feed(text: string, final = false): Array<['content' | 'thinking', string]> {
    this.pending += text
    const out: Array<['content' | 'thinking', string]> = []
    while (this.pending) {
      const tag = this.thinking ? '</think>' : '<think>'
      const at = this.pending.indexOf(tag)
      if (at >= 0) {
        if (at > 0) {
          const kind = this.thinking ? 'thinking' : 'content'
          const chunk = this.pending.slice(0, at)
          if (kind !== 'content') {
            this.thinkingBuffer += chunk
          }
          out.push([kind, chunk])
        }
        this.pending = this.pending.slice(at + tag.length)
        this.thinking = !this.thinking
        this.thinkingBuffer = ''
        continue
      }
      let held = 0
      if (!final) {
        for (let n = 1; n < tag.length; n++) {
          if (this.pending.endsWith(tag.slice(0, n))) held = n
        }
      }
      const ready = this.pending.slice(0, this.pending.length - held)
      if (ready) {
        const kind = this.thinking ? 'thinking' : 'content'
        if (kind !== 'content') {
          this.thinkingBuffer += ready
        }
        out.push([kind, ready])
      }
      this.pending = held ? this.pending.slice(-held) : ''
      break
    }
    if (final && this.thinking && this.thinkingBuffer) {
      out.push(['content', this.thinkingBuffer])
      this.thinkingBuffer = ''
    }
    return out
  }
}

export interface HarnessUpstreamConfig {
  protocol: AiProtocol
  baseUrl: string
  apiKey: string
  model: string
  systemPrompt?: string
}

export interface NativeHarnessOptions {
  getConfig: () => HarnessUpstreamConfig
}

export interface SessionMessage {
  role: 'user' | 'assistant'
  content: string
}

interface ProviderRoundResult {
  text: string
  reasoning: string
  finishReason: string
}

/** 受控流式 HTTP POST（移植自 DeepTutor packages/chat-engine/src/providers/http.ts） */
export function postStream(
  endpoint: string,
  headers: Record<string, string>,
  payload: string,
  signal: AbortSignal
): Promise<{
  status: number
  ok: boolean
  contentType: string
  body: ReadableStream<Uint8Array>
}> {
  signal.throwIfAborted()
  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    return Promise.reject(new Error('Invalid provider endpoint'))
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    return Promise.reject(new Error('Invalid provider endpoint'))
  }

  return new Promise((resolve, reject) => {
    const secure = url.protocol === 'https:'
    const request = (secure ? httpsRequest : httpRequest)(
      url,
      {
        method: 'POST',
        signal,
        agent: secure ? httpsAgent : httpAgent,
        headers: { ...headers, 'Content-Length': String(Buffer.byteLength(payload)) }
      },
      (response) => {
        const status = response.statusCode || 0
        if (status >= 300 && status < 400) {
          response.destroy()
          reject(new Error('Model provider redirected the request'))
          return
        }
        const encoding = String(response.headers['content-encoding'] || '').toLowerCase()
        const decompress =
          encoding === 'gzip'
            ? createGunzip()
            : encoding === 'deflate'
              ? createInflate()
              : encoding === 'br'
                ? createBrotliDecompress()
                : null
        if (encoding && encoding !== 'identity' && !decompress) {
          response.destroy()
          reject(new Error('Unsupported provider content encoding'))
          return
        }
        const stream = decompress ? response.pipe(decompress) : response
        if (decompress) {
          response.on('error', (err) => decompress.destroy(err))
          decompress.on('close', () => response.destroy())
        }
        resolve({
          status,
          ok: status >= 200 && status < 300,
          contentType: String(response.headers['content-type'] || ''),
          body: Readable.toWeb(stream) as ReadableStream<Uint8Array>
        })
      }
    )
    request.on('error', reject)
    request.end(payload)
  })
}

/** 增量 UTF-8 SSE 生成器（移植自 DeepTutor packages/chat-engine/src/providers/sse.ts） */
export async function* parseSseStream(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
  idleMs = 60_000
): AsyncGenerator<string> {
  const reader = body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: false })
  let pending = ''
  let data: string[] = []
  let eventBytes = 0

  const onAbort = () => {
    void reader.cancel(signal.reason).catch(() => {})
  }
  signal.addEventListener('abort', onAbort, { once: true })
  if (signal.aborted) {
    onAbort()
    return
  }

  try {
    while (true) {
      signal.throwIfAborted()
      let timer: ReturnType<typeof setTimeout> | undefined
      let part: Awaited<ReturnType<typeof reader.read>>
      try {
        part = await Promise.race([
          reader.read(),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error('Provider stream idle timeout')), idleMs)
          })
        ])
      } finally {
        clearTimeout(timer)
      }
      signal.throwIfAborted()
      pending += part.done ? decoder.decode() : decoder.decode(part.value, { stream: true })
      if (pending.length > MAX_LINE_BYTES) {
        throw new Error('Provider SSE line exceeds limit')
      }
      let end: number
      while ((end = pending.indexOf('\n')) >= 0) {
        const line = pending.slice(0, end).replace(/\r$/, '')
        pending = pending.slice(end + 1)
        if (!line) {
          if (data.length) yield data.join('\n')
          data = []
          eventBytes = 0
        } else if (line.startsWith('data:')) {
          const value = line.slice(5).replace(/^ /, '')
          eventBytes += value.length
          if (eventBytes > MAX_LINE_BYTES) {
            throw new Error('Provider SSE event exceeds limit')
          }
          data.push(value)
        }
      }
      if (part.done) {
        if (pending.startsWith('data:')) {
          data.push(pending.slice(5).replace(/^ /, ''))
        }
        if (data.length) yield data.join('\n')
        break
      }
    }
  } finally {
    signal.removeEventListener('abort', onAbort)
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

function classifyFailure(status: number, errText: string): AiFailReason {
  if (status === 401 || status === 403 || /unauthorized|authentication_failed|invalid.*key/i.test(errText)) {
    return 'unauthorized'
  }
  if (status === 402 || status === 429 || /quota|insufficient|rate_limit|balance/i.test(errText)) {
    return 'quota'
  }
  if (/timeout|timed out/i.test(errText)) {
    return 'timeout'
  }
  if (/ECONNREFUSED|ENOTFOUND|EAI_AGAIN|socket hang up|network|Invalid provider endpoint/i.test(errText)) {
    return 'offline'
  }
  return 'server'
}

export class NativeHarness {
  private options: NativeHarnessOptions
  private sessions = new Map<string, SessionMessage[]>()

  constructor(options: NativeHarnessOptions) {
    this.options = options
  }

  public clearSession(sessionId: string): void {
    this.sessions.delete(sessionId)
  }

  
  private recordSession(sessionId: string, messages: SessionMessage[]): void {
    this.sessions.delete(sessionId)
    const clipped = messages.slice(-MAX_SESSION_MESSAGES).map((m) => ({
      role: m.role,
      content: m.content.length > 24_000 ? m.content.slice(0, 24_000) : m.content
    }))
    this.sessions.set(sessionId, clipped)
    while (this.sessions.size > 32) {
      const oldest = this.sessions.keys().next().value
      if (oldest !== undefined) this.sessions.delete(oldest)
      else break
    }
  }

  public getSessionHistory(sessionId: string): SessionMessage[] {
    return [...(this.sessions.get(sessionId) ?? [])]
  }

  public restoreSession(sessionId: string, messages: SessionMessage[]): void {
    if (!this.sessions.has(sessionId)) this.recordSession(sessionId, messages)
  }

  public replaceLastAssistantMessage(sessionId: string, text: string): void {
    const last = this.sessions.get(sessionId)?.at(-1)
    if (last?.role === 'assistant') last.content = text.slice(0, 24_000)
  }

  public async runTurn(params: RunTurnParams): Promise<HarnessResult> {
    const startMs = Date.now()
    const timeoutMs = params.timeoutMs ?? 90_000
    const sessionId = params.sessionId || 'default-session'

    if (params.signal?.aborted) {
      return { ok: false, reason: 'aborted', detail: 'Request was canceled by user' }
    }

    const base = this.options.getConfig()
    const cfg = params.systemPrompt === undefined ? base : { ...base, systemPrompt: params.systemPrompt }
    if (!cfg.apiKey?.trim()) {
      return { ok: false, reason: 'unauthorized', detail: 'Missing API key' }
    }

    const controller = new AbortController()
    let isTimedOut = false
    let isUserCanceled = false

    const onUserAbort = () => {
      isUserCanceled = true
      controller.abort(new Error('Request was canceled by user'))
    }
    if (params.signal) {
      params.signal.addEventListener('abort', onUserAbort, { once: true })
      if (params.signal.aborted) {
        onUserAbort()
        return { ok: false, reason: 'aborted', detail: 'Request was canceled by user' }
      }
    }

    const timer =
      timeoutMs > 0
        ? setTimeout(() => {
            isTimedOut = true
            controller.abort(new Error(`Request timed out after ${timeoutMs}ms`))
          }, timeoutMs)
        : null

    let accumulatedText = ''
    try {
      const history: SessionMessage[] =
        params.isResume && this.sessions.has(sessionId)
          ? [...(this.sessions.get(sessionId) ?? [])]
          : []

      history.push({ role: 'user', content: params.prompt || '' })
      let continuationCount = 0

      while (true) {
        const round = await this.executeProviderRound(cfg, history, controller.signal, (chunk) => {
          accumulatedText += chunk
          params.onChunk?.(chunk)
        }, params.onUsage)

        const isTruncated = ['length', 'max_tokens', 'max_output_tokens'].includes(round.finishReason)
        if (isTruncated && continuationCount < MAX_CONTINUATION_ROUNDS && round.text.trim()) {
          continuationCount++
          history.push({ role: 'assistant', content: round.text })
          history.push({
            role: 'user',
            content: 'Continue where the response stopped, without repetition, and finish the answer.'
          })
          continue
        }

        break
      }

      const cleanHistory =
        params.isResume && this.sessions.has(sessionId)
          ? [...(this.sessions.get(sessionId) ?? [])]
          : []
      cleanHistory.push({ role: 'user', content: params.prompt || '' })
      cleanHistory.push({ role: 'assistant', content: accumulatedText })
      if (cleanHistory.length > MAX_SESSION_MESSAGES) {
        cleanHistory.splice(0, cleanHistory.length - MAX_SESSION_MESSAGES)
      }
      this.recordSession(sessionId, cleanHistory)

      return {
        ok: true,
        data: {
          sessionId,
          text: accumulatedText,
          durationMs: Date.now() - startMs
        }
      }
    } catch (err: any) {
      if (isUserCanceled || params.signal?.aborted) {
        if (accumulatedText.trim()) {
          const partialHistory =
            params.isResume && this.sessions.has(sessionId)
              ? [...(this.sessions.get(sessionId) ?? [])]
              : []
          partialHistory.push({ role: 'user', content: params.prompt || '' })
          partialHistory.push({ role: 'assistant', content: accumulatedText })
          this.recordSession(sessionId, partialHistory)
        }
        return { ok: false, reason: 'aborted', detail: 'Request was canceled by user' }
      }
      if (isTimedOut) {
        return { ok: false, reason: 'timeout', detail: `Request timed out after ${timeoutMs}ms` }
      }
      const status = typeof err?.status === 'number' ? err.status : 0
      const rawMsg = String(err?.message || 'Unknown error')
      const safeMsg = cfg.apiKey ? rawMsg.split(cfg.apiKey).join('[REDACTED]') : rawMsg
      return {
        ok: false,
        reason: classifyFailure(status, safeMsg),
        detail: safeMsg
      }
    } finally {
      if (timer) clearTimeout(timer)
      if (params.signal) {
        params.signal.removeEventListener('abort', onUserAbort)
      }
    }
  }

  private async executeProviderRound(
    cfg: HarnessUpstreamConfig,
    messages: SessionMessage[],
    signal: AbortSignal,
    onContentChunk: (chunk: string) => void,
    onUsage?: (usage: ProviderUsage) => void
  ): Promise<ProviderRoundResult> {
    const protocol: AiProtocol = cfg.protocol === 'anthropic' ? 'anthropic' : 'openai'
    const endpoint =
      protocol === 'anthropic'
        ? resolveAnthropicMessagesUrl(cfg.baseUrl)
        : resolveOpenAiChatUrl(cfg.baseUrl)

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream'
    }

    let bodyObj: Record<string, unknown>
    if (protocol === 'anthropic') {
      headers['x-api-key'] = cfg.apiKey
      headers['anthropic-version'] = '2023-06-01'
      bodyObj = {
        model: cfg.model || 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        stream: true,
        ...(cfg.systemPrompt ? { system: cfg.systemPrompt } : {}),
        messages: messages.map((m) => ({ role: m.role, content: m.content }))
      }
    } else {
      headers['Authorization'] = `Bearer ${cfg.apiKey}`
      const openAiMessages: Array<{ role: string; content: string }> = []
      if (cfg.systemPrompt?.trim()) {
        openAiMessages.push({ role: 'system', content: cfg.systemPrompt.trim() })
      }
      for (const m of messages) {
        openAiMessages.push({ role: m.role, content: m.content })
      }
      bodyObj = {
        model: cfg.model || 'deepseek-chat',
        stream: true,
        stream_options: { include_usage: true },
        max_tokens: 4096,
        messages: openAiMessages
      }
    }

    const response = await postStream(endpoint, headers, JSON.stringify(bodyObj), signal)
    if (!response.ok) {
      let errPreview = ''
      try {
        const reader = response.body.getReader()
        const first = await reader.read()
        if (first.value) {
          errPreview = new TextDecoder().decode(first.value).slice(0, 400)
        }
        await reader.cancel().catch(() => {})
      } catch {}
      const error: any = new Error(`Upstream HTTP ${response.status}: ${errPreview}`)
      error.status = response.status
      throw error
    }

    const filter = new ThinkFilter()
    let text = ''
    let reasoning = ''
    let finishReason = ''
    let totalBytes = 0
    let usage: Record<string, unknown> = {}

    const emitContent = (rawDelta: string) => {
      for (const [kind, segment] of filter.feed(rawDelta, false)) {
        if (kind === 'content') {
          text += segment
          onContentChunk(segment)
        } else {
          reasoning += segment
        }
      }
    }

    try {
    for await (const rawData of parseSseStream(response.body, signal)) {
      const trimmed = rawData.trim()
      if (!trimmed || trimmed === '[DONE]') {
        if (trimmed === '[DONE]') break
        continue
      }
      let parsed: any
      try {
        parsed = JSON.parse(trimmed)
      } catch {
        continue
      }

      if (parsed.error) {
        const errObj = parsed.error
        const msg = typeof errObj === 'string' ? errObj : errObj.message || 'Upstream stream error'
        const err: any = new Error(msg)
        err.status = typeof errObj?.code === 'number' ? errObj.code : 502
        throw err
      }

      if (protocol === 'anthropic') {
        if (parsed.type === 'message_start' && parsed.message?.usage) usage = { ...usage, ...parsed.message.usage }
        if (parsed.usage) usage = { ...usage, ...parsed.usage }
        if (parsed.type === 'content_block_delta') {
          const delta = parsed.delta
          if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
            totalBytes += delta.text.length
            if (totalBytes > MAX_TURN_BYTES) throw new Error('Provider output exceeds turn limit')
            emitContent(delta.text)
          } else if (delta?.type === 'thinking_delta' && typeof delta.thinking === 'string') {
            reasoning += delta.thinking
          }
        } else if (parsed.type === 'message_delta' && parsed.delta?.stop_reason) {
          finishReason = String(parsed.delta.stop_reason)
        } else if (parsed.type === 'error') {
          throw new Error(parsed.error?.message || 'Anthropic stream error')
        }
      } else {
        if (parsed.usage) usage = { ...usage, ...parsed.usage }
        const choice = Array.isArray(parsed.choices) ? parsed.choices[0] : null
        if (!choice) continue
        if (choice.finish_reason) {
          finishReason = String(choice.finish_reason)
        }
        const delta = choice.delta ?? choice.message ?? {}
        if (typeof delta.reasoning_content === 'string' && delta.reasoning_content) {
          reasoning += delta.reasoning_content
        }
        if (typeof delta.content === 'string' && delta.content) {
          totalBytes += delta.content.length
          if (totalBytes > MAX_TURN_BYTES) throw new Error('Provider output exceeds turn limit')
          emitContent(delta.content)
        }
      }
    }
    } finally { onUsage?.(normalizeProviderUsage(protocol, usage)) }

    for (const [kind, segment] of filter.feed('', true)) {
      if (kind === 'content') {
        text += segment
        onContentChunk(segment)
      } else {
        reasoning += segment
      }
    }

    if (!text.trim() && reasoning.trim()) {
      text = reasoning
      onContentChunk(reasoning)
    }

    return { text, reasoning, finishReason }
  }
}
