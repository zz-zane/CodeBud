/**
 * DeepTutor 3-Tier Learner Memory Profile (L1/L2/L3).
 *
 * 核心架构：
 * 1. L1 瞬时现场记忆（l1Session）：当前活跃课程、是否挂载运行报错/代码片段、现场焦点摘要
 * 2. L2 薄弱点与错题记忆（l2Weakness）：基于错题本过滤活跃错题（removedAt === null），聚合统计并计算 Top 3 薄弱课
 * 3. L3 全局学习阶段记忆（l3Global）：课程掌握度百分比与全局所处阶段描述
 * 4. formatLearnerMemoryTagContent：输出紧凑清晰的中文画像摘要（< 500 字），作为不可信参考数据注入给大模型因材施教
 */

import { LEARNER_MEMORY } from './copy'
import type { AiChatContextTag, WrongBookEntry } from '../../../shared/types'

export interface LearnerMemoryProfile {
  l1Session: {
    activeLessonId: string | null
    activeLessonTitle: string | null
    hasErrorTag: boolean
    hasCodeTag: boolean
    focusSummary: string
  }
  l2Weakness: {
    activeWrongCount: number
    holeCount: number
    topWeakLessons: Array<{
      lessonId: string
      title: string
      count: number
      totalWrongTimes: number
    }>
    summary: string
  }
  l3Global: {
    learnedCount: number
    totalCount: number
    masteryPercent: number
    stageSummary: string
  }
}

export interface BuildLearnerMemoryInput {
  learnedIds: Iterable<string>
  totalLessons: number
  wrongbook: WrongBookEntry[]
  activeLessonId: string | null
  contextTags: AiChatContextTag[]
  lessonTitleOf: (id: string) => string
}

export function buildLearnerMemoryProfile(input: BuildLearnerMemoryInput): LearnerMemoryProfile {
  const { learnedIds, totalLessons, wrongbook, activeLessonId, contextTags, lessonTitleOf } = input

  // 1. L1 瞬时现场记忆
  const hasErrorTag = contextTags.some((t) => t.type === 'error')
  const hasCodeTag = contextTags.some((t) => t.type === 'code')
  const activeTitle = activeLessonId ? lessonTitleOf(activeLessonId) : null

  let focus: string = LEARNER_MEMORY.FOCUS_FREE_CHAT
  if (hasErrorTag) {
    focus = LEARNER_MEMORY.FOCUS_ERROR
  } else if (hasCodeTag) {
    focus = LEARNER_MEMORY.FOCUS_CODE
  } else if (activeLessonId) {
    focus = LEARNER_MEMORY.FOCUS_STUDYING
  }

  const focusSummary = activeLessonId && activeTitle
    ? LEARNER_MEMORY.focusWithLesson(activeTitle, focus)
    : LEARNER_MEMORY.focusWithoutLesson(focus)

  // 2. L2 薄弱点与错题记忆（过滤活跃条目 removedAt === null）
  const activeEntries = (wrongbook || []).filter((e) => e && !e.removedAt)
  const activeWrongCount = activeEntries.length
  const holeCount = activeEntries.filter((e) => e.hole).length

  // 按 lessonId 聚合统计
  const lessonStats = new Map<string, { count: number; totalWrongTimes: number }>()
  for (const entry of activeEntries) {
    const lId = entry.lessonId || 'unknown'
    const stat = lessonStats.get(lId) || { count: 0, totalWrongTimes: 0 }
    stat.count += 1
    stat.totalWrongTimes += entry.wrongCount || 1
    lessonStats.set(lId, stat)
  }

  // 排序：优先累计错题次数降序，其次按活跃题目数降序
  const sortedLessons = Array.from(lessonStats.entries())
    .map(([lessonId, stat]) => ({
      lessonId,
      title: lessonTitleOf(lessonId) || lessonId,
      count: stat.count,
      totalWrongTimes: stat.totalWrongTimes
    }))
    .sort((a, b) => b.totalWrongTimes - a.totalWrongTimes || b.count - a.count)

  const topWeakLessons = sortedLessons.slice(0, 3)

  let weaknessSummary: string = LEARNER_MEMORY.NO_WRONGS_SUMMARY
  if (activeWrongCount > 0) {
    const weakList = topWeakLessons
      .map((item) => LEARNER_MEMORY.weakLessonItem(item.title, item.totalWrongTimes))
      .join('、')
    weaknessSummary = LEARNER_MEMORY.weakSummary(activeWrongCount, holeCount, weakList)
  }

  // 3. L3 全局学习阶段记忆
  const learnedSet = new Set(learnedIds)
  const learnedCount = learnedSet.size
  const total = Math.max(1, totalLessons)
  const masteryPercent = Math.min(100, Math.round((learnedCount / total) * 100))

  let stageSummary: string = LEARNER_MEMORY.STAGE_NOT_STARTED
  if (masteryPercent === 0) {
    stageSummary = LEARNER_MEMORY.STAGE_NOT_STARTED
  } else if (masteryPercent < 35) {
    stageSummary = LEARNER_MEMORY.STAGE_BEGINNER
  } else if (masteryPercent < 80) {
    stageSummary = LEARNER_MEMORY.STAGE_INTERMEDIATE
  } else {
    stageSummary = LEARNER_MEMORY.STAGE_ADVANCED
  }

  return {
    l1Session: {
      activeLessonId,
      activeLessonTitle: activeTitle,
      hasErrorTag,
      hasCodeTag,
      focusSummary
    },
    l2Weakness: {
      activeWrongCount,
      holeCount,
      topWeakLessons,
      summary: weaknessSummary
    },
    l3Global: {
      learnedCount,
      totalCount: totalLessons,
      masteryPercent,
      stageSummary
    }
  }
}

export function formatLearnerMemoryTagContent(profile: LearnerMemoryProfile): string {
  const { l1Session, l2Weakness, l3Global } = profile

  // L1 格式化
  const tagFlags: string[] = []
  if (l1Session.hasErrorTag) tagFlags.push(LEARNER_MEMORY.TAG_ERROR_FLAG)
  if (l1Session.hasCodeTag) tagFlags.push(LEARNER_MEMORY.TAG_CODE_FLAG)
  const tagPart = tagFlags.length ? `[${tagFlags.join('/')}] ` : ''
  const l1Line = LEARNER_MEMORY.formatL1(
    l1Session.activeLessonTitle || LEARNER_MEMORY.NONE,
    tagPart,
    l1Session.focusSummary
  )

  // L2 格式化
  const weakPart = l2Weakness.topWeakLessons.length
    ? l2Weakness.topWeakLessons
        .map((w) => LEARNER_MEMORY.weakTagItem(w.title, w.count, w.totalWrongTimes))
        .join('、')
    : LEARNER_MEMORY.NO_WEAK_LESSON
  const l2Line = LEARNER_MEMORY.formatL2(l2Weakness.activeWrongCount, l2Weakness.holeCount, weakPart)

  // L3 格式化
  const l3Line = LEARNER_MEMORY.formatL3(
    l3Global.masteryPercent,
    l3Global.learnedCount,
    l3Global.totalCount,
    l3Global.stageSummary
  )

  return `${l1Line}\n${l2Line}\n${l3Line}`
}
