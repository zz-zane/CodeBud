/**
 * 手机连接 HTTP 服务（docs/29 §2）：起真的 HTTP 服务（回环地址 + 临时端口），
 * 依赖全部注入假货，不碰 Electron、不碰任何真实网卡。
 */
import { request as httpRequest, get as httpGet, type IncomingMessage } from 'node:http'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { IPC } from '../../shared/ipc-channels'
import { DEVICE_ID_COOKIE, DEVICES_FILE_VERSION, PAIRING_MAX_FAILURES, type DevicesFile } from '../../shared/remote-auth'
import type { JsonStore } from '../store/json-store'
import { createDeviceRegistry, type DeviceRegistry } from '../remote/devices'
import { MAX_BODY_BYTES, createRemoteServer, resolveBindHost, type Invoker, type RemoteServer } from '../remote/server'
import type { HttpAssetHandler } from '../context'

let root: string
let rendererDir: string
const SECRET = 'TOP-SECRET-OUTSIDE-ROOT'

let store: { value: DevicesFile | null; writes: number }
let registry: DeviceRegistry
let server: RemoteServer
let base: string
let host: string
let clock: number | undefined
const handlers = new Map<string, Invoker>()
const assets = new Map<string, HttpAssetHandler>()
const invoked: string[] = []

function memoryStore(): JsonStore<DevicesFile> {
  store = { value: null, writes: 0 }
  return {
    read: () => store.value,
    write: (d) => {
      store.value = JSON.parse(JSON.stringify(d))
      store.writes++
    }
  }
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'miai-remote-'))
  rendererDir = join(root, 'renderer')
  mkdirSync(join(rendererDir, 'assets'), { recursive: true })
  writeFileSync(join(rendererDir, 'index.html'), '<html>APP-BUNDLE-INDEX</html>')
  writeFileSync(join(rendererDir, 'assets', 'a.js'), 'console.log("app-bundle");'.repeat(50))
  writeFileSync(join(root, 'secret.txt'), SECRET)
})
afterAll(() => rmSync(root, { recursive: true, force: true }))

beforeEach(async () => {
  clock = undefined
  invoked.length = 0
  handlers.clear()
  assets.clear()
  registry = createDeviceRegistry(memoryStore())
  server = createRemoteServer({
    devices: registry,
    lookupHandler: (c) => handlers.get(c),
    assets,
    rendererDir,
    now: () => clock ?? Date.now()
  })
  const r = await server.start(0, '127.0.0.1')
  if (!r.ok) throw new Error('start failed')
  host = `127.0.0.1:${r.port}`
  base = `http://${host}`
})
afterEach(async () => {
  await server.stop()
})

const post = (path: string, body: unknown, cookie?: string, headers: Record<string, string> = {}): Promise<Response> =>
  fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: base, ...(cookie ? { Cookie: cookie } : {}), ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  })

/** 配对一台设备，返回 cookie 头 */
async function pair(): Promise<string> {
  const res = await post('/pair', { code: server.pairingCode() })
  expect(res.status).toBe(200)
  const set = res.headers.get('set-cookie') ?? ''
  return set.split(';')[0]
}

const cookiesOf = (res: Response): string => res.headers.getSetCookie().map((s) => s.split(';')[0]).join('; ')

/** 发一个不经 URL 规范化的原始请求（fetch 会把 `..` 折叠掉） */
function raw(path: string, cookie: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest({ host: '127.0.0.1', port: Number(host.split(':')[1]), path, method: 'GET', headers: { Cookie: cookie } }, (res) => {
      let body = ''
      res.on('data', (c) => (body += c))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }))
    })
    req.on('error', reject)
    req.end()
  })
}

describe('未配对：什么数据都拿不到', () => {
  it('GET / 只给配对页，不含应用包', async () => {
    const res = await fetch(base + '/')
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('/pair')
    expect(html).not.toContain('APP-BUNDLE-INDEX')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('content-security-policy')).toContain("default-src 'none'")
  })

  it('/rpc /events /session /cet6/data/x /assets/a.js 都拒绝且不带数据', async () => {
    handlers.set(IPC.profileGet, () => ({ secret: SECRET }))
    assets.set('/cet6/data/', () => new Response(SECRET))
    const results = await Promise.all([
      post('/rpc', { channel: IPC.profileGet, args: [] }),
      fetch(base + '/events'),
      fetch(base + '/session'),
      fetch(base + '/cet6/data/x'),
      fetch(base + '/study/preview/x'),
      fetch(base + '/assets/a.js'),
      fetch(base + '/index.html?x=1', { headers: { Cookie: 'miai_device=forged' } })
    ])
    const [rpc, events, session, cet6, study, asset, forged] = results
    for (const r of [rpc, events, session, cet6, study, asset]) {
      expect(r.status).toBe(401)
      const text = await r.text()
      expect(text).not.toContain(SECRET)
      expect(text).not.toContain('app-bundle')
    }
    // 伪造的令牌同样只能拿到配对页
    expect(await forged.text()).not.toContain('APP-BUNDLE-INDEX')
    expect(invoked).toEqual([])
  })

  it('不发 CORS 头；OPTIONS 不放行', async () => {
    const res = await fetch(base + '/', { headers: { Origin: 'http://evil.example' } })
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
    const opt = await fetch(base + '/rpc', { method: 'OPTIONS', headers: { Origin: 'http://evil.example' } })
    expect(opt.status).toBe(405)
    expect(opt.headers.get('access-control-allow-origin')).toBeNull()
  })
})

describe('配对', () => {
  it('不将请求提交的 IP 或转发地址头写入配对和登录记录', async () => {
    const response = await post('/pair', {
      code: server.pairingCode(), ip: '192.0.2.23', addresses: ['198.51.100.42']
    }, undefined, { 'X-Forwarded-For': '203.0.113.9', 'X-Real-IP': '192.0.2.23' })
    expect(response.status).toBe(200)
    await fetch(base + '/', { headers: { Cookie: cookiesOf(response), 'X-Forwarded-For': '203.0.113.9' } })
    const serialized = JSON.stringify(store.value)
    for (const value of ['192.0.2.23', '198.51.100.42', '203.0.113.9', '127.0.0.1', 'remoteAddress', '"ip"']) {
      expect(serialized).not.toContain(value)
    }
    expect(store.value?.devices).toHaveLength(1)
    expect(store.value?.latestLogin?.deviceId).toBe(store.value?.devices[0].id)
  })

  it('同一浏览器再次配对不增加设备，身份 Cookie 不能独立访问', async () => {
    const a = await post('/pair', { code: server.pairingCode() })
    const cookies = cookiesOf(a)
    const identity = cookies.split('; ').find((s) => s.startsWith(DEVICE_ID_COOKIE + '='))!
    expect(identity).toBeTruthy()
    expect(a.headers.getSetCookie()[1]).toContain('HttpOnly; SameSite=Strict')
    expect((await fetch(base + '/session', { headers: { Cookie: identity } })).status).toBe(401)
    const id = registry.list()[0].id
    const before = server.pairingCode()
    const wrong = before === '000000' ? '000001' : '000000'
    expect((await post('/pair', { code: wrong }, cookies)).status).toBe(401)
    expect(registry.list()).toHaveLength(1)
    const b = await post('/pair', { code: before }, identity)
    expect(b.status).toBe(200)
    expect(registry.list()).toHaveLength(1)
    expect(registry.list()[0].id).toBe(id)
    expect((await fetch(base + '/session', { headers: { Cookie: cookies } })).status).toBe(401)
    expect((await fetch(base + '/session', { headers: { Cookie: cookiesOf(b) } })).status).toBe(200)
  })

  it('两台同名 Safari / iOS 浏览器各有独立记录', async () => {
    const headers = { 'User-Agent': 'iPhone Version/17.0 Safari/604.1' }
    for (let i = 0; i < 2; i++) expect((await post('/pair', { code: server.pairingCode() }, undefined, headers)).status).toBe(200)
    const devices = registry.list()
    expect(devices).toHaveLength(2)
    expect(devices.map((d) => d.name)).toEqual(['Safari / iOS', 'Safari / iOS'])
    expect(devices[0].id).not.toBe(devices[1].id)
  })

  it('仅配对或成功打开应用入口更新最新登录；普通请求与 HEAD 不改登录时间', async () => {
    clock = 100
    const a = await pair()
    const deviceA = registry.list()[0]
    expect(registry.latestLogin()?.at).toBe(100)
    clock = 200
    for (const path of ['/session', '/assets/a.js']) await fetch(base + path, { headers: { Cookie: a } })
    await fetch(base + '/', { method: 'HEAD', headers: { Cookie: a } })
    expect(registry.latestLogin()?.at).toBe(100)
    await fetch(base + '/', { headers: { Cookie: a } })
    expect(registry.latestLogin()).toEqual({ deviceId: deviceA.id, name: deviceA.name, at: 200 })
    clock = 300
    await pair()
    expect(registry.latestLogin()?.deviceId).not.toBe(deviceA.id)
    clock = 400
    await fetch(base + '/index.html', { headers: { Cookie: a } })
    expect(store.value?.latestLogin).toEqual({ deviceId: deviceA.id, name: deviceA.name, at: 400 })
    registry.revoke(deviceA.id)
    clock = 500
    await fetch(base + '/', { headers: { Cookie: a } })
    expect(registry.latestLogin()?.at).toBe(400)
  })

  it('成功：下发 HttpOnly + SameSite=Strict cookie（180 天），立刻换码，令牌只存哈希', async () => {
    const before = server.pairingCode()!
    const res = await post('/pair', { code: before }, undefined, { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) Chrome/120.0 Mobile Safari/537.36' })
    expect(res.status).toBe(200)
    const cookie = res.headers.get('set-cookie')!
    expect(cookie).toMatch(/^miai_device=[A-Za-z0-9_-]{43};/)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Strict')
    expect(cookie).toContain(`Max-Age=${180 * 24 * 3600}`)
    expect(server.pairingCode()).not.toBe(before)
    // 旧码作废
    const reuse = await post('/pair', { code: before })
    expect(reuse.status).toBe(401)
    // 磁盘上没有明文令牌
    const token = cookie.split(';')[0].split('=')[1]
    expect(JSON.stringify(store.value)).not.toContain(token)
    expect(store.value?.version).toBe(DEVICES_FILE_VERSION)
    expect(store.value?.devices).toHaveLength(1)
    expect(store.value?.devices[0].name).toBe('Chrome / Android')
    // 配对后能进 /session
    const s = await fetch(base + '/session', { headers: { Cookie: cookie.split(';')[0] } })
    expect(s.status).toBe(200)
    expect(await s.json()).toMatchObject({ paired: true })
  })

  it('连错 5 次锁入口，锁内连正确码也 429', async () => {
    const good = server.pairingCode()!
    const wrong = good === '000000' ? '000001' : '000000'
    for (let i = 0; i < PAIRING_MAX_FAILURES; i++) {
      expect((await post('/pair', { code: wrong })).status).toBe(401)
    }
    const locked = await post('/pair', { code: good })
    expect(locked.status).toBe(429)
    expect(await locked.json()).toMatchObject({ error: 'locked' })
    expect(server.lockedUntil()).toBeGreaterThan(Date.now())
    expect(store.value).toBeNull()
  })

  it('跨源 / 无 Origin 的配对请求被拒', async () => {
    const code = server.pairingCode()
    expect((await post('/pair', { code }, undefined, { Origin: 'http://evil.example' })).status).toBe(403)
    const noOrigin = await fetch(base + '/pair', { method: 'POST', body: JSON.stringify({ code }) })
    expect(noOrigin.status).toBe(403)
    expect(store.value).toBeNull()
  })
})

describe('/rpc', () => {
  it('白名单内通道调用同一个 handler，返回 JSON；handler 抛错 → {ok:false,error}', async () => {
    handlers.set(IPC.profileGet, (_e, args) => {
      invoked.push(IPC.profileGet)
      return { echoed: args }
    })
    handlers.set(IPC.wrongbookGet, () => {
      throw new Error('boom')
    })
    handlers.set(IPC.checkinSubmit, () => undefined)
    const cookie = await pair()
    const ok = await post('/rpc', { channel: IPC.profileGet, args: [1, 'a'] }, cookie)
    expect(ok.status).toBe(200)
    expect(await ok.json()).toEqual({ ok: true, data: { echoed: [1, 'a'] } })
    const bad = await post('/rpc', { channel: IPC.wrongbookGet, args: [] }, cookie)
    expect(await bad.json()).toEqual({ ok: false, error: 'boom' })
    const none = await post('/rpc', { channel: IPC.checkinSubmit }, cookie)
    expect(await none.json()).toEqual({ ok: true, data: null })
  })

  it('不把本机路径交给手机：六级音频目录、IDE / 编译器路径、研学连接命令', async () => {
    handlers.set(IPC.cet6GetState, () => ({ records: {}, media: { root: 'D:\\audio', ok: true }, lastMode: 'practice' }))
    handlers.set(IPC.configGet, () => ({
      nativeIdePaths: { c: 'C:\\ide\\c.exe', cpp: '', java: '', python: '' },
      envCache: { at: 'x', report: { c: { found: true, path: 'C:\\gcc.exe', version: '1' } } }
    }))
    handlers.set(IPC.studyGetState, () => ({ materials: [], connections: [{ id: 'a', command: 'C:\\x\\claude.exe', args: ['--p'] }] }))
    const cookie = await pair()
    const call = async (c: string): Promise<string> => JSON.stringify(await (await post('/rpc', { channel: c, args: [] }, cookie)).json())
    const all = [await call(IPC.cet6GetState), await call(IPC.configGet), await call(IPC.studyGetState)].join('')
    expect(all).not.toMatch(/[A-Z]:\\/)
    expect(JSON.parse(await call(IPC.cet6GetState)).data.media).toEqual({ root: null, ok: true })
    expect(JSON.parse(await call(IPC.configGet)).data.envCache.report.c).toEqual({ found: true, version: '1' })
  })

  it('白名单外通道：有效令牌也 403，handler 不会被调用', async () => {
    for (const k of ['runnerRun', 'configSave', 'envDetect', 'remoteSetEnabled', 'cet6PickMediaRoot'] as const) {
      handlers.set(IPC[k], () => {
        invoked.push(k)
        return 'ran'
      })
    }
    const cookie = await pair()
    for (const k of ['runnerRun', 'configSave', 'envDetect', 'remoteSetEnabled', 'cet6PickMediaRoot'] as const) {
      const res = await post('/rpc', { channel: IPC[k], args: [] }, cookie)
      expect(res.status, k).toBe(403)
    }
    const unknown = await post('/rpc', { channel: 'made:up', args: [] }, cookie)
    expect(unknown.status).toBe(403)
    expect(invoked).toEqual([])
  })

  it('白名单内但没有 handler → 404；坏请求 → 400', async () => {
    const cookie = await pair()
    expect((await post('/rpc', { channel: IPC.profileGet, args: [] }, cookie)).status).toBe(404)
    expect((await post('/rpc', 'not json', cookie)).status).toBe(400)
    expect((await post('/rpc', { channel: 5 }, cookie)).status).toBe(400)
    expect((await post('/rpc', { channel: IPC.profileGet, args: 'x' }, cookie)).status).toBe(400)
  })

  it('跨源 POST 被拒：有效令牌 + 外站 Origin / 无 Origin', async () => {
    handlers.set(IPC.profileGet, () => {
      invoked.push('x')
      return 1
    })
    const cookie = await pair()
    const evil = await post('/rpc', { channel: IPC.profileGet, args: [] }, cookie, { Origin: 'http://evil.example' })
    expect(evil.status).toBe(403)
    const none = await fetch(base + '/rpc', { method: 'POST', headers: { Cookie: cookie }, body: JSON.stringify({ channel: IPC.profileGet, args: [] }) })
    expect(none.status).toBe(403)
    expect(invoked).toEqual([])
  })

  it('请求体超过 1 MB 被拒', async () => {
    handlers.set(IPC.profileGet, () => 1)
    const cookie = await pair()
    const big = JSON.stringify({ channel: IPC.profileGet, args: ['x'.repeat(MAX_BODY_BYTES)] })
    const res = await post('/rpc', big, cookie)
    expect(res.status).toBe(413)
    // 刚好在上限内的正常请求不受影响
    const small = await post('/rpc', { channel: IPC.profileGet, args: ['x'.repeat(1000)] }, cookie)
    expect(small.status).toBe(200)
  })
})

describe('撤销', () => {
  it('被撤销的设备立刻失去访问', async () => {
    handlers.set(IPC.profileGet, () => 1)
    const cookie = await pair()
    expect((await post('/rpc', { channel: IPC.profileGet, args: [] }, cookie)).status).toBe(200)
    const [device] = registry.list()
    expect(registry.revoke(device.id)).toBe(true)
    expect((await post('/rpc', { channel: IPC.profileGet, args: [] }, cookie)).status).toBe(401)
    expect((await fetch(base + '/', { headers: { Cookie: cookie } })).headers.get('content-security-policy')).toContain("default-src 'none'")
  })

  it('revokeAll 清空设备清单', async () => {
    await pair()
    await pair()
    expect(registry.list()).toHaveLength(2)
    registry.revokeAll()
    expect(registry.list()).toHaveLength(0)
    expect(store.value?.devices).toEqual([])
  })
})

describe('路径围栏与静态资源', () => {
  it('路径穿越被拒（含编码形态），读不到根目录之外的文件', async () => {
    assets.set('/cet6/data/', async (req) => new Response(req.pathname))
    const cookie = await pair()
    for (const p of ['/../secret.txt', '/%2e%2e/secret.txt', '/assets/..%2f..%2fsecret.txt', '/assets/%2e%2e%2f%2e%2e%2fsecret.txt', '/a%5c..%5csecret.txt', '/assets//a.js']) {
      const r = await raw(p, cookie)
      expect(r.body, p).not.toContain(SECRET)
      expect([400, 403, 404], p).toContain(r.status)
    }
  })

  it('已配对：/ 给 index.html（no-store）；/assets 长缓存 + gzip', async () => {
    const cookie = await pair()
    const idx = await fetch(base + '/', { headers: { Cookie: cookie } })
    expect(await idx.text()).toContain('APP-BUNDLE-INDEX')
    expect(idx.headers.get('cache-control')).toBe('no-store')
    const js = await fetch(base + '/assets/a.js', { headers: { Cookie: cookie, 'Accept-Encoding': 'gzip' } })
    expect(js.headers.get('cache-control')).toContain('immutable')
    expect(js.headers.get('content-encoding')).toBe('gzip')
    expect(js.headers.get('content-type')).toContain('text/javascript')
    expect(await js.text()).toContain('app-bundle')
    expect(js.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('/cet6/* 路由转给登记的 handler，Range 头原样传入、206 原样回出', async () => {
    let seen: { pathname: string; range: string | null } | null = null
    assets.set('/cet6/media/', (req) => {
      seen = { pathname: req.pathname, range: req.range }
      return new Response('abc', { status: 206, headers: { 'Content-Range': 'bytes 0-2/10', 'Accept-Ranges': 'bytes' } })
    })
    const cookie = await pair()
    const res = await fetch(base + '/cet6/media/a/b%20c.mp3', { headers: { Cookie: cookie, Range: 'bytes=0-2' } })
    expect(res.status).toBe(206)
    expect(res.headers.get('content-range')).toBe('bytes 0-2/10')
    expect(await res.text()).toBe('abc')
    expect(seen).toEqual({ pathname: '/a/b%20c.mp3', range: 'bytes=0-2' })
  })
})

describe('/events（SSE）', () => {
  function openStream(cookie: string): Promise<{ res: IncomingMessage; chunks: string[]; close: () => void }> {
    return new Promise((resolve, reject) => {
      const req = httpGet({ host: '127.0.0.1', port: Number(host.split(':')[1]), path: '/events', headers: { Cookie: cookie } }, (res) => {
        const chunks: string[] = []
        res.setEncoding('utf8')
        res.on('data', (c: string) => chunks.push(c))
        resolve({ res, chunks, close: () => req.destroy() })
      })
      req.on('error', reject)
    })
  }
  const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

  it('sender.send 的推送只发给发起调用的那台设备', async () => {
    handlers.set(IPC.aiChatSend, async (event) => {
      const e = event as { sender: { send(c: string, p: unknown): void; isDestroyed(): boolean } }
      expect(e.sender.isDestroyed()).toBe(false)
      e.sender.send(IPC.aiChatStream, { delta: 'hi' })
    })
    const a = await pair()
    const b = await pair()
    const sa = await openStream(a)
    const sb = await openStream(b)
    expect(sa.res.headers['content-type']).toContain('text/event-stream')
    await wait(50)
    await post('/rpc', { channel: IPC.aiChatSend, args: [{}] }, a)
    await wait(100)
    expect(sa.chunks.join('')).toContain(`data: ${JSON.stringify({ channel: IPC.aiChatStream, payload: { delta: 'hi' } })}`)
    expect(sb.chunks.join('')).not.toContain('delta')
    sa.close()
    sb.close()
  })

  it('没有活跃事件流时 isDestroyed() 为 true；broadcast 发给所有设备', async () => {
    let destroyed: boolean | null = null
    handlers.set(IPC.aiChatCancel, (event) => {
      destroyed = (event as { sender: { isDestroyed(): boolean } }).sender.isDestroyed()
      return { ok: true }
    })
    const a = await pair()
    const b = await pair()
    await post('/rpc', { channel: IPC.aiChatCancel, args: ['s'] }, a)
    expect(destroyed).toBe(true)
    const sa = await openStream(a)
    const sb = await openStream(b)
    await wait(50)
    server.broadcast(IPC.configExternal, { reviewEnabled: false })
    await wait(100)
    for (const s of [sa, sb]) expect(s.chunks.join('')).toContain('"reviewEnabled":false')
    sa.close()
    sb.close()
  })

  it('撤销设备会掐掉它的事件流', async () => {
    const a = await pair()
    const sa = await openStream(a)
    const closed = new Promise<void>((r) => sa.res.on('close', () => r()))
    // feature 撤销设备时的两步：清单里删掉 + 掐流
    const id = registry.list()[0].id
    registry.revoke(id)
    server.dropDevice(id)
    await closed
  })

  it('同一设备重新配对会关闭旧令牌的事件流', async () => {
    const a = await pair()
    const stream = await openStream(a)
    const closed = new Promise<void>((resolve) => stream.res.on('close', resolve))
    const b = await post('/pair', { code: server.pairingCode() }, a)
    expect(b.status).toBe(200)
    await closed
    expect(registry.list()).toHaveLength(1)
    expect((await fetch(base + '/session', { headers: { Cookie: a } })).status).toBe(401)
  })
})

describe('其它', () => {
  it('resolveBindHost：字面 IP 才生效，否则回落到所有网卡', () => {
    expect(resolveBindHost('127.0.0.1')).toBe('127.0.0.1')
    expect(resolveBindHost('::1')).toBe('::1')
    expect(resolveBindHost(undefined)).toBe('0.0.0.0')
    expect(resolveBindHost('localhost')).toBe('0.0.0.0')
    expect(resolveBindHost('')).toBe('0.0.0.0')
  })

  it('端口被占用：start 如实报错，不自动换端口', async () => {
    const other = createRemoteServer({ devices: registry, lookupHandler: () => undefined, assets, rendererDir })
    const r = await other.start(Number(host.split(':')[1]), '127.0.0.1')
    expect(r).toMatchObject({ ok: false, code: 'port-in-use' })
    expect(other.isRunning()).toBe(false)
  })

  it('停止后端口立即释放', async () => {
    const port = Number(host.split(':')[1])
    await server.stop()
    expect(server.isRunning()).toBe(false)
    await expect(fetch(`http://127.0.0.1:${port}/`)).rejects.toThrow()
  })
})
