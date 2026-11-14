import { describe, expect, it, vi } from 'vitest'
vi.mock('electron', () => ({ safeStorage: { isEncryptionAvailable: () => true, encryptString: (s: string) => Buffer.from('enc:' + Buffer.from(s).toString('base64')), decryptString: (b: Buffer) => Buffer.from(b.toString().slice(4), 'base64').toString() } }))
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolveOpenAiChatUrl, resolveAnthropicMessagesUrl } from '../endpoint-url'
import { createSecretStore } from '../../store/safe-storage'

describe('AI 助教核心链路专项安全测试', () => {
  it('URL 规范化测试：支持多层路径与默认兜底', () => {
    expect(resolveOpenAiChatUrl('')).toBe('https://api.deepseek.com/chat/completions')
    expect(resolveOpenAiChatUrl('https://api.openai.com/v1')).toBe('https://api.openai.com/v1/chat/completions')
    expect(resolveOpenAiChatUrl('https://my-proxy.com/chat/completions')).toBe('https://my-proxy.com/chat/completions')

    expect(resolveAnthropicMessagesUrl('')).toBe('https://api.anthropic.com/v1/messages')
    expect(resolveAnthropicMessagesUrl('https://api.anthropic.com/v1')).toBe('https://api.anthropic.com/v1/messages')
    expect(resolveAnthropicMessagesUrl('https://my-proxy.com/messages')).toBe('https://my-proxy.com/messages')
  })

  it('SafeStorage 独立测试：OS safeStorage 加密落盘且不泄露明文', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'miai-safe-'))
    try {
      const store = createSecretStore(tmpDir)
      expect(store.hasKey()).toBe(false)
      expect(store.getApiKey()).toBe('')

      const testKey = 'sk-miai-super-secret-key-123456789'
      store.setApiKey(testKey)

      expect(store.hasKey()).toBe(true)
      expect(store.getApiKey()).toBe(testKey)

      // 验证磁盘文件绝对不包含明文
      const rawFile = readFileSync(join(tmpDir, 'ai-secret.bin'), 'utf8')
      expect(rawFile).not.toContain(testKey)

      store.clearApiKey()
      expect(store.hasKey()).toBe(false)
      expect(store.getApiKey()).toBe('')
    } finally {
      rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})
