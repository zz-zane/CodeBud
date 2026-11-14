import { describe, expect, it } from 'vitest'
import {
  buildLearnerMemoryProfile,
  formatLearnerMemoryTagContent
} from '../learner-memory'
import type { AiChatContextTag, WrongBookEntry } from '../../../../shared/types'

describe('learner-memory module', () => {
  const dummyLessonTitles: Record<string, string> = {
    'c-1': 'C语言指针基础',
    'c-2': '动态内存分配',
    'algo-1': '二分查找',
    'algo-2': '快速排序'
  }
  const lessonTitleOf = (id: string) => dummyLessonTitles[id] || id

  it('builds full L1/L2/L3 profile accurately', () => {
    const wrongbook: WrongBookEntry[] = [
      {
        key: 'q1', qid: 'q1', cleared: false,
        lessonId: 'c-1',
        wrongCount: 3,
        lastWrongAt: '2026-10-31T08:00:00Z',
        hole: true,
        removedAt: undefined
      },
      {
        key: 'q2', qid: 'q2', cleared: false,
        lessonId: 'c-1',
        wrongCount: 2,
        lastWrongAt: '2026-10-31T08:10:00Z',
        hole: false,
        removedAt: undefined
      },
      {
        key: 'q3', qid: 'q3', cleared: false,
        lessonId: 'algo-1',
        wrongCount: 4,
        lastWrongAt: '2026-10-31T08:20:00Z',
        hole: true,
        removedAt: undefined
      },
      {
        key: 'q4-removed', qid: 'q4-removed', cleared: false,
        lessonId: 'c-2',
        wrongCount: 5,
        lastWrongAt: '2026-10-31T08:30:00Z',
        hole: true,
        removedAt: '2026-10-31T09:00:00Z' // Should be excluded from active
      }
    ]

    const contextTags: AiChatContextTag[] = [
      { id: '1', type: 'error', title: '编译报错', content: 'segmentation fault' },
      { id: '2', type: 'code', title: '示例代码', content: 'int *p = NULL;' }
    ]

    const profile = buildLearnerMemoryProfile({
      learnedIds: ['c-1', 'algo-1'],
      totalLessons: 10,
      wrongbook,
      activeLessonId: 'c-1',
      contextTags,
      lessonTitleOf
    })

    // L1 checks
    expect(profile.l1Session.activeLessonId).toBe('c-1')
    expect(profile.l1Session.activeLessonTitle).toBe('C语言指针基础')
    expect(profile.l1Session.hasErrorTag).toBe(true)
    expect(profile.l1Session.hasCodeTag).toBe(true)
    expect(profile.l1Session.focusSummary).toContain('C语言指针基础')

    // L2 checks (only active entries: q1, q2, q3)
    expect(profile.l2Weakness.activeWrongCount).toBe(3)
    expect(profile.l2Weakness.holeCount).toBe(2)
    expect(profile.l2Weakness.topWeakLessons).toHaveLength(2)

    // c-1 totalWrongTimes: 3+2=5, algo-1: 4. So c-1 is top 1
    expect(profile.l2Weakness.topWeakLessons[0].lessonId).toBe('c-1')
    expect(profile.l2Weakness.topWeakLessons[0].totalWrongTimes).toBe(5)
    expect(profile.l2Weakness.topWeakLessons[0].count).toBe(2)

    expect(profile.l2Weakness.topWeakLessons[1].lessonId).toBe('algo-1')
    expect(profile.l2Weakness.topWeakLessons[1].totalWrongTimes).toBe(4)
    expect(profile.l2Weakness.topWeakLessons[1].count).toBe(1)

    // L3 checks (2/10 = 20%)
    expect(profile.l3Global.learnedCount).toBe(2)
    expect(profile.l3Global.totalCount).toBe(10)
    expect(profile.l3Global.masteryPercent).toBe(20)
    expect(profile.l3Global.stageSummary).toContain('入门启蒙')
  })

  it('formats compact learner memory tag content within 500 characters', () => {
    const profile = buildLearnerMemoryProfile({
      learnedIds: ['c-1', 'c-2', 'algo-1', 'algo-2'],
      totalLessons: 10,
      wrongbook: [
        {
          key: 'q1', qid: 'q1', cleared: false,
          lessonId: 'algo-1',
          wrongCount: 2,
          lastWrongAt: '2026-10-31T08:00:00Z',
          hole: false,
          removedAt: undefined
        }
      ],
      activeLessonId: 'algo-2',
      contextTags: [],
      lessonTitleOf
    })

    const text = formatLearnerMemoryTagContent(profile)
    expect(text).toContain('【L1 瞬时现场】')
    expect(text).toContain('【L2 薄弱记忆】')
    expect(text).toContain('【L3 全局阶段】')
    expect(text).toContain('快速排序')
    expect(text).toContain('二分查找')
    expect(text.length).toBeLessThan(500)
  })

  it('handles empty / zero cases gracefully', () => {
    const profile = buildLearnerMemoryProfile({
      learnedIds: [],
      totalLessons: 0,
      wrongbook: [],
      activeLessonId: null,
      contextTags: [],
      lessonTitleOf
    })

    expect(profile.l1Session.activeLessonId).toBeNull()
    expect(profile.l2Weakness.activeWrongCount).toBe(0)
    expect(profile.l2Weakness.topWeakLessons).toHaveLength(0)
    expect(profile.l3Global.masteryPercent).toBe(0)

    const text = formatLearnerMemoryTagContent(profile)
    expect(text).toContain('【L1 瞬时现场】')
    expect(text).toContain('【L2 薄弱记忆】')
    expect(text).toContain('【L3 全局阶段】')
    expect(text.length).toBeLessThan(500)
  })
})
