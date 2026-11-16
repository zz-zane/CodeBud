import { computed } from 'vue'
import { useContentStore } from '../stores/content'
import { useProgressStore } from '../stores/progress'
import { usePracticeStore } from '../stores/practice'
import { useQuizStore } from '../stores/quiz'
import { useSettingsStore } from '../stores/settings'
import { useCet6VocabStore } from '../stores/cet6-vocab'
import { poolLessonsOf, type ReviewScope } from './review-practice'
import { splitWrongbook } from './wrongbook-view'
import { LANG_LABEL } from './labels'
import { ALGO_COURSE } from './copy'
import { buildSchedule, pickDueToday } from '../../../shared/review-schedule'
import { today } from './day-clock'

/**
 * 「今天」页与侧栏徽标共用的几个数字（docs/31）。全是 computed，读的是各 store 里已有的数据，
 * 做完一轮复习 / 消除一道错题后 store 自己更新，数字随之变化；这里不另存一份。
 *
 * 复习「到期」（docs/32）：复习池里按间隔排程到期的课，取今日份（≤ 15）。
 * 今天页、侧栏徽标、手机标签栏和复习页都从这里取数，不各算一遍；排程每次由练习史 + learnedAt 重算，不落盘。
 */
export function useTodayCounts() {
  const content = useContentStore()
  const progress = useProgressStore()
  const practice = usePracticeStore()
  const quiz = useQuizStore()
  const settings = useSettingsStore()
  const vocab = useCet6VocabStore()

  /** 只读还没读过的；已读过的不重复发 IPC */
  function ensureLoaded(): void {
    if (!practice.loaded) void practice.load()
    if (!quiz.wrongbookLoaded) void quiz.loadWrongbook()
    if (!vocab.loaded) void vocab.load()
  }

  const due = computed(() => {
    if (!progress.loaded || !practice.loaded || !settings.config.reviewEnabled) return { total: 0, today: [] as string[], all: [] as string[] }
    const lessons = poolLessonsOf(content.questionIndex, progress.learnedSet, 'all')
    const intervals = settings.config.learning?.reviewStrategy ?? 'standard'
    const schedule = buildSchedule({ lessons, learnedAt: progress.profile.learnedAt, history: practice.history, todayKey: today.value, intervals })
    return pickDueToday(schedule, today.value)
  })
  const dueIds = computed(() => due.value.today)
  const reviewDueToday = dueIds
  const reviewDueTotal = computed(() => due.value.total)
  const reviewDue = computed(() => dueIds.value.length)

  /** 某个复习范围内今天到期的课（用 poolLessonsOf 的同一范围口径过滤今日份，保持排序） */
  function dueIdsFor(scope: ReviewScope): string[] {
    if (scope === 'all') return dueIds.value
    const inScope = new Set(poolLessonsOf(content.questionIndex, progress.learnedSet, scope))
    return dueIds.value.filter((id) => inScope.has(id))
  }

  /** 模块名 → 到期课数（模块名即界面上显示的语言名） */
  const reviewByModule = computed<Record<string, number>>(() => {
    const langOf = new Map<string, string>()
    for (const it of content.questionIndex) {
      langOf.set(it.lessonId, it.lessonId.startsWith('algo-') ? ALGO_COURSE.CAT_NAV : LANG_LABEL[it.lang])
    }
    const out: Record<string, number> = {}
    for (const id of dueIds.value) {
      const label = langOf.get(id)
      if (label) out[label] = (out[label] ?? 0) + 1
    }
    return out
  })

  const wrongEntries = computed(() => splitWrongbook(quiz.wrongbook).active)
  const wrongCount = computed(() => wrongEntries.value.length)
  /** 未消除错题里最近一次答错的时间（ISO）；没有则 null */
  const lastWrongAt = computed<string | null>(() => {
    let best: string | null = null
    for (const e of wrongEntries.value) if (!best || e.lastWrongAt > best) best = e.lastWrongAt
    return best
  })

  const vocabCount = computed(() => vocab.entries.filter((e) => !e.mastered).length)

  return { ensureLoaded, reviewDue, reviewDueToday, reviewDueTotal, dueIdsFor, reviewByModule, wrongCount, lastWrongAt, vocabCount }
}
