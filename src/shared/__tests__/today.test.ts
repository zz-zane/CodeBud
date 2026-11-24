import { describe, expect, it } from 'vitest'
import {
  estimateMinutes,
  nextTasks,
  pickActivePlan,
  pickCet6InProgress,
  planDay,
  planProgress,
  relativeDayLabel,
  topTwoModules,
  weekDots
} from '../today'
import type { StudyPlan } from '../study-companion'
import type { Cet6Meta, Cet6Record } from '../cet6'

const task = (id: string, status: 'todo' | 'doing' | 'done' = 'todo') => ({ id, title: id, description: '', status })
const plan = (id: string, createdAt: number, statuses: Array<'todo' | 'doing' | 'done'>, draft = false): StudyPlan => ({
  id, title: id, materialId: 'm', createdAt, source: 'ai', draft, tasks: statuses.map((s, i) => task(`${id}-${i}`, s))
})

describe('estimateMinutes', () => {
  it('全 0 → 0', () => expect(estimateMinutes({ review: 0, wrong: 0, vocab: 0 })).toBe(0))
  it('向上取整到 5 分钟', () => {
    expect(estimateMinutes({ review: 1, wrong: 0, vocab: 0 })).toBe(5)
    expect(estimateMinutes({ review: 5, wrong: 0, vocab: 0 })).toBe(5) // 300s 整
    expect(estimateMinutes({ review: 6, wrong: 0, vocab: 0 })).toBe(10)
    expect(estimateMinutes({ review: 12, wrong: 5, vocab: 18 })).toBe(25) // 720+300+270=1290s=21.5min
    expect(estimateMinutes({ review: 0, wrong: 5, vocab: 0 })).toBe(5) // 300s = 5min 整
    expect(estimateMinutes({ review: 0, wrong: 6, vocab: 0 })).toBe(10)
  })
  it('负数当 0', () => expect(estimateMinutes({ review: -3, wrong: 0, vocab: 0 })).toBe(0))
})

describe('weekDots', () => {
  it('周一为首，七格；过去没学 = missed，今天未学 = today，之后 = future', () => {
    const d = weekDots(['2026-11-09', '2026-11-10'], '2026-11-13') // 周五
    expect(d.map((x) => x.key)).toEqual(['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'])
    expect(d.map((x) => x.state)).toEqual(['done', 'done', 'missed', 'missed', 'today', 'future', 'future'])
    expect(d.map((x) => x.isToday)).toEqual([false, false, false, false, true, false, false])
  })
  it('今天已学 → state 是 done，isToday 仍标出今天', () => {
    expect(weekDots(['2026-11-13'], '2026-11-13')[4]).toEqual({ key: '2026-11-13', state: 'done', isToday: true })
  })
  it('周日当天：本周是前面六天 + 今天', () => {
    const d = weekDots([], '2026-11-15')
    expect(d[0].key).toBe('2026-11-09')
    expect(d[6]).toEqual({ key: '2026-11-15', state: 'today', isToday: true })
  })
  it('周一当天', () => expect(weekDots([], '2026-11-09')[0].state).toBe('today'))
  it('跨月：周三 2026-12-02 的那周从 11-30 开始', () => {
    const d = weekDots([], '2026-12-02')
    expect(d[0].key).toBe('2026-11-30')
    expect(d[6].key).toBe('2026-12-06')
  })
  it('跨年：2027-01-01（周五）的那周从 2026-12-28 开始', () => {
    const d = weekDots(['2026-12-31'], '2027-01-01')
    expect(d[0].key).toBe('2026-12-28')
    expect(d[3]).toEqual({ key: '2026-12-31', state: 'done', isToday: false })
    expect(d[6].key).toBe('2027-01-03')
  })
  it('日键非法 → 空', () => expect(weekDots([], 'nope')).toEqual([]))
})

describe('relativeDayLabel', () => {
  it('今天 / 昨天 / n 天前', () => {
    expect(relativeDayLabel('2026-11-13', '2026-11-13')).toBe('今天')
    expect(relativeDayLabel('2026-11-12', '2026-11-13')).toBe('昨天')
    expect(relativeDayLabel('2026-11-10', '2026-11-13')).toBe('3 天前')
    expect(relativeDayLabel('2026-10-31', '2026-11-02')).toBe('2 天前')
  })
  it('接受 ISO（北京日界）：UTC 16:30 已是北京次日', () => {
    expect(relativeDayLabel('2026-11-12T16:30:00.000Z', '2026-11-13')).toBe('今天')
    expect(relativeDayLabel('2026-11-12T15:30:00.000Z', '2026-11-13')).toBe('昨天')
  })
  it('未来按今天；解析不了 → 空串', () => {
    expect(relativeDayLabel('2026-11-20', '2026-11-13')).toBe('今天')
    expect(relativeDayLabel('garbage', '2026-11-13')).toBe('')
  })
})

describe('topTwoModules', () => {
  it('空 → 空', () => expect(topTwoModules({})).toEqual([]))
  it('0 不入列', () => expect(topTwoModules({ a: 0, b: 0 })).toEqual([]))
  it('超过两个只取最多的两个，降序', () => {
    expect(topTwoModules({ C: 5, 通用知识: 7, Java: 2, Python: 1 })).toEqual([['通用知识', 7], ['C', 5]])
  })
  it('只有一个', () => expect(topTwoModules({ C: 3, Java: 0 })).toEqual([['C', 3]]))
  it('同数保持传入顺序', () => expect(topTwoModules({ x: 4, y: 4, z: 4 })).toEqual([['x', 4], ['y', 4]]))
})

describe('planDay', () => {
  const t = (iso: string) => Date.parse(iso)
  it('同一天 = 第 1 天', () => expect(planDay(t('2026-11-13T01:00:00+08:00'), t('2026-11-13T23:00:00+08:00'))).toBe(1))
  it('按自然日而非 24 小时', () => {
    expect(planDay(t('2026-11-12T23:59:00+08:00'), t('2026-11-13T00:01:00+08:00'))).toBe(2)
  })
  it('跨月', () => expect(planDay(t('2026-10-30T10:00:00+08:00'), t('2026-11-02T10:00:00+08:00'))).toBe(4))
  it('创建时间在未来 → 1', () => expect(planDay(t('2026-11-20T10:00:00+08:00'), t('2026-11-13T10:00:00+08:00'))).toBe(1))
})

describe('pickActivePlan / nextTasks / planProgress', () => {
  it('空 → null', () => expect(pickActivePlan([])).toBeNull())
  it('全部完成的计划不算；取 createdAt 最大；草稿不参与', () => {
    const picked = pickActivePlan([
      plan('old', 1, ['todo']),
      plan('done', 9, ['done', 'done']),
      plan('draft-newest', 20, ['todo'], true),
      plan('new', 5, ['done', 'doing'])
    ])
    expect(picked?.id).toBe('new')
    expect(pickActivePlan([plan('only-draft', 10, ['todo'], true)])).toBeNull()
  })
  it('没有任务的计划不算', () => expect(pickActivePlan([plan('empty', 5, [])])).toBeNull())
  it('createdAt 相同取靠前', () => expect(pickActivePlan([plan('a', 5, ['todo']), plan('b', 5, ['todo'])])?.id).toBe('a'))
  it('nextTasks 取前 3 条未完成', () => {
    const p = plan('p', 1, ['done', 'todo', 'doing', 'todo', 'todo'])
    expect(nextTasks(p).map((x) => x.id)).toEqual(['p-1', 'p-2', 'p-3'])
    expect(nextTasks(p, 2).length).toBe(2)
  })
  it('keep 里的已完成任务保留在原位', () => {
    const p = plan('p', 1, ['done', 'todo', 'todo', 'todo'])
    expect(nextTasks(p, 3, new Set(['p-0'])).map((x) => x.id)).toEqual(['p-0', 'p-1', 'p-2'])
  })
  it('不足 3 条', () => expect(nextTasks(plan('p', 1, ['todo'])).length).toBe(1))
  it('planProgress', () => {
    expect(planProgress(plan('p', 1, ['done', 'todo', 'done', 'todo']))).toEqual({ done: 2, total: 4, percent: 50 })
    expect(planProgress(plan('e', 1, []))).toEqual({ done: 0, total: 0, percent: 0 })
  })
})

describe('pickCet6InProgress', () => {
  const metas = (ids: string[]): Cet6Meta[] => ids.map((id) => ({ id, title: `T-${id}`, year: 2025, month: 6, set: 1, file: `${id}.json` }))
  const rec = (answers: Record<string, string>, over: Partial<Cet6Record> = {}): Cet6Record => ({ answers, marks: [], submitted: false, seconds: 0, mode: 'practice', ...over })

  it('空输入 → null', () => {
    expect(pickCet6InProgress({}, [])).toBeNull()
    expect(pickCet6InProgress({}, metas(['a']))).toBeNull()
  })
  it('已交卷、没有作答、只有空白作答都不算', () => {
    expect(pickCet6InProgress({ a: rec({ q1: 'A' }, { submitted: true }), b: rec({}), c: rec({ q1: '  ' }) }, metas(['a', 'b', 'c']))).toBeNull()
  })
  it('返回标题、模式、已答数（空白不计）', () => {
    const r = pickCet6InProgress({ a: rec({ q1: 'A', q2: 'B', q3: '' }, { mode: 'exam' }) }, metas(['a']))
    expect(r).toEqual({ id: 'a', title: 'T-a', mode: 'exam', answered: 2 })
  })
  it('多套作答中：按目录顺序取第一套', () => {
    const r = pickCet6InProgress({ b: rec({ q1: 'A' }), a: rec({ q1: 'A' }) }, metas(['a', 'b']))
    expect(r?.id).toBe('a')
  })
  it('目录里没有的记录忽略', () => expect(pickCet6InProgress({ zz: rec({ q1: 'A' }) }, metas(['a']))).toBeNull())
})
