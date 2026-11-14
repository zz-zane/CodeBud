/**
 * 内容 store：content-bundle 数据的唯一入口 + 侧栏选择状态。
 * bundle 是构建期产物（改内容后先 npm run build:content），渲染进程直接 import，天然离线。
 */
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { ContentBundle, Lang, Lesson, OutlineLesson, OutlineModule, Stage } from '../../../shared/types'
import bundleJson from '../generated/content-bundle.json'
import algoBundleJson from '../generated/algo-bundle.json'
import { computeUnlocked } from '../../../shared/unlock'
import { nextWrittenAfter } from '../../../shared/lesson-nav'
import { buildQuestionIndex } from '../../../shared/question-index'
import { useProgressStore } from './progress'
import { createRecentLesson } from '../lib/recent-lesson'

export interface AlgoChapterLesson {
  id: string
  title: string
  order: number
  hasContent: boolean
}

export interface AlgoChapter {
  id: string
  title: string
  order: number
  lessons: AlgoChapterLesson[]
}

export interface AlgoBundle {
  version: number
  upstreamCommit: string
  license: string
  author: string
  url: string
  title: string
  subtitle: string
  chapters: AlgoChapter[]
  lessons: Lesson[]
  searchIndex: any[]
}

const bundle = bundleJson as unknown as ContentBundle
const algoBundle = algoBundleJson as unknown as AlgoBundle

export const useContentStore = defineStore('content', () => {
  // ---- 数据
  /**
   * 有正文的课。⚠️ `bundle.lessons` **只装「已经写了正文的课」**，别拿它当「课的全集」用。
   * 要数当前节数请看 `bundle.lessons.length`，别抄进注释。
   */
  const lessonIndex = new Map<string, Lesson>()
  for (const l of bundle.lessons) lessonIndex.set(l.id, l)

  // 算法与数据结构 · Hello 算法课程池（119 节离线官方正文）
  const algoIndex = new Map<string, Lesson>()
  for (const l of algoBundle.lessons) algoIndex.set(l.id, l)

  /**
   * 大纲全表：包括还没写正文的那些。
   */
  const outlineIndex = new Map<string, OutlineLesson>()
  for (const m of bundle.outline) for (const l of m.lessons) outlineIndex.set(l.id, l)

  // ---- 侧栏选择状态
  const activeLang = ref<Lang>('common')
  const activeStage = ref<1 | 2 | 3>(1)

  const activeModule = computed<OutlineModule | undefined>(() => {
    const stage = activeLang.value === 'common' ? 0 : activeStage.value
    return bundle.outline.find((m) => m.lang === activeLang.value && m.stage === stage)
  })

  const activeLessons = computed<OutlineLesson[]>(() => activeModule.value?.lessons ?? [])

  const totalLessons = computed(() => bundle.outline.reduce((s, m) => s + m.lessons.length, 0))

  // ---- 解锁与状态
  const progress = useProgressStore()
  const unlockedIds = computed(() => {
    return computeUnlocked(bundle.lessons, new Set(progress.profile.learned))
  })

  function lessonOf(id: string): Lesson | undefined {
    return lessonIndex.get(id) ?? algoIndex.get(id)
  }

  function getQuestion(lessonId: string, questionId: string) {
    return lessonOf(lessonId)?.questions.find((q) => q.id === questionId) ?? null
  }

  /**
   * 大纲里有没有这个课号（不管正文写没写）。
   */
  const recentLesson = createRecentLesson((id) => !!lessonOf(id) && statusOf(id) !== 'draft')

  /**
   * 「继续学习」要去的那一课：最近打开的课；没有就是通用知识的第一课。
   * 「进度」页的按钮与「今天」页的继续学习卡共用这一处（docs/31 §2.2）。
   */
  const continueLesson = computed<Lesson | null>(() => {
    const recent = recentLesson.id.value ? lessonOf(recentLesson.id.value) : undefined
    return recent ?? bundle.lessons.find((l) => l.lang === 'common') ?? null
  })

  function inOutline(id: string): boolean {
    return outlineIndex.has(id) || algoIndex.has(id)
  }

  /** 大纲课名（含未生成课） */
  function titleOf(id: string): string | undefined {
    return outlineIndex.get(id)?.title ?? algoIndex.get(id)?.title
  }

  /**
   * 课状态：draft = 内容未生成；locked = 前置未完成；open = 可学；learned = 已学
   * Hello 算法课全部自由阅读开放
   */
  function statusOf(id: string): 'draft' | 'locked' | 'open' | 'learned' {
    if (algoIndex.has(id)) {
      if (progress.profile.learned.includes(id)) return 'learned'
      return 'open'
    }
    if (!outlineIndex.get(id)?.hasContent) return 'draft'
    if (progress.profile.learned.includes(id)) return 'learned'
    return 'open'
  }

  /**
   * 已经写好正文的课有几节。
   */
  const readyCount = computed(() => bundle.lessons.length)

  /**
   * 「下一节现在就能上的课」
   */
  const nextUpId = computed<string | null>(() => {
    const written = bundle.outline.flatMap((m) => m.lessons).filter((l) => l.hasContent)
    return (written.find((l) => statusOf(l.id) === 'open') ?? written[0])?.id ?? null
  })

  /**
   * 「这一课之后第一节有正文的课」
   */
  function nextWrittenAfterId(id: string): string | null {
    if (id.startsWith('algo-')) {
      const idx = algoBundle.lessons.findIndex((l) => l.id === id)
      if (idx >= 0 && idx + 1 < algoBundle.lessons.length) {
        return algoBundle.lessons[idx + 1].id
      }
      return null
    }
    return nextWrittenAfter(bundle.outline, id)
  }

  function prevWrittenBeforeId(id: string): string | null {
    if (id.startsWith('algo-')) {
      const idx = algoBundle.lessons.findIndex((l) => l.id === id)
      if (idx > 0) {
        return algoBundle.lessons[idx - 1].id
      }
      return null
    }
    return null
  }

  function selectLang(lang: Lang) {
    activeLang.value = lang
  }
  function selectStage(stage: 1 | 2 | 3) {
    activeStage.value = stage
  }

  /**
   * 运行时题目索引：全部有正文的课 × 每道题的"轻档案"
   */
  const questionIndex = computed(() => buildQuestionIndex([...bundle.lessons, ...algoBundle.lessons]))

  return {
    bundle,
    algoBundle,
    recentLessonId: recentLesson.id,
    continueLesson,
    recordRecentLesson: recentLesson.record,
    lessonIndex,
    algoIndex,
    activeLang,
    activeStage,
    activeModule,
    activeLessons,
    totalLessons,
    unlockedIds,
    readyCount,
    nextUpId,
    nextWrittenAfterId,
    prevWrittenBeforeId,
    lessonOf,
    getQuestion,
    inOutline,
    titleOf,
    statusOf,
    selectLang,
    selectStage,
    questionIndex
  }
})
