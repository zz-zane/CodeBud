import { protocol } from 'electron'
import { randomUUID } from 'node:crypto'
import { STUDY_TEXT } from '../../shared/study-copy'

export const STUDY_HTML_CSP = "sandbox allow-scripts; default-src 'none'; base-uri 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'"
const previews = new Map<string, string>()

export function createHtmlPreview(html: unknown): string {
  if (typeof html !== 'string' || !html.trim() || html.length > 200_000) throw new Error(STUDY_TEXT.HTML_PREVIEW_INVALID)
  const id = randomUUID()
  previews.set(id, html)
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
  const html = previews.get(id)
  if (method !== 'GET' || html === undefined) return new Response(null, { status: 404 })
  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': STUDY_HTML_CSP, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' } })
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

export function blockStudyFrameRequest(url: string, resourceType: string, frameUrl = ''): boolean {
  if (resourceType === 'subFrame') return !isHtmlPreviewUrl(url) && url !== 'about:blank'
  return frameUrl.startsWith('miai-study:') && !isHtmlPreviewUrl(url) && !url.startsWith('data:')
}
