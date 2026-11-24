/**
 * 「今天」页的每日待办 + 任务组「排到每天」（2026-11-24，调研见 Codex research-vocab-todo.md）。
 * 纯函数：类型、读口归一化、学习日分配、当日建议 / 自动加入、增删改。存储在 today-todos.json（新文件，v1）。
 *
 * - 待办：用户手写，或从任务组的步骤加入（带 source）。一个步骤最多对应一条待办。
 * - 排到每天：任务组设目标日期 + 每周哪几天学，把未完成步骤平均摊到这些天；
 *   mode = suggest（到日出现在「计划建议」，用户点加入）/ auto（到日自动加入）/ off（不排）。
 * - 略过：某步骤在某天被略过（或从今天移除），当天不再建议；之后仍可从任务页再加。
 */
import { parseDateKey, shiftDateKey } from './dates'
import type { StudyPlan } from './study-companion'

export interface TodoSource { planId: string; taskId: string; planTitle: string }
export interface TodoItem {
  id: string
  title: string
  /** 排在哪天（北京时间日键） */
  day: string
  order: number
  createdAt: string
  doneAt: string | null
  source: TodoSource | null
}
export type PlanMode = 'suggest' | 'auto' | 'off'
export interface PlanSchedule {
  planId: string
  start: string
  target: string
  /** 0 = 周日 … 6 = 周六 */
  weekdays: number[]
  mode: PlanMode
  /** taskId → 排到的日子 */
  days: Record<string, string>
}
export interface TodoFile {
  version: 1
  items: TodoItem[]
  schedules: PlanSchedule[]
  /** `${planId}:${taskId}:${day}`：那天略过 / 移除过，不再建议 */
  skipped: string[]
}

export interface TodoSuggestion { planId: string; taskId: string; planTitle: string; taskTitle: string; day: string }

export const TODO_LIMITS = { title: 200, items: 2000, skipped: 2000, scheduleDays: 366 } as const
export const PLAN_MODES: readonly PlanMode[] = ['suggest', 'auto', 'off']

export const emptyTodoFile = (): TodoFile => ({ version: 1, items: [], schedules: [], skipped: [] })
export const sourceKey = (s: Pick<TodoSource, 'planId' | 'taskId'>): string => `${s.planId}:${s.taskId}`

// ---------------------------------------------------------------- 读口归一化

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const isDay = (v: unknown): v is string => typeof v === 'string' && parseDateKey(v) !== null

function normalizeItem(raw: unknown): TodoItem | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const id = str(r.id, 100)
  const title = str(r.title, TODO_LIMITS.title)
  if (!id || !title || !isDay(r.day)) return null
  const s = r.source as Record<string, unknown> | null | undefined
  const source = s && typeof s === 'object' && str(s.planId, 100) && str(s.taskId, 100)
    ? { planId: str(s.planId, 100), taskId: str(s.taskId, 100), planTitle: str(s.planTitle, TODO_LIMITS.title) }
    : null
  return {
    id, title, day: r.day, source,
    order: typeof r.order === 'number' && Number.isFinite(r.order) ? r.order : 0,
    createdAt: str(r.createdAt, 40),
    doneAt: typeof r.doneAt === 'string' && r.doneAt ? r.doneAt.slice(0, 40) : null
  }
}

function normalizeSchedule(raw: unknown): PlanSchedule | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const planId = str(r.planId, 100)
  if (!planId || !isDay(r.start) || !isDay(r.target)) return null
  const weekdays = Array.isArray(r.weekdays) ? [...new Set(r.weekdays.filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6))].sort() : []
  const days: Record<string, string> = {}
  if (typeof r.days === 'object' && r.days !== null) {
    for (const [k, v] of Object.entries(r.days as Record<string, unknown>)) if (k.length <= 100 && isDay(v)) days[k] = v
  }
  return { planId, start: r.start, target: r.target, weekdays, mode: PLAN_MODES.includes(r.mode as PlanMode) ? (r.mode as PlanMode) : 'suggest', days }
}

/** 读口 / 写口共用：坏条目丢掉，id 重复只留第一条，同一个步骤只留一条待办，同一任务组只留一份排程 */
export function normalizeTodoFile(raw: unknown): TodoFile {
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const items: TodoItem[] = []
  const ids = new Set<string>()
  const sources = new Set<string>()
  for (const x of Array.isArray(r.items) ? r.items : []) {
    const it = normalizeItem(x)
    if (!it || ids.has(it.id) || (it.source && sources.has(sourceKey(it.source)))) continue
    ids.add(it.id)
    if (it.source) sources.add(sourceKey(it.source))
    items.push(it)
    if (items.length >= TODO_LIMITS.items) break
  }
  const schedules: PlanSchedule[] = []
  for (const x of Array.isArray(r.schedules) ? r.schedules : []) {
    const s = normalizeSchedule(x)
    if (s && !schedules.some((o) => o.planId === s.planId)) schedules.push(s)
  }
  const skipped = (Array.isArray(r.skipped) ? r.skipped : []).filter((x): x is string => typeof x === 'string' && x.length <= 250).slice(-TODO_LIMITS.skipped)
  return { version: 1, items, schedules, skipped }
}

// ---------------------------------------------------------------- 排到每天

/** start..target（含两端）里落在 weekdays 上的日子；weekdays 为空当作每天；最多一年 */
export function studyDays(start: string, target: string, weekdays: readonly number[]): string[] {
  const out: string[] = []
  const pick = new Set(weekdays.length ? weekdays : [0, 1, 2, 3, 4, 5, 6])
  for (let i = 0, d: string | null = start; d && d <= target && i < TODO_LIMITS.scheduleDays; i++, d = shiftDateKey(d, 1)) {
    const p = parseDateKey(d)!
    if (pick.has(new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay())) out.push(d)
  }
  return out
}

/** 按顺序把步骤平均摊到学习日上（步骤比天多时一天放几个，比天少时隔几天放一个） */
export function distribute(taskIds: readonly string[], days: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {}
  if (!days.length) return out
  taskIds.forEach((id, i) => { out[id] = days[Math.floor((i * days.length) / taskIds.length)] })
  return out
}

export function setSchedule(file: TodoFile, s: PlanSchedule): TodoFile {
  return { ...file, schedules: [...file.schedules.filter((o) => o.planId !== s.planId), s] }
}

/** 今天（含之前没处理的）到日、还没做、没加过、今天没略过的步骤 */
export function suggestionsFor(file: TodoFile, plans: readonly StudyPlan[], today: string): TodoSuggestion[] {
  const linked = new Set(file.items.filter((i) => i.source).map((i) => sourceKey(i.source!)))
  const skipped = new Set(file.skipped)
  const out: TodoSuggestion[] = []
  for (const s of file.schedules) {
    if (s.mode === 'off') continue
    const plan = plans.find((p) => p.id === s.planId)
    if (!plan) continue
    for (const t of plan.tasks) {
      const day = s.days[t.id]
      const key = `${plan.id}:${t.id}`
      if (!day || day > today || t.status === 'done' || linked.has(key) || skipped.has(`${key}:${today}`)) continue
      out.push({ planId: plan.id, taskId: t.id, planTitle: plan.title, taskTitle: t.title, day })
    }
  }
  return out.sort((a, b) => a.day.localeCompare(b.day))
}

/** 自动加入：mode = auto 的任务组里，排在今天的建议 */
export function autoAdds(file: TodoFile, plans: readonly StudyPlan[], today: string): TodoSuggestion[] {
  const auto = new Set(file.schedules.filter((s) => s.mode === 'auto').map((s) => s.planId))
  return suggestionsFor(file, plans, today).filter((s) => auto.has(s.planId) && s.day === today)
}

// ---------------------------------------------------------------- 增删改

export function addTodo(file: TodoFile, p: { id: string; title: string; day: string; now: string; source?: TodoSource | null }): TodoFile {
  const title = p.title.trim().slice(0, TODO_LIMITS.title)
  if (!title || (p.source && file.items.some((i) => i.source && sourceKey(i.source) === sourceKey(p.source!)))) return file
  const order = Math.max(0, ...file.items.filter((i) => i.day === p.day).map((i) => i.order + 1))
  return { ...file, items: [...file.items, { id: p.id, title, day: p.day, order, createdAt: p.now, doneAt: null, source: p.source ?? null }] }
}

export function patchTodo(file: TodoFile, id: string, patch: Partial<Pick<TodoItem, 'title' | 'day' | 'doneAt'>>): TodoFile {
  return {
    ...file,
    items: file.items.map((i) => {
      if (i.id !== id) return i
      const title = patch.title === undefined ? i.title : patch.title.trim().slice(0, TODO_LIMITS.title) || i.title
      // 改到别的日子就排到那天末尾
      const order = patch.day && patch.day !== i.day ? Math.max(0, ...file.items.filter((x) => x.day === patch.day).map((x) => x.order + 1)) : i.order
      return { ...i, ...patch, title, order }
    })
  }
}

/** 删除；带来源的同时记「今天略过」，免得马上又出现在建议里 */
export function removeTodo(file: TodoFile, id: string, today: string): TodoFile {
  const it = file.items.find((i) => i.id === id)
  if (!it) return file
  return {
    ...file,
    items: file.items.filter((i) => i.id !== id),
    skipped: it.source ? [...file.skipped, `${sourceKey(it.source)}:${today}`].slice(-TODO_LIMITS.skipped) : file.skipped
  }
}

export function skipSuggestion(file: TodoFile, s: Pick<TodoSuggestion, 'planId' | 'taskId'>, today: string): TodoFile {
  return { ...file, skipped: [...file.skipped, `${sourceKey(s)}:${today}`].slice(-TODO_LIMITS.skipped) }
}

/** 两条待办互换顺序（调用方按界面上看到的相邻关系挑另一条） */
export function swapTodos(file: TodoFile, aId: string, bId: string): TodoFile {
  const a = file.items.find((i) => i.id === aId)
  const b = file.items.find((i) => i.id === bId)
  if (!a || !b || a === b) return file
  return { ...file, items: file.items.map((i) => (i === a ? { ...i, order: b.order } : i === b ? { ...i, order: a.order } : i)) }
}

/** 今天的（按顺序，未完成在前）+ 之前没做完的 */
export function todoView(file: TodoFile, today: string): { today: TodoItem[]; overdue: TodoItem[] } {
  const byOrder = (a: TodoItem, b: TodoItem): number => a.order - b.order
  return {
    today: file.items.filter((i) => i.day === today).sort(byOrder),
    overdue: file.items.filter((i) => i.day < today && !i.doneAt).sort((a, b) => a.day.localeCompare(b.day) || byOrder(a, b))
  }
}
