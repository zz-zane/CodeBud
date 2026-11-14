<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useContentStore } from '../stores/content'
import { useProgressStore } from '../stores/progress'
import { useSettingsStore } from '../stores/settings'
import {
  useReviewRunner,
  useReviewPool,
  REVIEW_MIN_SIZE,
  REVIEW_MAX_SIZE,
  normalizeReviewSize,
  type ReviewScope
} from '../lib/review-practice'
import { toast } from '../components/base/toast'
import { PANEL, REVIEW, TITLE, TOAST, ALGO_COURSE } from '../lib/copy'
import { LANG_LABEL } from '../lib/labels'
import { useTodayCounts } from '../lib/use-today-counts'
import MiIcon from '../components/base/MiIcon.vue'
import MiButton from '../components/base/MiButton.vue'

const router = useRouter()
const content = useContentStore()
const progress = useProgressStore()
const settings = useSettingsStore()

const currentScope = ref<ReviewScope>('all')
const pool = useReviewPool(currentScope)
const runner = useReviewRunner()
const counts = useTodayCounts()
onMounted(() => counts.ensureLoaded())
const dueInScope = computed(() => counts.dueIdsFor(currentScope.value))

const scopeList = computed(() => {
  const countOf = (scope: ReviewScope) => {
    return counts.dueIdsFor(scope).length
  }
  return [
    { key: 'all' as ReviewScope, label: REVIEW.ALL_COURSES, count: countOf('all') },
    { key: 'common' as ReviewScope, label: LANG_LABEL.common, count: countOf('common') },
    { key: 'c' as ReviewScope, label: LANG_LABEL.c, count: countOf('c') },
    { key: 'cpp' as ReviewScope, label: LANG_LABEL.cpp, count: countOf('cpp') },
    { key: 'java' as ReviewScope, label: LANG_LABEL.java, count: countOf('java') },
    { key: 'python' as ReviewScope, label: LANG_LABEL.python, count: countOf('python') },
    { key: 'algo' as ReviewScope, label: ALGO_COURSE.CAT_NAV, count: countOf('algo') }
  ]
})

const SIZE_KEY = 'miai:review-size:v1'

function readSize(): number {
  try {
    return normalizeReviewSize(window.localStorage.getItem(SIZE_KEY))
  } catch {
    return REVIEW_MIN_SIZE
  }
}

const size = ref(readSize())

function setSize(n: number): void {
  size.value = normalizeReviewSize(n)
  try {
    window.localStorage.setItem(SIZE_KEY, String(size.value))
  } catch {}
}

const starting = ref(false)

async function start(): Promise<void> {
  if (starting.value) return
  starting.value = true
  try {
    const n = await runner.start(size.value, currentScope.value, dueInScope.value)
    if (n > 0) toast(TOAST.reviewStarted(n), 'success')
    else if (n === 0) toast(REVIEW.EMPTY_POOL, 'warn')
  } finally {
    starting.value = false
  }
}

const firstLearnable = computed(() => {
  if (currentScope.value === 'algo') {
    const l = content.algoBundle.lessons.find((x) => !progress.learnedSet.has(x.id))
    return l ? { id: l.id, title: l.title } : (content.algoBundle?.lessons[0] ? { id: content.algoBundle.lessons[0].id, title: content.algoBundle.lessons[0].title } : null)
  }
  if (currentScope.value !== 'all') {
    const l = content.bundle.lessons.filter((x) => x.lang === currentScope.value).find((x) => content.statusOf(x.id) === 'open')
    return l ? { id: l.id, title: l.title } : null
  }
  const l = content.bundle.lessons.find((x) => content.statusOf(x.id) === 'open')
  return l ? { id: l.id, title: l.title } : null
})

function goLearn(): void {
  if (firstLearnable.value) router.push(`/lesson/${firstLearnable.value.id}`)
}
</script>

<template>
  <div class="page pg">
    <div class="pg-head">
      <h1 class="page-title pg-title">{{ TITLE.REVIEW }}</h1>
      <MiButton variant="ghost" icon="flag" :title="REVIEW.WRONGBOOK_DESC" @click="router.push('/practice?tab=wrongbook')">
        {{ REVIEW.WRONGBOOK_BTN }}
      </MiButton>
    </div>

    <div class="scope-tabs pg-chips" role="tablist">
      <button
        v-for="s in scopeList"
        :key="s.key"
        type="button"
        class="scope-chip pg-chip"
        :class="{ active: currentScope === s.key }"
        role="tab"
        :aria-selected="currentScope === s.key"
        :title="REVIEW.scopeCount(s.count)"
        @click="currentScope = s.key"
      >
        <span>{{ s.label }}</span>
        <span class="pg-count">{{ s.count }}</span>
      </button>
    </div>

    <div v-if="!settings.config.reviewEnabled" class="pg-empty">
      <MiIcon name="info" :size="24" />
      <p>{{ REVIEW.DISABLED }}</p>
    </div>

    <div v-else-if="pool === null" class="pg-empty" role="status">
      <MiIcon name="refresh" :size="24" />
      <p>{{ REVIEW.LOADING }}</p>
    </div>

    <div v-else-if="pool === 0" class="pg-empty">
      <MiIcon name="book" :size="24" />
      <p>{{ REVIEW.NO_LESSON }}</p>
      <MiButton v-if="firstLearnable" variant="primary" icon="play" @click="goLearn">{{ REVIEW.GO_LEARN }}</MiButton>
    </div>

    <div v-else class="review-start">
      <p class="due-line" data-testid="review-due-line">{{ counts.reviewDueToday.value.length > 0 ? REVIEW.dueStatus(counts.reviewDueToday.value.length, counts.reviewDueTotal.value) : REVIEW.NO_DUE }}</p>
      <div class="size-row" role="group" :aria-label="REVIEW.SIZE_LABEL">
        <button type="button" class="icon-btn step-btn" :disabled="size <= REVIEW_MIN_SIZE" :title="REVIEW.SIZE_DOWN" :aria-label="REVIEW.SIZE_DOWN" @click="setSize(size - 1)"><MiIcon name="minus" /></button>
        <span class="size-num" :title="PANEL.reviewDesc(pool)">{{ size }}</span>
        <button type="button" class="icon-btn step-btn" :disabled="size >= REVIEW_MAX_SIZE" :title="REVIEW.SIZE_UP" :aria-label="REVIEW.SIZE_UP" @click="setSize(size + 1)"><MiIcon name="plus" /></button>
      </div>
      <MiButton variant="primary" size="lg" icon="repeat" :disabled="starting" @click="start">{{ dueInScope.length > 0 ? REVIEW.START : REVIEW.START_FREE }}</MiButton>
    </div>
  </div>
</template>

<style scoped>
.page { max-width: var(--mi-page-max); }
.review-start { display: flex; flex-direction: column; align-items: center; gap: var(--mi-sp-4); padding: 56px var(--mi-sp-4); }
.size-row { display: flex; align-items: center; gap: var(--mi-sp-4); }
.size-num { min-width: 72px; text-align: center; font-family: var(--mi-font-serif); font-size: var(--mi-fs-title); line-height: 1; color: var(--mi-text); font-variant-numeric: tabular-nums; }
.due-line { margin: 0; font-size: var(--mi-fs-label); color: var(--mi-text-2); }
.review-note { margin: 0; font-size: var(--mi-fs-label); color: var(--mi-text-3); }
</style>
