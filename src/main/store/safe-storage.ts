/** API keys are persisted only with Electron's OS-backed safeStorage. */
import { safeStorage } from 'electron'
import { createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { hostname, userInfo } from 'node:os'
import { join } from 'node:path'

export interface SecretStore {
  getApiKey(): string
  setApiKey(key: string): void
  clearApiKey(): void
  hasKey(): boolean
  isEncryptionAvailable(): boolean
}

export function createSecretStore(storageDir: string): SecretStore {
  const secretPath = join(storageDir, 'ai-secret.bin')
  function isEncryptionAvailable(): boolean {
    try { return !!safeStorage?.isEncryptionAvailable() } catch { return false }
  }
  function writeEncrypted(key: string): void {
    const encrypted = safeStorage.encryptString(key)
    mkdirSync(storageDir, { recursive: true })
    const temp = join(storageDir, `.ai-secret-${randomBytes(12).toString('hex')}.tmp`)
    try { writeFileSync(temp, encrypted, { flag: 'wx' }); renameSync(temp, secretPath) }
    finally { try { unlinkSync(temp) } catch {} }
  }
  function setApiKey(key: string): void {
    const trimmed = (key || '').trim()
    if (!trimmed) throw new Error('Empty key; use clearApiKey to remove it')
    if (!isEncryptionAvailable()) throw new Error('System encryption is unavailable')
    if (existsSync(secretPath)) getApiKey()
    writeEncrypted(trimmed)
  }
  function getApiKey(): string {
    if (!existsSync(secretPath)) return ''
    if (!isEncryptionAvailable()) throw new Error('System encryption is unavailable; existing key preserved')
    try {
      const buffer = readFileSync(secretPath)
      if (buffer.subarray(0, 4).toString() === 'MGCM') {
        const key = createHash('sha256').update(`miai-lite-standalone-salt:${hostname()}:${userInfo().username}`).digest()
        const decipher = createDecipheriv('aes-256-gcm', key, buffer.subarray(4, 16))
        decipher.setAuthTag(buffer.subarray(16, 32))
        const legacy = Buffer.concat([decipher.update(buffer.subarray(32)), decipher.final()]).toString('utf8').trim()
        if (!legacy) throw new Error('Empty legacy key')
        writeEncrypted(legacy)
        return legacy
      }
      const result = safeStorage.decryptString(buffer).trim()
      if (!result) throw new Error('Empty stored key')
      return result
    } catch { throw new Error('Stored key could not be read or migrated; existing key preserved') }
  }
  function clearApiKey(): void { if (existsSync(secretPath)) unlinkSync(secretPath) }
  function hasKey(): boolean { return existsSync(secretPath) }
  return { getApiKey, setApiKey, clearApiKey, hasKey, isEncryptionAvailable }
}
