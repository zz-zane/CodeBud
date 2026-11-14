import { describe, expect, it } from 'vitest'
import {
  REVIEW_DAILY_CAP,
  buildSchedule,
  lessonEvents,
  pickDueToday,
  scheduleLesson,
  type LessonSchedule
} from '../review-schedule'
import { daysBetweenKeys } from '../dates'
import type { PracticeSession } from '../types'

const at = (day: string) => `${day}T12:00:00+08:00`
const sess = (day: string, items: Array<[string, boolean]>, id = 1): PracticeSession => ({
  id, uid: `x:${id}`, at: at(day), mode: 'review', items: items.map(([lessonId, ok], i) => ({ key: `${lessonId}:q${i}`, lessonId, ok }))
})
/** [day, ok, total] */
type Ev = [string, number, number]
const evs = (rows: Ev[]) => rows.map(([day, ok, total]) => ({ day, ok, total }))

interface Row { name: string; learnedAt: string | undefined; events: Ev[]; today: string; stage: number; due: string; lastDay?: string | null; overdue: number }
const L = (d: string) => at(d)

const rows: Row[] = [
  { name: '从未练习，今天学 → 明天到期', learnedAt: L('2026-11-13'), events: [], today: '2026-11-13', stage: 0, due: '2026-11-14', lastDay: null, overdue: 0 },
  { name: '昨天学、没练 → 今天到期，逾期 0', learnedAt: L('2026-11-12'), events: [], today: '2026-11-13', stage: 0, due: '2026-11-13', overdue: 0 },
  { name: '10 天前学、没练 → 逾期 9', learnedAt: L('2026-11-03'), events: [], today: '2026-11-13', stage: 0, due: '2026-11-04', overdue: 9 },
  { name: '到期当天答对 → 1 档，+3 天', learnedAt: L('2026-11-01'), events: [['2026-11-02', 1, 1]], today: '2026-11-02', stage: 1, due: '2026-11-05', lastDay: '2026-11-02', overdue: 0 },
  { name: '到期当天只对一半 → 档不变，从当天重排', learnedAt: L('2026-11-01'), events: [['2026-11-02', 1, 2]], today: '2026-11-02', stage: 0, due: '2026-11-03', overdue: 0 },
  { name: '0 档答错 → 仍 0 档', learnedAt: L('2026-11-01'), events: [['2026-11-02', 0, 1]], today: '2026-11-02', stage: 0, due: '2026-11-03', overdue: 0 },
  { name: '逾期后答对 → 升档，从练习当天算', learnedAt: L('2026-11-01'), events: [['2026-11-08', 1, 1]], today: '2026-11-08', stage: 1, due: '2026-11-11', overdue: 0 },
  { name: '提前答对 → 档与到期日都不变', learnedAt: L('2026-11-01'), events: [['2026-11-01', 1, 1]], today: '2026-11-01', stage: 0, due: '2026-11-02', lastDay: '2026-11-01', overdue: 0 },
  { name: '提前答错（1 档）→ 降档并重排', learnedAt: L('2026-11-01'), events: [['2026-11-02', 1, 1], ['2026-11-03', 0, 1]], today: '2026-11-03', stage: 0, due: '2026-11-04', overdue: 0 },
  { name: '正确率恰为 0.8 → 算记住', learnedAt: L('2026-11-01'), events: [['2026-11-02', 4, 5]], today: '2026-11-02', stage: 1, due: '2026-11-05', overdue: 0 },
  { name: '正确率恰为 0.5 → 不算忘了，档不变', learnedAt: L('2026-11-01'), events: [['2026-11-02', 1, 2]], today: '2026-11-02', stage: 0, due: '2026-11-03', overdue: 0 },
  { name: '正确率 4/9 < 0.5 → 忘了（1 档降到 0）', learnedAt: L('2026-11-01'), events: [['2026-11-02', 1, 1], ['2026-11-05', 4, 9]], today: '2026-11-05', stage: 0, due: '2026-11-06', overdue: 0 },
  { name: '学课日之前的事件被忽略', learnedAt: L('2026-11-05'), events: [['2026-11-03', 1, 1]], today: '2026-11-13', stage: 0, due: '2026-11-06', lastDay: null, overdue: 7 },
  { name: 'learnedAt 为 epoch 0 且有练习 → 起点 = 首次练习日', learnedAt: '1970-01-01T00:00:00.000Z', events: [['2026-11-02', 1, 1]], today: '2026-11-02', stage: 0, due: '2026-11-03', lastDay: '2026-11-02', overdue: 0 },
  { name: 'learnedAt 缺失且无练习 → 起点 = 今天', learnedAt: undefined, events: [], today: '2026-11-13', stage: 0, due: '2026-11-14', overdue: 0 },
  { name: 'epoch 0 且无练习 → 起点 = 今天', learnedAt: '1970-01-01T00:00:00.000Z', events: [], today: '2026-11-13', stage: 0, due: '2026-11-14', overdue: 0 },
  { name: '跨年：12-31 学，元旦答对', learnedAt: L('2025-12-31'), events: [['2026-01-01', 1, 1]], today: '2026-01-01', stage: 1, due: '2026-01-04', overdue: 0 }
]

describe('scheduleLesson 场景表', () => {
  for (const r of rows) {
    it(r.name, () => {
      const s = scheduleLesson({ lessonId: 'a', learnedAt: r.learnedAt, events: evs(r.events), todayKey: r.today })
      expect({ stage: s.stage, due: s.due, overdueDays: s.overdueDays }).toEqual({ stage: r.stage, due: r.due, overdueDays: r.overdue })
      if (r.lastDay !== undefined) expect(s.lastDay).toBe(r.lastDay)
    })
  }

  it('连续按时答对：1→3→7→14→30→60，最高档之后仍是 60', () => {
    const days = ['2026-01-02', '2026-01-05', '2026-01-12', '2026-01-26', '2026-02-25', '2026-04-26', '2026-06-25']
    const expectDue = ['2026-01-05', '2026-01-12', '2026-01-26', '2026-02-25', '2026-04-26', '2026-06-25', '2026-08-24']
    const expectStage = [1, 2, 3, 4, 5, 5, 5]
    days.forEach((_, i) => {
      const s = scheduleLesson({ lessonId: 'a', learnedAt: L('2026-01-01'), events: evs(days.slice(0, i + 1).map((d) => [d, 1, 1] as Ev)), todayKey: days[i] })
      expect([s.stage, s.due]).toEqual([expectStage[i], expectDue[i]])
    })
  })

  it('3 档到期答错 → 2 档，+7 天', () => {
    const e: Ev[] = [['2026-01-02', 1, 1], ['2026-01-05', 1, 1], ['2026-01-12', 1, 1], ['2026-01-26', 0, 1]]
    const s = scheduleLesson({ lessonId: 'a', learnedAt: L('2026-01-01'), events: evs(e), todayKey: '2026-01-26' })
    expect([s.stage, s.due]).toEqual([2, '2026-02-02'])
  })
})

describe('buildSchedule / lessonEvents', () => {
  it('同一天多次练习合成一个事件：1/2 + 3/3 = 0.8 → 记住', () => {
    const h = [sess('2026-11-02', [['a', true], ['a', false]], 1), sess('2026-11-02', [['a', true], ['a', true], ['a', true]], 2)]
    expect(lessonEvents(h, ['a']).get('a')).toEqual([{ day: '2026-11-02', ok: 4, total: 5 }])
    const [s] = buildSchedule({ lessons: ['a'], learnedAt: { a: L('2026-11-01') }, history: h, todayKey: '2026-11-02' })
    expect([s.stage, s.due]).toEqual([1, '2026-11-05'])
  })
  it('按课、按日分组，事件按日期升序；不在名单里的课忽略；非法时间跳过', () => {
    const h = [sess('2026-11-05', [['a', true], ['b', true]]), sess('2026-11-02', [['a', false]]), { ...sess('2026-11-03', [['a', true]]), at: 'bad' }]
    const m = lessonEvents(h, ['a'])
    expect(m.get('a')?.map((e) => e.day)).toEqual(['2026-11-02', '2026-11-05'])
    expect(m.has('b')).toBe(false)
  })
  it('北京日界：UTC 前一天 20:00 属于北京次日', () => {
    const h: PracticeSession[] = [{ ...sess('2026-11-02', [['a', true]]), at: '2026-11-01T20:00:00.000Z' }]
    expect(lessonEvents(h, ['a']).get('a')?.[0].day).toBe('2026-11-02')
  })
  it('今天复习并答对的课不在今日份里', () => {
    const base = { lessons: ['a'], learnedAt: { a: L('2026-11-01') }, todayKey: '2026-11-13' }
    expect(pickDueToday(buildSchedule({ ...base, history: [] }), '2026-11-13').today).toEqual(['a'])
    expect(pickDueToday(buildSchedule({ ...base, history: [sess('2026-11-13', [['a', true]])] }), '2026-11-13').today).toEqual([])
  })
  it('5000 条练习史重算很快', () => {
    const lessons = Array.from({ length: 200 }, (_, i) => `l${i}`)
    const h = Array.from({ length: 5000 }, (_, i) => sess(`2026-0${1 + (i % 9)}-${String(1 + (i % 28)).padStart(2, '0')}`, [[lessons[i % 200], i % 3 !== 0], [lessons[(i * 7) % 200], true]], i))
    const t0 = performance.now()
    const sch = buildSchedule({ lessons, learnedAt: {}, history: h, todayKey: '2026-11-13' })
    pickDueToday(sch, '2026-11-13')
    const ms = performance.now() - t0
    console.log(`[perf] 5000 sessions, 200 lessons: ${ms.toFixed(1)} ms`)
    expect(ms).toBeLessThan(200)
  })
})

describe('pickDueToday', () => {
  const S = (lessonId: string, stage: number, overdueDays: number, due = '2026-11-13'): LessonSchedule => ({ lessonId, stage, due, lastDay: null, overdueDays })
  it('逾期多的在前 → 档低的在前 → 课号小的在前；未到期的排除', () => {
    const r = pickDueToday([S('c', 1, 2), S('a', 2, 2), S('b', 1, 2), S('z', 0, 5), S('future', 0, 0, '2026-11-14')], '2026-11-13')
    expect(r.all).toEqual(['z', 'b', 'c', 'a'])
    expect(r.total).toBe(4)
  })
  it('37 课到期，今日份 15 课，逾期最多的先', () => {
    const sch = Array.from({ length: 37 }, (_, i) => S(`l${String(i).padStart(2, '0')}`, 0, i))
    const r = pickDueToday(sch, '2026-11-13')
    expect(r.total).toBe(37)
    expect(r.today).toHaveLength(REVIEW_DAILY_CAP)
    expect(r.today[0]).toBe('l36')
    expect(r.today[14]).toBe('l22')
  })
  it('空池', () => expect(pickDueToday([], '2026-11-13')).toEqual({ total: 0, today: [], all: [] }))
})

describe('daysBetweenKeys', () => {
  it('跨月 / 跨年 / 闰年 / 反向 / 非法', () => {
    expect(daysBetweenKeys('2026-01-31', '2026-02-01')).toBe(1)
    expect(daysBetweenKeys('2025-12-31', '2026-01-01')).toBe(1)
    expect(daysBetweenKeys('2024-02-28', '2024-03-01')).toBe(2)
    expect(daysBetweenKeys('2025-02-28', '2025-03-01')).toBe(1)
    expect(daysBetweenKeys('2026-11-13', '2026-11-03')).toBe(-10)
    expect(daysBetweenKeys('x', '2026-11-03')).toBeNull()
  })
})
