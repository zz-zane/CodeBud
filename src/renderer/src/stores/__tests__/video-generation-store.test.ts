import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import pointer from '../../../../../fixtures/video-pointer.json'
import { useVideoStore } from '../video'

const state = vi.hoisted(() => {
  const session = { id: 'session', updatedAt: 0, messages: [] as { role: string; content: string }[] }
  return { session, ai: { isOpen: false, activeTab: 'chat', init: vi.fn(), newSession: vi.fn(), saveSessions: vi.fn(), sessions: [session], currentSession: session } }
})
vi.mock('../ai-assistant', () => ({ useAiAssistantStore: () => state.ai }))

beforeEach(() => {
  setActivePinia(createPinia()); state.session.messages.length = 0
  vi.stubGlobal('window', { miai: { isRemote: false, video: {
    onVerifyPrompt: vi.fn(() => () => {}), onProgress: vi.fn(() => () => {}),
    generate: vi.fn(async input => { structuredClone(input); return { ok: true, video: { ...pointer, source: 'ai' } } })
  } } })
})
afterEach(() => vi.unstubAllGlobals())

it('persists a playable card in the originating session and passes the avoided skins', async () => {
  const store = useVideoStore()
  await store.generate({ question: '指针', avoid: ['locker', 'memory'] })
  expect(window.miai.video.generate).toHaveBeenCalledWith(expect.objectContaining({ question: '指针', avoid: ['locker', 'memory'] }))
  expect(state.session.messages).toHaveLength(2)
  expect(state.session.messages[1].content).toContain('```anim-card')
  expect(store.videos[0].id).toBe(pointer.id)
  expect(state.ai.saveSessions).toHaveBeenCalled()
  await store.generate(store.lastInput!)
  expect(window.miai.video.generate).toHaveBeenCalledTimes(2)
})
