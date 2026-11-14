/**
 * 手机连接的认证纯逻辑（docs/29 §2）：配对码、锁定计数、设备令牌、设备清单归一化、UA 摘要、
 * 同源判断。不碰文件、网络和 Electron，Vitest 直接测。
 *
 * ⚠️ 这里 import 了 `node:crypto`（常量时间比较与随机数）—— 只有主进程与测试会 import 本文件，
 * 渲染层只 import `remote-channels.ts` / 类型。字符串一律英文（文案闸门扫整个 src/）。
 */
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto'

export const PAIRING_CODE_LENGTH = 6
/** 配对码连续输错多少次锁入口 */
export const PAIRING_MAX_FAILURES = 5
/** 锁多久（毫秒） */
export const PAIRING_LOCK_MS = 10 * 60 * 1000
/** 设备令牌有效期：180 天（cookie 与服务端各验一次） */
export const DEVICE_TOKEN_TTL_MS = 180 * 24 * 60 * 60 * 1000
export const DEVICE_COOKIE = 'miai_device'
/** 浏览器身份只用于配对去重，不授予访问权限。 */
export const DEVICE_ID_COOKIE = 'miai_browser'
export const DEVICE_ID_TTL_MS = 365 * 24 * 60 * 60 * 1000
export const DEVICES_FILE_VERSION = 2

// ---------------------------------------------------------------- 配对码 + 全局锁

export function generatePairingCode(): string {
  return String(randomInt(0, 10 ** PAIRING_CODE_LENGTH)).padStart(PAIRING_CODE_LENGTH, '0')
}

/** 常量时间比较：先各取 SHA-256 再比，长度不同也不泄露长度 */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest()
  const hb = createHash('sha256').update(b).digest()
  return timingSafeEqual(ha, hb)
}

/** 全局（不按 IP）的配对尝试状态：局域网里 IP 不可信 */
export interface PairingGuard {
  failures: number
  /** 锁到什么时候（毫秒时间戳）；0 = 没锁 */
  lockedUntil: number
}

export const freshGuard = (): PairingGuard => ({ failures: 0, lockedUntil: 0 })

export type PairingAttempt =
  | { result: 'ok'; guard: PairingGuard }
  | { result: 'wrong'; guard: PairingGuard }
  | { result: 'locked'; guard: PairingGuard; retryAfterMs: number }

/**
 * 校验一次配对尝试，返回新的锁状态（不原地改）。
 * 锁定期间一律 `locked`，**连正确的码也不接受**；锁过期后计数从零开始；成功清零。
 */
export function attemptPairing(guard: PairingGuard, now: number, submitted: unknown, expected: string): PairingAttempt {
  if (guard.lockedUntil > now) {
    return { result: 'locked', guard, retryAfterMs: guard.lockedUntil - now }
  }
  const base: PairingGuard = guard.lockedUntil > 0 ? freshGuard() : guard
  if (typeof submitted === 'string' && submitted.length === PAIRING_CODE_LENGTH && safeEqual(submitted, expected)) {
    return { result: 'ok', guard: freshGuard() }
  }
  const failures = base.failures + 1
  if (failures >= PAIRING_MAX_FAILURES) {
    return { result: 'wrong', guard: { failures: 0, lockedUntil: now + PAIRING_LOCK_MS } }
  }
  return { result: 'wrong', guard: { failures, lockedUntil: 0 } }
}

// ---------------------------------------------------------------- 设备令牌 + 设备清单

/** 256 bit 随机令牌（base64url，43 字符） */
export function generateDeviceToken(): string {
  return randomBytes(32).toString('base64url')
}

/** 令牌只存哈希（SHA-256 hex） */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export interface DeviceRecord {
  id: string
  /** User-Agent 摘要，可为空串（界面补占位文案） */
  name: string
  tokenHash: string
  pairedAt: number
  lastSeenAt: number
  /** v2：保留首次配对时间，令牌期限从最近签发时间计算。 */
  tokenIssuedAt?: number
  identityHash?: string
}

export interface RemoteLoginView {
  deviceId: string
  name: string
  at: number
}

export interface DevicesFile {
  version: number
  devices: DeviceRecord[]
  latestLogin?: RemoteLoginView | null
}

const HEX64 = /^[0-9a-f]{64}$/

function normalizeDevice(raw: unknown): DeviceRecord | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string' || r.id.length === 0 || r.id.length > 64) return null
  if (typeof r.tokenHash !== 'string' || !HEX64.test(r.tokenHash)) return null
  if (typeof r.pairedAt !== 'number' || !Number.isFinite(r.pairedAt)) return null
  const lastSeenAt = typeof r.lastSeenAt === 'number' && Number.isFinite(r.lastSeenAt) ? r.lastSeenAt : r.pairedAt
  const name = typeof r.name === 'string' ? r.name.slice(0, 80) : ''
  return {
    id: r.id, name, tokenHash: r.tokenHash, pairedAt: r.pairedAt, lastSeenAt,
    ...(typeof r.tokenIssuedAt === 'number' && Number.isFinite(r.tokenIssuedAt) ? { tokenIssuedAt: r.tokenIssuedAt } : {}),
    ...(typeof r.identityHash === 'string' && HEX64.test(r.identityHash) ? { identityHash: r.identityHash } : {})
  }
}

export function normalizeLatestLogin(raw: unknown): RemoteLoginView | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (typeof r.deviceId !== 'string' || !r.deviceId || r.deviceId.length > 64) return null
  if (typeof r.at !== 'number' || !Number.isFinite(r.at) || r.at < 0) return null
  return { deviceId: r.deviceId, name: typeof r.name === 'string' ? r.name.slice(0, 80) : '', at: r.at }
}

/** 读盘归一化：坏条目丢弃、好条目保留（一条损坏不连累其余设备），id 与哈希各自去重 */
export function normalizeDevices(raw: unknown): DeviceRecord[] {
  const list = typeof raw === 'object' && raw !== null && Array.isArray((raw as { devices?: unknown }).devices)
    ? (raw as { devices: unknown[] }).devices
    : []
  const ids = new Set<string>()
  const hashes = new Set<string>()
  const out: DeviceRecord[] = []
  for (const item of list) {
    const d = normalizeDevice(item)
    if (!d || ids.has(d.id) || hashes.has(d.tokenHash)) continue
    ids.add(d.id)
    hashes.add(d.tokenHash)
    out.push(d)
  }
  return out
}

export function isDeviceExpired(d: DeviceRecord, now: number): boolean {
  return now - (d.tokenIssuedAt ?? d.pairedAt) > DEVICE_TOKEN_TTL_MS
}

/** 在设备清单里按令牌找人（逐条常量时间比哈希；过期的不认） */
export function findDeviceByToken(devices: readonly DeviceRecord[], token: string, now: number): DeviceRecord | null {
  const h = hashToken(token)
  let found: DeviceRecord | null = null
  for (const d of devices) {
    if (safeEqual(d.tokenHash, h) && found === null && !isDeviceExpired(d, now)) found = d
  }
  return found
}

// ---------------------------------------------------------------- 请求头小工具

/** 从 Cookie 头取一个值；没有 / 坏形状 = null */
export function readCookie(header: string | undefined, name: string): string | null {
  if (!header) return null
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim() || null
  }
  return null
}

/** POST 的同源判断：必须带 Origin，且其 host（含端口）与请求的 Host 头一致 */
export function isSameOrigin(origin: string | undefined, host: string | undefined): boolean {
  if (!origin || !host) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

/** User-Agent → 「浏览器 / 系统」摘要，认不出的部分省略（全认不出 = 空串） */
export function summarizeUserAgent(ua: string | undefined): string {
  if (!ua) return ''
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : ''
  // 顺序有讲究：Edge / Opera 的 UA 里也带 Chrome，Chrome 的 UA 里也带 Safari
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\/|CriOS\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : ''
  return [browser, os].filter(Boolean).join(' / ')
}

// ---------------------------------------------------------------- 状态视图（设置页用）

export interface RemoteAddress {
  address: string
  /** 网卡名（给界面分组显示） */
  name: string
  /** 可能来自组网工具（100.64.0.0/10 或虚拟网卡名）；仅启发式，见 main/remote/addresses.ts */
  overlay: boolean
}

export interface RemoteDeviceView {
  id: string
  name: string
  pairedAt: number
  lastSeenAt: number
}

/** 启动 / 监听失败的原因码（界面翻成人话） */
export type RemoteErrorCode = 'port-in-use' | 'permission' | 'listen-failed' | 'no-renderer'

export interface RemoteStatus {
  enabled: boolean
  port: number
  running: boolean
  error: { code: RemoteErrorCode; detail: string } | null
  /** 当前配对码；服务没在跑时为 null */
  pairingCode: string | null
  /** 配对入口被锁到什么时候（毫秒时间戳）；没锁 = 0 */
  lockedUntil: number
  devices: RemoteDeviceView[]
  latestLogin: RemoteLoginView | null
  addresses: RemoteAddress[]
  /** 构建产物是否可供手机加载（开发模式 = false） */
  rendererAvailable: boolean
}
