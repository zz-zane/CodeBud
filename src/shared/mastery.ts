import type { PracticeSession } from './types'

export const MASTERY_PASS = 0.8
export const MASTERY_WEAK = 0.6
export const MASTERY_MIN_ATTEMPTS = 3

const WEIGHTS = [0.5, 0.7, 0.85, 0.95, 1.0] // 最近 5 次，越新越重
const CAP: Record<number, number> = { 1: 0.5, 2: 0.8 } // 证据不足时封顶

export interface LessonMastery {
  score: number
  attempts: number
}

/** 根据按时间升序排列的单次得分（0..1）计算课程掌握度 */
export function computeMastery(scores: readonly number[]): number {
  const valid = scores
    .filter((s) => Number.isFinite(s))
    .map((s) => Math.min(1, Math.max(0, s)))
  if (valid.length === 0) return 0

  const recent = valid.slice(-WEIGHTS.length)
  const weights = WEIGHTS.slice(-recent.length)
  let weightedSum = 0
  let weightTotal = 0
  for (let i = 0; i < recent.length; i++) {
    weightedSum += recent[i] * weights[i]
    weightTotal += weights[i]
  }
  const raw = weightTotal > 0 ? weightedSum / weightTotal : 0
  const cap = CAP[valid.length]
  return cap === undefined ? raw : Math.min(raw, cap)
}

/** 从练习史中纯推导指定课程的掌握度（正确数 / 总数，按时间升序加权） */
export function lessonMastery(history: readonly PracticeSession[], lessonId: string): LessonMastery {
  if (!lessonId || history.length === 0) return { score: 0, attempts: 0 }
  const relevant = [...history]
    .sort((a, b) => a.at.localeCompare(b.at) || a.id - b.id)
    .map((session) => {
      let total = 0
      let correct = 0
      for (const item of session.items) {
        if (item.lessonId !== lessonId) continue
        total++
        if (item.ok) correct++
      }
      return total > 0 ? correct / total : null
    })
    .filter((score): score is number => score !== null)

  return {
    score: computeMastery(relevant),
    attempts: relevant.length
  }
}

/** 课程是否达到「已掌握」标准（掌握度 ≥ 0.8 且练习 ≥ 3 次） */
export function isLessonMastered(score: number, attempts: number): boolean {
  return score >= MASTERY_PASS && attempts >= MASTERY_MIN_ATTEMPTS
}

/** 计算「练过且掌握度 < 0.6」的薄弱课程 ID 列表 */
export function weakLessonsByMastery(
  history: readonly PracticeSession[],
  knownLessonIds?: ReadonlySet<string>
): string[] {
  const practiced = new Set<string>()
  for (const session of history) {
    for (const item of session.items) {
      if (!item.lessonId) continue
      if (knownLessonIds && !knownLessonIds.has(item.lessonId)) continue
      practiced.add(item.lessonId)
    }
  }
  const weak: string[] = []
  for (const lessonId of practiced) {
    if (lessonMastery(history, lessonId).score < MASTERY_WEAK) weak.push(lessonId)
  }
  return weak.sort()
}
