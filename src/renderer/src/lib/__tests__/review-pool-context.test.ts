import { describe, expect, it, vi } from 'vitest'
import { useReviewPool } from '../review-practice'

const fixture = vi.hoisted(() => ({
  content: { questionIndex: [{ lessonId: 'lesson-1' }, { lessonId: 'lesson-1' }, { lessonId: 'lesson-2' }] },
  progress: { loaded: false, learnedSet: new Set<string>() }
}))
vi.mock('../../stores/content', () => ({ useContentStore: () => fixture.content }))
vi.mock('../../stores/progress', () => ({ useProgressStore: () => fixture.progress }))

describe('review pool for the AI context rail', () => {
  it('waits for the profile and counts learned lessons with questions once', () => {
    fixture.progress.loaded = false
    expect(useReviewPool().value).toBeNull()
    fixture.progress.loaded = true
    fixture.progress.learnedSet = new Set(['algo-no-questions'])
    expect(useReviewPool().value).toBe(0)
    fixture.progress.learnedSet = new Set(['lesson-1', 'algo-no-questions'])
    expect(useReviewPool().value).toBe(1)
    fixture.progress.learnedSet.add('lesson-2')
    expect(useReviewPool().value).toBe(2)
  })
})
