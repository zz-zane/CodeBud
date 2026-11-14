import { describe, expect, it } from 'vitest'
import {
  DEVICE_TOKEN_TTL_MS,
  PAIRING_LOCK_MS,
  PAIRING_MAX_FAILURES,
  attemptPairing,
  findDeviceByToken,
  freshGuard,
  generateDeviceToken,
  generatePairingCode,
  hashToken,
  isSameOrigin,
  normalizeDevices,
  normalizeLatestLogin,
  readCookie,
  summarizeUserAgent,
  type DeviceRecord,
  type PairingGuard
} from '../remote-auth'

describe('配对码', () => {
  it('6 位数字，保留前导零', () => {
    for (let i = 0; i < 200; i++) expect(generatePairingCode()).toMatch(/^\d{6}$/)
  })

  it('正确码通过并清零计数', () => {
    let g: PairingGuard = { failures: 3, lockedUntil: 0 }
    const r = attemptPairing(g, 1000, '123456', '123456')
    expect(r.result).toBe('ok')
    g = r.guard
    expect(g).toEqual(freshGuard())
  })

  it('错码、非字符串、长度不对都算失败', () => {
    for (const bad of ['000000', '12345', '1234567', undefined, 123456, null]) {
      expect(attemptPairing(freshGuard(), 0, bad, '123456').result).toBe('wrong')
    }
  })

  it('连错 5 次锁 10 分钟（全局），锁内连正确码也拒绝，到期后重新计数', () => {
    let g = freshGuard()
    const t0 = 1_000_000
    for (let i = 0; i < PAIRING_MAX_FAILURES; i++) {
      const r = attemptPairing(g, t0, 'x', '123456')
      expect(r.result).toBe('wrong')
      g = r.guard
    }
    expect(g.lockedUntil).toBe(t0 + PAIRING_LOCK_MS)
    const locked = attemptPairing(g, t0 + 1000, '123456', '123456')
    expect(locked.result).toBe('locked')
    if (locked.result === 'locked') expect(locked.retryAfterMs).toBe(PAIRING_LOCK_MS - 1000)
    const after = attemptPairing(g, t0 + PAIRING_LOCK_MS, '123456', '123456')
    expect(after.result).toBe('ok')
    // 到期后再错一次：从 1 开始数，而不是立刻再锁
    const again = attemptPairing(g, t0 + PAIRING_LOCK_MS, 'x', '123456')
    expect(again.result).toBe('wrong')
    expect(again.guard.failures).toBe(1)
    expect(again.guard.lockedUntil).toBe(0)
  })

  it('成功清零：4 次错 + 1 次对 + 4 次错 不会锁', () => {
    let g = freshGuard()
    for (let i = 0; i < 4; i++) g = attemptPairing(g, 0, 'x', '123456').guard
    g = attemptPairing(g, 0, '123456', '123456').guard
    for (let i = 0; i < 4; i++) g = attemptPairing(g, 0, 'x', '123456').guard
    expect(g.lockedUntil).toBe(0)
  })
})

describe('设备令牌与清单', () => {
  it('新字段兼容旧设备；损坏的登录快照不会进入设置页', () => {
    expect(normalizeLatestLogin(undefined)).toBeNull()
    expect(normalizeLatestLogin({ deviceId: '', at: 10 })).toBeNull()
    expect(normalizeLatestLogin({ deviceId: 'a', at: NaN })).toBeNull()
    expect(normalizeLatestLogin({ deviceId: 'a', at: 10, name: 123 })).toEqual({ deviceId: 'a', at: 10, name: '' })
    const valid = dev('a', { tokenIssuedAt: 100, identityHash: hashToken('browser') })
    expect(normalizeDevices({ devices: [valid] })[0]).toEqual(valid)
    const damaged = { ...valid, tokenIssuedAt: NaN, identityHash: 'invalid' }
    const normalized = normalizeDevices({ devices: [damaged] })[0]
    expect(normalized.tokenIssuedAt).toBeUndefined()
    expect(normalized.identityHash).toBeUndefined()
  })

  const dev = (token: string, over: Partial<DeviceRecord> = {}): DeviceRecord => ({
    id: 'id-' + token.slice(0, 4), name: 'n', tokenHash: hashToken(token), pairedAt: 0, lastSeenAt: 0, ...over
  })

  it('令牌 256 bit（base64url 43 字符）且不重复；哈希是 SHA-256 hex', () => {
    const a = generateDeviceToken()
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(generateDeviceToken()).not.toBe(a)
    expect(hashToken(a)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('按令牌找人；过期、错误令牌找不到', () => {
    const t = generateDeviceToken()
    const list = [dev(t), dev(generateDeviceToken())]
    expect(findDeviceByToken(list, t, 1000)?.id).toBe(list[0].id)
    expect(findDeviceByToken(list, 'x', 1000)).toBeNull()
    expect(findDeviceByToken(list, t, DEVICE_TOKEN_TTL_MS + 1)).toBeNull()
  })

  it('损坏的文件保留好条目、丢坏条目并去重', () => {
    const good = dev('aaaa')
    const out = normalizeDevices({
      version: 1,
      devices: [good, null, 'x', { id: 'a' }, { ...good, id: 'dup' }, { ...good, id: 'b', tokenHash: 'zz' }, dev('bbbb', { lastSeenAt: NaN as unknown as number }), { ...dev('cccc'), name: 5 }]
    })
    expect(out.map((d) => d.id)).toEqual([good.id, dev('bbbb').id, dev('cccc').id])
    expect(out[1].lastSeenAt).toBe(out[1].pairedAt)
    expect(out[2].name).toBe('')
  })

  it('整份文件坏掉 = 空清单，不抛', () => {
    for (const raw of [null, undefined, 5, 'x', [], {}, { devices: 'no' }]) expect(normalizeDevices(raw)).toEqual([])
  })
})

describe('请求头小工具', () => {
  it('readCookie', () => {
    expect(readCookie('a=1; miai_device=tok; b=2', 'miai_device')).toBe('tok')
    expect(readCookie('a=1', 'miai_device')).toBeNull()
    expect(readCookie(undefined, 'x')).toBeNull()
    expect(readCookie('miai_device=', 'miai_device')).toBeNull()
  })

  it('isSameOrigin：必须带 Origin 且与 Host 一致', () => {
    expect(isSameOrigin('http://192.0.2.5:17600', '192.0.2.5:17600')).toBe(true)
    expect(isSameOrigin('http://evil.example', '192.0.2.5:17600')).toBe(false)
    expect(isSameOrigin('http://192.0.2.5:9999', '192.0.2.5:17600')).toBe(false)
    expect(isSameOrigin(undefined, '192.0.2.5:17600')).toBe(false)
    expect(isSameOrigin('null', '192.0.2.5:17600')).toBe(false)
  })

  it('summarizeUserAgent', () => {
    const ios = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
    expect(summarizeUserAgent(ios)).toBe('Safari / iOS')
    const android = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
    expect(summarizeUserAgent(android)).toBe('Chrome / Android')
    const edge = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0'
    expect(summarizeUserAgent(edge)).toBe('Edge / Windows')
    expect(summarizeUserAgent('curl/8')).toBe('')
    expect(summarizeUserAgent(undefined)).toBe('')
  })
})
