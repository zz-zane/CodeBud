import { afterEach, describe, expect, it, vi } from 'vitest'
import pointer from '../../../../../fixtures/video-pointer.json'
import type { ExplainerVideo } from '../../../../shared/video'
import { VideoEngine } from '../video-engine'
import type { VideoNarrator } from '../video-narrator'

afterEach(() => vi.useRealTimers())

describe('VideoEngine', () => {
  it('advances after narration and the gap, and seeking cancels stale work', async () => {
    vi.useFakeTimers()
    let resolveSpeech: (() => void) | undefined
    const narrator: VideoNarrator = {
      speak: vi.fn(() => new Promise<void>((resolve) => { resolveSpeech = resolve })),
      cancel: vi.fn(() => { resolveSpeech?.(); resolveSpeech = undefined })
    }
    const engine = new VideoEngine(pointer as ExplainerVideo, narrator, () => {})
    engine.play()
    engine.seek(2, 1)
    await Promise.resolve()
    expect(engine.getSnapshot()).toMatchObject({ state: 'playing', sceneIndex: 2, stepIndex: 1 })
    resolveSpeech?.()
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(350)
    expect(engine.getSnapshot()).toMatchObject({ state: 'playing', sceneIndex: 2, stepIndex: 2 })
    engine.pause()
    await vi.advanceTimersByTimeAsync(1000)
    expect(engine.getSnapshot()).toMatchObject({ state: 'paused', sceneIndex: 2, stepIndex: 2 })
    engine.previous()
    expect(engine.getSnapshot().stepIndex).toBe(1)
    engine.dispose()
  })
})
