import { describe, expect, it } from 'vitest'
import { catalogCategory, lessonNoteTitle } from '../course-navigation'
import { ALGO_COURSE } from '../copy'

describe('course navigation and note context', () => {
  it('accepts the algorithm deep link and safely falls back for other query shapes', () => {
    expect(catalogCategory('algo')).toBe('algo')
    for (const value of ['basics', '', null, undefined, ['algo']]) expect(catalogCategory(value)).toBe('basics')
  })
  it('uses the algorithm note category for either algorithm identity and leaves basic lessons separate', () => {
    expect(lessonNoteTitle({ id: 'algo-s013', title: 'T' })).toBe(ALGO_COURSE.noteTitle('T'))
    expect(lessonNoteTitle({ id: 'future-id', title: 'T', category: 'algo' })).toBe(ALGO_COURSE.noteTitle('T'))
    expect(lessonNoteTitle({ id: 'common-01', title: 'T' })).toBe(ALGO_COURSE.lessonNoteTitle('T'))
  })
})
