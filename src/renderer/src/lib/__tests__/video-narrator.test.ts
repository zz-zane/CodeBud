import { afterEach, describe, expect, it, vi } from 'vitest'
import { createVideoNarrator } from '../video-narrator'

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

describe('video narrator', () => {
  it('finishes immediately when narration is disabled', async () => {
    vi.stubGlobal('localStorage', { getItem: () => 'false' })
    const done = vi.fn()
    await createVideoNarrator().speak('字幕', 1).then(done)
    expect(done).toHaveBeenCalledOnce()
  })
  it('uses the timed fallback when no Chinese voice is available', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('localStorage', { getItem: () => null })
    vi.stubGlobal('window', { speechSynthesis: { getVoices: () => [], cancel: vi.fn() } })
    const narrator = createVideoNarrator()
    const done = vi.fn()
    void narrator.speak('字幕', 1).then(done)
    await vi.advanceTimersByTimeAsync(1499)
    expect(done).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(done).toHaveBeenCalledOnce()
  })
  it('resolves a canceled step instead of advancing after its old timer', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('localStorage', { getItem: () => null })
    vi.stubGlobal('window', { speechSynthesis: { getVoices: () => [], cancel: vi.fn() } })
    const narrator = createVideoNarrator()
    const done = vi.fn()
    void narrator.speak('字幕', 1).then(done)
    narrator.cancel()
    await Promise.resolve()
    expect(done).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(2000)
    expect(done).toHaveBeenCalledOnce()
  })
})
