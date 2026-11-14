// 自定义协议（miai-study:// / miai-cet6://）的共用底座：scheme 特权声明 + Range 解析 / 路径围栏 / CORS 头 / MIME 表。
//
// 协议面硬需求（最初逐条来自视频引擎「会发出的全部请求」的逆向清单，听力音频同样吃这几条）：
//   ① Range 随机读：播放器每次请求都带 `Range: bytes=N-`（首请求 bytes=0-）；
//      必须回 206 + `Content-Range: bytes A-B/SIZE`，否则降级为整份下载（仍能用、但丢随机读）；
//      N ≥ size → 416 + `bytes */SIZE`；
//   ② body 必须是真 ReadableStream（缺了直接抛「Missing HTTP response body stream」）；
//   ③ CORS：Range 不是 safelisted 请求头 → 跨源先发 OPTIONS 预检 ⇒ 需 Allow-Headers: range；
//      要读 Content-Range/Content-Length ⇒ 需 Expose-Headers；
//   ④ 路径按段 encodeURIComponent，服务端按段 decode（中文文件名）；
//   ⑤ 路径围栏：拒绝 `..` / `.` / 空段 / NUL / 反斜杠；根目录白名单前缀（大小写不敏感）。

import { protocol } from 'electron'
import { resolve, sep } from 'node:path'

/**
 * 必须在 app ready 之前调用。
 * `registerSchemesAsPrivileged` 整个进程只能调一次，所以所有自定义 scheme 的特权都集中声明在这里。
 */
export function registerSchemePrivileges(): void {
  protocol.registerSchemesAsPrivileged([
    { scheme: 'miai-study', privileges: { standard: true, secure: true } },
    // 六级真题（docs/27 §2.1）：试卷数据 + 本地听力音频
    {
      scheme: 'miai-cet6',
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true },
    },
  ])
}

const MIME: Record<string, string> = {
  mp4: 'video/mp4', webm: 'video/webm', mkv: 'video/x-matroska', avi: 'video/x-msvideo',
  mov: 'video/quicktime', m4v: 'video/mp4', ogv: 'video/ogg',
  mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', flac: 'audio/flac', m4a: 'audio/mp4',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml', ico: 'image/x-icon',
  json: 'application/json', js: 'text/javascript', mjs: 'text/javascript',
  html: 'text/html', htm: 'text/html', css: 'text/css', txt: 'text/plain', xml: 'text/xml',
  frag: 'text/plain', vert: 'text/plain', glsl: 'text/plain',
  ttf: 'font/ttf', otf: 'font/otf', ttc: 'font/collection', woff: 'font/woff', woff2: 'font/woff2',
  pkg: 'application/octet-stream', tex: 'application/octet-stream',
  bin: 'application/octet-stream', mdl: 'application/octet-stream', tex_json: 'application/json',
}

export function mimeFor(p: string): string {
  const name = p.split('/').pop() || ''
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : ''
  return MIME[ext] || 'application/octet-stream'
}

export function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'range',
    'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges, Content-Type',
    'Accept-Ranges': 'bytes',
  }
}

/** 解析单段 Range。返回 {start,end} | 'invalid' | null（null=没带/不认识的形态，按 200 全量处理） */
export function parseRange(
  header: string | null,
  size: number,
): { start: number; end: number } | 'invalid' | null {
  if (!header) return null
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim())
  if (!m) return null
  const [, a, b] = m
  if (a === '' && b === '') return 'invalid'
  let start: number
  let end: number
  if (a === '') {
    const n = Number(b) // bytes=-N → 末尾 N 字节
    if (!Number.isFinite(n) || n <= 0) return 'invalid'
    start = Math.max(0, size - n)
    end = size - 1
  } else {
    start = Number(a)
    end = b === '' ? size - 1 : Math.min(Number(b), size - 1)
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) return 'invalid'
  return { start, end }
}

/** 相对路径解析进根目录；任何一步越界返回 null（大小写不敏感前缀比对） */
export function resolveUnder(root: string, segs: string[]): string | null {
  const base = resolve(root)
  const full = resolve(base, ...segs)
  const a = full.toLowerCase()
  const b = base.toLowerCase()
  return a === b || a.startsWith(b.endsWith(sep) ? b : b + sep) ? full : null
}

/** 路径拆段 + 围栏校验。返回 {ok:true, segs} 或 {ok:false, why} */
export function pathFence(pathname: string): { ok: true; segs: string[] } | { ok: false; why: string } {
  let segs: string[]
  try {
    segs = pathname.split('/').slice(1).map((s) => decodeURIComponent(s))
  } catch {
    return { ok: false, why: 'decode-fail' }
  }
  for (const s of segs) {
    if (s === '' || s === '.' || s === '..') return { ok: false, why: 'dot-or-empty' }
    if (s.includes('\0') || s.includes('\\')) return { ok: false, why: 'nul-or-backslash' }
    // 解码后夹带的 '/'：只可能来自 %2F 走私（拼 URL 时逐段 encode，
    // 合法文件名段解码后不可能含 '/'）。放行的话 '..%2Fsecret' 会解码成
    // '../secret' —— 围栏只拒恰好等于 '..' 的段、join 后 allowed() 是纯字符串
    // 前缀比对，'<根>/../secret' 仍以根开头 ⇒ 读到围栏根之外。
    // 2026-10-14 夜巡 PoC（probe-wall2）在真应用里坐实过这条路，别删这两行。
    if (s.includes('/')) return { ok: false, why: 'slash-in-segment' }
  }
  return { ok: true, segs }
}
