import { STUDY_TEXT } from '../../shared/study-copy'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import type { StudyConnection } from '../../shared/study-companion'
import { idInput, objectInput, StudyStore, textInput } from './store'
import { normalizeAcpUsage, type ProviderUsage } from './usage'
import { RetryNoticeFilter } from '../../shared/acp-retry-notice'

interface PendingRequest { resolve(value: unknown): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }
interface RpcMessage { id?: number | string; method?: string; params?: Record<string, any>; result?: any; error?: { code?: number; message?: string } }

const QUOTA_RE = /quota|resource.?exhaust|usage limit/i
const RATE_RE = /rate.?limit|too many requests|\b429\b/i
const AUTH_RE = /auth|log ?in|sign ?in|unauthori[sz]ed|credential/i

/** Map an agent error or in-band warning to a specific user-facing reason; null when unrecognised. */
export function classifyAcpFailure(code: unknown, message: unknown): string | null {
  const text = typeof message === 'string' ? message : ''
  if (QUOTA_RE.test(text)) return STUDY_TEXT.ACP_QUOTA(/resets? in ([0-9hms ]+)/i.exec(text)?.[1]?.trim() ?? '')
  if (RATE_RE.test(text)) return STUDY_TEXT.ACP_RATE_LIMIT
  if (code === -32000 || AUTH_RE.test(text)) return STUDY_TEXT.ACP_AUTH_REQUIRED
  return null
}

/** Arguments that would let the agent act without asking; the tutor never allows them. */
export function unsafeAcpArgs(args: string[]): boolean {
  const flag = /^--?(dangerously[\w-]*|yolo|skip[-_]?permissions?|auto[-_]?approve|approve[-_]?all|allow[-_]?all|bypass[\w-]*|no[-_]?confirm)(=|$)/i
  const loose = /^(auto|accept[-_]?edits|bypass\w*|dont[-_]?ask)$/i
  return args.some((arg, i) => flag.test(arg) || (/^--(permission[-_]?)?mode(=|$)/i.test(arg) && loose.test(arg.includes('=') ? arg.split('=')[1] : args[i + 1] ?? '')))
}

/** Always a refusal: prefer an explicit reject option, never an allow one. */
export function permissionRefusal(options: unknown): { outcome: { outcome: 'selected'; optionId: string } | { outcome: 'cancelled' } } {
  const list = Array.isArray(options) ? options.filter((o): o is { optionId: string; kind?: string } => !!o && typeof o.optionId === 'string') : []
  const pick = list.find(o => o.kind === 'reject_once') ?? list.find(o => o.kind === 'reject_always') ?? list.find(o => /^reject/i.test(o.kind ?? ''))
  return { outcome: pick ? { outcome: 'selected', optionId: pick.optionId } : { outcome: 'cancelled' } }
}

function chunkText(content: any): string {
  if (Array.isArray(content)) return content.map(chunkText).join('')
  return content?.type === 'text' && typeof content.text === 'string' ? content.text : ''
}

export class AcpClient {
  private child: ChildProcessWithoutNullStreams | null = null
  private pending = new Map<number, PendingRequest>()
  private nextId = 1
  private sessions = new Map<string, string>()
  private usage = new Map<string, Record<string, unknown>>()
  private buffer = ''
  private listener: ((text: string) => void) | null = null
  private activeSession: string | null = null
  private protocol = 1
  private refused = 0
  private cancelling = false
  private cancelTimer: ReturnType<typeof setTimeout> | null = null
  private spare: string | null = null
  promptTimeoutMs = 180_000
  private exited: Promise<void> = Promise.resolve()
  authMethods: Array<{ id: string; name: string; type?: string }> = []
  get connected(): boolean { return !!this.child && !this.child.killed && this.child.exitCode === null }
  hasSession(id: string): boolean { return this.sessions.has(id) }

  constructor(private connection: StudyConnection, private directory: string) {}

  async initialize(): Promise<void> {
    if (/\.(cmd|bat|ps1)$/i.test(this.connection.command) || /[\r\n\0]/.test(this.connection.command)) throw new Error(STUDY_TEXT.ACP_SHELL_UNSUPPORTED)
    mkdirSync(this.directory, { recursive: true })
    this.child = spawn(this.connection.command, this.connection.args, { cwd: this.directory, shell: false, windowsHide: true, stdio: 'pipe' })
    this.exited = new Promise(resolve => { this.child!.once('close', () => resolve()); this.child!.once('error', () => resolve()) })
    this.child.stdout.setEncoding('utf8')
    this.child.stdin.on('error', () => { void this.close(new Error(STUDY_TEXT.ACP_INPUT_CLOSED)) })
    this.child.stdout.on('data', (chunk: string) => {
      this.buffer += chunk
      if (this.buffer.length > 4_194_304) { this.close(new Error(STUDY_TEXT.ACP_MESSAGE_TOO_LONG)); return }
      let index: number
      while ((index = this.buffer.indexOf('\n')) >= 0) {
        const line = this.buffer.slice(0, index).trim()
        this.buffer = this.buffer.slice(index + 1)
        if (!line) continue
        try { this.receive(JSON.parse(line)) } catch { this.close(new Error(STUDY_TEXT.ACP_MESSAGE_INVALID)); return }
      }
    })
    // Adapter stderr may contain account details; drain it without persisting or forwarding it.
    this.child.stderr.resume()
    this.child.on('error', () => this.close(new Error(STUDY_TEXT.ACP_START_FAILED)))
    this.child.on('close', () => this.close(new Error(STUDY_TEXT.ACP_EXITED)))
    const response = objectInput(await this.request('initialize', { protocolVersion: 1, clientCapabilities: { fs: { readTextFile: false, writeTextFile: false }, terminal: false }, clientInfo: { name: 'miai-learning', version: '1.0.0' } }))
    if (response.protocolVersion !== 1 && response.protocolVersion !== 2) throw new Error(STUDY_TEXT.ACP_VERSION_UNSUPPORTED)
    this.protocol = response.protocolVersion
    const methods = response.authMethods
    if (methods !== undefined && (!Array.isArray(methods) || methods.length > 20)) throw new Error(STUDY_TEXT.ACP_AUTH_INVALID)
    this.authMethods = (methods as unknown[] | undefined ?? []).map(value => {
      const data = objectInput(value)
      return { id: textInput(data.id ?? data.methodId, 200), name: textInput(data.name, 300), ...(typeof data.type === 'string' ? { type: data.type } : {}) }
    })
  }

  private receive(message: RpcMessage): void {
    if (!message || typeof message !== 'object') throw new Error('Invalid ACP message')
    if (message.method && message.id !== undefined) {
      if (message.method === 'session/request_permission') { this.refused++; this.write({ jsonrpc: '2.0', id: message.id, result: permissionRefusal(message.params?.options) }) }
      else this.write({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Learning client does not permit filesystem or terminal access' } })
      return
    }
    if (message.method === 'session/update') {
      const params = message.params
      if (params?.sessionId !== this.activeSession) return
      const update = params?.update
      // Only answer text reaches the chat; thoughts, tool calls, echoes and command lists are ignored.
      if (update?.sessionUpdate === 'agent_message_chunk') { const text = chunkText(update.content); if (text) this.listener?.(text) }
      return
    }
    if (typeof message.id !== 'number') return
    const pending = this.pending.get(message.id)
    if (!pending) return
    this.pending.delete(message.id)
    clearTimeout(pending.timer)
    if (message.error) pending.reject(new Error(classifyAcpFailure(message.error.code, message.error.message) ?? STUDY_TEXT.ACP_REQUEST_FAILED))
    else pending.resolve(message.result)
  }

  private write(value: unknown): void {
    if (!this.child || this.child.killed || !this.child.stdin.writable) throw new Error(STUDY_TEXT.ACP_NOT_CONNECTED)
    this.child.stdin.write(JSON.stringify(value) + '\n')
  }

  private request(method: string, params: unknown, timeoutMs = 30_000): Promise<unknown> {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(STUDY_TEXT.ACP_TIMEOUT)) }, timeoutMs)
      this.pending.set(id, { resolve, reject, timer })
      try { this.write({ jsonrpc: '2.0', id, method, params }) }
      catch (error) { clearTimeout(timer); this.pending.delete(id); reject(error) }
    })
  }

  async authenticate(methodId: string): Promise<void> {
    const method = this.authMethods.find(item => item.id === methodId)
    if (!method) throw new Error(STUDY_TEXT.ACP_AUTH_UNKNOWN)
    if (method.type === 'terminal') throw new Error(STUDY_TEXT.ACP_TERMINAL_LOGIN)
    await this.request(this.protocol === 2 ? 'auth/login' : 'authenticate', { methodId }, 180_000)
    this.sessions.clear()
  }

  /** Confirms the account is signed in (session/new needs it) and parks the session for the first prompt. */
  async probe(): Promise<void> {
    this.spare = textInput(objectInput(await this.request('session/new', { cwd: this.directory, mcpServers: [] })).sessionId, 500)
  }

  async prompt(appSessionId: string, text: string, signal: AbortSignal, onChunk: (text: string) => void): Promise<{ text: string; usage: ProviderUsage | null }> {
    if (this.listener) throw new Error(STUDY_TEXT.ACP_BUSY)
    signal.throwIfAborted()
    let sessionId = this.sessions.get(appSessionId)
    if (!sessionId) {
      sessionId = this.spare ?? textInput(objectInput(await this.request('session/new', { cwd: this.directory, mcpServers: [] })).sessionId, 500)
      this.spare = null
      const model = this.connection.model
      if (model) {
        try { await this.request('session/set_model', { sessionId, modelId: model }) }
        catch (error) { throw this.connected ? new Error(STUDY_TEXT.ACP_MODEL_INVALID) : error }
      }
      this.sessions.set(appSessionId, sessionId)
    }
    let output = ''
    let warning = ''
    const notices = new RetryNoticeFilter()
    this.refused = 0
    this.cancelling = false
    this.activeSession = sessionId
    const accept = (chunk: string) => {
      // Quota/rate warnings arrive as ordinary text; hold them back and report them as an error instead.
      if (!output && /^\s*⚠/.test(chunk) && (QUOTA_RE.test(chunk) || RATE_RE.test(chunk))) { warning += chunk; return }
      if (output.length + chunk.length > 2_000_000) { this.cancel(); return }
      output += chunk
      onChunk(chunk)
    }
    this.listener = chunk => {
      if (this.cancelling) return
      const text = notices.push(chunk)
      if (text) accept(text)
    }
    const abort = () => this.cancel()
    signal.addEventListener('abort', abort, { once: true })
    try {
      signal.throwIfAborted()
      const result = objectInput(await this.request('session/prompt', { sessionId, prompt: [{ type: 'text', text }] }, this.promptTimeoutMs))
      signal.throwIfAborted()
      const tail = notices.flush()
      if (tail) accept(tail)
      if (warning && !output) throw new Error(classifyAcpFailure(undefined, warning) ?? STUDY_TEXT.ACP_REQUEST_FAILED)
      // Only retry notices came back: the request never produced an answer, so report why (network unless the notice says otherwise).
      if (notices.dropped && !output.trim()) throw new Error(classifyAcpFailure(undefined, notices.dropped) ?? STUDY_TEXT.ACP_NETWORK)
      if (this.refused > 0) { output += STUDY_TEXT.ACP_TOOL_REFUSED; onChunk(STUDY_TEXT.ACP_TOOL_REFUSED) }
      const raw = result.usage && typeof result.usage === 'object' ? result.usage as Record<string, unknown> : null
      const usage = raw ? normalizeAcpUsage(raw, this.usage.get(sessionId)) : null
      if (raw) this.usage.set(sessionId, raw)
      return { text: output, usage }
    } catch (error) {
      if (error instanceof Error && error.message === STUDY_TEXT.ACP_TIMEOUT) void this.close(error)
      throw error
    } finally {
      signal.removeEventListener('abort', abort)
      if (this.cancelTimer) clearTimeout(this.cancelTimer)
      this.cancelTimer = null
      this.listener = null
      this.activeSession = null
    }
  }

  /** Switch the model of every live session and of the parked one; later sessions pick it up from the connection. */
  async setModel(modelId: string): Promise<void> {
    if (this.listener) throw new Error(STUDY_TEXT.ACP_BUSY)
    const targets = [...this.sessions.values(), ...(this.spare ? [this.spare] : [])]
    for (const sessionId of targets) {
      try { await this.request('session/set_model', { sessionId, modelId }) }
      catch (error) { throw this.connected ? new Error(STUDY_TEXT.ACP_MODEL_INVALID) : error }
    }
    this.connection = { ...this.connection, model: modelId }
  }

  /** Ask the agent to stop; if it does not finish the turn within 3s the process is killed. */
  private cancel(): void {
    if (!this.activeSession || this.cancelling) return
    this.cancelling = true
    try { this.write({ jsonrpc: '2.0', method: 'session/cancel', params: { sessionId: this.activeSession } }) } catch {}
    this.cancelTimer = setTimeout(() => { void this.close(new Error(STUDY_TEXT.ACP_CANCELLED_RECONNECT)) }, 3000)
  }

  close(error = new Error(STUDY_TEXT.ACP_CLOSED)): Promise<void> {
    const child = this.child
    this.child = null
    for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(error) }
    this.pending.clear()
    this.sessions.clear()
    this.usage.clear()
    this.listener = null
    this.spare = null
    if (this.cancelTimer) clearTimeout(this.cancelTimer)
    this.cancelTimer = null
    if (child && !child.killed) child.kill()
    // 'close' fires only once the agent's handles (stdio, and on Windows its cwd) are released; a dead-looking pid is not enough.
    // Bounded so disconnect and quit never hang on an agent whose stdio a grandchild still holds.
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<void>(resolve => { timer = setTimeout(() => { try { child?.kill('SIGKILL') } catch {} resolve() }, 5000); timer.unref?.() })
    return Promise.race([this.exited, timeout]).finally(() => clearTimeout(timer))
  }
}

export class StudyConnections {
  private clients = new Map<string, AcpClient>()
  private connecting = new Map<string, Promise<StudyConnection>>()
  constructor(private store: StudyStore) {}

  snapshot() {
    const state = this.store.read()
    state.connections = state.connections.map(connection => ({ ...connection, status: this.clients.get(connection.id)?.connected ? 'ready' : connection.status === 'error' ? 'error' : 'disconnected' }))
    return state
  }

  hasSession(appSessionId: string): boolean {
    const id = this.store.read().activeConnectionId
    return !!id && !!this.clients.get(id)?.hasSession(appSessionId)
  }

  save(input: unknown): StudyConnection {
    const data = objectInput(input)
    if (!['claude', 'codex', 'antigravity', 'custom'].includes(data.kind as string)) throw new Error(STUDY_TEXT.CONNECTION_KIND_INVALID)
    if (!Array.isArray(data.args) || data.args.length > 40) throw new Error(STUDY_TEXT.CONNECTION_ARGS_INVALID)
    const id = data.id === undefined ? crypto.randomUUID() : idInput(data.id)
    const connection: StudyConnection = { id, kind: data.kind as StudyConnection['kind'], label: textInput(data.label, 100), command: textInput(data.command, 1000), args: data.args.map(arg => textInput(arg, 2000, true)), status: 'disconnected' }
    if (connection.args.some(arg => /[\0\r\n]/.test(arg))) throw new Error(STUDY_TEXT.CONNECTION_ARG_CHARACTERS)
    if (connection.args.some(arg => /^--?(api[-_]?key|token|password|secret)(=|$)/i.test(arg))) throw new Error(STUDY_TEXT.CONNECTION_SECRET_ARGUMENT)
    if (unsafeAcpArgs(connection.args)) throw new Error(STUDY_TEXT.CONNECTION_UNSAFE_ARGUMENT)
    if (data.model !== undefined && data.model !== '') {
      const model = textInput(data.model, 100)
      if (!/^[\w.:/-]+$/.test(model)) throw new Error(STUDY_TEXT.CONNECTION_MODEL_INVALID)
      connection.model = model
    }
    void this.disconnectClient(id)
    this.store.update(state => {
      const index = state.connections.findIndex(item => item.id === id)
      if (data.id !== undefined && index < 0) throw new Error(STUDY_TEXT.CONNECTION_MISSING)
      if (index < 0) state.connections.push(connection)
      else state.connections[index] = connection
    })
    return connection
  }

  async connect(value: unknown): Promise<StudyConnection> {
    const id = idInput(value)
    const existing = this.connecting.get(id)
    if (existing) return existing
    const pending = this.connectOnce(id)
    this.connecting.set(id, pending)
    try { return await pending } finally { this.connecting.delete(id) }
  }

  private async connectOnce(id: string): Promise<StudyConnection> {
    const connection = this.store.read().connections.find(item => item.id === id)
    if (!connection) throw new Error(STUDY_TEXT.ACP_SAVE_FIRST)
    void this.disconnectClient(id)
    const client = new AcpClient(connection, join(this.store.directory, 'study-agent-workspaces', id))
    this.clients.set(id, client)
    try {
      await client.initialize()
      if (connection.kind === 'antigravity') await client.probe()
      if (this.clients.get(id) !== client) throw new Error(STUDY_TEXT.ACP_CONNECT_CANCELLED)
      const ready: StudyConnection = { ...connection, status: 'ready', error: undefined, authMethods: connection.kind === 'antigravity' ? [] : client.authMethods }
      this.store.update(state => { state.connections[state.connections.findIndex(item => item.id === id)] = ready })
      return ready
    } catch (error) {
      if (this.clients.get(id) === client) this.clients.delete(id)
      await client.close()
      this.store.update(state => {
        const row = state.connections.find(item => item.id === id)
        if (row) { row.status = 'error'; row.error = error instanceof Error ? error.message : STUDY_TEXT.ACP_CONNECT_FAILED }
      })
      throw error
    }
  }

  async authenticate(input: unknown): Promise<StudyConnection> {
    const data = objectInput(input)
    const id = idInput(data.connectionId)
    const client = this.clients.get(id)
    if (!client) throw new Error(STUDY_TEXT.ACP_CONNECT_FOR_AUTH)
    await client.authenticate(textInput(data.methodId, 200))
    return this.store.read().connections.find(item => item.id === id)!
  }

  async disconnect(value: unknown): Promise<void> {
    const id = idInput(value)
    const exited = this.disconnectClient(id)
    this.store.update(state => {
      const connection = state.connections.find(item => item.id === id)
      if (!connection) throw new Error(STUDY_TEXT.CONNECTION_MISSING)
      connection.status = 'disconnected'
      if (state.activeConnectionId === id) state.activeConnectionId = null
    })
    await exited
  }

  /** Persist the model on the connection and apply it at once to a live agent. */
  async setModel(input: unknown): Promise<StudyConnection> {
    const data = objectInput(input)
    const id = idInput(data.connectionId)
    const model = textInput(data.model, 100)
    if (!/^[\w.:/-]+$/.test(model)) throw new Error(STUDY_TEXT.CONNECTION_MODEL_INVALID)
    if (!this.store.read().connections.some(item => item.id === id)) throw new Error(STUDY_TEXT.CONNECTION_MISSING)
    const client = this.clients.get(id)
    if (client?.connected) await client.setModel(model)
    this.store.update(state => { state.connections.find(item => item.id === id)!.model = model })
    return this.store.read().connections.find(item => item.id === id)!
  }

  async remove(value: unknown): Promise<void> {
    const id = idInput(value)
    const exited = this.disconnectClient(id)
    this.store.update(state => {
      if (!state.connections.some(item => item.id === id)) throw new Error(STUDY_TEXT.CONNECTION_MISSING)
      state.connections = state.connections.filter(item => item.id !== id)
      if (state.activeConnectionId === id) state.activeConnectionId = null
    })
    await exited
  }

  select(value: unknown): void {
    const id = value === null ? null : idInput(value)
    if (id && !this.clients.get(id)?.connected) throw new Error(STUDY_TEXT.ACP_CONNECT_FIRST)
    this.store.update(state => { state.activeConnectionId = id })
  }

  async prompt(appSessionId: string, text: string, signal: AbortSignal, onChunk: (text: string) => void) {
    const id = this.store.read().activeConnectionId
    if (!id) throw new Error(STUDY_TEXT.ACP_NOT_SELECTED)
    if (!this.clients.get(id)?.connected) await this.connect(id)
    return this.clients.get(id)!.prompt(appSessionId, text, signal, onChunk)
  }

  /** Kills at once; the promise settles when the agent has really exited (or after the 5s bound). */
  private disconnectClient(id: string): Promise<void> {
    const client = this.clients.get(id)
    this.clients.delete(id)
    return client ? client.close() : Promise.resolve()
  }
  async close(): Promise<void> { await Promise.all([...this.clients.keys()].map(id => this.disconnectClient(id))) }
}
