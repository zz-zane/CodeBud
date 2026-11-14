/**
 * 手机浏览器用的 `window.miai` 传输层（docs/29 §3.1）：
 * invoke = POST /rpc；on = 订阅一条共享的 EventSource('/events')，断线自动重连。
 * RPC 失败（主进程 handler 抛错 / 通道被拒）表现为 rejected Promise，message 取服务端的原文。
 */
import type { MiaiTransport } from '../../../shared/miai-api'
import { IPC } from '../../../shared/ipc-channels'

const RECONNECT_MS = 3000

export function createHttpTransport(): MiaiTransport {
  const listeners = new Map<string, Set<(payload: unknown) => void>>()
  let source: EventSource | null = null

  function connect(): void {
    const es = new EventSource('/events')
    source = es
    // Re-read persisted chats after reconnecting, including changes missed while offline.
    es.onopen = () => {
      for (const listener of listeners.get(IPC.aiSessionsChanged) ?? []) listener(undefined)
    }
    es.onmessage = (e: MessageEvent<string>) => {
      let msg: { channel?: unknown; payload?: unknown }
      try {
        msg = JSON.parse(e.data)
      } catch {
        return
      }
      if (typeof msg.channel !== 'string') return
      for (const l of listeners.get(msg.channel) ?? []) l(msg.payload)
    }
    es.onerror = () => {
      // 网络抖动时浏览器自己会重连；被服务端明确拒绝（连接已关闭）则隔几秒重建
      if (es.readyState === EventSource.CLOSED) {
        es.close()
        if (source === es) setTimeout(connect, RECONNECT_MS)
      }
    }
  }
  connect()

  return {
    isRemote: true,
    async invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
      // JSON 表达不了 undefined：去掉末尾的 undefined 参数，handler 看到的就是「没传」
      while (args.length > 0 && args[args.length - 1] === undefined) args.pop()
      const res = await fetch('/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel, args })
      })
      if (res.status === 401) {
        // 令牌失效（被撤销 / 过期）：重新加载，服务端会给配对页
        location.reload()
        throw new Error('unauthorized')
      }
      let body: { ok?: boolean; data?: unknown; error?: unknown } = {}
      try {
        body = await res.json()
      } catch {
        /* 非 JSON 响应按下面的通用错误处理 */
      }
      if (body.ok === true) return body.data as T
      throw new Error(typeof body.error === 'string' ? body.error : `HTTP ${res.status}`)
    },
    on(channel, listener) {
      const set = listeners.get(channel) ?? new Set()
      set.add(listener)
      listeners.set(channel, set)
      return () => {
        set.delete(listener)
      }
    }
  }
}
