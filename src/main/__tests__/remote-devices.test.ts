import { describe, expect, it } from 'vitest'
import { createDeviceRegistry } from '../remote/devices'
import { DEVICE_TOKEN_TTL_MS, generateDeviceToken, hashToken, type DevicesFile } from '../../shared/remote-auth'
import type { JsonStore } from '../store/json-store'

function fixture(initial: DevicesFile | null = null) {
  let value = initial
  let fail = false
  const store: JsonStore<DevicesFile> = {
    read: () => value,
    write: (next) => {
      if (fail) throw new Error('disk full')
      value = structuredClone(next)
    }
  }
  return { registry: createDeviceRegistry(store), reload: () => createDeviceRegistry(store),
    saved: () => value, failWrites: () => { fail = true } }
}

describe('配对设备登记与最新登录', () => {
  it('保存时只保留设备字段，不继承旧数据中的 IP、地址列表或登录 IP', () => {
    const token = generateDeviceToken()
    const raw = JSON.parse(JSON.stringify({
      version: 2,
      addresses: ['198.51.100.42'],
      devices: [{ id: 'phone', name: 'Safari / iOS', tokenHash: hashToken(token), pairedAt: 10, lastSeenAt: 10,
        ip: '192.0.2.23', remoteAddress: '203.0.113.9' }],
      latestLogin: { deviceId: 'phone', name: 'Safari / iOS', at: 10, ip: '192.0.2.23' }
    }))
    const { registry, saved } = fixture(raw)
    registry.recordLogin('phone', 20)
    const serialized = JSON.stringify(saved())
    for (const value of ['192.0.2.23', '198.51.100.42', '203.0.113.9', 'remoteAddress', 'addresses', '"ip"']) {
      expect(serialized).not.toContain(value)
    }
    expect(saved()?.devices[0].id).toBe('phone')
    expect(saved()?.latestLogin?.at).toBe(20)
  })

  it('同一浏览器重复配对复用条目与首次配对时间，轮换令牌', () => {
    const { registry, saved } = fixture()
    const first = registry.add('Safari / iOS', 10)
    const again = registry.add('iOS', 20, first.browserToken)
    expect(registry.list()).toHaveLength(1)
    expect(again.device).toMatchObject({ id: first.device.id, name: 'iOS', pairedAt: 10, tokenIssuedAt: 20 })
    expect(again.browserToken).toBe(first.browserToken)
    expect(again.token).not.toBe(first.token)
    expect(registry.authenticate(first.token, 21)).toBeNull()
    expect(registry.authenticate(again.token, 21)?.id).toBe(first.device.id)
    expect(registry.authenticate(first.browserToken, 21)).toBeNull()
    expect(JSON.stringify(saved())).not.toContain(again.token)
    expect(JSON.stringify(saved())).not.toContain(first.browserToken)
  })

  it('同名浏览器在不同设备上不会误合并，伪造的身份不会占用既有设备', () => {
    const { registry } = fixture()
    const a = registry.add('Safari / iOS', 10)
    const b = registry.add('Safari / iOS', 20)
    const c = registry.add('Safari / iOS', 30, generateDeviceToken())
    expect(registry.list()).toHaveLength(3)
    expect(new Set([a.device.id, b.device.id, c.device.id]).size).toBe(3)
    expect(registry.authenticate(a.token, 31)?.id).toBe(a.device.id)
  })

  it('到期后用浏览器身份重新配对，续期从新签发时间计算', () => {
    const { registry } = fixture()
    const first = registry.add('Safari / iOS', 0)
    const afterExpiry = DEVICE_TOKEN_TTL_MS + 1
    expect(registry.authenticate(first.token, afterExpiry)).toBeNull()
    const again = registry.add('Safari / iOS', afterExpiry, first.browserToken)
    expect(again.device.pairedAt).toBe(0)
    expect(registry.authenticate(again.token, afterExpiry + 100)?.id).toBe(first.device.id)
  })

  it('v1 记录保留，持旧令牌重新配对可升级身份；同名旧记录不自动合并', () => {
    const token = generateDeviceToken()
    const otherToken = generateDeviceToken()
    const { registry, saved } = fixture({ version: 1, devices: [
      { id: 'legacy-a', name: 'Safari / iOS', tokenHash: hashToken(token), pairedAt: 0, lastSeenAt: 5 },
      { id: 'legacy-b', name: 'Safari / iOS', tokenHash: hashToken(otherToken), pairedAt: 0, lastSeenAt: 5 }
    ] })
    expect(registry.latestLogin()).toBeNull()
    const again = registry.add('Safari / iOS', DEVICE_TOKEN_TTL_MS + 1, undefined, token)
    expect(again.device.id).toBe('legacy-a')
    expect(registry.list()).toHaveLength(2)
    expect(saved()?.version).toBe(2)
    expect(registry.authenticate(otherToken, 10)?.id).toBe('legacy-b')
  })

  it('普通请求只刷新活跃时间；登录记录持久保存，撤销设备不改写历史', () => {
    const { registry, reload } = fixture()
    const a = registry.add('Safari / iOS', 10)
    const b = registry.add('Chrome / Android', 20)
    registry.authenticate(a.token, 100_000)
    expect(registry.latestLogin()).toEqual({ deviceId: b.device.id, name: b.device.name, at: 20 })
    registry.recordLogin(a.device.id, 200_000)
    expect(reload().latestLogin()).toEqual({ deviceId: a.device.id, name: a.device.name, at: 200_000 })
    registry.revoke(a.device.id)
    expect(registry.latestLogin()?.deviceId).toBe(a.device.id)
    registry.recordLogin(a.device.id, 300_000)
    expect(registry.latestLogin()?.at).toBe(200_000)
    expect(registry.authenticate(a.token, 300_000)).toBeNull()
    registry.revokeAll()
    expect(registry.list()).toEqual([])
    expect(reload().latestLogin()?.at).toBe(200_000)
  })

  it('旧设备登录时补发持久标识，不增加设备，标识不能单独用于认证', () => {
    const token = generateDeviceToken()
    const { registry, reload } = fixture({ version: 1, devices: [
      { id: 'old-phone', name: 'iOS', tokenHash: hashToken(token), pairedAt: 0, lastSeenAt: 0 }
    ] })
    const identity = registry.recordLogin('old-phone', 10)!
    expect(identity).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(registry.list()).toHaveLength(1)
    expect(registry.authenticate(identity, 11)).toBeNull()
    expect(registry.recordLogin('old-phone', 12, identity)).toBe(identity)
    expect(registry.recordLogin('old-phone', 13, 'forged')).toBeNull()
    const paired = reload().add('Safari / iOS', DEVICE_TOKEN_TTL_MS + 1, identity)
    expect(paired.device.id).toBe('old-phone')
  })

  it('写盘失败时不替换已有访问令牌或登录记录', () => {
    const { registry, failWrites } = fixture()
    const first = registry.add('Safari / iOS', 10)
    failWrites()
    expect(() => registry.add('iOS', 20, first.browserToken)).toThrow('disk full')
    expect(registry.authenticate(first.token, 21)?.id).toBe(first.device.id)
    expect(registry.latestLogin()?.at).toBe(10)
  })
})
