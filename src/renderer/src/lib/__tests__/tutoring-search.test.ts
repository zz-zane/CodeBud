import { describe, expect, it } from 'vitest'
import type { Lesson, SearchEntry } from '../../../../shared/types'
import { findCourseReferences, isValidCourseReference } from '../tutoring-search'
import algo from '../../generated/algo-bundle.json'
import basic from '../../generated/content-bundle.json'

const lesson = { id: 'algo-1', title: '链表', body: '链表是由节点组成的结构。' } as Lesson
const entry = { id: lesson.id, title: lesson.title, text: lesson.body, tags: [], keywords: [] } as unknown as SearchEntry
const lookup = (id: string) => id === lesson.id ? lesson : undefined

describe('course references', () => {
  it('uses bounded real excerpts and rejects forged or missing references', () => {
    const refs = findCourseReferences([entry], lookup, '链表')
    expect(refs).toHaveLength(1)
    expect(isValidCourseReference(refs[0], lookup)).toBe(true)
    expect(isValidCourseReference({ ...refs[0], lessonId: 'unknown' }, lookup)).toBe(false)
    expect(isValidCourseReference({ ...refs[0], excerpt: 'invented' }, lookup)).toBe(false)
    expect(findCourseReferences([entry], lookup, 'unrelatedword')).toEqual([])
    expect(refs[0].excerpt.length).toBeLessThanOrEqual(200)
  })
  it('finds real basic and Hello lessons and does not invent missing matches', () => {
    const lessons = [...basic.lessons, ...algo.lessons] as unknown as Lesson[]
    const index = [...basic.searchIndex, ...algo.searchIndex] as SearchEntry[]
    const find = (id: string) => lessons.find(l => l.id === id)
    const linked = findCourseReferences(index, find, '链表')
    expect(linked.some(r => r.lessonId.startsWith('algo-'))).toBe(true)
    expect(linked.every(r => isValidCourseReference(r, find))).toBe(true)
    expect(findCourseReferences(index, find, 'zzzznoexistingwordzzzz')).toEqual([])
    expect(findCourseReferences(index, find, 'new session')).toEqual([])
    expect(findCourseReferences(index, find, '请解释一下')).toEqual([])
    expect(findCourseReferences(index, find, '编程').some(r => !r.lessonId.startsWith('algo-'))).toBe(true)
  })
  it('caps both the number of citations and each original excerpt', () => {
    const items = Array.from({ length: 5 }, (_, n) => ({ id: `id-${n}`, title: '链表', body: 'x'.repeat(150) + '链表' + 'y'.repeat(300) } as Lesson))
    const entries = items.map(x => ({ id: x.id, title: x.title, text: x.body, tags: [], keywords: [] } as unknown as SearchEntry))
    const found = findCourseReferences(entries, id => items.find(x => x.id === id), '链表')
    expect(found).toHaveLength(3)
    expect(found.every(r => r.excerpt.length <= 200 && isValidCourseReference(r, id => items.find(x => x.id === id)))).toBe(true)
  })
  it('filters references by language retaining only the specified language and common', () => {
    const pyLesson = { id: 'py-1', lang: 'python', title: 'Python入门', body: 'print 是 Python 的输出函数。' } as Lesson
    const cLesson = { id: 'c-1', lang: 'c', title: 'C入门', body: 'printf 是 C 的输出函数。' } as Lesson
    const commonLesson = { id: 'com-1', lang: 'common', title: '通用输出', body: '输出函数是程序的窗口。' } as Lesson

    const entries = [
      { id: pyLesson.id, lang: 'python', title: pyLesson.title, text: pyLesson.body, tags: [], keywords: [] },
      { id: cLesson.id, lang: 'c', title: cLesson.title, text: cLesson.body, tags: [], keywords: [] },
      { id: commonLesson.id, lang: 'common', title: commonLesson.title, text: commonLesson.body, tags: [], keywords: [] }
    ] as unknown as SearchEntry[]

    const map: Record<string, Lesson> = {
      [pyLesson.id]: pyLesson,
      [cLesson.id]: cLesson,
      [commonLesson.id]: commonLesson
    }
    const find = (id: string) => map[id]

    const refs = findCourseReferences(entries, find, '输出函数', 'python')
    expect(refs.some(r => r.lessonId === 'py-1')).toBe(true)
    expect(refs.some(r => r.lessonId === 'com-1')).toBe(true)
    expect(refs.some(r => r.lessonId === 'c-1')).toBe(false)

    // 当未指定语言（undefined）时，不过滤语言，所有语言的相关课程均可作为候选
    const allRefs = findCourseReferences(entries, find, '输出函数', undefined)
    expect(allRefs.some(r => r.lessonId === 'py-1')).toBe(true)
    expect(allRefs.some(r => r.lessonId === 'c-1')).toBe(true)
    expect(allRefs.some(r => r.lessonId === 'com-1')).toBe(true)
  })
})
