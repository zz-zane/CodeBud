import { ALGO_COURSE } from './copy'
import type { Lesson } from '../../../shared/types'

export function catalogCategory(value: unknown): 'basics' | 'algo' {
  return value === 'algo' ? 'algo' : 'basics'
}

export function lessonNoteTitle(lesson: Pick<Lesson, 'id' | 'title' | 'category'>): string {
  return lesson.category === 'algo' || lesson.id.startsWith('algo-')
    ? ALGO_COURSE.noteTitle(lesson.title)
    : ALGO_COURSE.lessonNoteTitle(lesson.title)
}

/**
 * 判断是否为入门课（P1-6：四种写法对照在入门课里默认折叠，标成「拓展」）。
 * 针对各语言第一阶段第1课（如 py-s1-01, python-stage1-01）或通用知识入门课。
 */
export function isIntroLesson(
  lesson: { id: string; stage?: number | string; title?: string } | null | undefined
): boolean {
  if (!lesson) return false
  if (lesson.id === 'common-01') return true
  const st = Number(lesson.stage)
  if (st === 0 || st === 1) {
    if (lesson.id.endsWith('-01') || lesson.id.endsWith('-01-intro')) return true
    if (/入门|认识|第一个|简介|intro/i.test(lesson.title ?? '')) return true
  }
  return false
}
