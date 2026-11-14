import { describe, expect, it } from 'vitest'
import { isPinnedToBottom, shouldSendAiMessage } from '../ai-input'

describe('AI input keys', () => {
  const event = { key: 'Enter', shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, isComposing: false, keyCode: 13 }
  it('only sends an unmodified Enter outside IME composition', () => {
    expect(shouldSendAiMessage(event, false)).toBe(true)
    for (const patch of [{shiftKey:true},{ctrlKey:true},{altKey:true},{metaKey:true},{isComposing:true},{keyCode:229},{key:'a'}]) expect(shouldSendAiMessage({...event,...patch}, false)).toBe(false)
    expect(shouldSendAiMessage(event, true)).toBe(false)
  })
})

describe('isPinnedToBottom (DESIGN CLAUDE-v1 §6.3)', () => {
  // clientHeight 500、scrollHeight 1000：离底 = 1000 - top - 500
  it('47px from the bottom still follows', () => expect(isPinnedToBottom(1000, 453, 500)).toBe(true))
  it('exactly 48px from the bottom stops following', () => expect(isPinnedToBottom(1000, 452, 500)).toBe(false))
  it('49px from the bottom stops following', () => expect(isPinnedToBottom(1000, 451, 500)).toBe(false))
  it('short content that does not scroll counts as pinned', () => expect(isPinnedToBottom(300, 0, 500)).toBe(true))
})
