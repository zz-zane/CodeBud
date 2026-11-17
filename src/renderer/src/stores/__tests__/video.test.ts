import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { demoToVideo } from '../../../../shared/video'
import { VIDEO_UI } from '../../lib/copy'
import { useVideoStore } from '../video'
import { useAiAssistantStore } from '../ai-assistant'
import pointer from '../../../../../fixtures/video-pointer.json'
import type { ExplainerVideo } from '../../../../shared/video'

const api = { isRemote: true, video: { list: vi.fn().mockResolvedValue([]), delete: vi.fn().mockResolvedValue({ ok: true }),
  generate: vi.fn(), outline: vi.fn(), cancel: vi.fn(), onVerifyPrompt: vi.fn(), onProgress: vi.fn(), answerVerify: vi.fn() } }
beforeEach(() => { setActivePinia(createPinia()); vi.stubGlobal('window', { miai: api }); vi.clearAllMocks() })
afterEach(() => vi.unstubAllGlobals())

describe('video UI store', () => {
  it('adapts v2 videos for the unchanged library while retaining acts for playback', async () => {
    api.video.list.mockResolvedValueOnce([pointer])
    const store = useVideoStore()
    await store.refresh()
    expect(store.videos[0].scenes).toHaveLength(2)
    expect(store.videos[0].checks).toHaveLength(2)
    store.play(store.videos[0] as ExplainerVideo)
    expect(store.current?.acts).toHaveLength(2)
  })
  it('rejects the obsolete demo bridge and keeps remote generation disabled', async () => {
    const store = useVideoStore()
    const demo = demoToVideo({ title: 'demo', code: ['x'], steps: [{ say: 'x', at: 1, vars: [] }] }, 'common-01', 'demo')
    store.play(demo)
    expect(store.current).toBeNull()
    await store.generate({ question: 'question' })
    expect(store.error).toBe(VIDEO_UI.PHONE_GENERATE)
    expect(api.video.generate).not.toHaveBeenCalled()
    await store.remove('video-id')
    expect(api.video.delete).toHaveBeenCalledWith('video-id')
  })

  it('does not add builtin hit into user library list when generating', async () => {
    vi.stubGlobal('window', { miai: api, addEventListener: vi.fn(), removeEventListener: vi.fn() })
    const session = { id: 's1', title: 'test', messages: [] as unknown[], createdAt: 0, updatedAt: 0 }
    const aiStore = useAiAssistantStore()
    vi.spyOn(aiStore, 'init').mockResolvedValue(undefined)
    vi.spyOn(aiStore, 'saveSessions').mockResolvedValue(undefined)
    aiStore.sessions.push(session as never)
    aiStore.currentSessionId = 's1'
    api.isRemote = false
    api.video.generate.mockResolvedValueOnce({
      ok: true,
      video: { ...pointer, id: 'c-pointer-basics', source: 'builtin' }
    })
    const store = useVideoStore()
    await store.generate({ question: '我分不清 p 和 *p' })
    expect(store.videos).toHaveLength(0)
    expect(session.messages).toHaveLength(2)
  })
})
