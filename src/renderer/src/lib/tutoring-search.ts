import { searchEntries } from '../../../shared/search'
import type { CourseReference, Lang, Lesson, SearchEntry } from '../../../shared/types'

const STOP = new Set(['\u4ec0\u4e48', '\u5982\u4f55', '\u600e\u6837', '\u8bf7\u95ee', '\u89e3\u91ca', '\u4e00\u4e0b', '\u8fd9\u4e2a', '\u600e\u4e48', '\u4e3a\u4ec0\u4e48', '\u662f\u4ec0\u4e48', 'the', 'and', 'what', 'how', 'new', 'session', 'please', 'explain', 'hello'])

/** Return excerpts from the actual lesson body, never from model output or question-bank text. */
export function findCourseReferences(index: SearchEntry[], lessonOf: (id: string) => Lesson | undefined, query: string, lang?: Lang | string): CourseReference[] {
  let normalized = query.toLowerCase()
  for (const stop of [...STOP].filter(s => /[\u4e00-\u9fff]/.test(s)).sort((a, b) => b.length - a.length)) normalized = normalized.split(stop).join(' ')
  const words = normalized.match(/[a-z][a-z0-9_+#-]{2,}|[\u4e00-\u9fff]{2,}/g) ?? []
  const terms = new Set<string>()
  for (const word of words) {
    if (!STOP.has(word)) terms.add(word)
    if (/^[\u4e00-\u9fff]+$/.test(word)) {
      for (let size = Math.min(word.length, 6); size >= 2; size--) {
        for (let i = 0; i + size <= word.length; i++) {
          const part = word.slice(i, i + size)
          if (!STOP.has(part)) terms.add(part)
        }
      }
    }
  }
  const candidates = new Map<string, { score: number; term: string }>()
  for (const term of [...terms].sort((a, b) => b.length - a.length).slice(0, 40)) {
    for (const hit of searchEntries(index, term, 12)) {
      const lesson = lessonOf(hit.entry.id)
      if (!lesson || !lesson.body.toLowerCase().includes(term)) continue
      if (lang && lesson.lang !== lang && lesson.lang !== 'common') continue
      const score = hit.score * term.length
      if (score > (candidates.get(lesson.id)?.score ?? 0)) candidates.set(lesson.id, { score, term })
    }
  }
  return [...candidates.entries()].sort((a, b) => b[1].score - a[1].score).slice(0, 3).flatMap(([id, match]) => {
    const lesson = lessonOf(id)!
    const at = lesson.body.toLowerCase().indexOf(match.term)
    const start = Math.max(0, at - 80)
    return [{ lessonId: id, title: lesson.title, excerpt: lesson.body.slice(start, Math.min(lesson.body.length, start + 200)) }]
  })
}

export function isValidCourseReference(ref: CourseReference, lessonOf: (id: string) => Lesson | undefined): boolean {
  if (!ref || typeof ref.lessonId !== 'string' || typeof ref.title !== 'string' || typeof ref.excerpt !== 'string') return false
  const lesson = lessonOf(ref.lessonId)
  return !!lesson && lesson.title === ref.title && !!ref.excerpt && ref.excerpt.length <= 200 && lesson.body.includes(ref.excerpt)
}
