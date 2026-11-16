<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as echarts from 'echarts/core'
import { RadarChart, HeatmapChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  VisualMapComponent,
  CalendarComponent,
  RadarComponent,
  TitleComponent
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useContentStore } from '../stores/content'
import { useProgressStore } from '../stores/progress'
import { usePracticeStore } from '../stores/practice'
import { useCet6Store } from '../stores/cet6'
import { isLessonMastered, lessonMastery } from '../../../shared/mastery'
import { localDateKeyOf } from '../../../shared/dates'
import { CET6_EXAM_TOTAL } from '../../../shared/cet6'
import { today } from '../lib/day-clock'
import { LANG_LABEL, STAGE_LABEL } from '../lib/labels'
import { computeAlgoProgress, computePerLang, learnedCount, overallPercent } from '../lib/overview'
import { ALGO_COURSE, CET6, EMPTY, OVERVIEW, TITLE } from '../lib/copy'
import { useLessonOpener } from '../lib/openLesson'
import MiButton from '../components/base/MiButton.vue'
import MiIcon from '../components/base/MiIcon.vue'
import MiProgressRing from '../components/base/MiProgressRing.vue'
import MiEmpty from '../components/base/MiEmpty.vue'
import MiTabs from '../components/base/MiTabs.vue'
import FavoritesView from './FavoritesView.vue'

echarts.use([
  RadarChart,
  HeatmapChart,
  GridComponent,
  TooltipComponent,
  VisualMapComponent,
  CalendarComponent,
  RadarComponent,
  TitleComponent,
  CanvasRenderer
])

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

const content = useContentStore()
const progress = useProgressStore()
const practice = usePracticeStore()
const cet6 = useCet6Store()
const route = useRoute()
const router = useRouter()

const activeTab = ref<'overview' | 'favorites'>('overview')

function handleOverviewTabChange(newTab: string) {
  if (newTab === 'memo') {
    void router.push('/memo')
    return
  }
  activeTab.value = newTab as 'overview' | 'favorites'
}

const perLang = computed(() => [
  ...computePerLang(content.bundle.outline, content.bundle.lessons, progress.learnedSet),
  computeAlgoProgress(content.algoBundle.lessons, progress.learnedSet)
])

const commonLessons = computed(() => content.bundle.lessons.filter((l) => l.lang === 'common'))
const commonLearned = computed(() => learnedCount(progress.learnedSet, commonLessons.value))
const commonPercent = computed(() => overallPercent(progress.learnedSet, commonLessons.value))

const { openLesson } = useLessonOpener()
const recentLesson = computed(() => (content.recentLessonId ? content.lessonOf(content.recentLessonId) : null))
function continueLearning(): void {
  const id = content.continueLesson?.id
  if (id) openLesson(id)
}

const allLessons = computed(() => [...content.bundle.lessons, ...content.algoBundle.lessons])
const allPercent = computed(() => overallPercent(progress.learnedSet, allLessons.value))
const allLearned = computed(() => learnedCount(progress.learnedSet, allLessons.value))
const algoLearned = computed(() => learnedCount(progress.learnedSet, content.algoBundle.lessons))
const algoPercent = computed(() => overallPercent(progress.learnedSet, content.algoBundle.lessons))

const radarData = computed(() => {
  const list = [...new Set(content.bundle.outline.map(m => m.lang))].map(lang => ({
    name: LANG_LABEL[lang],
    value: overallPercent(progress.learnedSet, content.bundle.lessons.filter(l => l.lang === lang))
  }))
  list.push({
    name: ALGO_COURSE.CAT_NAV,
    value: algoPercent.value
  })
  return list
})

const calendarData = computed(() => {
  const byDay = new Map<string, number>()
  for (const h of progress.profile.history) {
    const d = localDateKeyOf(h.finishedAt)
    if (!d) continue
    byDay.set(d, (byDay.get(d) ?? 0) + 1)
  }
  return [...byDay.entries()].map(([d, n]) => [d, n] as [string, number])
})

function masteredInCourse(lang: string): number {
  const list = lang === 'algo'
    ? content.algoBundle.lessons
    : content.bundle.lessons.filter((l) => l.lang === lang)
  return list.filter((l) => {
    const m = lessonMastery(practice.history, l.id)
    return isLessonMastered(m.score, m.attempts)
  }).length
}

/** 每门课一行：分段条按阶段切开，长度对应课数，比一张卡片一组小条更好扫 */
const courseRows = computed(() => [
  {
    key: 'common',
    label: LANG_LABEL.common,
    learned: commonLearned.value,
    total: commonLessons.value.length,
    mastered: masteredInCourse('common'),
    stages: [{ key: 'all', label: OVERVIEW.COMMON_ALL, learned: commonLearned.value, total: commonLessons.value.length, percent: commonPercent.value }]
  },
  ...perLang.value.map((p) => ({
    key: p.lang as string,
    label: p.lang === 'algo' ? ALGO_COURSE.CAT_NAV : LANG_LABEL[p.lang],
    learned: p.learned,
    total: p.total,
    mastered: masteredInCourse(p.lang),
    stages: p.stages.filter((s) => s.total > 0).map((s) => ({ key: String(s.stage), label: STAGE_LABEL[s.stage], learned: s.learned, total: s.total, percent: s.percent }))
  }))
])

const radarEl = ref<HTMLDivElement | null>(null)
const calendarEl = ref<HTMLDivElement | null>(null)
let radarChart: echarts.ECharts | null = null
let calendarChart: echarts.ECharts | null = null

const CALENDAR_PAD_LEFT = 34
const CALENDAR_PAD_RIGHT = 16

const calendarYear = computed(() => Number(today.value.slice(0, 4)))

function monthNameMap(containerW: number): string[] {
  const plotW = Math.max(0, containerW - CALENDAR_PAD_LEFT - CALENDAR_PAD_RIGHT)
  const pitch = plotW / 11.3
  const roomy = pitch >= 26 + 6
  return Array.from({ length: 12 }, (_, i) =>
    roomy ? TITLE.calendarMonth(i + 1) : TITLE.calendarMonthNarrow(i + 1)
  )
}

function updateCharts() {
  if (radarChart && radarEl.value) {
    radarChart.setOption({
      tooltip: {},
      radar: {
        indicator: radarData.value.map((d) => ({ name: d.name, max: 100 })),
        radius: '68%',
        axisName: { color: token('--mi-text-2'), fontSize: 12 }
      },
      series: [
        {
          type: 'radar',
          data: [{ value: radarData.value.map((d) => d.value), name: TITLE.SERIES_PROGRESS }],
          symbol: 'circle',
          symbolSize: 5,
          lineStyle: { color: token('--mi-blue-deep'), width: 2 },
          itemStyle: { color: token('--mi-blue-deep') },
          areaStyle: { color: token('--mi-blue-deep'), opacity: 0.25 }
        }
      ]
    })
  }
  if (calendarChart && calendarEl.value) {
    const max = Math.max(1, ...calendarData.value.map(([, n]) => n))
    calendarChart.setOption({
      tooltip: { formatter: (p: { data: [string, number] }) => TITLE.radarTooltip(p.data[0], p.data[1]) },
      visualMap: {
        min: 0,
        max,
        type: 'continuous',
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        inRange: { color: [token('--mi-blue-light'), token('--mi-blue-deep')] },
        calculable: false,
        show: false
      },
      calendar: {
        range: String(calendarYear.value),
        cellSize: ['auto', 16],
        top: 44,
        left: CALENDAR_PAD_LEFT,
        right: CALENDAR_PAD_RIGHT,
        yearLabel: { show: false },
        dayLabel: { nameMap: 'ZH', color: token('--mi-text-3'), margin: 8 },
        monthLabel: {
          nameMap: monthNameMap(calendarEl.value?.clientWidth ?? 0),
          color: token('--mi-text-3'),
          margin: 10
        },
        splitLine: { lineStyle: { color: token('--mi-border') } },
        itemStyle: { color: token('--mi-card'), borderColor: token('--mi-bg'), borderWidth: 2 }
      },
      series: [
        {
          type: 'heatmap',
          coordinateSystem: 'calendar',
          data: calendarData.value
        }
      ]
    })
  }
}

function resize() {
  radarChart?.resize()
  calendarChart?.resize()
  updateCharts()
}

onMounted(() => {
  void cet6.loadState()
  if (!practice.loaded) void practice.load()
  if (radarEl.value) radarChart = echarts.init(radarEl.value)
  if (calendarEl.value) calendarChart = echarts.init(calendarEl.value)
  updateCharts()
  window.addEventListener('resize', resize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  radarChart?.dispose()
  calendarChart?.dispose()
})
</script>

<template>
  <div class="overview pg">
    <MiTabs class="overview-subnav" :tabs="[
      { key: 'overview', label: TITLE.OVERVIEW_TAB_STATS, icon: 'chart' },
      { key: 'favorites', label: TITLE.OVERVIEW_TAB_FAVORITES, icon: 'star' },
      { key: 'memo', label: TITLE.OVERVIEW_TAB_MEMO, icon: 'note' }
    ]" :model-value="activeTab" :aria-label="TITLE.OVERVIEW"
      @update:model-value="handleOverviewTabChange($event as string)" />

    <div v-if="activeTab === 'favorites'" class="subview-wrap">
      <FavoritesView />
    </div>

    <div v-else class="overview-content">
      <section class="hero">
        <MiProgressRing :percent="allPercent" :size="72" :stroke="5" :label="allPercent + '%'" />
        <div class="hero-text">
          <h1 class="page-title pg-title">{{ TITLE.OVERVIEW }}</h1>
          <div class="hero-stats">
            <span class="hero-stat" :title="OVERVIEW.STAT_LEARNED"><MiIcon name="circle-check" :size="14" /><b>{{ allLearned }}</b>{{ OVERVIEW.learnedOfTotal(allLessons.length) }}</span>
            <button type="button" class="hero-stat stat-link" :title="OVERVIEW.STAT_FAVORITES" @click="activeTab = 'favorites'"><MiIcon name="star" :size="14" /><b>{{ progress.profile.favorites.length }}</b>{{ OVERVIEW.UNIT_LESSON }}</button>
            <button type="button" class="hero-stat stat-link" :title="CET6.STAT_TITLE" @click="router.push('/cet6')"><MiIcon name="graduation" :size="14" /><b>{{ cet6.submittedCount }}</b>{{ CET6.statUnit(CET6_EXAM_TOTAL) }}</button>
            <span class="hero-stat" :title="`${OVERVIEW.STAT_HISTORY}（${OVERVIEW.STAT_HISTORY_NOTE}）`"><MiIcon name="repeat" :size="14" /><b>{{ progress.profile.history.length }}</b>{{ OVERVIEW.UNIT_TIMES }}</span>
          </div>
        </div>
        <MiButton class="hero-continue" variant="primary" icon="play" :title="recentLesson?.title" @click="continueLearning">
          {{ recentLesson ? OVERVIEW.continueLesson(recentLesson.title) : OVERVIEW.START_FIRST }}
        </MiButton>
      </section>

      <section class="course-rows">
        <div v-for="c in courseRows" :key="c.key" class="course-row">
          <span class="course-name-wrap">
            <span class="course-name">{{ c.label }}</span>
            <span v-if="c.total > 0 && c.mastered === c.total" class="course-mastered" data-testid="course-mastered">{{ OVERVIEW.MASTERED_BADGE }}</span>
          </span>
          <div class="stage-track" role="img" :aria-label="`${c.label} ${c.learned}/${c.total}`">
            <span
              v-for="s in c.stages"
              :key="s.key"
              class="stage-seg"
              :style="{ flexGrow: s.total }"
              :title="`${s.label} ${s.learned}/${s.total}`"
            ><i :style="{ width: s.percent + '%' }" /></span>
          </div>
          <span class="course-count">{{ c.learned }}/{{ c.total }}</span>
        </div>
      </section>

      <div class="chart-grid">
        <section class="pg-section">
          <h2 class="pg-section-title"><MiIcon name="target" :size="14" />{{ TITLE.RADAR_CARD }}</h2>
          <div ref="radarEl" class="chart" />
        </section>
        <section class="pg-section">
          <h2 class="pg-section-title"><MiIcon name="clock" :size="14" />{{ TITLE.calendarCard(calendarYear) }}</h2>
          <div v-if="calendarData.length > 0" ref="calendarEl" class="chart chart-calendar" />
          <MiEmpty v-else v-bind="EMPTY.CALENDAR_EMPTY" />
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overview-content { display: flex; flex-direction: column; gap: var(--mi-sp-8); }
.subview-wrap :deep(.favorites-head) { display: none; }
.hero { display: flex; align-items: center; gap: var(--mi-sp-6); flex-wrap: wrap; }
.hero-text { flex: 1; min-width: 200px; display: flex; flex-direction: column; gap: var(--mi-sp-2); }
.hero-stats { display: flex; flex-wrap: wrap; gap: var(--mi-sp-1) var(--mi-sp-4); }
.hero-stat { display: inline-flex; align-items: center; gap: var(--mi-sp-1); padding: 0; border: 0; background: transparent; font: var(--mi-fs-label) var(--mi-font-family); color: var(--mi-text-3); }
.hero-stat b { font-weight: 500; color: var(--mi-text); font-variant-numeric: tabular-nums; }
.stat-link { cursor: pointer; }
.stat-link:hover b { color: var(--mi-blue-deep); }
.stat-link:focus-visible { outline: 2px solid var(--mi-blue-deep); outline-offset: 2px; }
.hero-continue { flex-shrink: 1; min-width: 0; max-width: 320px; overflow: hidden; text-overflow: ellipsis; }
.course-rows { display: flex; flex-direction: column; }
.course-row { display: grid; grid-template-columns: 112px minmax(0, 1fr) 60px; align-items: center; gap: var(--mi-sp-4); padding: var(--mi-sp-3) 0; border-bottom: 1px solid var(--mi-border); }
.course-row:last-child { border-bottom: 0; }
.course-name-wrap { display: flex; align-items: center; gap: var(--mi-sp-1); min-width: 0; }
.course-name { font-size: var(--mi-fs-body); color: var(--mi-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.course-mastered { flex-shrink: 0; padding: 1px var(--mi-sp-1); border-radius: var(--mi-radius-ctl); background: var(--mi-success-fill); color: var(--mi-success-deep); font-size: var(--mi-fs-caption); font-weight: 500; }
.stage-track { display: flex; gap: 3px; height: 8px; }
.stage-seg { display: block; flex-basis: 0; min-width: 6px; border-radius: 4px; overflow: hidden; background: var(--mi-blue-light); }
.stage-seg i { display: block; height: 100%; background: var(--mi-blue-deep); border-radius: inherit; }
.course-count { font-size: var(--mi-fs-caption); text-align: right; color: var(--mi-text-3); font-variant-numeric: tabular-nums; }
.chart-grid {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: var(--mi-sp-4);
}
@media (max-width: 820px) {
  .chart-grid {
    grid-template-columns: 1fr;
  }
}
.chart {
  height: 240px;
}
.chart-calendar {
  height: 180px;
}
.subview-wrap {
  animation: fadeIn var(--mi-dur-fast) var(--mi-ease-out);
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
