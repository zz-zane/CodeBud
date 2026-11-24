import { describe, expect, it } from 'vitest'
import type { StudyPlan } from '../study-companion'
import {
  addTodo, autoAdds, distribute, emptyTodoFile, swapTodos, normalizeTodoFile, patchTodo, removeTodo, setSchedule,
  skipSuggestion, studyDays, suggestionsFor, todoView, type PlanSchedule
} from '../today-todo'

const NOW = '2026-11-24T02:00:00.000Z'
const plan = (tasks: Array<[string, 'todo' | 'doing' | 'done']>): StudyPlan => ({
  id: 'java', title: '一个月学完 Java', materialId: 'custom', createdAt: 0, source: 'manual', draft: false,
  tasks: tasks.map(([id, status]) => ({ id, title: `步骤 ${id}`, description: '', status }))
})
const sched = (over: Partial<PlanSchedule> = {}): PlanSchedule => ({
  planId: 'java', start: '2026-11-24', target: '2026-11-30', weekdays: [], mode: 'suggest', days: { t1: '2026-11-23', t2: '2026-11-24', t3: '2026-11-25' }, ...over
})

describe('排到每天', () => {
  it('studyDays 只取选中的星期几；空 = 每天', () => {
    // 2026-11-24 是周二
    expect(studyDays('2026-11-24', '2026-11-30', [])).toHaveLength(7)
    expect(studyDays('2026-11-24', '2026-11-30', [0, 6])).toEqual(['2026-11-28', '2026-11-29'])
    expect(studyDays('2026-11-30', '2026-11-24', [])).toEqual([])
  })

  it('distribute 按顺序平均摊开', () => {
    expect(distribute(['a', 'b'], ['d1', 'd2', 'd3', 'd4'])).toEqual({ a: 'd1', b: 'd3' })
    expect(distribute(['a', 'b', 'c', 'd'], ['d1', 'd2'])).toEqual({ a: 'd1', b: 'd1', c: 'd2', d: 'd2' })
    expect(distribute(['a'], [])).toEqual({})
  })
})

describe('当日建议与自动加入', () => {
  const plans = [plan([['t1', 'todo'], ['t2', 'todo'], ['t3', 'todo']])]
  const T = '2026-11-24'

  it('到日（含之前没处理的）、没做完、没加过、今天没略过的步骤才建议；mode off 不建议', () => {
    const f = setSchedule(emptyTodoFile(), sched())
    expect(suggestionsFor(f, plans, T).map((s) => s.taskId)).toEqual(['t1', 't2'])
    expect(suggestionsFor(setSchedule(f, sched({ mode: 'off' })), plans, T)).toEqual([])
    expect(suggestionsFor(f, [plan([['t1', 'done'], ['t2', 'todo'], ['t3', 'todo']])], T).map((s) => s.taskId)).toEqual(['t2'])
    const added = addTodo(f, { id: 'x', title: '步骤 t1', day: T, now: NOW, source: { planId: 'java', taskId: 't1', planTitle: 'p' } })
    expect(suggestionsFor(added, plans, T).map((s) => s.taskId)).toEqual(['t2'])
    expect(suggestionsFor(skipSuggestion(f, { planId: 'java', taskId: 't2' }, T), plans, T).map((s) => s.taskId)).toEqual(['t1'])
    // 略过只管那一天
    expect(suggestionsFor(skipSuggestion(f, { planId: 'java', taskId: 't2' }, '2026-11-23'), plans, T).map((s) => s.taskId)).toEqual(['t1', 't2'])
  })

  it('自动加入只加排在今天的，旧的留在建议里', () => {
    const f = setSchedule(emptyTodoFile(), sched({ mode: 'auto' }))
    expect(autoAdds(f, plans, T).map((s) => s.taskId)).toEqual(['t2'])
    expect(autoAdds(setSchedule(f, sched()), plans, T)).toEqual([])
  })
})

describe('待办增删改', () => {
  const T = '2026-11-24'
  const src = { planId: 'java', taskId: 't1', planTitle: 'p' }

  it('同一步骤只能加一次；空标题不加；顺序接在当天末尾', () => {
    let f = addTodo(emptyTodoFile(), { id: 'a', title: '  背单词 ', day: T, now: NOW })
    f = addTodo(f, { id: 'b', title: '步骤', day: T, now: NOW, source: src })
    f = addTodo(f, { id: 'c', title: '步骤', day: T, now: NOW, source: src })
    f = addTodo(f, { id: 'd', title: '   ', day: T, now: NOW })
    expect(f.items.map((i) => [i.id, i.title, i.order])).toEqual([['a', '背单词', 0], ['b', '步骤', 1]])
  })

  it('删除带来源的待办会记当天略过，建议里不会立刻冒出来', () => {
    let f = setSchedule(emptyTodoFile(), sched({ days: { t1: T } }))
    f = addTodo(f, { id: 'b', title: '步骤', day: T, now: NOW, source: src })
    f = removeTodo(f, 'b', T)
    expect(f.items).toEqual([])
    expect(suggestionsFor(f, [plan([['t1', 'todo']])], T)).toEqual([])
  })

  it('改期、改名、完成；互换顺序；视图分今天和之前没做完的', () => {
    let f = emptyTodoFile()
    for (const id of ['a', 'b', 'c']) f = addTodo(f, { id, title: id, day: T, now: NOW })
    f = addTodo(f, { id: 'old', title: 'old', day: '2026-11-22', now: NOW })
    f = swapTodos(f, 'c', 'b')
    expect(todoView(f, T).today.map((i) => i.id)).toEqual(['a', 'c', 'b'])
    f = patchTodo(f, 'a', { title: '  ' })
    expect(f.items.find((i) => i.id === 'a')!.title).toBe('a')
    f = patchTodo(f, 'old', { day: T })
    expect(todoView(f, T).today.map((i) => i.id)).toEqual(['a', 'c', 'b', 'old'])
    f = patchTodo(f, 'b', { day: '2026-11-23' })
    expect(todoView(f, T).overdue.map((i) => i.id)).toEqual(['b'])
    f = patchTodo(f, 'b', { doneAt: NOW })
    expect(todoView(f, T).overdue).toEqual([])
  })
})

describe('读口归一化', () => {
  it('坏条目丢掉、同一步骤只留一条、排程字段夹住', () => {
    const f = normalizeTodoFile({
      items: [
        { id: 'a', title: 'ok', day: '2026-11-24' },
        { id: 'a', title: 'dup id', day: '2026-11-24' },
        { id: 'b', title: '', day: '2026-11-24' },
        { id: 'c', title: 'bad day', day: 'tomorrow' },
        { id: 'd', title: 's1', day: '2026-11-24', source: { planId: 'p', taskId: 't' } },
        { id: 'e', title: 's2', day: '2026-11-24', source: { planId: 'p', taskId: 't' } }
      ],
      schedules: [
        { planId: 'p', start: '2026-11-24', target: '2026-12-24', weekdays: [1, 1, 9, 3], mode: 'weird', days: { t: '2026-11-25', u: 'x' } },
        { planId: 'p', start: '2026-11-24', target: '2026-12-24' }
      ],
      skipped: ['p:t:2026-11-24', 5]
    })
    expect(f.items.map((i) => i.id)).toEqual(['a', 'd'])
    expect(f.schedules).toEqual([{ planId: 'p', start: '2026-11-24', target: '2026-12-24', weekdays: [1, 3], mode: 'suggest', days: { t: '2026-11-25' } }])
    expect(f.skipped).toEqual(['p:t:2026-11-24'])
    expect(normalizeTodoFile(null)).toEqual(emptyTodoFile())
  })
})
