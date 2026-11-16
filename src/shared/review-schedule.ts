/**
 * 复习间隔排程（docs/32）：完全由 profile.learnedAt + 练习史推导，不落盘。
 * 纯函数，无 Vue / Electron 依赖。日键一律走 shared/dates.ts。
 */
import { daysBetweenKeys, localDateKeyOf, shiftDateKey } from './dates'
import type { PracticeSession, ReviewStrategy } from './types'

export const REVIEW_STRATEGIES = {
  standard: [1, 3, 7, 14, 30, 60],
  sprint: [1, 1, 2, 3, 4, 7]
} as const satisfies Record<ReviewStrategy, readonly number[]>

export const REVIEW_INTERVALS_DAYS = REVIEW_STRATEGIES.standard
export const REVIEW_PASS = 0.8
export const REVIEW_FAIL = 0.5
export const REVIEW_DAILY_CAP = 15

function resolveIntervals(intervals?: readonly number[] | ReviewStrategy): readonly number[] {
  if (typeof intervals === 'string') return REVIEW_STRATEGIES[intervals] ?? REVIEW_STRATEGIES.standard
  return intervals && intervals.length > 0 ? intervals : REVIEW_STRATEGIES.standard
}
/** 早于此时刻的 learnedAt 视为回填值（epoch 0） */
const BACKFILL_BEFORE = Date.parse('2000-01-01T00:00:00Z')

export interface LessonEvent {
  day: string
  ok: number
  total: number
}

export interface LessonSchedule {
  lessonId: string
  stage: number
  due: string
  lastDay: string | null
  overdueDays: number
}

/** 一次遍历练习史：按课、按日聚合，每课的事件按日期升序 */
export function lessonEvents(
  history: readonly PracticeSession[],
  lessonIds: Iterable<string>
): Map<string, LessonEvent[]> {
  const want = new Set(lessonIds)
  const byLesson = new Map<string, Map<string, LessonEvent>>()
  for (const s of history) {
    const day = localDateKeyOf(s.at)
    if (!day) continue
    for (const it of s.items) {
      if (!want.has(it.lessonId)) continue
      let days = byLesson.get(it.lessonId)
      if (!days) byLesson.set(it.lessonId, (days = new Map()))
      let ev = days.get(day)
      if (!ev) days.set(day, (ev = { day, ok: 0, total: 0 }))
      ev.total += 1
      if (it.ok) ev.ok += 1
    }
  }
  const out = new Map<string, LessonEvent[]>()
  for (const [id, days] of byLesson) out.set(id, [...days.values()].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0)))
  return out
}

function plus(day: string, n: number): string {
  return shiftDateKey(day, n) ?? day
}

export function scheduleLesson(p: {
  lessonId: string
  learnedAt: string | undefined
  events: readonly LessonEvent[]
  todayKey: string
  intervals?: readonly number[] | ReviewStrategy
}): LessonSchedule {
  const { events, todayKey } = p
  const days = resolveIntervals(p.intervals)
  const maxStage = days.length - 1
  const t = p.learnedAt ? Date.parse(p.learnedAt) : NaN
  const learnedKey = Number.isNaN(t) || t < BACKFILL_BEFORE ? null : localDateKeyOf(p.learnedAt as string)
  const anchor = learnedKey ?? events[0]?.day ?? todayKey

  let stage = 0
  let due = plus(anchor, days[0])
  let lastDay: string | null = null
  for (const e of events) {
    if (e.day < anchor) continue
    const acc = e.ok / e.total
    if (acc < REVIEW_FAIL) {
      stage = Math.max(0, stage - 1)
      due = plus(e.day, days[stage])
    } else if (e.day >= due) {
      if (acc >= REVIEW_PASS) stage = Math.min(maxStage, stage + 1)
      due = plus(e.day, days[stage])
    }
    lastDay = e.day
  }
  const late = daysBetweenKeys(due, todayKey) ?? 0
  return { lessonId: p.lessonId, stage, due, lastDay, overdueDays: Math.max(0, late) }
}

export function buildSchedule(p: {
  lessons: readonly string[]
  learnedAt: Readonly<Record<string, string>>
  history: readonly PracticeSession[]
  todayKey: string
  intervals?: readonly number[] | ReviewStrategy
}): LessonSchedule[] {
  const events = lessonEvents(p.history, p.lessons)
  return p.lessons.map((lessonId) =>
    scheduleLesson({ lessonId, learnedAt: p.learnedAt[lessonId], events: events.get(lessonId) ?? [], todayKey: p.todayKey, intervals: p.intervals })
  )
}

/** 到期集合按 overdueDays 降序 → stage 升序 → lessonId 升序；today = 前 cap 课 */
export function pickDueToday(
  schedule: readonly LessonSchedule[],
  todayKey: string,
  cap: number = REVIEW_DAILY_CAP
): { total: number; today: string[]; all: string[] } {
  const all = schedule
    .filter((s) => s.due <= todayKey)
    .sort((a, b) => b.overdueDays - a.overdueDays || a.stage - b.stage || (a.lessonId < b.lessonId ? -1 : a.lessonId > b.lessonId ? 1 : 0))
    .map((s) => s.lessonId)
  return { total: all.length, today: all.slice(0, cap), all }
}
