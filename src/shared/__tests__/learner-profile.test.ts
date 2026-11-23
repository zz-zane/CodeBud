import { describe, expect, it } from 'vitest'
import { hasBannedPhrase } from '../memory-guard'
import { isLearnerMemory, learnerMemoryText, LEARNER_KNOWN_GROUPS, LEARNER_KNOWN_OPTIONS, LEARNER_MEMORY_PREFIX, LEARNER_ZERO } from '../learner-profile'

describe('学习背景 → 记忆文本', () => {
  it('拼出带固定前缀的一行，能被识别', () => {
    const text = learnerMemoryText({ known: ['Python 基础', '操作系统基础'], style: 'concept-only', pace: 'slow', goal: '  期末考\n操作系统 ' })
    expect(text).toBe('【学习背景】已学：Python 基础、操作系统基础；偏好：只要概念，不要代码；讲解速度：慢一点；目标：期末考 操作系统')
    expect(isLearnerMemory(text)).toBe(true)
    expect(isLearnerMemory('我喜欢例子')).toBe(false)
  })

  it('选了零基础就只写零基础；什么都没选写「未填写」；没写目标就不带目标', () => {
    expect(learnerMemoryText({ known: ['零基础', 'Java'], style: 'analogy-first', pace: 'normal' })).toBe('【学习背景】已学：零基础；偏好：先看比喻再看代码；讲解速度：正常')
    expect(learnerMemoryText({ known: [], style: 'code-first', pace: 'normal', goal: '' })).toContain('已学：未填写')
  })

  it('不超过 240 字、不触发记忆的绝对化表述拦截', () => {
    const text = learnerMemoryText({ known: ['Python 基础', 'C 语言', 'C++', 'Java', '数据结构与算法', '操作系统基础', '计算机网络', '数据库'], style: 'analogy-first', pace: 'slow', goal: '很长的目标'.repeat(40) })
    expect(text.length).toBeLessThanOrEqual(240)
    expect(text.startsWith(LEARNER_MEMORY_PREFIX)).toBe(true)
    expect(hasBannedPhrase(text, '')).toBe(false)
  })

  it('调研页的分组正好覆盖「零基础」以外的全部选项，不多不少', () => {
    const grouped = LEARNER_KNOWN_GROUPS.flatMap((g) => [...g.items])
    expect(grouped).toEqual(LEARNER_KNOWN_OPTIONS.filter((o) => o !== LEARNER_ZERO))
  })
})
