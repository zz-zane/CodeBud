import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { StudyStore } from '../store'
import { editStudyTasks } from '../tasks'
import { applyStudyActions } from '../actions'
import { CUSTOM_PLAN_MATERIAL, studyContext } from '../../../shared/study-companion'

const root = resolve('D:/project/coding/outputs/study-companion-20261105/root-tests')
let dir: string
let store: StudyStore
beforeEach(() => { mkdirSync(root, { recursive: true }); dir = mkdtempSync(join(root, 'tasks-')); store = new StudyStore(dir) })
afterEach(() => {
  if (!dir.startsWith(root + '\\') && !dir.startsWith(root + '/')) throw new Error('Invalid cleanup target')
  rmSync(dir, { recursive: true, force: true })
})

describe('editStudyTasks：自定义任务组的增删改', () => {
  it('建组 → 加任务 → 改标题与状态 → 删任务 → 改名 → 删组，全程落盘且通过快照校验', () => {
    const plan = editStudyTasks(store, { op: 'create_plan', title: '一个月 Java', tasks: [{ title: '装 JDK' }] })!
    expect(plan.materialId).toBe(CUSTOM_PLAN_MATERIAL)
    expect(plan.draft).toBe(false)
    expect(plan.source).toBe('manual')
    expect(plan.tasks[0]).toMatchObject({ title: '装 JDK', description: '', status: 'todo' })

    const added = editStudyTasks(store, { op: 'add_task', planId: plan.id, title: '写 Hello World', description: '能编译运行' })!
    const second = added.tasks[1]
    editStudyTasks(store, { op: 'update_task', planId: plan.id, taskId: second.id, status: 'doing', title: '写并运行 Hello World' })
    const reread = new StudyStore(dir).read().plans[0]
    expect(reread.tasks[1]).toMatchObject({ title: '写并运行 Hello World', description: '能编译运行', status: 'doing' })

    editStudyTasks(store, { op: 'delete_task', planId: plan.id, taskId: plan.tasks[0].id })
    editStudyTasks(store, { op: 'rename_plan', planId: plan.id, title: 'Java 入门' })
    expect(store.read().plans[0]).toMatchObject({ title: 'Java 入门' })
    expect(store.read().plans[0].tasks).toHaveLength(1)

    expect(editStudyTasks(store, { op: 'delete_plan', planId: plan.id })).toBeNull()
    expect(store.read().plans).toHaveLength(0)
  })

  it('拒绝空标题、未知状态、不存在的组 / 任务、超过 30 项、未知 op；失败不改数据', () => {
    const plan = editStudyTasks(store, { op: 'create_plan', title: 'G' })!
    expect(() => editStudyTasks(store, { op: 'add_task', planId: plan.id, title: '  ' })).toThrow()
    expect(() => editStudyTasks(store, { op: 'add_task', planId: 'nope', title: 'x' })).toThrow()
    expect(() => editStudyTasks(store, { op: 'update_task', planId: plan.id, taskId: 'nope', status: 'done' })).toThrow()
    expect(() => editStudyTasks(store, { op: 'create_plan', title: 'Big', tasks: Array.from({ length: 31 }, (_, i) => ({ title: `t${i}` })) })).toThrow()
    expect(() => editStudyTasks(store, { op: 'shell', planId: plan.id })).toThrow()
    const t = editStudyTasks(store, { op: 'add_task', planId: plan.id, title: 'ok' })!.tasks[0]
    expect(() => editStudyTasks(store, { op: 'update_task', planId: plan.id, taskId: t.id, status: 'finished' })).toThrow()
    expect(store.read().plans).toHaveLength(1)
    expect(store.read().plans[0].tasks).toEqual([expect.objectContaining({ title: 'ok', status: 'todo' })])
  })

  it('lessonId 只接受真实课程', () => {
    const plan = editStudyTasks(store, { op: 'create_plan', title: 'G' })!
    const isLesson = (id: string): boolean => id === 'c-stage1-14'
    expect(() => editStudyTasks(store, { op: 'add_task', planId: plan.id, title: 'x', lessonId: 'fake-01' }, isLesson)).toThrow()
    expect(editStudyTasks(store, { op: 'add_task', planId: plan.id, title: 'x', lessonId: 'c-stage1-14' }, isLesson)!.tasks[0].lessonId).toBe('c-stage1-14')
  })
})

describe('AI 助教通过对话管理任务（study-actions）', () => {
  const run = (actions: unknown[], sessionId = 'study-main') => applyStudyActions({
    store, text: 'ok\n```study-actions\n' + JSON.stringify(actions) + '\n```', userMessage: '', sessionId, turnId: crypto.randomUUID(), isLesson: id => id === 'java-stage1-01', createChat: () => {}
  })

  it('new_task_group 直接生效（不是草稿），并出现在 AI 上下文里（带组 id 与任务 id）', () => {
    const result = run([{ type: 'new_task_group', title: '一个月学 Java', tasks: [{ title: '第 1 周：语法', lessonId: 'java-stage1-01' }, { title: '第 2 周：面向对象' }] }])
    expect(result.actions[0]).toMatchObject({ ok: true, type: 'new_task_group' })
    expect(result.actions[0].route).toBeUndefined()
    const plan = store.read().plans[0]
    expect(plan).toMatchObject({ title: '一个月学 Java', draft: false, source: 'ai', materialId: CUSTOM_PLAN_MATERIAL })
    const ctx = studyContext(store.read())
    expect(ctx).toContain(plan.id)
    expect(ctx).toContain(plan.tasks[1].id)
    expect(ctx).toContain('第 2 周：面向对象')
  })

  it('add_task / update_task / delete_task / rename / delete_group 都可用；非主聊天拒绝', () => {
    run([{ type: 'new_task_group', title: 'G', tasks: [{ title: 'a' }] }])
    const plan = store.read().plans[0]
    expect(run([{ type: 'add_task', planId: plan.id, title: 'b' }], 'side-chat').actions[0].ok).toBe(false)
    const r = run([
      { type: 'add_task', planId: plan.id, title: 'b' },
      { type: 'update_task', planId: plan.id, taskId: plan.tasks[0].id, status: 'done' },
      { type: 'rename_task_group', planId: plan.id, title: 'G2' }
    ])
    expect(r.actions.map(a => a.ok)).toEqual([true, true, true])
    expect(store.read().plans[0]).toMatchObject({ title: 'G2' })
    expect(store.read().plans[0].tasks.map(t => [t.title, t.status])).toEqual([['a', 'done'], ['b', 'todo']])
    expect(run([{ type: 'delete_task', planId: plan.id, taskId: plan.tasks[0].id }]).actions[0].ok).toBe(true)
    expect(run([{ type: 'delete_task_group', planId: plan.id }]).actions[0].ok).toBe(true)
    expect(store.read().plans).toHaveLength(0)
  })

  it('confirm_plan 把待确认草稿原样确认；草稿任务在确认前不进上下文', () => {
    store.update(state => { state.plans.push({ id: 'd1', title: 'Draft', materialId: 'm1', createdAt: 1, source: 'ai', draft: true, tasks: [{ id: 't1', title: 'secret task', description: '', status: 'todo' }] }) })
    expect(studyContext(store.read())).not.toContain('secret task')
    expect(run([{ type: 'add_task', planId: 'd1', title: 'x' }]).actions[0].ok).toBe(false)
    expect(run([{ type: 'confirm_plan', planId: 'd1' }]).actions[0].ok).toBe(true)
    expect(store.read().plans[0].draft).toBe(false)
    expect(studyContext(store.read())).toContain('secret task')
  })
})
