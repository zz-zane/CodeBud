/**
 * 「今天」页的纯逻辑（docs/31）：预计分钟、本周七格、相对日期、计划挑选、六级作答中的卷。
 * 无 Vue / Electron 依赖，可被 Vitest 直接测。日界一律按 shared/dates.ts 的北京时间口径。
 */
import { REL_DAY } from './copy'
import { localDateKeyOf, parseDateKey } from './dates'
import type { Cet6Meta, Cet6Mode, Cet6Record } from './cet6'
import type { StudyPlan, StudyTask } from './study-companion'

const DAY_MS = 86_400_000

/** 日键 → 距 1970-01-01 的整日数；非法键返回 null */
function dayNumber(key: string): number | null {
  const p = parseDateKey(key)
  return p ? Date.UTC(p.y, p.m - 1, p.d) / DAY_MS : null
}

/** ceil((复习课×60 + 错题×60 + 生词×15) 秒 / 60 / 5) × 5 分钟；全 0 → 0 */
export function estimateMinutes(n: { review: number; wrong: number; vocab: number }): number {
  const sec = Math.max(0, n.review) * 60 + Math.max(0, n.wrong) * 60 + Math.max(0, n.vocab) * 15
  return sec <= 0 ? 0 : Math.ceil(sec / 60 / 5) * 5
}

export type WeekDotState = 'done' | 'today' | 'idle'
export interface WeekDot {
  key: string
  state: WeekDotState
}

/** 包含 todayKey 的那一周（周一为首）七格；今天已学（在 days 里）算 done，不算 today */
export function weekDots(days: readonly string[], todayKey: string): WeekDot[] {
  const t = dayNumber(todayKey)
  if (t === null) return []
  const dow = new Date(t * DAY_MS).getUTCDay() // 0 = 周日
  const monday = t - ((dow + 6) % 7)
  const studied = new Set(days)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date((monday + i) * DAY_MS)
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
    const state: WeekDotState = studied.has(key) ? 'done' : key === todayKey ? 'today' : 'idle'
    return { key, state }
  })
}

/** 日键或 ISO 时间 → 今天 / 昨天 / n 天前；解析不了返回空串，未来的日期按今天 */
export function relativeDayLabel(dateKeyOrIso: string, todayKey: string): string {
  const key = parseDateKey(dateKeyOrIso) ? dateKeyOrIso : localDateKeyOf(dateKeyOrIso)
  const a = key ? dayNumber(key) : null
  const b = dayNumber(todayKey)
  if (a === null || b === null) return ''
  const diff = b - a
  if (diff <= 0) return REL_DAY.TODAY
  if (diff === 1) return REL_DAY.YESTERDAY
  return REL_DAY.ago(diff)
}

/** 数量最多的两个模块（降序；0 和负数不入列；同数保持传入顺序） */
export function topTwoModules(counts: Record<string, number>): Array<[string, number]> {
  return Object.entries(counts)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
}

/** 计划第几天 = 创建日到今天的自然日差 + 1（最小 1） */
export function planDay(createdAt: number, now: number): number {
  const a = dayNumber(localDateKeyOf(new Date(createdAt).toISOString()) ?? '')
  const b = dayNumber(localDateKeyOf(new Date(now).toISOString()) ?? '')
  if (a === null || b === null) return 1
  return Math.max(1, b - a + 1)
}

/** 有未完成任务的计划里 createdAt 最新的一份；同时间取靠前的 */
export function pickActivePlan(plans: readonly StudyPlan[]): StudyPlan | null {
  let best: StudyPlan | null = null
  for (const p of plans) {
    if (p.draft || !p.tasks.some((t) => t.status !== 'done')) continue
    if (!best || p.createdAt > best.createdAt) best = p
  }
  return best
}

/** 最多 n 条未完成任务；keep 里的任务即使已完成也保留在原位（刚勾掉的留到离开页面） */
export function nextTasks(plan: StudyPlan, n = 3, keep: ReadonlySet<string> = new Set()): StudyTask[] {
  return plan.tasks.filter((t) => t.status !== 'done' || keep.has(t.id)).slice(0, n)
}

export function planProgress(plan: StudyPlan): { done: number; total: number; percent: number } {
  const total = plan.tasks.length
  const done = plan.tasks.filter((t) => t.status === 'done').length
  return { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) }
}

export interface Cet6InProgress {
  id: string
  title: string
  mode: Cet6Mode
  answered: number
}

/**
 * 作答中的六级卷：submitted === false 且至少有一道非空作答，且目录里有这套卷。
 * 记录里没有保存时间戳，所以多套并存时按目录顺序（metas，新卷在前）取第一套。
 */
export function pickCet6InProgress(
  records: Readonly<Record<string, Cet6Record>>,
  metas: readonly Cet6Meta[]
): Cet6InProgress | null {
  for (const m of metas) {
    const r = records[m.id]
    if (!r || r.submitted) continue
    const answered = Object.values(r.answers).filter((v) => v.trim() !== '').length
    if (answered > 0) return { id: m.id, title: m.title, mode: r.mode, answered }
  }
  return null
}
