import { computed, type ComputedRef, type Ref } from 'vue'
import { useContentStore } from '../stores/content'
import { useProgressStore } from '../stores/progress'
import { usePracticeStore } from '../stores/practice'
import { useQuizStore } from '../stores/quiz'
import { buildPaper } from '../../../shared/quiz-paper'
import {
  buildReviewPaper,
  normalizeReviewSize,
  type ReviewPaperItem
} from '../../../shared/review-paper'
import { parseQuestionKey } from '../../../shared/question-key'
import type { QuestionIndexItem } from '../../../shared/question-index'
import type { PracticeSession, Question } from '../../../shared/types'

export { REVIEW_MIN_SIZE, REVIEW_MAX_SIZE, normalizeReviewSize } from '../../../shared/review-paper'

export type ReviewScope = 'all' | 'common' | 'c' | 'cpp' | 'java' | 'python' | 'algo'

export interface ReviewDraft {
  questions: Question[]
  keys: string[]
  lessonCount: number
  size: number
}

export interface ReviewDeps {
  index: readonly QuestionIndexItem[]
  findQuestion: (item: QuestionIndexItem) => Question | null
  lessons: readonly string[]
  history: readonly PracticeSession[]
  wrongKeys: readonly string[]
  holeKeys: readonly string[]
  now: number
  rng?: () => number
}

export function buildReviewDraft(size: number, deps: ReviewDeps): ReviewDraft | null {
  const usable: { item: QuestionIndexItem; question: Question }[] = []
  for (const item of deps.index) {
    const question = deps.findQuestion(item)
    if (question) usable.push({ item, question })
  }

  const picked: ReviewPaperItem[] = buildReviewPaper({
    lessons: deps.lessons,
    history: deps.history,
    wrongKeys: deps.wrongKeys,
    holeKeys: deps.holeKeys,
    index: usable.map((u) => u.item),
    size,
    now: deps.now,
    ...(deps.rng ? { rng: deps.rng } : {})
  })
  if (picked.length === 0) return null

  const byKey = new Map(usable.map((u) => [u.item.key, u.question]))
  const entries = picked.map((p) => ({ question: byKey.get(p.key)!, key: p.key }))

  const paper = buildPaper(entries, entries.length, deps.rng)

  return {
    questions: paper.map((e) => e.question),
    keys: paper.map((e) => e.key),
    lessonCount: new Set(picked.map((p) => p.lessonId)).size,
    size: paper.length
  }
}

/** 复习范围对题目索引的筛选（池、出题、今日到期共用这一处） */
export function scopeIndexOf(index: readonly QuestionIndexItem[], scope: ReviewScope = 'all'): readonly QuestionIndexItem[] {
  if (scope === 'all') return index
  if (scope === 'algo') return index.filter((it) => it.lessonId.startsWith('algo-'))
  return index.filter((it) => it.lang === scope && !it.lessonId.startsWith('algo-'))
}

export function poolLessonsOf(
  index: readonly QuestionIndexItem[],
  learned: ReadonlySet<string>,
  scope: ReviewScope = 'all'
): string[] {
  return [...new Set(scopeIndexOf(index, scope).map((it) => it.lessonId))].filter((id) => learned.has(id))
}

export function useReviewPool(scope?: Ref<ReviewScope>): ComputedRef<number | null> {
  const content = useContentStore()
  const progress = useProgressStore()
  return computed(() =>
    progress.loaded
      ? poolLessonsOf(content.questionIndex, progress.learnedSet, scope ? scope.value : 'all').length
      : null
  )
}

/** dueToday：当前范围内今天到期的课；非空时只从这些课里组卷，空则用整个复习池（自由复习） */
export function storeDeps(scope: ReviewScope = 'all', dueToday: readonly string[] = []): ReviewDeps | null {
  const content = useContentStore()
  const progress = useProgressStore()
  const practice = usePracticeStore()
  const quiz = useQuizStore()

  const pool = poolLessonsOf(content.questionIndex, progress.learnedSet, scope)
  if (pool.length === 0) return null
  const lessons = dueToday.length > 0 ? dueToday : pool
  const filteredIndex = scopeIndexOf(content.questionIndex, scope)

  const live = quiz.wrongbook.filter((e) => !e.cleared && !e.removed)
  return {
    index: filteredIndex,
    findQuestion: (it) => {
      const { qid } = parseQuestionKey(it.key)
      return content.lessonOf(it.lessonId)?.questions.find((q) => q.id === qid) ?? null
    },
    lessons,
    history: practice.history,
    wrongKeys: live.map((e) => e.key),
    holeKeys: live.filter((e) => e.hole).map((e) => e.key),
    now: Date.now()
  }
}

export function useReviewRunner() {
  const quiz = useQuizStore()
  const practice = usePracticeStore()
  const progress = useProgressStore()

  async function start(size: number, scope: ReviewScope = 'all', dueToday: readonly string[] = []): Promise<number> {
    if (!practice.loaded) await practice.load()
    if (!progress.loaded) return -1

    const deps = storeDeps(scope, dueToday)
    if (!deps) return 0

    const draft = buildReviewDraft(normalizeReviewSize(size), deps)
    if (!draft) return 0

    quiz.startQuiz('review', '__review__', draft.questions, draft.keys)
    return draft.questions.length
  }

  return { start }
}
