import { describe, expect, it } from 'vitest'
import { computeUnlocked, statusOf, type Unlockable } from '../unlock'

describe('computeUnlocked 自由选课模式', () => {
  it('所有课程天然自由可学', () => {
    const all: Unlockable[] = [
      { id: 'a', required: [] },
      { id: 'b', required: ['a'] },
      { id: 'c', required: ['b'] }
    ]
    const unlocked = computeUnlocked(all, new Set())
    expect(unlocked.has('a')).toBe(true)
    expect(unlocked.has('b')).toBe(true)
    expect(unlocked.has('c')).toBe(true)
  })

  it('空档案时也能直接解锁所有进阶课程', () => {
    const all: Unlockable[] = [
      { id: 'c-stage3-01', required: ['c-stage2-10'] },
      { id: 'python-stage3-05', required: ['python-stage2-08'] }
    ]
    const got = computeUnlocked(all, new Set())
    expect(got.has('c-stage3-01')).toBe(true)
    expect(got.has('python-stage3-05')).toBe(true)
  })

  it('已学的课继续保留在解锁集合', () => {
    const all: Unlockable[] = [{ id: 'a', required: [] }]
    expect(computeUnlocked(all, new Set(['b'])).has('b')).toBe(true)
  })
})

describe('statusOf 状态判定（自由选课）', () => {
  it('lesson 不存在 → missing', () => {
    expect(statusOf('x', undefined, new Set(), new Set())).toBe('missing')
  })
  it('已学优先于一切 → learned', () => {
    const l: Unlockable = { id: 'a', required: [] }
    expect(statusOf('a', l, new Set(['a']), new Set())).toBe('learned')
  })
  it('未学课程均自由开放 → open（不产生 locked）', () => {
    const l: Unlockable = { id: 'a', required: ['some-pre'] }
    expect(statusOf('a', l, new Set(), new Set())).toBe('open')
  })
})
