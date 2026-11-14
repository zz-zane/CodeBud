/**
 * 已配对设备清单（docs/29 §2-1/5）：`<数据目录>/remote-devices.json`，令牌只存 SHA-256 哈希。
 * 读口经 `normalizeDevices`（坏条目丢、好条目留）；`lastSeenAt` 最多一分钟落一次盘，免得每个请求都写文件。
 * 存储用注入的 `JsonStore` 端口，测试里换内存实现。
 */
import { randomUUID } from 'node:crypto'
import {
  DEVICES_FILE_VERSION,
  findDeviceByToken,
  generateDeviceToken,
  hashToken,
  normalizeDevices,
  normalizeLatestLogin,
  safeEqual,
  type DeviceRecord,
  type DevicesFile,
  type RemoteLoginView
} from '../../shared/remote-auth'
import type { JsonStore } from '../store/json-store'

const TOUCH_WRITE_INTERVAL_MS = 60_000

export interface DeviceRegistry {
  list(): DeviceRecord[]
  /** 仅在配对码验证成功后调用；浏览器标识或旧令牌可复用原设备条目。 */
  add(name: string, now: number, browserToken?: string, previousToken?: string): { token: string; browserToken: string; device: DeviceRecord }
  /** 凭令牌认人（过期 / 已撤销 = null），顺带刷新最近活跃 */
  authenticate(token: string, now: number): DeviceRecord | null
  latestLogin(): RemoteLoginView | null
  /** 返回可下发的浏览器身份；旧设备首次登录时补发，身份本身不授权。 */
  recordLogin(id: string, now: number, browserToken?: string): string | null
  revoke(id: string): boolean
  revokeAll(): void
}

export function createDeviceRegistry(store: JsonStore<DevicesFile>): DeviceRegistry {
  const raw = store.read()
  let devices: DeviceRecord[] = normalizeDevices(raw)
  let latestLogin = normalizeLatestLogin(raw?.latestLogin)
  let lastWrite = 0

  function persist(now: number, next = devices, login = latestLogin): void {
    store.write({ version: DEVICES_FILE_VERSION, devices: next, latestLogin: login })
    devices = next
    latestLogin = login
    lastWrite = now
  }

  return {
    list: () => devices.map((d) => ({ ...d })),
    add(name, now, browserToken, previousToken) {
      const browserHash = browserToken && /^[A-Za-z0-9_-]{43}$/.test(browserToken) ? hashToken(browserToken) : null
      const previousHash = previousToken ? hashToken(previousToken) : null
      const knownBrowser = browserHash ? devices.find((d) => d.identityHash && safeEqual(d.identityHash, browserHash)) : undefined
      // 旧版没有浏览器标识；正确配对码 + 已持有的旧令牌可保留原设备（包含到期令牌）。
      const previous = knownBrowser ?? (previousHash ? devices.find((d) => safeEqual(d.tokenHash, previousHash)) : undefined)
      const identity = knownBrowser ? browserToken! : generateDeviceToken()
      const token = generateDeviceToken()
      const device: DeviceRecord = {
        id: previous?.id ?? randomUUID(), name: name.slice(0, 80), tokenHash: hashToken(token),
        pairedAt: previous?.pairedAt ?? now, lastSeenAt: now, tokenIssuedAt: now, identityHash: hashToken(identity)
      }
      const next = previous ? devices.map((d) => d.id === previous.id ? device : d) : [...devices, device]
      persist(now, next, { deviceId: device.id, name: device.name, at: now })
      return { token, browserToken: identity, device: { ...device } }
    },
    authenticate(token, now) {
      const found = findDeviceByToken(devices, token, now)
      if (!found) return null
      if (now - found.lastSeenAt > 0) {
        const updated = { ...found, lastSeenAt: now }
        devices = devices.map((d) => (d.id === found.id ? updated : d))
        if (now - lastWrite >= TOUCH_WRITE_INTERVAL_MS) {
          try {
            persist(now)
          } catch {
            /* 活跃时间落盘失败不影响访问 */
          }
        }
        return updated
      }
      return found
    },
    latestLogin: () => latestLogin ? { ...latestLogin } : null,
    recordLogin(id, now, browserToken) {
      const device = devices.find((d) => d.id === id)
      if (!device) return null
      const identity = !device.identityHash ? generateDeviceToken()
        : browserToken && safeEqual(device.identityHash, hashToken(browserToken)) ? browserToken : null
      const next = identity && !device.identityHash
        ? devices.map((d) => d.id === id ? { ...d, identityHash: hashToken(identity) } : d)
        : devices
      persist(now, next, { deviceId: id, name: device.name, at: now })
      return identity
    },
    revoke(id) {
      const next = devices.filter((d) => d.id !== id)
      if (next.length === devices.length) return false
      persist(Date.now(), next)
      return true
    },
    revokeAll() {
      persist(Date.now(), [])
    }
  }
}
