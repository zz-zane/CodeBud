import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { searchQuestions } from '../../../shared/search'

const fixtures = vi.hoisted(() => {
  const question = (id: string, stem: string) => ({ id, type: 'choice', stem, options: ['a', 'b'], answer: 0, explanation: 'e' })
  const lesson = (id: string, stem: string) => ({ id, lang: 'common', stage: 0, tags: [], questions: [question('q1', stem)], body: '', title: id })
  return { basic: lesson('common-01', 'basic fixture'), algo: lesson('algo-s013', 'algorithm needle') }
})
vi.mock('../generated/content-bundle.json', () => ({ default: { lessons: [fixtures.basic], outline: [], searchIndex: [] } }))
vi.mock('../generated/algo-bundle.json', () => ({ default: { lessons: [fixtures.algo], chapters: [], searchIndex: [] } }))
vi.mock('./progress', () => ({ useProgressStore: () => ({ profile: { learned: [] } }) }))

import { useContentStore } from './content'

describe('algorithm questions in the content store', () => {
  beforeEach(() => setActivePinia(createPinia()))
  it('indexes both bundles and resolves algorithm questions for search and practice', () => {
    const store = useContentStore()
    expect(store.questionIndex.map(q => q.key)).toEqual(['common-01:q1', 'algo-s013:q1'])
    expect(searchQuestions(store.questionIndex, 'algorithm needle').map(hit => hit.item.key)).toEqual(['algo-s013:q1'])
    expect(store.lessonOf('algo-s013')?.questions[0].stem).toBe('algorithm needle')
    expect(store.getQuestion('algo-s013', 'q1')?.stem).toBe('algorithm needle')
    expect(store.getQuestion('algo-s013', 'missing')).toBeNull()
    expect(store.statusOf('algo-s013')).toBe('open')
  })
})
