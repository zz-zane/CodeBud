<script setup lang="ts">
 







import { computed, nextTick, ref } from 'vue'
import { useRouter } from 'vue-router'
import MiIcon from '../base/MiIcon.vue'
import { useAiAssistantStore } from '../../stores/ai-assistant'
import { useContentStore } from '../../stores/content'
import { useSettingsStore } from '../../stores/settings'
import { useQuizStore } from '../../stores/quiz'
import { useProgressStore } from '../../stores/progress'
import { buildLearnerMemoryProfile, formatLearnerMemoryTagContent } from '../../lib/learner-memory'
import { useLessonOpener } from '../../lib/openLesson'
import { lessonPracticeQuestions, lessonPracticeRoute } from '../../lib/startPractice'
import { useReviewPool } from '../../lib/review-practice'
import { isValidCourseReference } from '../../lib/tutoring-search'
import { courseGroups, type CourseCategory } from '../../lib/ai-course-catalog'
import { LANG_LABEL, STAGE_LABEL } from '../../lib/labels'
import { AI_ASSISTANT, ALGO_COURSE, PANEL } from '../../lib/copy'
import MiButton from '../base/MiButton.vue'
import type { CourseReference } from '../../../../shared/types'

const ai = useAiAssistantStore()
const content = useContentStore()
const settings = useSettingsStore()
const router = useRouter()
const { openLesson } = useLessonOpener()
const pool = useReviewPool()

const quiz = useQuizStore()
const progress = useProgressStore()

// 确保错题本加载
if (!quiz.wrongbookLoaded) {
  void quiz.loadWrongbook()
}

// ── Learner Memory (L1/L2/L3) ──
const totalLessonsCount = computed(() => {
  return (content.bundle?.lessons?.length || 0) + (content.algoBundle?.lessons?.length || 0)
})

const memoryProfile = computed(() => {
  return buildLearnerMemoryProfile({
    learnedIds: progress.learnedSet,
    totalLessons: totalLessonsCount.value,
    wrongbook: quiz.wrongbook,
    activeLessonId: ai.lessonContextId,
    contextTags: ai.contextTags,
    lessonTitleOf: (id: string) => content.lessonOf(id)?.title ?? id
  })
})

const isMemoryMounted = computed(() => {
  return ai.contextTags.some((t) => t.id === 'learner-memory')
})

function toggleMemoryMount() {
  if (isMemoryMounted.value) {
    ai.removeContextTag('learner-memory')
  } else {
    ai.addContextTag({
      id: 'learner-memory',
      type: 'memory',
      title: AI_ASSISTANT.TAG_MEMORY,
      content: formatLearnerMemoryTagContent(memoryProfile.value),
      removable: true
    })
  }
}


// ── A 学习对象 ──
const lesson = computed(() => (ai.lessonContextId ? content.lessonOf(ai.lessonContextId) ?? null : null))
const isAlgo = computed(() => !!lesson.value && lesson.value.id.startsWith('algo-'))
const algoChapter = computed(() => {
  const id = lesson.value?.id
  if (!id || !isAlgo.value) return null
  return content.algoBundle.chapters.find((c) => c.lessons.some((l) => l.id === id))?.title ?? null
})
const learned = computed(() => !!lesson.value && content.statusOf(lesson.value.id) === 'learned')
const statusText = computed(() => {
  if (learned.value) return AI_ASSISTANT.STATUS_LEARNED
  return isAlgo.value ? AI_ASSISTANT.ALGO_READABLE : AI_ASSISTANT.STATUS_LEARNING
})
const quizCount = computed(() => lessonPracticeQuestions(lesson.value).length)
const quizText = computed(() => {
  return quizCount.value > 0 ? AI_ASSISTANT.lessonQuizCount(quizCount.value) : isAlgo.value ? AI_ASSISTANT.ALGO_NO_QUIZ : AI_ASSISTANT.LESSON_NO_QUIZ
})

function goLesson(id: string) {
  ai.isOpen = true
  ai.markReturnTarget()
  openLesson(id)
}
function goAlgoCatalog() {
  ai.markReturnTarget()
  void router.push('/courses?cat=algo')
}
function startQuiz() {
  if (!lesson.value || !quizCount.value) return
  ai.markReturnTarget()
  void router.push(lessonPracticeRoute(lesson.value.id))
}

// ── 课程选择器（栏内展开，不是新页面/新弹窗） ──
const picking = ref(true)
const filter = ref('')
const filterInput = ref<HTMLInputElement | null>(null)
const category = ref<CourseCategory>('common')
const categories = [
  ...(['common', 'c', 'cpp', 'java', 'python'] as const).map(key => ({ key, label: LANG_LABEL[key] })),
  { key: 'algo' as const, label: ALGO_COURSE.CAT_NAV }
]
const groups = computed(() => courseGroups(content.bundle, content.algoBundle, category.value, filter.value, id => !!content.lessonOf(id)))
function openPicker() {
  picking.value = true
  filter.value = ''
  void nextTick(() => filterInput.value?.focus())
}
function choose(id: string) {
  ai.setLessonContext(id)
  picking.value = false
  ai.isOpen = true
  ai.markReturnTarget()
  openLesson(id)
}
function onPickerKey(e: KeyboardEvent) {
  if (e.key === 'Escape') { e.stopPropagation(); picking.value = false }
}
// 点语言分类同时告诉 AI「用户在意哪门语言」；algo 不是合法 Lang，不传
function pickCategory(key: CourseCategory) {
  category.value = key
  filter.value = ''
  if (key !== 'algo') content.selectLang(key)
}

// ── B 本轮上下文 ──
const turnTags = computed(() => ai.contextTags.filter((t) => t.type !== 'lesson'))
function kindOf(type: string) {
  return type === 'code' ? AI_ASSISTANT.TAG_CODE : type === 'error' ? AI_ASSISTANT.TAG_ERROR : type === 'memory' ? AI_ASSISTANT.TAG_MEMORY : AI_ASSISTANT.TAG_SELECTION
}

// ── C 对话里提到的课程 ──
const mentioned = computed(() => {
  const seen = new Set<string>()
  const out: CourseReference[] = []
  for (const m of ai.currentMessages) {
    for (const r of m.references ?? []) {
      if (seen.has(r.lessonId) || !isValidCourseReference(r, content.lessonOf)) continue
      seen.add(r.lessonId)
      out.push(r)
    }
  }
  return out.slice(0, 5)
})

// ── D 复习 ──
const showReview = computed(() => settings.config.reviewEnabled && pool.value !== null && pool.value > 0)

defineExpose({ openPicker })
</script>

<template>
  <div class="ai-rail-inner">
    <section class="rail-block">
      <h3 class="rail-title">{{ AI_ASSISTANT.RAIL_TITLE_TARGET }}</h3>
      <template v-if="!picking">
        <template v-if="lesson">
          <div class="target-title">{{ lesson.title }}</div>
          <div class="target-badges">
            <template v-if="isAlgo">
              <span class="badge">{{ ALGO_COURSE.CAT_BADGE }}</span>
              <span v-if="algoChapter" class="badge">{{ algoChapter }}</span>
            </template>
            <template v-else>
              <span class="badge">{{ LANG_LABEL[lesson.lang] }}</span>
              <span v-if="lesson.lang !== 'common' && STAGE_LABEL[lesson.stage]" class="badge">{{ STAGE_LABEL[lesson.stage] }}</span>
            </template>
          </div>
          <p class="target-line" :class="{ learned }">{{ statusText }}</p>
          <p class="target-line">{{ quizText }}</p>
          <div class="target-actions">
            <MiButton size="sm" variant="secondary" @click="goLesson(lesson.id)">{{ AI_ASSISTANT.OPEN_LESSON }}</MiButton>
            <MiButton v-if="isAlgo" size="sm" variant="secondary" @click="goAlgoCatalog">{{ AI_ASSISTANT.ALGO_CATALOG }}</MiButton>
            <MiButton v-if="quizCount > 0" size="sm" variant="secondary" @click="startQuiz">{{ AI_ASSISTANT.START_LESSON_QUIZ }}</MiButton>
            <button type="button" class="icon-btn" :title="AI_ASSISTANT.CHANGE_LESSON" :aria-label="AI_ASSISTANT.CHANGE_LESSON" @click="openPicker"><MiIcon name="refresh" /></button>
            <button type="button" class="icon-btn" :title="AI_ASSISTANT.REMOVE_LESSON_CONTEXT" :aria-label="AI_ASSISTANT.REMOVE_LESSON_CONTEXT" @click="ai.setLessonContext(null)"><MiIcon name="x" /></button>
          </div>
        </template>
        <template v-else>
          <p class="rail-note">{{ AI_ASSISTANT.RAIL_NO_TARGET }}</p>
          <MiButton size="sm" variant="secondary" @click="openPicker">{{ AI_ASSISTANT.PICK_LESSON }}</MiButton>
        </template>
      </template>

      <div v-else class="picker" @keydown="onPickerKey">
        <input ref="filterInput" v-model="filter" type="search" class="picker-filter" :aria-label="AI_ASSISTANT.PICK_LESSON_FILTER" :placeholder="AI_ASSISTANT.PICK_LESSON_FILTER" />
        <div class="picker-categories" :aria-label="AI_ASSISTANT.COURSE_CATEGORIES">
          <button v-for="cat in categories" :key="cat.key" type="button" :class="{ active: category === cat.key }" :aria-pressed="category === cat.key" @click="pickCategory(cat.key)">{{ cat.label }}</button>
        </div>
        <div class="picker-list">
          <div v-for="g in groups" :key="g.key" class="picker-group">
            <div class="picker-group-title">{{ g.label }}</div>
            <button v-for="it in g.items" :key="it.id" type="button" class="picker-item" :disabled="!it.available" :title="it.available ? it.title : `${it.title} ? ${AI_ASSISTANT.COURSE_UNAVAILABLE}`" @click="choose(it.id)">{{ it.title }}</button>
          </div>
          <p v-if="groups.length === 0" class="rail-note">{{ AI_ASSISTANT.PICK_LESSON_EMPTY }}</p>
        </div>
      </div>
    </section>

    
    <!-- 学习记忆画像 (L1/L2/L3) -->
    <section class="rail-block memory-rail-block">
      <div class="memory-rail-head">
        <h3 class="rail-title">{{ AI_ASSISTANT.MEMORY_BADGE }}</h3>
        <span class="memory-capsule">
          {{ AI_ASSISTANT.MEMORY_PROGRESS_CAPSULE(memoryProfile.l3Global.learnedCount, memoryProfile.l3Global.totalCount, memoryProfile.l3Global.masteryPercent) }}
        </span>
      </div>

      <div class="memory-stats-row">
        <span class="memory-stat-pill">
          {{ AI_ASSISTANT.MEMORY_ACTIVE_WRONGS(memoryProfile.l2Weakness.activeWrongCount, memoryProfile.l2Weakness.holeCount) }}
        </span>
      </div>

      <div v-if="memoryProfile.l2Weakness.topWeakLessons.length" class="memory-weak-section">
        <div class="memory-section-label">{{ AI_ASSISTANT.MEMORY_WEAK_LESSONS }}</div>
        <div class="weak-tag-list">
          <button
            v-for="item in memoryProfile.l2Weakness.topWeakLessons"
            :key="item.lessonId"
            type="button"
            class="weak-lesson-tag"
            :title="AI_ASSISTANT.MEMORY_CLICK_TO_REVIEW"
            @click="goLesson(item.lessonId)"
          >
            <span class="weak-tag-title">{{ item.title }}</span>
            <span class="weak-tag-count">{{ AI_ASSISTANT.wrongTimesBadge(item.totalWrongTimes) }}</span>
          </button>
        </div>
      </div>

      <div class="memory-action-row">
        <MiButton
          size="sm"
          :variant="isMemoryMounted ? 'ghost' : 'secondary'"
          @click="toggleMemoryMount"
        >
          {{ isMemoryMounted ? AI_ASSISTANT.MEMORY_UNMOUNT_BTN : AI_ASSISTANT.MEMORY_MOUNT_BTN }}
        </MiButton>
      </div>
    </section>

    <section v-if="turnTags.length" class="rail-block">
      <h3 class="rail-title" :title="AI_ASSISTANT.RAIL_CONTEXT_NOTE">{{ AI_ASSISTANT.RAIL_TITLE_CONTEXT }}</h3>
      <div v-for="t in turnTags" :key="t.id" class="ctx-item">
        <div class="ctx-head">
          <span class="ctx-kind">{{ kindOf(t.type) }}</span>
          <span class="ctx-title" :title="t.title">{{ t.title }}</span>
          <button type="button" class="ctx-del" :aria-label="AI_ASSISTANT.removeContextLabel(t.title)" :title="AI_ASSISTANT.removeContextLabel(t.title)" @click="ai.removeContextTag(t.id)">×</button>
        </div>
        <pre class="ctx-preview" :title="t.content">{{ t.content }}</pre>
      </div>
    </section>

    <section v-if="mentioned.length" class="rail-block">
      <h3 class="rail-title">{{ AI_ASSISTANT.RAIL_TITLE_REFS }}</h3>
      <button v-for="r in mentioned" :key="r.lessonId" type="button" class="ref-item" :title="r.excerpt" @click="goLesson(r.lessonId)">{{ r.title }}</button>
    </section>

    <section v-if="showReview" class="rail-block">
      <h3 class="rail-title">{{ AI_ASSISTANT.RAIL_TITLE_REVIEW }}</h3>
      <p class="rail-note">{{ PANEL.reviewDesc(pool ?? 0) }}</p>
      <MiButton size="sm" variant="secondary" @click="router.push('/review')">{{ PANEL.GO_REVIEW }}</MiButton>
    </section>
  </div>
</template>

<style scoped>
.ai-rail-inner { display:flex; flex-direction:column; height:100%; min-height:0; box-sizing:border-box; }
.rail-block { padding:var(--mi-sp-4); border-top:1px solid var(--mi-border); display:flex; flex-direction:column; gap:var(--mi-sp-2); }
.rail-block:first-child { border-top:0; flex:1 1 auto; min-height:280px; }
.rail-block > button { align-self:flex-start; }
.rail-title { margin:0; font-size:var(--mi-fs-caption); font-weight:500; color:var(--mi-text-2); letter-spacing:0; }
.target-title { font-size:var(--mi-fs-body); font-weight:500; color:var(--mi-text); line-height:1.4; }
.target-badges { display:flex; flex-wrap:wrap; gap:var(--mi-sp-2); }
.badge { font-size:var(--mi-fs-caption); color:var(--mi-text-2); background:var(--mi-blue-light); border-radius:6px; padding:2px var(--mi-sp-2); }
.target-line { margin:0; font-size:var(--mi-fs-label); color:var(--mi-text-2); }
.target-line.learned { color:var(--mi-text); }
.target-actions { display:flex; flex-wrap:wrap; gap:var(--mi-sp-2); align-items:center; margin-top:var(--mi-sp-1); }
.rail-link { border:0; background:transparent; color:var(--mi-text-2); font:inherit; font-size:var(--mi-fs-label); cursor:pointer; padding:var(--mi-sp-1) 2px; }
.rail-link:hover { color:var(--mi-text); text-decoration:underline; }
.rail-note { margin:0; font-size:var(--mi-fs-label); color:var(--mi-text-2); line-height:1.55; }
.rail-note.small { font-size:var(--mi-fs-caption); }
.picker { display:flex; flex-direction:column; gap:var(--mi-sp-2); flex:1; min-height:0; }
.picker-filter { width:100%; box-sizing:border-box; padding:var(--mi-sp-2) var(--mi-sp-3); border:1px solid var(--mi-border); border-radius:var(--mi-radius-sm); background:var(--mi-card); color:var(--mi-text); font:inherit; font-size:var(--mi-fs-label); }
.picker-filter:focus { outline:none; border-color:var(--mi-border-control); }
.picker-categories { display:flex; flex-wrap:wrap; gap:var(--mi-sp-1); }
.picker-categories button { border:0; border-radius:6px; background:transparent; color:var(--mi-text-2); font:inherit; font-size:var(--mi-fs-caption); padding:var(--mi-sp-1) var(--mi-sp-2); cursor:pointer; }
.picker-categories button.active,.picker-categories button:hover { background:var(--mi-blue-light); color:var(--mi-text); }
.picker-item:disabled { opacity:.5; cursor:not-allowed; }
.picker-list { flex:1 1 0; min-height:0; overflow:auto; display:flex; flex-direction:column; gap:var(--mi-sp-3); scrollbar-width:thin; scrollbar-color:var(--mi-border) transparent; }
.picker-group { display:flex; flex-direction:column; gap:2px; }
.picker-group-title { font-size:var(--mi-fs-caption); color:var(--mi-text-2); padding:2px var(--mi-sp-2); }
.picker-item,.ref-item { text-align:left; border:0; background:transparent; color:var(--mi-text); font:inherit; font-size:var(--mi-fs-label); padding:var(--mi-sp-2); border-radius:6px; cursor:pointer; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.picker-item:hover,.ref-item:hover { background:var(--mi-blue-light); }
.ctx-item { display:flex; flex-direction:column; gap:var(--mi-sp-1); }
.ctx-head { display:flex; align-items:center; gap:var(--mi-sp-2); min-width:0; }
.ctx-kind { font-size:var(--mi-fs-caption); color:var(--mi-text-2); flex-shrink:0; }
.ctx-title { flex:1; min-width:0; font-size:var(--mi-fs-label); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ctx-del { border:0; background:transparent; color:var(--mi-text-2); cursor:pointer; font-size:var(--mi-fs-read); padding:0 var(--mi-sp-1); }
.ctx-preview { margin:0; font-family:var(--mi-code); font-size:var(--mi-fs-caption); line-height:1.5; color:var(--mi-text-2); white-space:pre-wrap; word-break:break-all; display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
.ai-rail-inner button:focus-visible,.picker-filter:focus-visible { outline:2px solid var(--mi-text); outline-offset:2px; }
.ai-rail-inner button:focus:not(:focus-visible) { outline:none; }

/* 学习画像 */
.memory-rail-block { flex-shrink: 0; }
.memory-rail-head { display: flex; align-items: center; justify-content: space-between; gap: var(--mi-sp-2); }
.memory-capsule { font-size: var(--mi-fs-caption); color: var(--mi-text-3); font-variant-numeric: tabular-nums; }
.memory-stats-row { display: flex; flex-direction: column; gap: var(--mi-sp-1); }
.memory-stat-pill { font-size: var(--mi-fs-label); color: var(--mi-text-2); }
.memory-weak-section { display: flex; flex-direction: column; gap: var(--mi-sp-2); margin-top: 2px; }
.memory-section-label { font-size: var(--mi-fs-caption); color: var(--mi-text-2); }
.weak-tag-list { display: flex; flex-wrap: wrap; gap: var(--mi-sp-1); }
.weak-lesson-tag { display: inline-flex; align-items: center; gap: var(--mi-sp-1); padding: 3px var(--mi-sp-2); border: 0; border-radius: 6px; background: var(--mi-blue-light); color: var(--mi-text); font-size: var(--mi-fs-caption); cursor: pointer; text-align: left; }
.weak-lesson-tag:hover { background: var(--cds-fill-ghost-hover); }
.weak-tag-title { max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.weak-tag-count { font-size: var(--mi-fs-caption); color: var(--mi-error-deep); }
.memory-action-row { display: flex; margin-top: var(--mi-sp-1); }

</style>
