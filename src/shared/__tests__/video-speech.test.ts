import { describe, expect, it } from 'vitest'
import { speechText } from '../video-speech'

describe('speechText', () => {
  it('reads symbols only inside backticks and matches multi-character operators first', () => {
    expect(speechText('用 `*p` 和 `&a`，再看 `p->x == 5`。')).toBe('用 星号 p 和 取地址 a，再看 p 箭头 x 等于等于 5。')
    expect(speechText('原文 *p 与未闭合 `&a 保持不变')).toBe('原文 *p 与未闭合 `&a 保持不变')
    expect(speechText('`a!=b && c<=d`')).toBe('a 不等于 b 逻辑与 c 小于等于 d')
  })
})
