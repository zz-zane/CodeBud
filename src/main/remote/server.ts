/**
 * 手机连接 HTTP 服务（docs/29 §2 §3）。只用 Node 内置模块；不 import Electron，
 * 依赖（设备清单、通道表、静态资源路由、渲染层目录）全部注入，测试里换假货。
 *
 * 路由（除 POST /pair 与未配对的 GET / 外，每一条都先验设备令牌）：
 *   GET  /                 未配对 → 配对页；已配对 → index.html
 *   POST /pair             {code} → 配对（全局锁、成功即换码、下发 cookie）
 *   GET  /session          已配对 → {paired:true}；否则 401
 *   POST /rpc              {channel,args} → 白名单内的通道调用同一个 handler
 *   GET  /events           SSE：主进程推送（AI 流式输出、配置变化）
 *   GET  /cet6/* /study/*  由各功能登记的静态资源路由（ctx.httpAssets）
 *   GET  其它              渲染层构建产物（路径围栏）
 * 不发任何 CORS 头；POST 必须同源（Origin 与 Host 一致）；请求体上限 1 MB。
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { isIP } from 'node:net'
import { join } from 'node:path'
import { pipeline, Readable } from 'node:stream'
import { createGzip } from 'node:zlib'
import {
  DEVICE_COOKIE,
  DEVICE_ID_COOKIE,
  DEVICE_ID_TTL_MS,
  DEVICE_TOKEN_TTL_MS,
  attemptPairing,
  freshGuard,
  generatePairingCode,
  isSameOrigin,
  readCookie,
  summarizeUserAgent,
  type DeviceRecord,
  type PairingGuard,
  type RemoteErrorCode
} from '../../shared/remote-auth'
import { isRemoteChannelAllowed } from '../../shared/remote-channels'
import { redactForRemote } from '../../shared/remote-redact'
import { mimeFor, pathFence, resolveUnder } from '../file-protocol'
import type { HttpAssetHandler } from '../context'
import type { DeviceRegistry } from './devices'
import { PAIR_PAGE_CSP, renderPairPage } from './pair-page'

/** 请求体上限：1 MB */
export const MAX_BODY_BYTES = 1024 * 1024
const MAX_STREAMS = 64
const HEARTBEAT_MS = 25_000
const GZIP_TYPES = /^(text\/|application\/json|application\/javascript|image\/svg\+xml)/

export type Invoker = (event: unknown, args: unknown[]) => unknown

export interface RemoteServerDeps {
  devices: DeviceRegistry
  lookupHandler(channel: string): Invoker | undefined
  assets: ReadonlyMap<string, HttpAssetHandler>
  rendererDir: string
  now?: () => number
}

export type StartResult = { ok: true; port: number } | { ok: false; code: RemoteErrorCode; detail: string }

export interface RemoteServer {
  start(port: number, host: string): Promise<StartResult>
  stop(): Promise<void>
  isRunning(): boolean
  /** 当前配对码；没在跑 = null */
  pairingCode(): string | null
  regenerateCode(): void
  lockedUntil(): number
  /** 向所有已连接设备推一条消息（配置变化广播） */
  broadcast(channel: string, payload: unknown): void
  /** 设备被撤销：掐掉它的事件流 */
  dropDevice(id: string): void
  dropAllDevices(): void
}

/** 绑定地址：环境变量 MIAI_REMOTE_HOST 必须是字面 IP（验证用 127.0.0.1），否则回落到所有网卡 */
export function resolveBindHost(env: string | undefined): string {
  return env && isIP(env) !== 0 ? env : '0.0.0.0'
}

function json(res: ServerResponse, status: number, body: unknown, extra: Record<string, string | string[]> = {}): void {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
    ...extra
  })
  res.end(text)
}

function plain(res: ServerResponse, status: number, text = ''): void {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
  res.end(text)
}

const browserCookie = (token: string): string =>
  `${DEVICE_ID_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(DEVICE_ID_TTL_MS / 1000)}`

class BodyTooLarge extends Error {}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length'])
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      reject(new BodyTooLarge())
      return
    }
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > MAX_BODY_BYTES) {
        reject(new BodyTooLarge())
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function errorCodeOf(err: NodeJS.ErrnoException): RemoteErrorCode {
  if (err.code === 'EADDRINUSE') return 'port-in-use'
  if (err.code === 'EACCES' || err.code === 'EPERM') return 'permission'
  return 'listen-failed'
}

export function createRemoteServer(deps: RemoteServerDeps): RemoteServer {
  const now = deps.now ?? Date.now
  let server: Server | null = null
  let code: string | null = null
  let guard: PairingGuard = freshGuard()
  /** 设备 id → 它当前的事件流们 */
  const streams = new Map<string, Set<ServerResponse>>()

  function dropDeviceStreams(id: string): void {
    for (const res of streams.get(id) ?? []) res.destroy()
    streams.delete(id)
  }

  function streamCount(): number {
    let n = 0
    for (const s of streams.values()) n += s.size
    return n
  }

  function writeEvent(res: ServerResponse, channel: string, payload: unknown): void {
    try {
      res.write(`data: ${JSON.stringify({ channel, payload })}\n\n`)
    } catch {
      /* 流已断：设备重连后下一条推送自然恢复 */
    }
  }

  function authenticate(req: IncomingMessage): DeviceRecord | null {
    const token = readCookie(req.headers.cookie, DEVICE_COOKIE)
    return token ? deps.devices.authenticate(token, now()) : null
  }

  /** 给远程调用的仿事件对象：sender.send 只写到发起设备自己的事件流 */
  function fakeEvent(deviceId: string): { sender: { send(channel: string, payload: unknown): void; isDestroyed(): boolean } } {
    return {
      sender: {
        send(channel, payload) {
          for (const res of streams.get(deviceId) ?? []) writeEvent(res, channel, redactForRemote(channel, payload))
        },
        isDestroyed: () => (streams.get(deviceId)?.size ?? 0) === 0
      }
    }
  }

  async function sendWeb(res: ServerResponse, r: Response, method: string): Promise<void> {
    const headers: Record<string, string> = {}
    r.headers.forEach((v, k) => {
      headers[k] = v
    })
    res.writeHead(r.status, headers)
    if (!r.body || method === 'HEAD') {
      res.end()
      return
    }
    const src = Readable.fromWeb(r.body as Parameters<typeof Readable.fromWeb>[0])
    res.on('close', () => src.destroy())
    pipeline(src, res, () => {
      /* 客户端中途断开（拖动音频进度条）属正常 */
    })
  }

  async function serveStatic(req: IncomingMessage, res: ServerResponse, pathname: string, device: DeviceRecord): Promise<void> {
    let file: string
    if (pathname === '/' || pathname === '/index.html') {
      file = join(deps.rendererDir, 'index.html')
    } else {
      const fence = pathFence(pathname)
      if (!fence.ok) return plain(res, 403, fence.why)
      const full = resolveUnder(deps.rendererDir, fence.segs)
      if (!full) return plain(res, 403, 'outside-root')
      file = full
    }
    let st
    try {
      st = await stat(file)
    } catch {
      return plain(res, 404, 'not found')
    }
    if (!st.isFile()) return plain(res, 404, 'not found')
    const type = mimeFor(file)
    const isIndex = file === join(deps.rendererDir, 'index.html')
    // 登录指成功打开应用页面；资源请求、会话检查和 SSE 重连只刷新活跃时间。
    if (isIndex && req.method === 'GET') {
      const identity = deps.devices.recordLogin(device.id, now(), readCookie(req.headers.cookie, DEVICE_ID_COOKIE) ?? undefined)
      if (identity) res.setHeader('Set-Cookie', browserCookie(identity))
    }
    const headers: Record<string, string> = {
      'Content-Type': GZIP_TYPES.test(type) ? `${type}; charset=utf-8` : type,
      // 带哈希的构建产物（/assets/）可长期缓存；入口页必须每次都拿最新的
      'Cache-Control': isIndex ? 'no-store' : pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
      Vary: 'Accept-Encoding'
    }
    const gzip = GZIP_TYPES.test(type) && /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''))
    if (gzip) headers['Content-Encoding'] = 'gzip'
    else headers['Content-Length'] = String(st.size)
    res.writeHead(200, headers)
    if (req.method === 'HEAD') return void res.end()
    const src = createReadStream(file)
    res.on('close', () => src.destroy())
    if (gzip) pipeline(src, createGzip(), res, () => {})
    else pipeline(src, res, () => {})
  }

  async function handlePair(req: IncomingMessage, res: ServerResponse): Promise<void> {
    if (!isSameOrigin(req.headers.origin, req.headers.host)) return json(res, 403, { error: 'origin' })
    let body: unknown
    try {
      body = JSON.parse(await readBody(req))
    } catch (err) {
      return err instanceof BodyTooLarge ? json(res, 413, { error: 'too-large' }) : json(res, 400, { error: 'bad-request' })
    }
    const submitted = typeof body === 'object' && body !== null ? (body as { code?: unknown }).code : undefined
    const t = now()
    const attempt = attemptPairing(guard, t, submitted, code ?? '')
    guard = attempt.guard
    if (code === null || attempt.result === 'wrong') return json(res, 401, { error: 'wrong' })
    if (attempt.result === 'locked') return json(res, 429, { error: 'locked', retryAfterMs: attempt.retryAfterMs })
    const { token, browserToken, device } = deps.devices.add(
      summarizeUserAgent(req.headers['user-agent']), t,
      readCookie(req.headers.cookie, DEVICE_ID_COOKIE) ?? undefined,
      readCookie(req.headers.cookie, DEVICE_COOKIE) ?? undefined
    )
    dropDeviceStreams(device.id)
    code = generatePairingCode() // 配对成功立刻换码：旧码作废
    json(res, 200, { ok: true }, {
      'Set-Cookie': [
        `${DEVICE_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(DEVICE_TOKEN_TTL_MS / 1000)}`,
        browserCookie(browserToken)
      ]
    })
  }

  async function handleRpc(req: IncomingMessage, res: ServerResponse, device: DeviceRecord): Promise<void> {
    if (!isSameOrigin(req.headers.origin, req.headers.host)) return json(res, 403, { ok: false, error: 'origin' })
    let body: unknown
    try {
      body = JSON.parse(await readBody(req))
    } catch (err) {
      return err instanceof BodyTooLarge ? json(res, 413, { ok: false, error: 'too-large' }) : json(res, 400, { ok: false, error: 'bad-request' })
    }
    const { channel, args } = (typeof body === 'object' && body !== null ? body : {}) as { channel?: unknown; args?: unknown }
    if (typeof channel !== 'string' || (args !== undefined && !Array.isArray(args))) return json(res, 400, { ok: false, error: 'bad-request' })
    if (!isRemoteChannelAllowed(channel)) return json(res, 403, { ok: false, error: 'forbidden' })
    const invoke = deps.lookupHandler(channel)
    if (!invoke) return json(res, 404, { ok: false, error: 'no-handler' })
    try {
      const data = await invoke(fakeEvent(device.id), (args as unknown[] | undefined) ?? [])
      return json(res, 200, { ok: true, data: data === undefined ? null : redactForRemote(channel, data) })
    } catch (err) {
      return json(res, 200, { ok: false, error: err instanceof Error ? err.message : String(err) })
    }
  }

  function handleEvents(req: IncomingMessage, res: ServerResponse, device: DeviceRecord): void {
    if (streamCount() >= MAX_STREAMS) return plain(res, 503, 'too many streams')
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    })
    res.write(': ok\n\n')
    const set = streams.get(device.id) ?? new Set<ServerResponse>()
    set.add(res)
    streams.set(device.id, set)
    const beat = setInterval(() => res.write(': hb\n\n'), HEARTBEAT_MS)
    req.on('close', () => {
      clearInterval(beat)
      set.delete(res)
      if (set.size === 0 && streams.get(device.id) === set) streams.delete(device.id)
    })
  }

  async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const method = req.method ?? 'GET'
    const url = new URL(req.url ?? '/', 'http://local')
    const pathname = url.pathname
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'no-referrer')

    if (method === 'POST' && pathname === '/pair') return handlePair(req, res)
    if (method !== 'GET' && method !== 'HEAD' && method !== 'POST') return plain(res, 405)

    const device = authenticate(req)
    if (!device) {
      // 未配对：入口页只给配对页，其余一律 401，不带任何数据
      if ((method === 'GET' || method === 'HEAD') && (pathname === '/' || pathname === '/index.html')) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Security-Policy': PAIR_PAGE_CSP })
        return void res.end(method === 'HEAD' ? undefined : renderPairPage())
      }
      return pathname === '/session' ? json(res, 401, { paired: false }) : plain(res, 401)
    }

    if (method === 'POST') return pathname === '/rpc' ? handleRpc(req, res, device) : plain(res, 404)
    if (pathname === '/session') return json(res, 200, { paired: true, device: { id: device.id, name: device.name } })
    if (pathname === '/events') return handleEvents(req, res, device)
    for (const [prefix, handler] of deps.assets) {
      if (pathname.startsWith(prefix)) {
        const r = await handler({ pathname: pathname.slice(prefix.length - 1), method, range: (req.headers.range as string | undefined) ?? null })
        return sendWeb(res, r, method)
      }
    }
    return serveStatic(req, res, pathname, device)
  }

  return {
    start(port, host) {
      if (server) return Promise.resolve({ ok: true, port })
      return new Promise((resolve) => {
        const s = createServer((req, res) => {
          route(req, res).catch(() => {
            if (!res.headersSent) plain(res, 500)
            else res.destroy()
          })
        })
        s.once('error', (err: NodeJS.ErrnoException) => {
          resolve({ ok: false, code: errorCodeOf(err), detail: err.code ?? err.message })
        })
        s.listen(port, host, () => {
          server = s
          code = generatePairingCode()
          guard = freshGuard()
          s.removeAllListeners('error')
          s.on('error', () => {})
          resolve({ ok: true, port: (s.address() as { port: number }).port })
        })
      })
    },
    async stop() {
      const s = server
      if (!s) return
      server = null
      code = null
      for (const set of streams.values()) for (const res of set) res.destroy()
      streams.clear()
      await new Promise<void>((resolve) => {
        s.close(() => resolve())
        s.closeAllConnections()
      })
    },
    isRunning: () => server !== null,
    pairingCode: () => code,
    regenerateCode() {
      if (server) code = generatePairingCode()
    },
    lockedUntil: () => (guard.lockedUntil > now() ? guard.lockedUntil : 0),
    broadcast(channel, payload) {
      for (const set of streams.values()) for (const res of set) writeEvent(res, channel, redactForRemote(channel, payload))
    },
    dropDevice: dropDeviceStreams,
    dropAllDevices() {
      for (const set of streams.values()) for (const res of set) res.destroy()
      streams.clear()
    }
  }
}
