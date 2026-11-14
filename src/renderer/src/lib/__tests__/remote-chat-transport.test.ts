import { afterEach, describe, expect, it, vi } from 'vitest'
import { IPC } from '../../../../shared/ipc-channels'
import { createHttpTransport } from '../../remote/http-transport'

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('remote chat reconnect', () => {
  it('事件流首次打开或断线重连后，通知聊天重新读取共享历史', () => {
    vi.useFakeTimers()
    const sources: FakeSource[] = []
    class FakeSource {
      static CLOSED = 2
      readyState = 1
      onopen: (() => void) | null = null
      onerror: (() => void) | null = null
      onmessage: ((event: { data: string }) => void) | null = null
      close = vi.fn()
      constructor(public url: string) { sources.push(this) }
    }
    vi.stubGlobal('EventSource', FakeSource)
    const transport = createHttpTransport()
    const changed = vi.fn()
    const unsubscribe = transport.on(IPC.aiSessionsChanged, changed)
    expect(sources[0].url).toBe('/events')
    sources[0].onopen!()
    expect(changed).toHaveBeenCalledTimes(1)
    sources[0].onmessage!({ data: JSON.stringify({ channel: IPC.aiSessionsChanged, payload: null }) })
    expect(changed).toHaveBeenCalledTimes(2)
    sources[0].readyState = FakeSource.CLOSED
    sources[0].onerror!()
    vi.advanceTimersByTime(3000)
    expect(sources[0].close).toHaveBeenCalled()
    sources[1].onopen!()
    expect(changed).toHaveBeenCalledTimes(3)
    unsubscribe()
    sources[1].onopen!()
    expect(changed).toHaveBeenCalledTimes(3)
  })
})
