import { describe, expect, it } from 'vitest'
import { createRecentLesson } from '../recent-lesson'

describe('recent lesson', () => {
  it('records valid visits, survives reload and ignores invalid ids', () => {
    const data = new Map<string, string>()
    const storage = () => ({ getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => data.set(k, v) })
    const valid = (id: string) => id === 'written'
    const first = createRecentLesson(valid, storage)
    expect(first.id.value).toBeNull()
    first.record('draft')
    expect(first.id.value).toBeNull()
    first.record('written')
    expect(createRecentLesson(valid, storage).id.value).toBe('written')
    expect(createRecentLesson(() => false, storage).id.value).toBeNull()
  })
  it('keeps valid visits in memory when storage throws', () => {
    const storage = () => { throw new Error('unavailable') }
    const recent = createRecentLesson(id => id === 'written', storage)
    expect(recent.id.value).toBeNull()
    recent.record('written')
    expect(recent.id.value).toBe('written')
    recent.record('draft')
    expect(recent.id.value).toBe('written')
  })
})
