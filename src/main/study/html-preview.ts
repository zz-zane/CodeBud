import { protocol } from 'electron'
import { randomUUID } from 'node:crypto'
import { STUDY_TEXT } from '../../shared/study-copy'

export const STUDY_HTML_CSP = "sandbox allow-scripts; default-src 'none'; base-uri 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'"
/**
 * AI 互动示意（```widget）用的放宽版（2026-11-24 用户同意放权）：仍是 sandbox allow-scripts、不同源、读不到应用数据，
 * 不能嵌框、提交表单、跳转主窗口；放开 https 图片 / 字体 / 媒体、https 请求（搜图），脚本只许三家常用 CDN。
 */
export const STUDY_WIDGET_CSP = "sandbox allow-scripts; default-src 'none'; base-uri 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; script-src 'unsafe-inline' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://unpkg.com; style-src 'unsafe-inline'; img-src data: https:; font-src data: https:; media-src https:; connect-src https:; form-action 'none'"
const previews = new Map<string, { html: string; network: boolean }>()

export function createHtmlPreview(html: unknown, opts?: unknown): string {
  if (typeof html !== 'string' || !html.trim() || html.length > 200_000) throw new Error(STUDY_TEXT.HTML_PREVIEW_INVALID)
  const id = randomUUID()
  previews.set(id, { html, network: (opts as { network?: unknown } | undefined)?.network === true })
  if (previews.size > 20) previews.delete(previews.keys().next().value!)
  return `miai-study://preview/${id}`
}

/**
 * 按 id 出预览页（协议与手机连接的 `/study/preview/<id>` 共用）。
 * 隔离靠响应头 `Content-Security-Policy: sandbox allow-scripts …`：不带 allow-same-origin，
 * 文档是不透明源 —— 经 HTTP 提供时也读不到应用源的 cookie / 令牌，也不能同源 fetch /rpc。
 * （手机连接的 cookie 本身是 HttpOnly，这是第二道。）
 */
export function htmlPreviewById(id: string, method = 'GET'): Response {
  const p = previews.get(id)
  if (method !== 'GET' || p === undefined) return new Response(null, { status: 404 })
  return new Response(p.html, { headers: { 'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': p.network ? STUDY_WIDGET_CSP : STUDY_HTML_CSP, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' } })
}

export function htmlPreviewResponse(url: string, method = 'GET'): Response {
  const target = new URL(url)
  const id = target.protocol === 'miai-study:' && target.host === 'preview' && !target.search && !target.hash
    ? target.pathname.slice(1) : undefined
  return id === undefined ? new Response(null, { status: 404 }) : htmlPreviewById(id, method)
}

export function isHtmlPreviewUrl(url: string): boolean {
  try {
    const target = new URL(url)
    return target.protocol === 'miai-study:' && target.host === 'preview' && !target.search && !target.hash && previews.has(target.pathname.slice(1))
  } catch { return false }
}

export function installHtmlPreviewProtocol(): void {
  protocol.handle('miai-study', request => htmlPreviewResponse(request.url, request.method))
}

/** 这个预览页允许联网吗（AI 互动示意） */
function isNetworkPreview(frameUrl: string): boolean {
  try {
    const t = new URL(frameUrl)
    return t.protocol === 'miai-study:' && t.host === 'preview' && previews.get(t.pathname.slice(1))?.network === true
  } catch { return false }
}

export function blockStudyFrameRequest(url: string, resourceType: string, frameUrl = ''): boolean {
  if (resourceType === 'subFrame') return !isHtmlPreviewUrl(url) && url !== 'about:blank'
  if (frameUrl.startsWith('miai-study:') && url.startsWith('https:') && isNetworkPreview(frameUrl)) return false
  return frameUrl.startsWith('miai-study:') && !isHtmlPreviewUrl(url) && !url.startsWith('data:')
}
