import { describe, expect, it } from 'vitest'
import {
  MASTERY_MIN_ATTEMPTS,
  MASTERY_PASS,
  MASTERY_WEAK,
  computeMastery,
  isLessonMastered,
  lessonMastery,
  weakLessonsByMastery
} from '../mastery'
import { studyContext, type StudySnapshot } from '../study-companion'
import type { PracticeSession } from '../types'

function makeSession(id: number, at: string, items: Array<{ lessonId: string; ok: boolean }>): PracticeSession {
  return {
    id,
    uid: `dev:${id}`,
    at,
    mode: 'lesson',
    items: items.map((item, idx) => ({ key: `${item.lessonId}#q${idx}`, ...item }))
  }
}

describe('mastery', () => {
  it('computes weighted mastery over the most recent 5 attempts and caps low-evidence scores', () => {
    expect(computeMastery([])).toBe(0)
    // 1 attempt capped at 0.5
    expect(computeMastery([1])).toBe(0.5)
    expect(computeMastery([0.3])).toBe(0.3)
    // 2 attempts capped at 0.8
    expect(computeMastery([1, 1])).toBe(0.8)
    expect(computeMastery([0.4, 0.6])).toBeCloseTo((0.4 * 0.95 + 0.6 * 1.0) / 1.95, 6)
    // 3+ attempts uncapped, newer attempts weigh more
    expect(computeMastery([1, 1, 1])).toBeCloseTo(1, 6)
    const improving = computeMastery([0, 0, 1, 1, 1])
    const declining = computeMastery([1, 1, 1, 0, 0])
    expect(improving).toBeGreaterThan(declining)
    // Only last 5 count
    expect(computeMastery([0, 0, 0, 1, 1, 1, 1, 1])).toBeCloseTo(1, 6)
  })

  it('derives lesson mastery chronologically from practice history', () => {
    const history: PracticeSession[] = [
      // Out-of-order timestamps: later session has lower accuracy, earlier had high
      makeSession(2, '2026-11-10T12:00:00Z', [
        { lessonId: 'c-01', ok: false },
        { lessonId: 'c-01', ok: true }
      ]),
      makeSession(1, '2026-11-09T12:00:00Z', [
        { lessonId: 'c-01', ok: true },
        { lessonId: 'c-01', ok: true },
        { lessonId: 'c-02', ok: false }
      ]),
      makeSession(3, '2026-11-11T12:00:00Z', [
        { lessonId: 'c-01', ok: false },
        { lessonId: 'c-01', ok: false }
      ])
    ]
    const res = lessonMastery(history, 'c-01')
    expect(res.attempts).toBe(3)
    // scores in chronological order: [1.0, 0.5, 0.0], weights [0.85, 0.95, 1.0]
    const expected = (1.0 * 0.85 + 0.5 * 0.95 + 0.0 * 1.0) / (0.85 + 0.95 + 1.0)
    expect(res.score).toBeCloseTo(expected, 6)
    expect(lessonMastery(history, 'c-99')).toEqual({ score: 0, attempts: 0 })
  })

  it('requires score >= 0.8 and attempts >= 3 to count as mastered', () => {
    expect(MASTERY_PASS).toBe(0.8)
    expect(MASTERY_MIN_ATTEMPTS).toBe(3)
    expect(isLessonMastered(0.8, 2)).toBe(false)
    expect(isLessonMastered(0.79, 3)).toBe(false)
    expect(isLessonMastered(0.8, 3)).toBe(true)
  })

  it('finds practiced weak lessons with mastery < 0.6', () => {
    expect(MASTERY_WEAK).toBe(0.6)
    const history: PracticeSession[] = [
      makeSession(1, '2026-11-09T10:00:00Z', [{ lessonId: 'weak-1', ok: true }]), // 1 attempt capped at 0.5 < 0.6
      makeSession(2, '2026-11-09T11:00:00Z', [{ lessonId: 'strong-1', ok: true }]),
      makeSession(3, '2026-11-10T11:00:00Z', [{ lessonId: 'strong-1', ok: true }]),
      makeSession(4, '2026-11-11T11:00:00Z', [{ lessonId: 'strong-1', ok: true }]),
      makeSession(5, '2026-11-11T12:00:00Z', [{ lessonId: 'unknown-lesson', ok: false }])
    ]
    expect(weakLessonsByMastery(history)).toEqual(['unknown-lesson', 'weak-1'])
    expect(weakLessonsByMastery(history, new Set(['weak-1', 'strong-1']))).toEqual(['weak-1'])
  })

  it('includes current lesson mastery in studyContext when provided', () => {
    const snapshot = {
      version: 1,
      memory: [],
      notes: [],
      materials: [],
      plans: [],
      position: { route: '/lesson/c-01', lessonId: 'c-01', weakLessons: [], progress: { learned: 1, total: 10 } },
      connections: [],
      activeConnectionId: null
    } as unknown as StudySnapshot
    const ctx = studyContext(snapshot, '指针', { lessonId: 'c-01', score: 0.624, attempts: 3 })
    expect(ctx).toContain('"currentLessonMastery":{"lessonId":"c-01","score":0.62,"attempts":3}')
  })
})
