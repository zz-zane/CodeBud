import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { randomUUID } from 'node:crypto'
import { get as httpGet } from 'node:http'
import { IPC } from '../../shared/ipc-channels'
import { DEFAULT_APP_CONFIG, type AiChatSendPayload, type AiChatSession, type AiChatStreamEvent } from '../../shared/types'
import { ensureMainSession } from '../../shared/study-companion'
import type { MainContext } from '../context'
import { StudyStore } from '../study/store'
import { aiChatFeature } from '../features/ai-chat'
import { createDeviceRegistry } from '../remote/devices'
import { createRemoteServer } from '../remote/server'

const { handlers } = vi.hoisted(() => ({ handlers: new Map<string, (...args: any[]) => any>() }))
vi.mock('../ipc', () => ({ handle: (channel: string, fn: (...args: any[]) => any) => handlers.set(channel, fn) }))

const root = resolve(tmpdir(), 'miai-chat-sync-tests')
let dir: string
let notify: ReturnType<typeof vi.fn>
const load = (): AiChatSession[] => JSON.parse(readFileSync(join(dir, 'ai-sessions.json'), 'utf8'))
const invoke = (channel: string, event: unknown, ...args: unknown[]) => handlers.get(channel)!(event, ...args)

beforeEach(() => {
  mkdirSync(root, { recursive: true })
  dir = mkdtempSync(join(root, 'case-'))
  handlers.clear()
  notify = vi.fn()
  const ctx = {
    storageDir: dir, studyMathPath: 'unused', notifyChatSessionsChanged: notify,
    readConfig: () => ({ ...DEFAULT_APP_CONFIG, ai: { ...DEFAULT_APP_CONFIG.ai, apiKey: 'test-key' } }),
    study: {
      store: new StudyStore(dir), connections: {}, lessonIds: new Set(), generateLearningPlan: vi.fn(),
      harness: {
        getSessionHistory: () => [], replaceLastAssistantMessage: vi.fn(),
        runTurn: vi.fn(async ({ onChunk }: { onChunk: (text: string) => void }) => { onChunk('reply'); return { ok: true, data: { text: 'reply' } } })
      }
    }
  } as unknown as MainContext
  aiChatFeature.register(ctx)
})

afterEach(() => {
  if (!resolve(dir).startsWith(root + sep)) throw new Error('Invalid cleanup path')
  rmSync(dir, { recursive: true, force: true })
})

function seedQuestion(sessionId = 'study-main'): AiChatSendPayload {
  const session = { id: sessionId, title: 'Topic', createdAt: 1, updatedAt: 2,
    messages: [{ id: randomUUID(), role: 'user' as const, content: 'mobile question', createdAt: 2 }] }
  invoke(IPC.aiSessionsSave, {}, ensureMainSession([session]))
  return { sessionId, turnId: randomUUID(), cliSessionId: randomUUID(), isResume: false, userMessage: 'mobile question' }
}

describe('shared chat persistence', () => {
  it('真实手机 HTTP 保存会通知电脑；手机事件流断开后回复仍可从电脑读取', async () => {
    const rendererDir = join(dir, 'renderer')
    mkdirSync(rendererDir)
    writeFileSync(join(rendererDir, 'index.html'), 'app')
    const remote = createRemoteServer({
      devices: createDeviceRegistry({ read: () => null, write: () => {} }), rendererDir, assets: new Map(),
      lookupHandler: channel => handlers.has(channel) ? (event, args) => invoke(channel, event, ...args) : undefined
    })
    const result = await remote.start(0, '127.0.0.1')
    if (!result.ok) throw new Error('start failed')
    const base = `http://127.0.0.1:${result.port}`
    const chunks: string[] = []
    let disconnect: (() => void) | undefined
    try {
      const pair = await fetch(base + '/pair', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ code: remote.pairingCode() }) })
      expect(pair.status).toBe(200)
      const cookie = pair.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
      const rpc = async (channel: string, args: unknown[]) => {
        const response = await fetch(base + '/rpc', { method: 'POST', headers: { Origin: base, Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ channel, args }) })
        expect(response.status).toBe(200)
        return response.json()
      }
      await new Promise<void>((resolveStream, reject) => {
        const request = httpGet(base + '/events', { headers: { Cookie: cookie } }, response => {
          response.setEncoding('utf8')
          response.on('data', chunk => chunks.push(chunk))
          disconnect = () => request.destroy()
          resolveStream()
        })
        request.on('error', reject)
      })
      notify.mockImplementation(() => remote.broadcast(IPC.aiSessionsChanged, null))
      const question: AiChatSession = { id: 'study-main', title: 'Main', createdAt: 1, updatedAt: 2,
        messages: [{ id: randomUUID(), role: 'user', content: 'from HTTP phone', createdAt: 2 }] }
      expect(await rpc(IPC.aiSessionsSave, [ensureMainSession([question])])).toMatchObject({ ok: true, data: { ok: true } })
      await vi.waitFor(() => expect(chunks.join('')).toContain(IPC.aiSessionsChanged))
      disconnect!()
      const payload: AiChatSendPayload = { sessionId: 'study-main', turnId: randomUUID(), cliSessionId: randomUUID(), isResume: false, userMessage: 'from HTTP phone' }
      expect(await rpc(IPC.aiChatSend, [payload])).toMatchObject({ ok: true })
      const desktop = invoke(IPC.aiSessionsGet, {}) as AiChatSession[]
      expect(desktop[0].messages.map(message => message.content)).toEqual(['from HTTP phone', 'reply'])
      expect(notify).toHaveBeenCalledTimes(2)
    } finally {
      disconnect?.()
      await remote.stop()
    }
  })

  it('保存提问后通知其它界面刷新，并保留旧主聊天消息', () => {
    seedQuestion()
    const previous = load()[0].messages[0]
    invoke(IPC.aiSessionsSave, {}, ensureMainSession([]))
    expect(notify).toHaveBeenCalledTimes(2)
    expect(load()[0].messages).toContainEqual(previous)
  })

  it.each(['study-main', 'topic'])('手机断开后，%s 的完整回复仍由主进程保存', async (kind) => {
    const payload = seedQuestion(kind === 'topic' ? randomUUID() : 'study-main')
    const send = vi.fn()
    await invoke(IPC.aiChatSend, { sender: { isDestroyed: () => true, send } }, payload)
    const session = load().find(item => item.id === payload.sessionId)!
    expect(session.messages.map(message => message.content)).toEqual(['mobile question', 'reply'])
    expect(session.messages[1].id).toBe(payload.turnId)
    expect(session.cliSessionReady).toBe(true)
    expect(send).not.toHaveBeenCalled()
    expect(notify).toHaveBeenCalledTimes(2)
  })

  it('回复在 done 推送前已落盘；发起端再保存不会生成重复回复', async () => {
    const payload = seedQuestion()
    const send = vi.fn((channel: string, event: AiChatStreamEvent) => {
      expect(channel).toBe(IPC.aiChatStream)
      if (event.type === 'done') expect(load()[0].messages.at(-1)?.content).toBe(event.fullText)
    })
    await invoke(IPC.aiChatSend, { sender: { isDestroyed: () => false, send } }, payload)
    expect(send.mock.calls.some(([, event]) => event.type === 'done')).toBe(true)
    invoke(IPC.aiSessionsSave, {}, load())
    expect(load()[0].messages.filter(message => message.id === payload.turnId)).toHaveLength(1)
  })

  it('聊天文件损坏时拒绝覆盖，不把旧历史重置为空', () => {
    writeFileSync(join(dir, 'ai-sessions.json'), '{broken')
    expect(() => invoke(IPC.aiSessionsGet, {})).toThrow()
    expect(readFileSync(join(dir, 'ai-sessions.json'), 'utf8')).toBe('{broken')
    expect(notify).not.toHaveBeenCalled()
  })
})
