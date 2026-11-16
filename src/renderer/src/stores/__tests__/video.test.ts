import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { demoToVideo } from '../../../../shared/video'
import { VIDEO_UI } from '../../lib/copy'
import { useVideoStore } from '../video'

const api = { isRemote: true, video: { list: vi.fn().mockResolvedValue([]), delete: vi.fn().mockResolvedValue({ ok: true }),
  generate: vi.fn(), outline: vi.fn(), cancel: vi.fn(), onVerifyPrompt: vi.fn(), answerVerify: vi.fn() } }
beforeEach(() => { setActivePinia(createPinia()); vi.stubGlobal('window', { miai: api }); vi.clearAllMocks() })
afterEach(() => vi.unstubAllGlobals())

describe('video UI store', () => {
  it('keeps mobile playback and deletion but does not call generation', async () => {
    const store = useVideoStore()
    const demo = demoToVideo({ title: 'demo', code: ['x'], steps: [{ say: 'x', at: 1, vars: [] }] }, 'common-01', 'demo')
    store.play(demo)
    expect(store.current?.id).toBe(demo.id)
    store.open({ question: 'question' })
    await store.generate()
    expect(store.error).toBe(VIDEO_UI.PHONE_GENERATE)
    expect(api.video.generate).not.toHaveBeenCalled()
    await store.remove('video-id')
    expect(api.video.delete).toHaveBeenCalledWith('video-id')
  })
  it('passes an IPC-cloneable outline rather than a reactive proxy', async () => {
    api.isRemote = false
    api.video.generate.mockImplementation(async input => {
      structuredClone(input)
      return { ok: false, error: 'test' }
    })
    const store = useVideoStore()
    store.open({ question: 'question' })
    store.outline = { title: 't', confusion: 'c', analogy: 'a', scenes: [{ kind: 'trace', goal: 'g' }] }
    await store.generate()
    expect(store.error).toBe('test')
    expect(api.video.generate).toHaveBeenCalledOnce()
    api.isRemote = true
  })
})
