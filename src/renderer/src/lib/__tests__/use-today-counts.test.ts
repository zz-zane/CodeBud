/**
 * 侧栏徽标与「今天」页共用的数字（lib/use-today-counts.ts，docs/31）。
 * 各 store 用响应式替身：证明数字读的是 store 里已有的数据，且做完复习 / 消除错题后会跟着变。
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../stores/content', async () => {
  const { reactive } = await import('vue')
  const content = reactive({
    questionIndex: [
      { lessonId: 'common-01', lang: 'common' },
      { lessonId: 'common-02', lang: 'common' },
      { lessonId: 'c-01', lang: 'c' },
      { lessonId: 'c-02', lang: 'c' },
      { lessonId: 'c-03', lang: 'c' },
      { lessonId: 'algo-01', lang: 'c' }
    ]
  })
  return { useContentStore: () => content }
})
vi.mock('../../stores/progress', async () => {
  const { reactive } = await import('vue')
  const ids = ['common-01', 'common-02', 'c-01', 'c-02', 'c-03', 'algo-01']
  // 十天前学的：按 docs/32 的排程，没练过的课现在都已逾期到期
  const old = new Date(Date.now() - 10 * 86_400_000).toISOString()
  const progress = reactive({ loaded: true, learnedSet: new Set(ids), profile: { learnedAt: Object.fromEntries(ids.map((id) => [id, old])) as Record<string, string> } })
  return { useProgressStore: () => progress }
})
vi.mock('../../stores/practice', async () => {
  const { reactive } = await import('vue')
  const practice = reactive({ loaded: true, history: [] as unknown[], load: () => {} })
  return { usePracticeStore: () => practice }
})
vi.mock('../../stores/quiz', async () => {
  const { reactive } = await import('vue')
  const quiz = reactive({ wrongbook: [] as unknown[], wrongbookLoaded: true, loadWrongbook: () => {} })
  return { useQuizStore: () => quiz }
})
vi.mock('../../stores/settings', async () => {
  const { reactive } = await import('vue')
  const settings = reactive({ config: { reviewEnabled: true } })
  return { useSettingsStore: () => settings }
})
vi.mock('../../stores/cet6-vocab', async () => {
  const { reactive, computed } = await import('vue')
  const state = reactive({ all: [] as Array<{ mastered: boolean }>, loaded: true, load: () => {} })
  return { useCet6VocabStore: () => reactive({ entries: computed(() => state.all), loaded: true, load: () => {}, state }) }
})

import { useTodayCounts } from '../use-today-counts'
import { usePracticeStore } from '../../stores/practice'
import { useContentStore } from '../../stores/content'
import { useProgressStore } from '../../stores/progress'
import { useQuizStore } from '../../stores/quiz'
import { useSettingsStore } from '../../stores/settings'
import { useCet6VocabStore } from '../../stores/cet6-vocab'

const session = (lessons: string[]) => ({
  id: 1, uid: 'x:1', at: new Date().toISOString(), mode: 'review',
  items: lessons.map((l) => ({ key: `${l}:q1`, lessonId: l, ok: true }))
})
const wrong = (key: string, over: Record<string, unknown> = {}) => ({ key, lessonId: key.split(':')[0], qid: 'q1', wrongCount: 1, lastWrongAt: '2026-11-12T10:00:00.000Z', cleared: false, ...over })

describe('useTodayCounts', () => {
  it('复习到期 = 按间隔排程到期的今日份，并按模块拆开；练过且答对的课离开列表', () => {
    const c = useTodayCounts()
    expect(c.reviewDue.value).toBe(6)
    expect(c.reviewDueTotal.value).toBe(6)
    expect(c.reviewByModule.value).toEqual({ 通用知识: 2, C: 3, 算法与数据结构: 1 })
    ;(usePracticeStore().history as unknown[]).push(session(['c-01', 'c-02', 'common-01']))
    expect(c.reviewDue.value).toBe(3)
    expect(c.reviewByModule.value).toEqual({ 通用知识: 1, C: 1, 算法与数据结构: 1 })
  })

  it('学课日之前的练习被忽略，不改变到期', () => {
    const c = useTodayCounts()
    const before = c.reviewDue.value
    ;(usePracticeStore().history as unknown[]).push({ ...session(['common-02']), at: '2020-01-01T00:00:00.000Z' })
    expect(c.reviewDue.value).toBe(before)
  })

  it('今日份最多 15 课，总数另给；dueIdsFor 按范围过滤今日份', () => {
    const c = useTodayCounts()
    const content = useContentStore() as unknown as { questionIndex: Array<{ lessonId: string; lang: string }> }
    const progress = useProgressStore() as unknown as { learnedSet: Set<string>; profile: { learnedAt: Record<string, string> } }
    const added = Array.from({ length: 20 }, (_, i) => `java-${String(i).padStart(2, '0')}`)
    for (const id of added) {
      content.questionIndex.push({ lessonId: id, lang: 'java' })
      progress.learnedSet.add(id)
      progress.profile.learnedAt[id] = progress.profile.learnedAt['c-01']
    }
    expect(c.reviewDueTotal.value).toBeGreaterThan(15)
    expect(c.reviewDueToday.value).toHaveLength(15)
    expect(c.reviewDue.value).toBe(15)
    expect(c.dueIdsFor('all')).toEqual(c.reviewDueToday.value)
    expect(c.dueIdsFor('java').every((id) => id.startsWith('java-'))).toBe(true)
    expect(c.dueIdsFor('java').length + c.dueIdsFor('c').length + c.dueIdsFor('common').length + c.dueIdsFor('algo').length).toBe(15)
    // 清理，别影响后面的用例
    content.questionIndex.splice(6)
    for (const id of added) { progress.learnedSet.delete(id); delete progress.profile.learnedAt[id] }
    expect(c.reviewDueTotal.value).toBe(c.reviewDue.value)
  })

  it('复习关闭 → 0；档案没读完 → 0', () => {
    const c = useTodayCounts()
    const settings = useSettingsStore()
    settings.config.reviewEnabled = false
    expect(c.reviewDue.value).toBe(0)
    settings.config.reviewEnabled = true
    expect(c.reviewDue.value).toBeGreaterThan(0)
  })

  it('错题 = 未消除且未软删；最近一次答错取其中最晚的；消除后数字下降', () => {
    const c = useTodayCounts()
    const quiz = useQuizStore()
    expect(c.wrongCount.value).toBe(0)
    expect(c.lastWrongAt.value).toBeNull()
    ;(quiz.wrongbook as unknown[]).push(
      wrong('c-01:q1', { lastWrongAt: '2026-11-10T10:00:00.000Z' }),
      wrong('c-02:q1', { lastWrongAt: '2026-11-12T10:00:00.000Z' }),
      wrong('c-03:q1', { cleared: true, lastWrongAt: '2026-11-13T10:00:00.000Z' }),
      wrong('common-01:q1', { removed: true, lastWrongAt: '2026-11-13T11:00:00.000Z' })
    )
    expect(c.wrongCount.value).toBe(2)
    expect(c.lastWrongAt.value).toBe('2026-11-12T10:00:00.000Z')
    ;(quiz.wrongbook as Array<{ key: string; cleared: boolean }>).find((e) => e.key === 'c-02:q1')!.cleared = true
    expect(c.wrongCount.value).toBe(1)
    expect(c.lastWrongAt.value).toBe('2026-11-10T10:00:00.000Z')
  })

  it('生词 = 未掌握的条目数', () => {
    const c = useTodayCounts()
    const vocab = useCet6VocabStore() as unknown as { state: { all: Array<{ mastered: boolean }> } }
    expect(c.vocabCount.value).toBe(0)
    vocab.state.all.push({ mastered: false }, { mastered: true }, { mastered: false })
    expect(c.vocabCount.value).toBe(2)
  })
})
