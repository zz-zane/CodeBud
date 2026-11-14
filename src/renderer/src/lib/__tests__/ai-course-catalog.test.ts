import { describe, expect, it } from 'vitest'
import type { ContentBundle } from '../../../../shared/types'
import type { AlgoBundle } from '../../stores/content'
import basicsJson from '../../generated/content-bundle.json'
import algoJson from '../../generated/algo-bundle.json'
import { courseGroups, type CourseCategory } from '../ai-course-catalog'

const basics = basicsJson as unknown as ContentBundle
const algo = algoJson as unknown as AlgoBundle
const ids = new Set([...basics.lessons, ...algo.lessons].map(x => x.id))
const groups = (category: CourseCategory, query = '') => courseGroups(basics, algo, category, query, id => ids.has(id))

describe('AI course catalog', () => {
  it('includes every outline entry in each category, including the last Python and Hello lessons', () => {
    for (const lang of ['common', 'c', 'cpp', 'java', 'python'] as const) {
      const expected = basics.outline.filter(x => x.lang === lang).flatMap(x => x.lessons)
      expect(groups(lang).flatMap(x => x.items).map(x => x.id)).toEqual(expected.map(x => x.id))
    }
    const expected = algo.chapters.flatMap(x => x.lessons)
    expect(expected.length).toBe(119)
    expect(groups('algo').flatMap(x => x.items).map(x => x.id)).toEqual(expected.map(x => x.id))
  })
  it('filters within category and disables drafts or missing bodies', () => {
    const python = groups('python').flatMap(x => x.items)
    const last = python.at(-1)!
    expect(groups('python', last.title).flatMap(x => x.items).some(x => x.id === last.id)).toBe(true)
    expect(groups('python', '__no_such_course__')).toEqual([])
    for (const item of python) expect(item.available).toBe(item.hasContent && ids.has(item.id))
    const unavailable = courseGroups(basics, algo, 'algo', '', () => false).flatMap(x => x.items)
    expect(unavailable.every(x => !x.available)).toBe(true)
  })
})
