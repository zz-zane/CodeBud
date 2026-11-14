/**
 * 复习页组卷（docs/32 §3.2）：今天有到期的课时只从这些课里抽题；没有到期时从整个复习池抽（自由复习）。
 * 四个 store 用替身，runner 真跑到 quiz.startQuiz。
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it, vi } from 'vitest'
import { maskComments } from '../../../../shared/__tests__/mask-comments'
import { REVIEW, TODAY } from '../copy'

const fx = vi.hoisted(() => {
  const lessons = ['c-01', 'c-02', 'c-03', 'c-04']
  const index = lessons.flatMap((l) =>
    [1, 2, 3, 4, 5, 6].map((n) => ({ key: `${l}:q${n}`, lessonId: l, lang: 'c', stage: 1, type: 'single', difficulty: 'easy', tags: [], stem: 's' }))
  )
  return {
    lessons,
    index,
    content: {
      questionIndex: index,
      lessonOf: (id: string) => ({ questions: [1, 2, 3, 4, 5, 6].map((n) => ({ id: `q${n}`, type: 'single', stem: id, options: ['a', 'b'], answer: 0 })) })
    },
    progress: { loaded: true, learnedSet: new Set(lessons) },
    practice: { loaded: true, history: [] as unknown[], load: async () => {} },
    quiz: { wrongbook: [] as unknown[], startQuiz: vi.fn() }
  }
})
vi.mock('../../stores/content', () => ({ useContentStore: () => fx.content }))
vi.mock('../../stores/progress', () => ({ useProgressStore: () => fx.progress }))
vi.mock('../../stores/practice', () => ({ usePracticeStore: () => fx.practice }))
vi.mock('../../stores/quiz', () => ({ useQuizStore: () => fx.quiz }))

import { storeDeps, useReviewRunner } from '../review-practice'

const lessonsOfKeys = (keys: string[]) => [...new Set(keys.map((k) => k.split(':')[0]))].sort()

describe('复习组卷只用今日到期的课', () => {
  it('storeDeps：有到期 → lessons = 到期列表；没有 → 整个池', () => {
    expect(storeDeps('all', ['c-02', 'c-03'])?.lessons).toEqual(['c-02', 'c-03'])
    expect(storeDeps('all', [])?.lessons).toEqual(fx.lessons)
    expect(storeDeps('all')?.lessons).toEqual(fx.lessons)
    // 题目索引仍按范围筛，不因到期而缩小
    expect(storeDeps('all', ['c-02'])?.index).toHaveLength(24)
  })

  it('runner：有到期时每一道题都属于到期的课；没有到期时覆盖整个池', async () => {
    const { start } = useReviewRunner()
    fx.quiz.startQuiz.mockClear()
    expect(await start(20, 'all', ['c-02', 'c-04'])).toBeGreaterThan(0)
    const dueKeys = fx.quiz.startQuiz.mock.calls[0][3] as string[]
    expect(lessonsOfKeys(dueKeys)).toEqual(['c-02', 'c-04'])

    fx.quiz.startQuiz.mockClear()
    expect(await start(20, 'all', [])).toBeGreaterThan(0)
    expect(lessonsOfKeys(fx.quiz.startQuiz.mock.calls[0][3] as string[])).toEqual(fx.lessons)
  })
})

describe('ReviewView 静态契约', () => {
  const view = readFileSync(join(__dirname, '..', '..', 'views', 'ReviewView.vue'), 'utf8')
  const code = maskComments(view)
  it('新文案全走 copy.ts，视图里没有写死中文', () => {
    expect(code).not.toMatch(/[一-鿿]/)
    for (const key of ['dueStatus', 'NO_DUE', 'START_FREE']) {
      expect(code).toContain(`REVIEW.${key}`)
      expect(Object.keys(REVIEW)).toContain(key)
    }
  })
  it('数字来自共用的 useTodayCounts，不自己算排程', () => {
    expect(code).toContain("from '../lib/use-today-counts'")
    expect(code).not.toContain('buildSchedule')
  })
  it('文案内容', () => {
    expect(REVIEW.dueStatus(12, 12)).toBe('今天到期 12 课')
    expect(REVIEW.dueStatus(15, 37)).toBe('今天到期 15 课 · 共 37 课到期')
    expect(REVIEW.NO_DUE).toBe('今天没有到期的课')
    expect(TODAY.dueTotalTitle(37, 15)).toBe('共 37 课到期，今天先复习 15 课')
  })
})
