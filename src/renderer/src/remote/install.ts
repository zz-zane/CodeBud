/**
 * 浏览器环境（没有 preload）的启动安装（docs/29 §3.4）：
 * 问 /session —— 已配对则装上 HTTP 版 `window.miai`，应用照常启动；
 * 未配对时服务端对 `/` 给的是配对页、根本不会把应用包发过来，这里只是兜底（重新加载去拿配对页）。
 */
import { createMiaiApi } from '../../../shared/miai-api'
import { createHttpTransport } from './http-transport'

export async function installRemoteMiai(): Promise<void> {
  const res = await fetch('/session')
  if (!res.ok) {
    location.reload()
    return new Promise<void>(() => {})
  }
  window.miai = createMiaiApi(createHttpTransport())
}
