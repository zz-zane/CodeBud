import { describe, expect, it } from 'vitest'
import { assertChatSessions, ensureMainSession, STUDY_MAIN_SESSION_ID } from '../study-companion'

describe('main session', () => {
  it('preserves old sessions and protects the main session across saves', () => {
    const old = [{ id: 'old', title: 'old', createdAt: 1, updatedAt: 1, messages: [] }]
    const first = ensureMainSession(old)
    expect(first[1]).toEqual(old[0])
    expect(ensureMainSession(first)).toEqual(first)
    expect(ensureMainSession(old, first)[0]).toEqual(first[0])
    expect(ensureMainSession([{ ...first[0], title: 'changed' }])[0].title).toBe('主聊天')
    expect(first[0].id).toBe(STUDY_MAIN_SESSION_ID)
  })

  it('keeps persisted main messages when a stale save omits them', () => {
    const first = ensureMainSession([])
    first[0].messages.push({ id: 'question', role: 'user', content: 'keep', createdAt: 1 })
    const stale = [{ ...first[0], createdAt: 999, messages: [] }]
    const saved = ensureMainSession(stale, first)
    expect(saved[0].messages).toEqual(first[0].messages)
    expect(saved[0].createdAt).toBe(first[0].createdAt)
  })

  it('merges updated and new main messages without duplication', () => {
    const previous = ensureMainSession([])
    previous[0].messages = [{ id: 'a', role: 'user', content: 'one', createdAt: 1 }]
    const next = [{ ...previous[0], messages: [
      { id: 'a', role: 'user' as const, content: 'updated', createdAt: 1 },
      { id: 'b', role: 'assistant' as const, content: 'two', createdAt: 2 }
    ] }]
    expect(ensureMainSession(next, previous)[0].messages.map(m => m.content)).toEqual(['updated', 'two'])
  })

  it.each([null, [null], [{ id: 'x' }]])('rejects invalid session data without replacing it', value => {
    expect(() => assertChatSessions(value)).toThrow(TypeError)
  })

  it('rejects duplicate IDs and invalid messages', () => {
    const main = ensureMainSession([])[0]
    expect(() => ensureMainSession([main, main])).toThrow(TypeError)
    expect(() => ensureMainSession([{ ...main, messages: [null as never] }])).toThrow(TypeError)
  })
})
