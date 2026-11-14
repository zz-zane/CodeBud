import { describe, it, expect, vi } from 'vitest'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSecretStore } from '../../store/safe-storage'

const state = vi.hoisted(() => ({ available: true }))
vi.mock('electron', () => ({ safeStorage: {
  isEncryptionAvailable: () => state.available,
  encryptString: (s: string) => Buffer.from('enc:' + Buffer.from(s).toString('base64')),
  decryptString: (b: Buffer) => { if (!b.toString().startsWith('enc:')) throw new Error(); return Buffer.from(b.toString().slice(4), 'base64').toString() }
} }))

describe('integration safety regressions', () => {
  it('preserves existing encrypted or corrupt bytes when OS encryption is unavailable', () => {
    const dir = mkdtempSync(join(tmpdir(), 'miai-secret-'))
    const store = createSecretStore(dir)
    state.available = true
    store.setApiKey('unit-test-key')
    const before = readFileSync(join(dir, 'ai-secret.bin'))
    state.available = false
    expect(() => store.getApiKey()).toThrow()
    expect(() => store.setApiKey('replacement')).toThrow()
    expect(readFileSync(join(dir, 'ai-secret.bin'))).toEqual(before)
    state.available = true
    writeFileSync(join(dir, 'ai-secret.bin'), 'corrupt')
    expect(() => store.getApiKey()).toThrow()
    expect(() => store.setApiKey('replacement')).toThrow()
    expect(readFileSync(join(dir, 'ai-secret.bin'), 'utf8')).toBe('corrupt')
  })
})
