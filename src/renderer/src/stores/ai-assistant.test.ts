import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAiAssistantStore } from './ai-assistant'
import { useRunnerStore } from './runner'
import { useSettingsStore } from './settings'
import { AI_ASSISTANT } from '../lib/copy'
// 课程表：c-01 / c-02 可用，c-draft 是还没写正文的课；其余 id 一律查无此课
const { LESSONS } = vi.hoisted(() => ({ LESSONS: {
  'c-01': { id: 'c-01', title: 'A', lang: 'c', body: 'pointer lesson body ' + 'x'.repeat(2000) },
  'c-02': { id: 'c-02', title: 'B', lang: 'c', body: 'array lesson body' },
  'py-1': { id: 'py-1', title: 'P', lang: 'python', body: 'print wrong lang line' },
  'java-1': { id: 'java-1', title: 'J', lang: 'java', body: 'print wrong lang line' },
  'common-1': { id: 'common-1', title: 'C', lang: 'common', body: 'print wrong lang line' },
  'algo-1': { id: 'algo-1', title: 'algorithm', lang: 'common', body: 'algorithm lesson body' },
  'c-draft': { id: 'c-draft', title: 'D', lang: 'c', body: '' }
} as Record<string, { id: string; title: string; lang: string; body: string }> }))
const { SEARCH_INDEX } = vi.hoisted(() => ({ SEARCH_INDEX: ['py-1', 'java-1', 'common-1'].map((id) => ({
  id, title: id, text: 'print wrong lang line', tags: [], keywords: []
})) }))
const { contentStub } = vi.hoisted(() => ({ contentStub: { activeLang: 'common' as string } }))
vi.mock('./content', () => ({ useContentStore: () => Object.assign(contentStub, {
  bundle: { searchIndex: SEARCH_INDEX }, algoBundle: { searchIndex: [] },
  lessonOf: (id: string) => LESSONS[id],
  statusOf: (id: string) => (id === 'c-draft' ? 'draft' : 'open')
}) }))
import type { AiChatSendPayload, AiChatSession, AiChatStreamEvent } from '../../../shared/types'
import { ensureMainSession } from '../../../shared/study-companion'

describe('assistant turn ownership', () => {
  let listener: (event: AiChatStreamEvent) => void
  let sends: AiChatSendPayload[]
  let settle: () => void
  let saves: any[]
  beforeEach(() => {
    setActivePinia(createPinia()); sends=[]; saves=[]
    vi.stubGlobal('window', { miai: { aiAssistant: {
      getSessions: async () => [], onStream: (f: typeof listener) => {listener=f; return () => {}},
      saveSessions: async (v: any) => {saves.push(v); return {ok:true}},
      send: (p: AiChatSendPayload) => { sends.push(p); return new Promise<void>(r => {settle=r}) }, cancel: async () => ({ok:true})
    } } })
  })
  it('sends and persists attachment-only messages and retries without consuming a newer draft', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const store = useAiAssistantStore(); await store.init()
    useSettingsStore().config.ai.model = 'gpt-5'
    store.reasoningEffort = 'xhigh'
    store.addAttachment({ id: 'text', name: 'code.py', size: 5, kind: 'file', textContent: 'hello', path: 'private-path' })
    store.addAttachment({ id: 'image', name: 'photo.png', size: 42, kind: 'image', previewUrl: 'blob:test' })
    expect(store.sendDraft()).toBe(true)
    await vi.waitFor(() => expect(sends.length).toBe(1))
    const attachments = [
      { id: 'text', name: 'code.py', size: 5, kind: 'file', textContent: 'hello' },
      { id: 'image', name: 'photo.png', size: 42, kind: 'image' }
    ]
    expect(sends[0].reasoningEffort).toBe('xhigh')
    expect(sends[0].attachments).toEqual(attachments)
    expect(saves.at(-1)[0].messages[0]).toMatchObject({ reasoningEffort: 'xhigh', attachments })
    expect(store.pendingAttachments).toEqual([])
    expect(revoke).toHaveBeenCalledWith('blob:test')
    listener({ type: 'error', turnId: sends[0].turnId, sessionId: sends[0].sessionId, error: 'failed' })
    settle(); await Promise.resolve()
    store.reasoningEffort = 'low'
    store.addAttachment({ id: 'next', name: 'next.txt', size: 1, kind: 'file', textContent: 'n' })
    const retry = store.retryLastMessage()
    await vi.waitFor(() => expect(sends.length).toBe(2))
    expect(sends[1]).toMatchObject({ reasoningEffort: 'xhigh', attachments })
    expect(store.pendingAttachments.map(a => a.id)).toEqual(['next'])
    expect(store.reasoningEffort).toBe('xhigh')
    listener({ type: 'done', turnId: sends[1].turnId, sessionId: sends[1].sessionId, fullText: 'ok' })
    settle(); await retry
    revoke.mockRestore()
  })

  it('does not send a hidden GPT effort after switching to a DeepSeek model', async () => {
    const store = useAiAssistantStore(); await store.init()
    const settings = useSettingsStore()
    settings.config.ai.model = 'gpt-5'
    store.reasoningEffort = 'xhigh'
    const first = store.sendMessage('gpt')
    await vi.waitFor(() => expect(sends.length).toBe(1))
    expect(sends[0].reasoningEffort).toBe('xhigh')
    listener({ type: 'done', turnId: sends[0].turnId, sessionId: sends[0].sessionId, fullText: 'ok' })
    settle(); await first
    settings.config.ai.model = 'deepseek-chat'
    const next = store.sendMessage('deepseek')
    await vi.waitFor(() => expect(sends.length).toBe(2))
    expect(sends[1].reasoningEffort).toBeUndefined()
    expect(store.currentMessages.at(-1)?.reasoningEffort).toBeUndefined()
    listener({ type: 'done', turnId: sends[1].turnId, sessionId: sends[1].sessionId, fullText: 'ok' })
    settle(); await next
  })

  it('keeps newly added attachments while a queued send waits for cancellation', async () => {
    const store = useAiAssistantStore(); await store.init()
    const settings = useSettingsStore(); settings.config.ai.model = 'gpt-5'; store.reasoningEffort = 'xhigh'
    const first = store.sendMessage('first')
    await vi.waitFor(() => expect(sends.length).toBe(1))
    const canceled = store.cancelStream()
    store.addAttachment({ id: 'sent', name: 'sent.txt', size: 1, kind: 'file', textContent: 'a' })
    const next = store.sendMessage('next')
    store.addAttachment({ id: 'later', name: 'later.txt', size: 1, kind: 'file', textContent: 'b' })
    settings.config.ai.model = 'deepseek-chat'
    settle(); await Promise.all([first, canceled])
    await vi.waitFor(() => expect(sends.length).toBe(2))
    expect(sends[1].attachments?.map(a => a.id)).toEqual(['sent'])
    expect(sends[1].reasoningEffort).toBeUndefined()
    expect(store.pendingAttachments.map(a => a.id)).toEqual(['later'])
    listener({ type: 'done', turnId: sends[1].turnId, sessionId: sends[1].sessionId, fullText: 'ok' })
    settle(); await next
  })
  it('persists a question before send and ignores canceled late events after switching', async () => {
    const store=useAiAssistantStore(); await store.init()
    store.tutoringAction = 'hint'
    const firstSession=store.currentSessionId
    store.addContextTag({id:'selection',type:'selection',title:'source',content:'text'})
    const sending=store.sendMessage('first')
    await vi.waitFor(() => expect(sends.length).toBe(1))
    expect(saves.at(-1)[0].messages[0].content).toBe('first')
    expect(saves.at(-1)[0].messages[0].tutoringAction).toBe('hint')
    const first=sends[0]
    expect(() => structuredClone(first)).not.toThrow()
    store.newSession(); const secondSession=store.currentSessionId
    const sending2=store.sendMessage('second')
    await Promise.resolve(); expect(sends.length).toBe(1)
    listener({type:'done',turnId:first.turnId,sessionId:firstSession,fullText:'late'})
    settle(); await sending
    await vi.waitFor(() => expect(sends.length).toBe(2))
    const second=sends[1]
    listener({type:'done',turnId:first.turnId,sessionId:firstSession,fullText:'late'})
    listener({type:'done',turnId:second.turnId,sessionId:secondSession,fullText:'real'})
    settle(); await sending2
    expect(store.sessions.find(s=>s.id===firstSession)?.messages.map(m=>m.content)).toEqual(['first',''])
    expect(store.currentMessages.map(m=>m.content)).toEqual(['second','real'])
    expect(store.currentSession?.cliSessionReady).toBe(true)
  })
  it('rejects a late event for the same session after a retry starts', async () => {
    const store=useAiAssistantStore(); await store.init()
    const firstSend=store.sendMessage('first')
    await vi.waitFor(() => expect(sends.length).toBe(1))
    const first=sends[0]
    const stopping=store.cancelStream()
    const nextSend=store.sendMessage('retry')
    settle(); await Promise.all([firstSend,stopping])
    await vi.waitFor(() => expect(sends.length).toBe(2))
    const second=sends[1]
    listener({type:'done',turnId:first.turnId,sessionId:first.sessionId,fullText:'late'})
    expect(store.currentMessages.some(m=>m.content==='late')).toBe(false)
    listener({type:'done',turnId:second.turnId,sessionId:second.sessionId,fullText:'fresh'})
    settle(); await nextSend
    expect(store.currentMessages.at(-1)?.content).toBe('fresh')
  })

  it('keeps a new draft when retry waits for a canceled turn to finish', async () => {
    const store = useAiAssistantStore(); await store.init()
    const first = store.sendMessage('first')
    await vi.waitFor(() => expect(sends.length).toBe(1))
    const cancel = store.cancelStream()
    const retry = store.retryLastMessage()
    store.draft = 'keep this draft'
    expect(store.sendDraft()).toBe(false)
    expect(store.draft).toBe('keep this draft')
    settle(); await Promise.all([first, cancel])
    await vi.waitFor(() => expect(sends.length).toBe(2))
    settle(); await retry
  })

  it('keeps a queued draft when switching sessions before cancellation finishes', async () => {
    const store = useAiAssistantStore(); await store.init()
    const first = store.sendMessage('first')
    await vi.waitFor(() => expect(sends.length).toBe(1))
    const cancel = store.cancelStream()
    store.draft = 'queued draft'
    expect(store.sendDraft()).toBe(true)
    store.newSession()
    settle(); await Promise.all([first, cancel]); await Promise.resolve()
    expect(store.draft).toBe('queued draft')
    expect(sends.length).toBe(1)
  })

})


// ── DESIGN CLAUDE-v1 §6.1（S9，实施阻断）+ ACCEPTANCE T 组 ──────────────────
describe('init idempotency and main-workspace state', () => {
  const disk = () => [
    { id: 'a', title: 'A', createdAt: 1, updatedAt: 1, messages: [] },
    { id: 'b', title: 'B', createdAt: 2, updatedAt: 2, messages: [] }
  ]
  let getSessions: ReturnType<typeof vi.fn>
  let onStream: ReturnType<typeof vi.fn>
  let listener: (event: AiChatStreamEvent) => void
  let sends: AiChatSendPayload[]
  beforeEach(() => {
    setActivePinia(createPinia()); sends = []
    getSessions = vi.fn(async () => disk())
    onStream = vi.fn((f: typeof listener) => { listener = f; return () => {} })
    vi.stubGlobal('window', { miai: { aiAssistant: {
      getSessions, onStream,
      saveSessions: async () => ({ ok: true }),
      send: (p: AiChatSendPayload) => { sends.push(p); return new Promise<void>(() => {}) },
      cancel: async () => ({ ok: true })
    } } })
  })

  it('S9: concurrent init reads disk once and subscribes once', async () => {
    const store = useAiAssistantStore()
    await Promise.all([store.init(), store.init()])
    await store.init()
    expect(getSessions).toHaveBeenCalledTimes(1)
    expect(onStream).toHaveBeenCalledTimes(1)
    expect(store.sessions.map((s) => s.id)).toEqual(['study-main', 'a', 'b'])
    expect(store.currentSessionId).toBe('study-main')
  })

  it('S9: init after selectSession(b) keeps b', async () => {
    const store = useAiAssistantStore()
    await store.init()
    store.selectSession('b')
    for (let i = 0; i < 10; i++) await store.init()
    expect(store.currentSessionId).toBe('b')
  })

  it('S9: init during a stream leaves stream, draft and tags untouched', async () => {
    const store = useAiAssistantStore()
    await store.init()
    store.selectSession('b')
    store.draft = 'next question'
    store.setLessonContext('c-01')
    void store.sendMessage('hi')
    await vi.waitFor(() => expect(sends.length).toBe(1))
    listener({ type: 'chunk', turnId: sends[0].turnId, sessionId: 'b', text: 'par' })
    await store.init()
    expect(store.isStreaming).toBe(true)
    expect(store.streamingText).toBe('par')
    expect(store.currentSessionId).toBe('b')
    expect(store.draft).toBe('next question')
    expect(store.lessonContextId).toBe('c-01')
    store.selectSession('b')
    expect(store.isStreaming).toBe(true)
    expect(store.streamingText).toBe('par')
  })

  it('S9: a failed first load can be retried, without wiping memory', async () => {
    getSessions.mockRejectedValueOnce(new Error('disk'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const store = useAiAssistantStore()
    await store.init()
    expect(store.sessions).toEqual([])
    await store.init()
    expect(getSessions).toHaveBeenCalledTimes(2)
    expect(store.sessions.map((s) => s.id)).toEqual(['study-main', 'a', 'b'])
    warn.mockRestore()
  })

  it('S9: sessions created before the disk load are kept and disk history is merged, not dropped', async () => {
    let release!: () => void
    getSessions.mockImplementationOnce(() => new Promise((r) => { release = () => r(disk()) }))
    const saved: string[][] = []
    window.miai.aiAssistant.saveSessions = vi.fn(async (sessions) => { saved.push(sessions.map((s: { id: string }) => s.id)); return { ok: true } })
    const store = useAiAssistantStore()
    const loading = store.init()
    store.newSession()
    const early = store.currentSessionId
    await Promise.resolve()
    expect(saved).toEqual([])
    release(); await loading
    await vi.waitFor(() => expect(saved.length).toBeGreaterThan(0))
    expect(store.currentSessionId).toBe(early)
    expect(store.sessions.map((s) => s.id)).toEqual([early, 'study-main', 'a', 'b'])
    expect(saved.at(-1)).toEqual([early, 'study-main', 'a', 'b'])
  })

  it('T: setLessonContext replaces, removes, and refuses draft or unknown lessons', async () => {
    const store = useAiAssistantStore(); await store.init()
    store.setLessonContext('c-01')
    store.setLessonContext('c-02')
    expect(store.contextTags.filter((t) => t.type === 'lesson').map((t) => t.id)).toEqual(['lesson-c-02'])
    store.setLessonContext('c-draft')
    expect(store.contextTags.some((t) => t.type === 'lesson')).toBe(false)
    store.setLessonContext('c-01'); store.setLessonContext('nope')
    expect(store.lessonContextId).toBe(null)
    store.setLessonContext('c-01'); store.setLessonContext(null)
    expect(store.contextTags).toEqual([])
  })

  it('includes a bounded body excerpt for both ordinary and algorithm lessons', async () => {
    const store = useAiAssistantStore(); await store.init()
    store.setLessonContext('c-01')
    expect(store.contextTags[0].content).toBe(LESSONS['c-01'].title + '\n' + LESSONS['c-01'].body.slice(0, 1500))
    store.setLessonContext('algo-1')
    expect(store.contextTags[0].content).toBe('algorithm\nalgorithm lesson body')
  })

  it('T: openWithSelection with a lessonId keeps exactly one lesson tag, and can skip opening the rail', async () => {
    const store = useAiAssistantStore(); await store.init()
    store.setLessonContext('c-02')
    store.openWithSelection({ text: 'sel', lessonId: 'c-01', lessonTitle: '\u6307\u9488\u5165\u95e8', openRail: false })
    expect(store.contextTags.filter((t) => t.type === 'lesson').map((t) => t.id)).toEqual(['lesson-c-01'])
    expect(store.contextTags.some((t) => t.type === 'selection')).toBe(true)
    expect(store.isOpen).toBe(false)
    expect(sends.length).toBe(0)
  })

  it('sends the captured selection and lesson even if tags change during navigation', async () => {
    const store = useAiAssistantStore(); await store.init()
    const tags = store.openWithSelection({ text: 'selected original', lessonId: 'c-01', action: 'explain', openRail: false, deferSend: true })
    store.clearContextTags()
    store.addContextTag({ id: 'later', type: 'selection', title: 'later', content: 'new selection' })
    void store.sendMessage('explain', tags)
    await vi.waitFor(() => expect(sends.length).toBe(1))
    expect(sends[0].contextTags?.map(tag => tag.content)).toEqual([tags[0].content, 'selected original'])
    expect(store.currentMessages[0].contextTags).toEqual(tags)
    expect(store.contextTags.map(tag => tag.id)).toEqual(['later'])
  })

  it('T: the lesson background survives the four-tag cap', async () => {
    const store = useAiAssistantStore(); await store.init()
    store.setLessonContext('c-01')
    for (let i = 0; i < 5; i++) store.addContextTag({ id: 's' + i, type: 'selection', title: 't', content: 'c' + i })
    expect(store.contextTags.length).toBe(4)
    expect(store.lessonContextId).toBe('c-01')
  })

  it('T: draft clears only when a send is accepted, and survives session switches', async () => {
    const store = useAiAssistantStore(); await store.init()
    store.draft = 'keep me'
    store.selectSession('b'); store.newSession()
    expect(store.draft).toBe('keep me')
    expect(store.sendDraft()).toBe(true)
    await vi.waitFor(() => expect(store.draft).toBe(''))
    await vi.waitFor(() => expect(sends.length).toBe(1))
    store.draft = 'while streaming'
    expect(store.sendDraft()).toBe(false)
    expect(store.draft).toBe('while streaming')
    expect(sends.length).toBe(1)
  })

  it('T: returnTarget is cleared by newSession and by deleting that session', async () => {
    const store = useAiAssistantStore(); await store.init()
    store.selectSession('b'); store.markReturnTarget()
    expect(store.returnTarget).toEqual({ sessionId: 'b', title: 'B' })
    store.newSession()
    expect(store.returnTarget).toBe(null)
    store.selectSession('a'); store.markReturnTarget()
    store.deleteSession('a')
    expect(store.returnTarget).toBe(null)
  })

  it('T: attachRunFailure adds clipped code + error tags once per run and never sends', async () => {
    const store = useAiAssistantStore(); await store.init()
    const fail = { fp: 'fp1', langLabel: 'Python', code: 'x'.repeat(5000), errorTitle: '', errorText: 'e'.repeat(3000), lessonId: 'c-01' }
    store.attachRunFailure(fail)
    store.attachRunFailure(fail)
    const code = store.contextTags.find((t) => t.id === 'run-code-fp1')!
    const err = store.contextTags.find((t) => t.id === 'run-error-fp1')!
    expect(code.content.length).toBeLessThanOrEqual(4000)
    expect(code.content.endsWith('…（\u5df2\u622a\u65ad）')).toBe(true)
    expect(err.content.length).toBeLessThanOrEqual(2000)
    expect(err.title).toBe('\u8fd0\u884c\u62a5\u9519')
    expect(store.contextTags.filter((t) => t.id.startsWith('run-')).length).toBe(2)
    expect(store.lessonContextId).toBe('c-01')
    expect(sends.length).toBe(0)
  })
})

describe('session title normalization', () => {
  it('normalizes legacy "New session" title to AI_ASSISTANT.DEFAULT_SESSION_TITLE', async () => {
    setActivePinia(createPinia())
    vi.stubGlobal('window', {
      miai: {
        aiAssistant: {
          getSessions: async () => [
            { id: 'old-1', title: 'New session', messages: [], createdAt: 1, updatedAt: 1 },
            { id: 'custom-2', title: 'my-custom-title', messages: [], createdAt: 2, updatedAt: 2 }
          ],
          onStream: () => () => {},
          saveSessions: async () => ({ ok: true })
        }
      }
    })
    const store = useAiAssistantStore()
    await store.init()
    expect(store.sessions.find((s) => s.id === 'old-1')?.title).toBe(AI_ASSISTANT.DEFAULT_SESSION_TITLE)
    expect(store.sessions.find((s) => s.id === 'custom-2')?.title).toBe('my-custom-title')
  })
})

// P0-6：没有课程标签 + activeLang 是默认 common 时，不能退化成「不按语言过滤」。
// 实测过的原始 bug：问 Python 问题，推荐里混进 C 的「printf 与 scanf」和 Java 的「Scanner 与 println」。
describe('P0-6 course references filtered by language', () => {
  const makeWindow = () => vi.stubGlobal('window', {
    miai: { aiAssistant: {
      getSessions: async () => [],
      onStream: () => () => {},
      saveSessions: async () => ({ ok: true }),
      send: async () => {},
      cancel: async () => ({ ok: true })
    } }
  })

  // Real bug shape: asking about Python recommended C printf / Java Scanner.
  // With activeLang defaulting to common it degraded to no filtering; all three bodies contain print.
  it('falls back to the runner language when activeLang is still common', async () => {
    setActivePinia(createPinia())
    makeWindow()
    contentStub.activeLang = 'common'
    const runner = useRunnerStore()
    runner.setLang('python')
    const store = useAiAssistantStore()
    await store.init()
    await store.sendMessage('print wrong lang line')
    const refs = store.currentSession?.messages.find(m => m.role === 'user')?.references ?? []
    const ids = refs.map(r => r.lessonId)
    expect(ids).toContain('py-1')
    expect(ids).toContain('common-1')
    expect(ids).not.toContain('java-1')
  })

  it('filters by the explicitly selected language', async () => {
    setActivePinia(createPinia())
    makeWindow()
    contentStub.activeLang = 'java'
    const store = useAiAssistantStore()
    await store.init()
    await store.sendMessage('print wrong lang line')
    const ids = (store.currentSession?.messages.find(m => m.role === 'user')?.references ?? []).map(r => r.lessonId)
    expect(ids).toContain('java-1')
    expect(ids).not.toContain('py-1')
    contentStub.activeLang = 'common'
  })
})

describe('phone and desktop chat synchronization', () => {
  let shared: AiChatSession[]
  let streams: Array<(event: AiChatStreamEvent) => void>
  let changes: Set<() => void>
  let sends: AiChatSendPayload[]
  let writes: number
  const notify = () => { for (const callback of changes) callback() }

  beforeEach(() => {
    shared = ensureMainSession([{ id: 'topic', title: 'Existing topic', createdAt: 1, updatedAt: 1, messages: [] }])
    streams = []; changes = new Set(); sends = []; writes = 0
    vi.stubGlobal('window', { miai: { aiAssistant: {
      getSessions: async () => structuredClone(shared),
      onStream: (cb: (event: AiChatStreamEvent) => void) => { streams.push(cb); return () => {} },
      onSessionsChanged: (cb: () => void) => { changes.add(cb); return () => { changes.delete(cb) } },
      saveSessions: async (value: AiChatSession[]) => {
        writes++
        shared = ensureMainSession(structuredClone(value), shared)
        notify()
        return { ok: true }
      },
      send: async (payload: AiChatSendPayload) => { sends.push(payload) }, cancel: async () => ({ ok: true })
    } } })
  })

  async function client() {
    setActivePinia(createPinia())
    const store = useAiAssistantStore()
    await store.init()
    return store
  }

  it('sends from an HTTP phone browser without crypto.randomUUID and syncs to desktop', async () => {
    const desktop = await client()
    const phone = await client()
    const secureCrypto = globalThis.crypto
    vi.stubGlobal('crypto', { getRandomValues: secureCrypto.getRandomValues.bind(secureCrypto) })
    try {
      phone.draft = 'question over LAN HTTP'
      await expect(phone.sendMessage(phone.draft)).resolves.toBeUndefined()
      await vi.waitFor(() => expect(desktop.currentMessages.at(-1)?.content).toBe('question over LAN HTTP'))
      expect(sends).toHaveLength(1)
      expect(sends[0].turnId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
      expect(sends[0].cliSessionId).not.toBe(sends[0].turnId)
      phone.newSession()
      expect(phone.currentSessionId).not.toBe('study-main')
    } finally {
      vi.stubGlobal('crypto', secureCrypto)
      desktop.$dispose(); phone.$dispose()
    }
  })

  it('syncs phone questions and persisted replies without duplicate replies or save loops', async () => {
    const desktop = await client()
    const phone = await client()
    desktop.draft = 'unsent desktop draft'
    await phone.sendMessage('question from phone')
    await vi.waitFor(() => expect(desktop.currentMessages[0]?.content).toBe('question from phone'))
    const turn = sends[0]
    streams[1]({ type: 'chunk', turnId: turn.turnId, sessionId: turn.sessionId, text: 'partial' })
    expect(phone.streamingText).toBe('partial')
    shared[0].messages.push({ id: turn.turnId, role: 'assistant', content: 'persisted reply', createdAt: Date.now() })
    notify()
    await vi.waitFor(() => expect(desktop.currentMessages.at(-1)?.content).toBe('persisted reply'))
    expect(phone.isStreaming).toBe(true)
    streams[1]({ type: 'done', turnId: turn.turnId, sessionId: turn.sessionId, fullText: 'persisted reply' })
    await vi.waitFor(() => expect(writes).toBe(2))
    await vi.waitFor(() => expect(phone.isStreaming).toBe(false))
    expect(phone.currentMessages.filter(message => message.id === turn.turnId)).toHaveLength(1)
    expect(desktop.currentMessages.filter(message => message.id === turn.turnId)).toHaveLength(1)
    expect(desktop.draft).toBe('unsent desktop draft')
    expect(desktop.isStreaming).toBe(false)
    expect(changes.size).toBe(2)
    desktop.$dispose(); phone.$dispose()
    expect(changes.size).toBe(0)
  })

  it('preserves the desktop topic, draft, context and active stream while syncing', async () => {
    const desktop = await client()
    const phone = await client()
    desktop.selectSession('topic')
    await desktop.sendMessage('local topic question')
    await vi.waitFor(() => expect(phone.sessions.find(session => session.id === 'topic')?.messages).toHaveLength(1))
    const localTurn = sends[0]
    streams[0]({ type: 'chunk', turnId: localTurn.turnId, sessionId: localTurn.sessionId, text: 'local partial' })
    desktop.draft = 'keep my draft'
    desktop.addContextTag({ id: 'selection', type: 'selection', title: 'Selection', content: 'keep my context' })
    await phone.sendMessage('phone main question')
    await vi.waitFor(() => expect(desktop.mainSession?.messages.at(-1)?.content).toBe('phone main question'))
    expect(desktop.currentSessionId).toBe('topic')
    expect(desktop.currentMessages[0].content).toBe('local topic question')
    expect(desktop.draft).toBe('keep my draft')
    expect(desktop.contextTags[0].content).toBe('keep my context')
    expect(desktop.streamingText).toBe('local partial')
    expect(desktop.isStreaming).toBe(true)
    desktop.$dispose(); phone.$dispose()
  })

  it('rejects a stale refresh snapshot when a local message is sent during the read', async () => {
    const desktop = await client()
    shared[0].messages.push({ id: 'remote-message', role: 'user', content: 'remote question', createdAt: 1 })
    const stale = structuredClone(shared)
    let release!: (sessions: AiChatSession[]) => void
    const original = window.miai.aiAssistant.getSessions
    const get = vi.fn().mockImplementationOnce(() => new Promise<AiChatSession[]>(resolve => { release = resolve }))
      .mockImplementation(original)
    window.miai.aiAssistant.getSessions = get
    notify()
    await vi.waitFor(() => expect(get).toHaveBeenCalledTimes(1))
    await desktop.sendMessage('new local question')
    release(stale)
    await vi.waitFor(() => expect(get.mock.calls.length).toBeGreaterThanOrEqual(2))
    await vi.waitFor(() => expect(desktop.currentMessages.map(message => message.content)).toEqual(['remote question', 'new local question']))
    expect(writes).toBe(1)
    desktop.$dispose()
  })
})
