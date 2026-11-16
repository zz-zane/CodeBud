<script setup lang="ts">
import MiIcon from '../components/base/MiIcon.vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import MiTabs from '../components/base/MiTabs.vue'
import { useContentStore } from '../stores/content'
import { usePracticeStore } from '../stores/practice'
import { useLessonOpener } from '../lib/openLesson'
import { LANG_LABEL, STAGE_LABEL } from '../lib/labels'
import { APP_SIDEBAR, LEARN_VIEW, ALGO_COURSE, OVERVIEW, PRACTICE } from '../lib/copy'
import { isLessonMastered, lessonMastery } from '../../../shared/mastery'
import { lessonPracticeQuestions } from '../lib/startPractice'
import type { Lang } from '../../../shared/types'

const route = useRoute()
const router = useRouter()
const content = useContentStore()
const practice = usePracticeStore()
const { openLesson } = useLessonOpener()

onMounted(() => {
  if (!practice.loaded) void practice.load()
})

function masteredOf(id: string): boolean {
  const m = lessonMastery(practice.history, id)
  return isLessonMastered(m.score, m.attempts)
}

const currentLang = computed({
  get: () => content.activeLang,
  set: (lang: Lang) => content.selectLang(lang)
})

type CourseTab = Lang | 'algo'

const courseTabs = [
  { key: 'common', label: LANG_LABEL.common },
  { key: 'c', label: LANG_LABEL.c },
  { key: 'cpp', label: LANG_LABEL.cpp },
  { key: 'java', label: LANG_LABEL.java },
  { key: 'python', label: LANG_LABEL.python },
  { key: 'algo', label: ALGO_COURSE.CAT_NAV }
]

const activeTab = ref<CourseTab>('common')

watch(
  () => [route.query.cat, content.activeLang] as const,
  ([cat, lang]) => {
    if (cat === 'algo') {
      activeTab.value = 'algo'
    } else {
      activeTab.value = lang
    }
  },
  { immediate: true }
)

function onTabChange(key: string): void {
  const tab = key as CourseTab
  activeTab.value = tab
  if (tab === 'algo') {
    void router.replace({ query: { ...route.query, cat: 'algo' } })
  } else {
    content.selectLang(tab)
    const q = { ...route.query }
    delete q.cat
    void router.replace({ query: q })
  }
}

const modules = computed(() => content.bundle.outline.filter((m) => m.lang === content.activeLang))
const algoChapters = computed(() => content.algoBundle?.chapters ?? [])
const quizCount = (id: string) => lessonPracticeQuestions(content.lessonOf(id)).length
</script>

<template>
  <div class="courses-view">
    <header class="catalog-header">
      <h1>{{ APP_SIDEBAR.COURSE_OUTLINE }}</h1>
      <MiTabs
        class="language-tabs"
        :tabs="courseTabs"
        :model-value="activeTab"
        :aria-label="LEARN_VIEW.LANGUAGE_LABEL"
        @update:model-value="onTabChange($event as string)"
      />
    </header>

    <!-- 基础编程课程（通用知识、C、C++、Java、Python） -->
    <div v-if="activeTab !== 'algo'" class="basics-category">
      <section v-for="mod in modules" :key="mod.stage" class="stage-section">
        <div class="stage-heading">
          <h3>{{ mod.lang === 'common' ? LANG_LABEL.common : STAGE_LABEL[mod.stage] }}</h3>
          <span>{{ LEARN_VIEW.modLessonCount(mod.lessons.length) }}</span>
        </div>
        <div class="lesson-grid">
          <button
            v-for="lesson in mod.lessons"
            :key="lesson.id"
            type="button"
            class="curriculum-lesson-card"
            :disabled="!lesson.hasContent"
            @click="openLesson(lesson.id)"
          >
            <span class="lesson-number">{{ String(lesson.order).padStart(2, '0') }}</span>
            <span class="lesson-info">
              <span class="lesson-title">{{ lesson.title }}</span>
            </span>
            <span v-if="masteredOf(lesson.id)" class="lesson-status mastered" data-testid="lesson-mastered">{{ OVERVIEW.MASTERED_BADGE }}</span>
            <span v-if="content.statusOf(lesson.id) === 'learned'" class="lesson-status learned" role="img" :title="LEARN_VIEW.STATUS_COMPLETED" :aria-label="LEARN_VIEW.STATUS_COMPLETED">
              <MiIcon name="circle-check" />
            </span>
          </button>
        </div>
      </section>
    </div>

    <!-- 算法与数据结构（Hello 算法） -->
    <div v-else class="algo-category">
      <div class="algo-intro-card">
        <div class="algo-meta-row">
          <span class="algo-badge">{{ ALGO_COURSE.OPEN_SOURCE_BADGE }}</span>
          <span class="algo-upstream">{{ ALGO_COURSE.UPSTREAM_COMMIT_PREFIX }}{{ content.algoBundle?.upstreamCommit.slice(0, 7) }}</span>
          <span class="algo-license">{{ ALGO_COURSE.LICENSE_LABEL }}</span>
          <span class="algo-author">{{ ALGO_COURSE.AUTHOR_PREFIX }}{{ content.algoBundle?.author }}</span>
        </div>
        <p class="algo-statement">
          {{ ALGO_COURSE.DESC }}
        </p>
      </div>

      <section v-for="chap in algoChapters" :key="chap.id" class="stage-section">
        <template v-if="chap.id === 'algo-c19'">
          <div class="stage-heading">
            <h3>{{ ALGO_COURSE.PAPER_BOOK }}</h3>
          </div>
          <div class="paperbook-card">
            <div class="paperbook-actions">
              <a
                :href="ALGO_COURSE.PAPER_BOOK_URL"
                target="_blank"
                rel="noopener noreferrer"
                class="paperbook-buy-btn"
              >
                {{ ALGO_COURSE.BUY_PAPER_BOOK }}
              </a>
              <button
                type="button"
                class="paperbook-read-btn"
                @click="openLesson('algo-s119')"
              >
                {{ ALGO_COURSE.READ_PAPER_BOOK_NOTE }}
              </button>
            </div>
          </div>
        </template>
        <template v-else>
          <div class="stage-heading">
            <h3>{{ chap.title }}</h3>
            <span>{{ ALGO_COURSE.lessonCount(chap.lessons.length) }}</span>
          </div>
          <div class="lesson-grid">
            <button
              v-for="lesson in chap.lessons"
              :key="lesson.id"
              type="button"
              class="curriculum-lesson-card"
              @click="openLesson(lesson.id)"
            >
              <span class="lesson-number">{{ String(lesson.order).padStart(2, '0') }}</span>
              <span class="lesson-info">
                <span class="lesson-title">{{ lesson.title }}</span>
              </span>
              <span v-if="masteredOf(lesson.id)" class="lesson-status mastered" data-testid="lesson-mastered">{{ OVERVIEW.MASTERED_BADGE }}</span>
              <span v-if="quizCount(lesson.id) > 0" class="lesson-status">{{ PRACTICE.questionCount(quizCount(lesson.id)) }}</span>
            </button>
          </div>
        </template>
      </section>
    </div>
  </div>
</template>

<style scoped>
.courses-view {
  max-width: 960px;
  margin: 0 auto;
  padding-bottom: var(--mi-sp-6);
}
h1,
h2,
h3 {
  font-family: var(--mi-font-family);
  color: var(--mi-text);
}
h1 {
  font-size: var(--mi-fs-title);
  font-weight: 500;
  line-height: var(--mi-lh-title);
  margin: 0 0 var(--mi-sp-6);
}

/*
 * 这一条有 7 个页签，最长的是「算法与数据结构」。
 * 之前写成 `width: max-content`：容器按内容撑，但页签是 `flex: 1 1 0` + `min-width: 0`，
 * 每个算出来是 0，最后容器只有 ~500px，7 份分下来每格 71px —— 装不下 91px 的字，
 * 文字直接溢出到邻居头上（截图里「Pytho算法与数据结」糊成一片）。
 * 改成占满一行并给上限：每格 100px 起，字放得下，选中的滑块也还是等宽等分。
 */
.language-tabs {
  margin: 0 0 var(--mi-sp-6);
}
.language-tabs :deep(.mi-tab) {
  padding: 0 var(--mi-sp-2);
}

.algo-intro-card {
  padding: var(--mi-sp-4) var(--mi-sp-4);
  background: var(--cds-surface-1);
  border: 1px solid var(--mi-border);
  border-radius: var(--radius-lg);
  margin-bottom: var(--mi-sp-6);
}
.algo-meta-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mi-sp-3);
  align-items: center;
  font-size: var(--mi-fs-caption);
  margin-bottom: var(--mi-sp-2);
}
.algo-badge {
  padding: 2px var(--mi-sp-2);
  background: var(--mi-blue-light);
  color: var(--mi-blue-deep);
  border-radius: 4px;
  font-weight: 500;
}
.algo-upstream,
.algo-license,
.algo-author {
  color: var(--mi-text-2);
}
.algo-statement {
  font-size: var(--mi-fs-label);
  color: var(--mi-text-2);
  line-height: 1.6;
  margin: 0;
}

.paperbook-card {
  padding: var(--mi-sp-4);
  background: var(--mi-card);
  border: 1px solid var(--mi-border);
  border-radius: var(--mi-radius-sm);
  margin-top: var(--mi-sp-3);
}
.paperbook-desc {
  font-size: var(--mi-fs-label);
  color: var(--mi-text-2);
  margin: 0 0 var(--mi-sp-3);
}
.paperbook-actions {
  display: flex;
  gap: var(--mi-sp-3);
  flex-wrap: wrap;
}
.paperbook-buy-btn {
  display: inline-flex;
  align-items: center;
  padding: var(--mi-sp-2) var(--mi-sp-4);
  border-radius: var(--mi-radius-sm);
  background: var(--mi-blue-deep);
  color: #fff;
  font-size: var(--mi-fs-label);
  text-decoration: none;
  font-weight: 500;
  transition: opacity var(--mi-dur-fast) ease;
}
.paperbook-buy-btn:hover {
  filter: brightness(0.95);
  text-decoration: none;
}
.paperbook-read-btn {
  padding: var(--mi-sp-2) var(--mi-sp-4);
  border-radius: var(--mi-radius-sm);
  background: var(--mi-bg);
  border: 1px solid var(--mi-border);
  color: var(--mi-text);
  font-size: var(--mi-fs-label);
  cursor: pointer;
  transition: background var(--mi-dur-fast) ease;
}
.paperbook-read-btn:hover {
  background: var(--mi-blue-light);
}

.stage-section {
  margin-top: var(--mi-sp-6);
}
.stage-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0 var(--mi-sp-3);
  border-bottom: 1px solid var(--mi-border);
}
h3 {
  font-size: var(--mi-fs-section);
  font-weight: 500;
  margin: 0;
}
.lesson-grid {
  display: flex;
  flex-direction: column;
  gap: 0;
}
.curriculum-lesson-card {
  display: flex;
  align-items: center;
  gap: var(--mi-sp-4);
  min-height: var(--mi-row-h);
  padding: 0;
  text-align: left;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--mi-border);
  border-radius: 0;
  font: inherit;
  color: var(--mi-text);
  cursor: pointer;
  transition: background-color var(--cds-dur-snap) var(--cds-ease-swift);
}
.curriculum-lesson-card:hover:enabled {
  background: var(--cds-fill-ghost-hover);
}
.curriculum-lesson-card:focus-visible {
  outline: 2px solid var(--cds-clay);
  outline-offset: -2px;
}
.curriculum-lesson-card:disabled {
  color: var(--mi-text-3);
  cursor: default;
}
.lesson-number {
  width: 24px;
  flex-shrink: 0;
  font-family: var(--mi-code);
  font-size: var(--mi-fs-caption);
  color: var(--mi-text-3);
}
.lesson-info {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--mi-sp-3);
  min-width: 0;
}
.lesson-title {
  font-size: var(--mi-fs-body);
  line-height: var(--mi-lh-body);
  overflow-wrap: anywhere;
}
.lesson-status {
  color: var(--mi-text-2);
  font-size: var(--mi-fs-caption);
  white-space: nowrap;
}
.lesson-status.learned {
  color: var(--mi-success-deep);
}
.lesson-status.mastered {
  padding: 2px var(--mi-sp-2);
  border-radius: var(--mi-radius-ctl);
  background: var(--mi-success-fill);
  color: var(--mi-success-deep);
  font-weight: 500;
}
@media (max-width: 1100px) {
  .lesson-info {
    align-items: flex-start;
    flex-direction: column;
    gap: 2px;
  }
}
</style>
