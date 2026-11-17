import { afterEach, describe, expect, it, vi } from 'vitest'
import pointer from '../../../../../fixtures/video-pointer.json'
import type { ExplainerVideo } from '../../../../shared/video'
import { VideoEngine, resolveStepActions } from '../video-engine'

afterEach(() => vi.useRealTimers())
describe('VideoEngine', () => {
  it('derives follow and open from fly without mutating the step', () => {
    const act = pointer.acts[0] as ExplainerVideo['acts'][number]
    const step = structuredClone(act.steps[3]); delete step.follow; delete step.open
    expect(resolveStepActions(act, step)).toEqual({ follow: 'p', open: ['a'] })
    expect(step.follow).toBeUndefined(); expect(step.open).toBeUndefined()
  })
  it('waits for animation, narration and the gap before advancing', async () => {
    vi.useFakeTimers()
    let finishAnimation!: () => void
    const animation = vi.fn(() => new Promise<void>(resolve => { finishAnimation = resolve }))
    const narrator = { speak: vi.fn().mockResolvedValue(undefined), cancel: vi.fn() }
    const engine = new VideoEngine(pointer as ExplainerVideo, narrator, () => {}, animation)
    engine.play(); await Promise.resolve()
    await vi.advanceTimersByTimeAsync(1000)
    expect(engine.getSnapshot().stepIndex).toBe(0)
    finishAnimation(); await Promise.resolve(); await Promise.resolve()
    await vi.advanceTimersByTimeAsync(350)
    expect(engine.getSnapshot().stepIndex).toBe(1)
    engine.dispose()
  })
  it('pauses before an unanswered question and reveals on request', async () => {
    const narrator = { speak: vi.fn().mockResolvedValue(undefined), cancel: vi.fn() }
    const engine = new VideoEngine(pointer as ExplainerVideo, narrator, () => {})
    engine.play(); engine.seek(0, 3)
    expect(engine.getSnapshot().state).toBe('asking')
    const calls = narrator.speak.mock.calls.length
    engine.reveal()
    expect(engine.getSnapshot().state).toBe('playing')
    expect(narrator.speak).toHaveBeenCalledTimes(calls + 1)
    engine.dispose()
  })
  it('ignores stale narration completion after a seek', async () => {
    let finish!: () => void
    const narrator = { speak: vi.fn(() => new Promise<void>(resolve => { finish = resolve })), cancel: vi.fn() }
    const engine = new VideoEngine(pointer as ExplainerVideo, narrator, () => {})
    engine.play()
    const oldFinish = finish
    engine.seek(1, 0)
    oldFinish()
    await Promise.resolve(); await Promise.resolve()
    expect(engine.getSnapshot()).toMatchObject({ sceneIndex: 1, stepIndex: 0, state: 'playing' })
    engine.dispose()
  })
  it('updates the frame while paused and pauses before a manually selected question', () => {
    const animation = vi.fn().mockResolvedValue(undefined)
    const engine = new VideoEngine(pointer as ExplainerVideo, { speak: vi.fn().mockResolvedValue(undefined), cancel: vi.fn() }, () => {}, animation)
    engine.seek(0, 1)
    expect(engine.getSnapshot().state).toBe('paused')
    expect(animation).toHaveBeenCalledOnce()
    engine.seek(0, 3)
    expect(engine.getSnapshot().state).toBe('asking')
    expect(animation).toHaveBeenCalledOnce()
    engine.dispose()
  })
  it('returns from a question, changes speed and invalidates pending playback on close', async () => {
    vi.useFakeTimers()
    let finish!: () => void
    const narrator = { speak: vi.fn(() => new Promise<void>(resolve => { finish = resolve })), cancel: vi.fn() }
    const engine = new VideoEngine(pointer as ExplainerVideo, narrator, () => {})
    engine.play(); engine.seek(0, 3)
    expect(engine.getSnapshot().state).toBe('asking')
    engine.previous()
    expect(engine.getSnapshot()).toMatchObject({ stepIndex: 2, state: 'playing' })
    engine.setRate(1.5)
    expect(engine.getSnapshot()).toMatchObject({ stepIndex: 2, rate: 1.5, state: 'playing' })
    const complete = finish
    engine.dispose(); complete(); await vi.advanceTimersByTimeAsync(1000)
    expect(engine.getSnapshot().stepIndex).toBe(2)
    expect(narrator.cancel).toHaveBeenCalled()
  })
})
