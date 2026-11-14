import { describe, expect, it } from 'vitest'
import { validChatExtras } from '../chat-request'

describe('AI request attachment and effort validation', () => {
  const file = { id: 'id', name: 'code.py', size: 3, kind: 'file', textContent: 'abc' }
  it('accepts optional extras and each supported effort, up to six bounded files', () => {
    expect(validChatExtras(undefined, undefined)).toBe(true)
    for (const effort of ['low', 'medium', 'high', 'xhigh']) expect(validChatExtras(effort, Array(6).fill(file))).toBe(true)
    expect(validChatExtras('medium', [{ ...file, textContent: 'x'.repeat(20000) }])).toBe(true)
  })
  it('rejects malformed values, paths, oversized text and excess attachments', () => {
    for (const effort of ['max', '', null, {}, 2]) expect(validChatExtras(effort, undefined)).toBe(false)
    for (const attachments of [null, {}, [null], Array(7).fill(file), [{ ...file, id: '' }], [{ ...file, name: '../secret' }], [{ ...file, name: 'a\nb' }], [{ ...file, size: -1 }], [{ ...file, size: 1.5 }], [{ ...file, kind: 'binary' }], [{ ...file, textContent: 'x'.repeat(20001) }], [{ ...file, path: 'secret' }]]) {
      expect(validChatExtras('medium', attachments)).toBe(false)
    }
  })
})
