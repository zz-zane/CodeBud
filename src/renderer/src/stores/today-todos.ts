/**
 * 「今天」页每日待办（today-todos.json）。渲染层是唯一写方：改动先改内存再整份存，主进程归一化后回传。
 * 带来源的待办和任务组步骤双向同步完成状态（在这里勾 → 步骤标完成；步骤在任务页完成 → 这里显示已完成）。
 */
import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { toIpc } from '../lib/ipc-safe'
import { toast } from '../components/base/toast'
import { TODO_COPY } from '../lib/copy'
import { useStudyStore } from './study'
import { today } from '../lib/day-clock'
import { shiftDateKey } from '../../../shared/dates'
import {
  addTodo, autoAdds, emptyTodoFile, swapTodos, patchTodo, removeTodo, setSchedule as setScheduleIn, skipSuggestion,
  suggestionsFor, todoView, type PlanSchedule, type TodoFile, type TodoItem, type TodoSuggestion
} from '../../../shared/today-todo'

export const useTodayTodosStore = defineStore('today-todos', () => {
  // shallowRef：每次改动都换整份新对象（纯函数归约），条目不能是深层代理，否则 structuredClone 送 IPC 会失败
  const file = shallowRef<TodoFile>(emptyTodoFile())
  const loaded = ref(false)
  const study = useStudyStore()

  async function load(): Promise<void> {
    try {
      file.value = await window.miai.todos.get()
      loaded.value = true
    } catch (err) {
      console.error('[todos] load failed', err)
    }
  }

  async function commit(next: TodoFile): Promise<void> {
    const prev = file.value
    file.value = next
    try {
      file.value = await window.miai.todos.save(toIpc(next))
    } catch (err) {
      console.error('[todos] save failed', err)
      file.value = prev
      toast(TODO_COPY.SAVE_FAILED, 'error')
    }
  }

  const view = computed(() => todoView(file.value, today.value))
  const suggestions = computed(() => suggestionsFor(file.value, study.plans, today.value))

  function taskOf(item: TodoItem): { status: string } | undefined {
    const s = item.source
    return s ? study.plans.find((p) => p.id === s.planId)?.tasks.find((t) => t.id === s.taskId) : undefined
  }
  // 关联的步骤还在时以它为准（任务页改回未完成，这里也跟着取消勾选）；手写的看 doneAt
  const isDone = (item: TodoItem): boolean => {
    const t = taskOf(item)
    return t ? t.status === 'done' : !!item.doneAt
  }

  const add = (title: string, day = today.value): Promise<void> =>
    commit(addTodo(file.value, { id: crypto.randomUUID(), title, day, now: new Date().toISOString() }))

  async function toggle(item: TodoItem): Promise<void> {
    const done = !isDone(item)
    await commit(patchTodo(file.value, item.id, { doneAt: done ? new Date().toISOString() : null }))
    const s = item.source
    if (s && taskOf(item)) await study.setTaskStatus(s.planId, s.taskId, done ? 'done' : 'todo')
  }

  const rename = (item: TodoItem, title: string): Promise<void> => commit(patchTodo(file.value, item.id, { title }))
  const moveToToday = (item: TodoItem): Promise<void> => commit(patchTodo(file.value, item.id, { day: today.value }))
  const moveToTomorrow = (item: TodoItem): Promise<void> => commit(patchTodo(file.value, item.id, { day: shiftDateKey(today.value, 1) ?? today.value }))
  /** 在界面上的未完成列表里和上 / 下一条换位置（已完成的固定排在后面，不参与） */
  function move(item: TodoItem, dir: -1 | 1): Promise<void> {
    const open = view.value.today.filter((i) => !isDone(i))
    const other = open[open.findIndex((i) => i.id === item.id) + dir]
    return other ? commit(swapTodos(file.value, item.id, other.id)) : Promise.resolve()
  }
  const remove = (item: TodoItem): Promise<void> => commit(removeTodo(file.value, item.id, today.value))

  function withSuggestion(f: TodoFile, s: TodoSuggestion): TodoFile {
    return addTodo(f, { id: crypto.randomUUID(), title: s.taskTitle, day: today.value, now: new Date().toISOString(), source: { planId: s.planId, taskId: s.taskId, planTitle: s.planTitle } })
  }
  const accept = (s: TodoSuggestion): Promise<void> => commit(withSuggestion(file.value, s))
  const skip = (s: TodoSuggestion): Promise<void> => commit(skipSuggestion(file.value, s, today.value))

  /** 自动加入：「自动加入」模式的任务组里排在今天的步骤；没有要加的就不写盘 */
  async function runAuto(): Promise<void> {
    const adds = autoAdds(file.value, study.plans, today.value)
    if (adds.length) await commit(adds.reduce(withSuggestion, file.value))
  }

  const scheduleOf = (planId: string): PlanSchedule | undefined => file.value.schedules.find((s) => s.planId === planId)
  const setSchedule = (s: PlanSchedule): Promise<void> => commit(setScheduleIn(file.value, s))

  return { file, loaded, load, view, suggestions, isDone, add, toggle, rename, moveToToday, moveToTomorrow, move, remove, accept, skip, runAuto, scheduleOf, setSchedule }
})
