import { describe, expect, it } from 'vitest'
import { wordBoundsAt } from '../cet6-tap-select'

const at = (text: string, offset: number): string | null => {
  const b = wordBoundsAt(text, offset)
  return b ? text.slice(b[0], b[1]) : null
}

describe('手机长按选词：找手指下的单词', () => {
  const s = "Schools haven't done well-known work, he said."
  it('词中间、词首、词尾右侧都能取到整词', () => {
    expect(at(s, 2)).toBe('Schools')
    expect(at(s, 0)).toBe('Schools')
    expect(at(s, 7)).toBe('Schools') // 落在词后的空格上，取左边的词
  })
  it('撇号、连字符连着的算一个词；句末标点不算进去', () => {
    expect(at(s, 10)).toBe("haven't")
    expect(at(s, 23)).toBe('well-known')
    expect(at(s, s.length - 2)).toBe('said')
  })
  it('空白与标点之间、越界、中文都返回 null', () => {
    expect(at('a , b', 2)).toBeNull()
    expect(at('', 0)).toBeNull()
    expect(at('中文没有单词', 2)).toBeNull()
    expect(at('word', 99)).toBe('word')
  })
  it('词边上的连字符不算进词（“--” 破折号）', () => {
    expect(at('end -- start', 1)).toBe('end')
    expect(at('end -- start', 4)).toBeNull()
  })
})
