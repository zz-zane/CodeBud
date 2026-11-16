import { describe, expect, it } from 'vitest'
import { hasBannedPhrase } from '../memory-guard'
import { STUDY_TEXT } from '../study-copy'

describe('memory-guard hasBannedPhrase', () => {
  it('flags all banned absolute phrases when used unquoted', () => {
    for (const phrase of STUDY_TEXT.BANNED_MEMORY_PHRASES) {
      expect(hasBannedPhrase(`学员已经${phrase}指针`), phrase).toBe(true)
    }
    expect(hasBannedPhrase('记住数组下标从 0 开始，需要多练边界条件')).toBe(false)
  })

  it('allows banned phrases inside 「...」, "...", or “...” quotes (learner verbatim)', () => {
    expect(hasBannedPhrase('学员原话说「我已经彻底掌握指针了」，需要用题目核对', '我已经彻底掌握指针了')).toBe(false)
    expect(hasBannedPhrase('自述："热爱算法但总是粗心"，实际错因多在边界条件', '热爱算法但总是粗心')).toBe(false)
    expect(hasBannedPhrase('原话“从来不写注释”，约定练习时先写函数说明', '从来不写注释')).toBe(false)
    expect(hasBannedPhrase('学员「完全掌握」指针', '我在学习指针')).toBe(true)
    expect(hasBannedPhrase('学员原话说「没问题」但助教认为已完全掌握')).toBe(true)
  })
})
