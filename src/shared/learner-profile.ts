/**
 * 学习背景（第一次打开 app 时的基础调研）→ 一条长期记忆。
 * 存成普通 StudyMemory（不改快照结构），以固定前缀识别；AI 助教的上下文会带上它，
 * 讲解动画 skill（content/skills/explainer-video/SKILL.md §0.5）按它选讲法。
 */
import { LEARNER_TEXT as T } from './study-copy'

export const LEARNER_MEMORY_PREFIX = T.PREFIX

export type LearnerStyle = keyof typeof T.STYLE
export type LearnerPace = keyof typeof T.PACE

export interface LearnerAnswers {
  /** 已学过的内容（选项文字）；含「零基础」时其余忽略 */
  known: string[]
  style: LearnerStyle
  pace: LearnerPace
  goal?: string
}

export const LEARNER_ZERO = T.ZERO
export const LEARNER_KNOWN_OPTIONS = T.KNOWN
export const LEARNER_STYLE_TEXT: Record<LearnerStyle, string> = T.STYLE
export const LEARNER_PACE_TEXT: Record<LearnerPace, string> = T.PACE

export function isLearnerMemory(text: string): boolean {
  return text.startsWith(LEARNER_MEMORY_PREFIX)
}

/** 记忆正文：一行、≤ 240 字（AI 记忆上限），不含绝对化表述 */
export function learnerMemoryText(a: LearnerAnswers): string {
  const known = a.known.includes(LEARNER_ZERO) ? LEARNER_ZERO : a.known.filter((k) => k !== LEARNER_ZERO).join(T.JOIN) || T.UNFILLED
  const goal = (a.goal ?? '').replace(/\s+/g, ' ').trim().slice(0, 60)
  const parts = [T.known(known), T.style(LEARNER_STYLE_TEXT[a.style]), T.pace(LEARNER_PACE_TEXT[a.pace])]
  if (goal) parts.push(T.goal(goal))
  return (LEARNER_MEMORY_PREFIX + parts.join(T.SEP)).slice(0, 240)
}
