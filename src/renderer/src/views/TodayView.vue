<script setup lang="ts">
/**
 * 「今天」页（docs/31 §2）：每天一个入口 —— 接着学、把到期的清掉、做计划里今天的事。
 * 所有数字来自已有 store / 纯函数（shared/today.ts、lib/use-today-counts.ts），这里不另算一份。
 * 版面数值见 docs/31；手机（≤768px）的版面差异在 styles/phone.css 的「今天」一节。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue'
import { useRouter, type RouteLocationRaw } from 'vue-router'
import { useContentStore } from '../stores/content'
import { useProgressStore } from '../stores/progress'
import { useCetStore } from '../stores/cet6'
import { useStudyStore } from '../stores/study'
import { useSettingsStore } from '../stores/settings'
import { useSettingsDialogStore } from '../stores/settings-dialog'
import { useAiAssistantStore } from '../stores/ai-assistant'
import { useLessonOpener } from '../lib/openLesson'
import { useTodayCounts } from '../lib/use-today-counts'
import { today } from '../lib/day-clock'
import { assetBase } from '../lib/asset-base'
import { learnedCount } from '../lib/overview'
import { LANG_LABEL } from '../lib/labels'
import { ALGO_COURSE, APP_SIDEBAR, TODAY } from '../lib/copy'
import { STUDY_COPY } from '../lib/study-copy'
import { parseDateKey, shiftDateKey } from '../../../shared/dates'
import { answerTally, CET_LEVELS, type Cet6Exam } from '../../../shared/cet6'
import { buildProviderList, currentProvider } from '../../../shared/provider-list'
import {
  estimateMinutes,
  nextTasks,
  pickActivePlan,
  pickCet6InProgress,
  planDay,
  planProgress,
  relativeDayLabel,
  topTwoModules,
  weekDots
} from '../../../shared/today'
import type { StudyTask } from '../../../shared/study-companion'
import TodayMyTodos from '../components/domain/TodayMyTodos.vue'
import MiButton from '../components/base/MiButton.vue'
import MiIcon, { type MiIconName } from '../components/base/MiIcon.vue'
import UpdateBanner from '../components/domain/UpdateBanner.vue'

const router = useRouter()
const content = useContentStore()
const progress = useProgressStore()
const study = useStudyStore()
const settings = useSettingsStore()
const settingsDialog = useSettingsDialogStore()
const ai = useAiAssistantStore()
const counts = useTodayCounts()
const { openLesson } = useLessonOpener()

// 手机：计划折成第五行、不渲染大标题与提问条（版面数值在 phone.css）
const phoneMq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(max-width: 768px)') : null
const isPhone = ref(phoneMq?.matches ?? false)
function onPhoneMq(e: MediaQueryListEvent): void {
  isPhone.value = e.matches
}

onMounted(() => {
  phoneMq?.addEventListener('change', onPhoneMq)
  counts.ensureLoaded()
  for (const { store } of cetPapers) {
    void store.loadState()
    if (!store.catalogLoaded) void store.loadCatalog()
  }
})
onBeforeUnmount(() => phoneMq?.removeEventListener('change', onPhoneMq))

// ── 页头 ──
const dateLine = computed(() => {
  const p = parseDateKey(today.value)
  if (!p) return ''
  const dow = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()
  return TODAY.dateLine(p.m, p.d, TODAY.WEEKDAYS[(dow + 6) % 7])
})
const week = computed(() => weekDots(progress.checkin.days, today.value))
// 连续天数只在「今天或昨天学过」时才算数，断了的连续不再显示
const streak = computed(() => {
  const c = progress.checkin
  return c.lastDate === today.value || c.lastDate === shiftDateKey(today.value, -1) ? c.streakDays : 0
})

// ── 继续学习卡 ──
const isNewUser = computed(() => progress.loaded && progress.learnedSet.size === 0)
const lesson = computed(() => content.continueLesson)
const moduleLessons = computed(() => {
  const l = lesson.value
  if (!l) return []
  return l.id.startsWith('algo-') ? content.algoBundle.lessons : content.bundle.lessons.filter((x) => x.lang === l.lang)
})
const moduleLabel = computed(() => (lesson.value?.id.startsWith('algo-') ? ALGO_COURSE.CAT_NAV : lesson.value ? LANG_LABEL[lesson.value.lang] : ''))
const moduleLearned = computed(() => learnedCount(progress.learnedSet, moduleLessons.value))
const modulePercent = computed(() => (moduleLessons.value.length ? Math.round((moduleLearned.value / moduleLessons.value.length) * 100) : 0))
const lessonNo = computed(() => moduleLessons.value.findIndex((x) => x.id === lesson.value?.id) + 1)
const allLearned = computed(() => {
  const all = [...content.bundle.lessons, ...content.algoBundle.lessons]
  return all.length > 0 && learnedCount(progress.learnedSet, all) >= all.length
})

// ── 今日待办 ──
interface TodoRow { key: string; icon: MiIconName; title: string; meta: string; num?: number; due?: boolean; hint?: string; to: RouteLocationRaw }

const cetPapers = CET_LEVELS.map((level) => {
  const store = useCetStore(level)
  const paper = computed(() => pickCet6InProgress(store.records, store.metas))
  // 总题数要读试卷文件；读不到就只显示已答数
  const total = ref<{ id: string; total: number } | null>(null)
  watch(paper, async (p, _, onCleanup) => {
    if (!p || total.value?.id === p.id) return
    const meta = store.metas.find((m) => m.id === p.id)
    if (!meta) return
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    try {
      const resp = await fetch(`${assetBase()[level]}data/${meta.file}`, { signal: controller.signal })
      if (!resp.ok) return
      const exam = (await resp.json()) as Cet6Exam
      if (controller.signal.aborted) return
      total.value = { id: p.id, total: answerTally(exam, {}).total }
    } catch {
      /* 读不到总题数不影响待办行 */
    }
  }, { immediate: true })
  return { level, store, paper, total, startLabel: level === 'cet4' ? TODAY.START_CET4 : TODAY.START_CET6 }
})

const baseRows = computed<TodoRow[]>(() => {
  const rows: TodoRow[] = []
  if (counts.reviewDue.value > 0) {
    const meta = topTwoModules(counts.reviewByModule.value).map(([l, n]) => TODAY.moduleCount(l, n)).join(TODAY.MODULE_SEP)
    const hint = counts.reviewDueTotal.value > counts.reviewDueToday.value.length ? TODAY.dueTotalTitle(counts.reviewDueTotal.value, counts.reviewDueToday.value.length) : undefined
    rows.push({ key: 'review', icon: 'refresh', title: TODAY.ROW_REVIEW, meta, num: counts.reviewDue.value, due: true, hint, to: '/review' })
  }
  if (counts.wrongCount.value > 0) {
    const when = counts.lastWrongAt.value ? relativeDayLabel(counts.lastWrongAt.value, today.value) : ''
    rows.push({ key: 'wrong', icon: 'flag', title: TODAY.ROW_WRONG, meta: when ? TODAY.lastWrong(when) : '', num: counts.wrongCount.value, to: { path: '/practice', query: { tab: 'wrongbook' } } })
  }
  if (counts.vocabCount.value > 0) {
    rows.push({ key: 'vocab', icon: 'book', title: TODAY.ROW_VOCAB, meta: TODAY.VOCAB_META, num: counts.vocabCount.value, due: true, to: { path: '/cet6/vocab', query: { review: '1' } } })
  }
  for (const { level, paper, total } of cetPapers) {
    const p = paper.value
    if (!p) continue
    const questionTotal = total.value?.id === p.id ? total.value.total : null
    rows.push({ key: level, icon: 'graduation', title: level === 'cet4' ? `${APP_SIDEBAR.NAV_CET4} · ${p.title}` : p.title, meta: TODAY.cet6Meta(p.mode, p.answered, questionTotal), to: { path: `/${level}/${p.id}`, query: { mode: p.mode } } })
  }
  return rows
})

const minutes = computed(() => estimateMinutes({ review: counts.reviewDue.value, wrong: counts.wrongCount.value, vocab: counts.vocabCount.value }))

// ── 计划 ──
// 进入页面后第一次选中的计划就锁住：最后一项勾完也不会立刻换成别的计划
const lockedPlanId = ref<string | null>(null)
watchEffect(() => {
  if (!lockedPlanId.value) lockedPlanId.value = pickActivePlan(study.plans)?.id ?? null
})
const plan = computed(() => study.plans.find((p) => p.id === lockedPlanId.value) ?? pickActivePlan(study.plans))
const ticked = ref<Set<string>>(new Set())
const planTasks = computed(() => (plan.value ? nextTasks(plan.value, 3, ticked.value) : []))
const planStat = computed(() => (plan.value ? planProgress(plan.value) : { done: 0, total: 0, percent: 0 }))
const planRemaining = computed(() => (plan.value ? plan.value.tasks.filter((t) => t.status !== 'done').length : 0))

async function toggleTask(t: StudyTask): Promise<void> {
  const p = plan.value
  if (!p) return
  const next = t.status === 'done' ? 'todo' : 'done'
  const res = await study.setTaskStatus(p.id, t.id, next)
  if (!res.ok) return
  const set = new Set(ticked.value)
  if (next === 'done') set.add(t.id)
  else set.delete(t.id)
  ticked.value = set
}

const tasksRoute: RouteLocationRaw = { path: '/study', query: { tab: 'tasks' } }
const rows = computed<TodoRow[]>(() => {
  if (!isPhone.value || !plan.value || planRemaining.value === 0) return baseRows.value
  const n = Math.min(planRemaining.value, 3)
  return [...baseRows.value, { key: 'plan', icon: 'list', title: TODAY.planRowTitle(plan.value.title), meta: TODAY.planRowMeta(n), num: n, to: tasksRoute }]
})

// ── 提问条 ──
const providers = computed(() => buildProviderList({ connections: study.connections, activeConnectionId: study.activeConnectionId, builtinLabel: STUDY_COPY.PROVIDER.BUILTIN, builtinReady: settings.config.ai.hasKey }))
const provider = computed(() => currentProvider(providers.value))
const aiReady = computed(() => provider.value.status === 'ready')
const question = ref('')

function openAiSettings(): void {
  settingsDialog.openSettings('ai', '/today')
}
function ask(): void {
  const text = question.value.trim()
  if (!aiReady.value || !text) return
  ai.draft = text
  ai.isOpen = false
  ai.railPref = 'closed'
  void router.push('/ai')
  ai.sendDraft()
  question.value = ''
}
</script>

<template>
  <div class="today">
    <UpdateBanner />
    <!-- 页头 -->
    <header class="t-head">
      <div class="t-head-left">
        <div class="t-date">{{ dateLine }}</div>
        <h1 v-if="!isPhone" class="t-title pg-title">{{ TODAY.TITLE }}</h1>
        <div v-if="isPhone && streak > 0" class="t-streak-n">
          <MiIcon name="flame" :size="16" />{{ TODAY.STREAK_LEAD }} <b>{{ streak }}</b> {{ TODAY.STREAK_UNIT }}
        </div>
      </div>
      <div class="t-streak">
        <div v-if="!isPhone && streak > 0" class="t-streak-n">
          <MiIcon name="flame" :size="16" />{{ TODAY.STREAK_LEAD }} <b>{{ streak }}</b> {{ TODAY.STREAK_UNIT }}
        </div>
        <ol class="t-week">
          <li v-for="(d, i) in week" :key="d.key" class="t-day" :class="{ 'is-today': d.isToday, linked: d.state === 'done' && week[i - 1]?.state === 'done' }">
            <span class="t-dot" :class="d.state" role="img" :aria-label="TODAY.weekDot(TODAY.WEEKDAYS[i], d.state, d.isToday)">
              <MiIcon v-if="d.state === 'done'" name="check" :size="12" />
            </span>
            <span aria-hidden="true">{{ TODAY.WEEKDAYS[i] }}</span>
          </li>
        </ol>
      </div>
    </header>

    <!-- 继续学习卡 -->
    <section v-if="progress.loaded && lesson && !allLearned" class="t-card t-cont">
      <div class="t-cont-body">
        <div class="t-cap">{{ TODAY.continueCaption(moduleLabel, lessonNo, moduleLessons.length) }}</div>
        <div class="t-cont-title">{{ lesson.title }}</div>
        <div class="t-bar" role="progressbar" :aria-label="TODAY.progressLabel(moduleLabel)" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="modulePercent">
          <i :style="{ width: modulePercent + '%' }" />
        </div>
        <div class="t-bar-meta">
          <span>{{ isNewUser ? TODAY.NOT_STARTED : TODAY.learnedCount(moduleLearned) }}</span>
          <span>{{ TODAY.estMinutes(lesson.estMinutes) }}</span>
        </div>
      </div>
      <MiButton class="t-cont-btn" variant="primary" size="lg" icon="play" @click="openLesson(lesson.id)">
        {{ isNewUser ? TODAY.START_FIRST_BTN : TODAY.CONTINUE_BTN }}
      </MiButton>
    </section>
    <section v-else-if="progress.loaded && allLearned" class="t-card t-cont t-cont-done">
      <div class="t-cont-body"><div class="t-cont-title t-cont-title-plain">{{ TODAY.ALL_LEARNED }}</div></div>
      <MiButton class="t-cont-btn" variant="secondary" size="lg" @click="router.push('/review')">{{ TODAY.GO_REVIEW }}</MiButton>
    </section>

    <!-- 新用户 -->
    <template v-if="isNewUser">
      <section>
        <h2 class="t-sec">{{ TODAY.START_SECTION }}</h2>
        <div class="t-start-list">
          <button type="button" class="t-start" @click="router.push('/courses')">
            <MiIcon name="book" /><span class="t-lbl">{{ TODAY.START_LANG }}</span><MiIcon class="t-chev" name="chevron-right" />
          </button>
          <button v-for="{ level, startLabel } in cetPapers" :key="level" type="button" class="t-start" @click="router.push(`/${level}`)">
            <MiIcon name="graduation" /><span class="t-lbl">{{ startLabel }}</span><MiIcon class="t-chev" name="chevron-right" />
          </button>
          <button type="button" class="t-start" @click="router.push(tasksRoute)">
            <MiIcon name="list" /><span class="t-lbl">{{ TODAY.START_PLAN }}</span><MiIcon class="t-chev" name="chevron-right" />
          </button>
        </div>
      </section>
      <div class="t-note">{{ TODAY.NEW_NOTE }}</div>
    </template>

    <!-- 今日待办 + 计划 -->
    <div v-else-if="progress.loaded" class="t-cols">
      <section class="t-todo">
        <h2 class="t-sec">
          {{ TODAY.TODO_SECTION }}
          <span v-if="minutes > 0">{{ TODAY.estimate(minutes) }}</span>
        </h2>
        <div v-if="rows.length" class="t-rows mi-stagger">
          <button v-for="r in rows" :key="r.key" type="button" class="t-row" :data-row="r.key" :title="r.hint" @click="router.push(r.to)">
            <span class="t-tile"><MiIcon :name="r.icon" /></span>
            <span class="t-row-body">
              <span class="t-row-title">{{ r.title }}</span>
              <span v-if="r.meta" class="t-row-meta">{{ r.meta }}</span>
            </span>
            <span v-if="r.num !== undefined" class="t-num" :class="{ due: r.due }">{{ r.num }}</span>
            <MiIcon class="t-chev" name="chevron-right" />
          </button>
        </div>
        <div v-else class="t-note">{{ TODAY.ALL_DONE }}</div>
      </section>

      <section v-if="!isPhone" class="t-plan-col">
        <h2 class="t-sec">{{ TODAY.PLAN_SECTION }}</h2>
        <div class="t-card t-plan">
          <template v-if="plan">
            <div class="t-plan-name">{{ plan.title }}</div>
            <div class="t-bar" role="progressbar" :aria-label="plan.title" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="planStat.percent">
              <i :style="{ width: planStat.percent + '%' }" />
            </div>
            <div class="t-cap">{{ TODAY.planMeta(planDay(plan.createdAt, Date.now()), planStat.done, planStat.total) }}</div>
            <div class="t-tasks">
              <label v-for="t in planTasks" :key="t.id" class="t-task" :class="{ done: t.status === 'done' }">
                <input type="checkbox" class="t-check" :checked="t.status === 'done'" @change="toggleTask(t)" />
                <span class="t-box" aria-hidden="true" />
                <span class="t-task-title">{{ t.title }}</span>
              </label>
            </div>
            <button type="button" class="t-link" @click="router.push(tasksRoute)">{{ TODAY.ALL_TASKS }}</button>
          </template>
          <template v-else>
            <div class="t-noplan">{{ TODAY.NO_PLAN }}</div>
            <MiButton variant="secondary" @click="router.push(tasksRoute)">{{ TODAY.MAKE_PLAN }}</MiButton>
          </template>
        </div>
      </section>
    </div>

    <!-- 我的待办：手写 + 任务组排到今天的建议 -->
    <TodayMyTodos v-if="progress.loaded" />

    <!-- 提问条 -->
    <form v-if="!isPhone && !isNewUser && progress.loaded" class="t-ask" @submit.prevent="ask">
      <input
        v-model="question"
        class="t-ask-input"
        type="text"
        :placeholder="aiReady ? TODAY.ASK_PLACEHOLDER : TODAY.ASK_SETUP"
        :aria-label="TODAY.ASK_PLACEHOLDER"
        :readonly="!aiReady"
        autocomplete="off"
        @click="!aiReady && openAiSettings()"
        @keydown.enter.prevent="aiReady ? ask() : openAiSettings()"
      />
      <span class="t-chip"><i class="t-chip-dot" :class="{ ready: aiReady }" />{{ provider.label }}</span>
      <button type="submit" class="t-send" :class="{ ready: aiReady && question.trim() !== '' }" :disabled="!aiReady || question.trim() === ''" :title="TODAY.ASK_SEND" :aria-label="TODAY.ASK_SEND">
        <MiIcon name="arrow-up" />
      </button>
    </form>
  </div>
</template>

<style scoped>
.today { display: flex; flex-direction: column; gap: var(--mi-sp-6); width: 100%; max-width: var(--mi-page-max); margin-inline: auto; min-width: 0; }

/* 页头 */
.t-head { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--mi-sp-3); }
.t-date { font-size: var(--mi-fs-caption); line-height: var(--mi-lh-caption); color: var(--mi-text-3); }
#app .claude-app-container main.content .t-title { margin: 2px 0 0; }
.t-streak { display: flex; align-items: center; gap: var(--mi-sp-3); }
/* 连续天数：小胶囊，火苗上色 */
.t-streak-n { display: flex; align-items: center; gap: 4px; padding: 3px 10px 3px 8px; border-radius: 999px; background: var(--mi-warn-fill); font-size: var(--mi-fs-label); color: var(--mi-text-2); }
.t-streak-n :deep(svg) { color: var(--mi-warn-deep); }
.t-streak-n b { font-size: var(--mi-fs-body); font-weight: 500; color: var(--mi-warn-deep); font-variant-numeric: tabular-nums; }
/* 一周七格：已学 = 实心带勾，今天没学 = 圆环，过去没学 = 浅灰，还没到 = 虚线圈；相邻两天都学了用短线连起来 */
.t-week { display: flex; gap: 4px; margin: 0; padding: 0; list-style: none; }
.t-day { position: relative; width: 26px; display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: var(--mi-fs-caption); line-height: var(--mi-lh-caption); color: var(--mi-text-3); }
.t-day.is-today { color: var(--mi-blue-ink); font-weight: 500; }
.t-day.linked::before { content: ''; position: absolute; top: 9px; right: 50%; width: 30px; height: 2px; background: var(--mi-blue-deep); }
.t-dot { position: relative; z-index: 1; box-sizing: border-box; display: flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 50%; color: var(--mi-btn-primary-text); }
.t-dot.done { background: var(--mi-blue-deep); }
.t-dot.today { border: 2px solid var(--mi-blue-deep); background: var(--mi-card); }
.t-dot.missed { background: var(--mi-border); }
.t-dot.future { border: 1.5px dashed var(--mi-border); }
/* 今天已学：实心外再套一圈，仍看得出哪天是今天 */
.is-today .t-dot.done { box-shadow: 0 0 0 2px var(--mi-canvas), 0 0 0 3.5px var(--mi-blue-deep); }

/* 卡片 */
.t-card { box-sizing: border-box; background: var(--mi-card); border: 1px solid var(--mi-border); border-radius: var(--mi-radius-box); }
.t-cap { font-size: var(--mi-fs-caption); line-height: var(--mi-lh-caption); color: var(--mi-text-3); }
.t-bar { position: relative; height: 4px; border-radius: 2px; background: var(--mi-blue); }
.t-bar > i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 2px; background: var(--mi-blue-deep); }

/* 继续学习卡 */
.t-cont { display: flex; align-items: center; gap: 20px; padding: 20px; }
.t-cont-body { flex: 1; min-width: 0; }
.t-cont-title { margin: 2px 0 var(--mi-sp-3); font-size: var(--mi-fs-section); font-weight: 500; line-height: var(--mi-lh-caption); color: var(--mi-text); }
.t-cont-title-plain { margin: 0; }
.t-bar-meta { display: flex; justify-content: space-between; margin-top: 6px; font-size: var(--mi-fs-caption); color: var(--mi-text-3); font-variant-numeric: tabular-nums; }
.t-cont :deep(.mi-btn) { border-radius: var(--mi-radius-ctl); gap: 6px; }

/* 两栏 */
.t-cols { display: grid; grid-template-columns: minmax(0, 1fr) 296px; gap: var(--mi-sp-6); align-items: start; }
.t-sec { display: flex; align-items: center; justify-content: space-between; margin: 0 0 var(--mi-sp-3); font-size: var(--mi-fs-section); font-weight: 500; line-height: var(--mi-lh-caption); color: var(--mi-text); }
.t-sec span { font-size: var(--mi-fs-caption); font-weight: 400; color: var(--mi-text-3); }

/* 待办行 */
.t-rows { border-top: 1px solid var(--mi-border); }
.t-row { box-sizing: border-box; display: flex; align-items: center; gap: var(--mi-sp-3); width: 100%; height: 56px; padding: 0; border: 0; border-bottom: 1px solid var(--mi-border); background: transparent; color: var(--mi-text); font: inherit; text-align: left; cursor: pointer; }
.t-row:hover { background: var(--cds-fill-ghost-hover); }
.t-row:focus-visible, .t-start:focus-visible, .t-link:focus-visible { outline: 2px solid var(--mi-blue-deep); outline-offset: -2px; }
.t-tile { display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 32px; height: 32px; border-radius: var(--mi-radius); background: var(--mi-blue-light); color: var(--mi-text-2); }
.t-row-body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.t-row-title { font-size: var(--mi-fs-body); font-weight: 500; line-height: var(--mi-lh-caption); }
.t-row-meta { font-size: var(--mi-fs-caption); line-height: var(--mi-lh-caption); color: var(--mi-text-3); }
.t-num { font-size: var(--mi-fs-body); font-weight: 500; font-variant-numeric: tabular-nums; }
.t-num.due { color: var(--mi-blue-ink); }
.t-chev { color: var(--mi-text-3); }
.t-note { padding: var(--mi-sp-4) 0; border-top: 1px solid var(--mi-border); border-bottom: 1px solid var(--mi-border); font-size: var(--mi-fs-label); color: var(--mi-text-3); }

/* 计划卡 */
.t-plan { padding: var(--mi-sp-4); }
.t-plan-name { font-size: var(--mi-fs-body); font-weight: 500; }
.t-plan .t-bar { margin: var(--mi-sp-3) 0 var(--mi-sp-1); }
.t-tasks { display: flex; flex-direction: column; gap: 2px; margin-top: var(--mi-sp-3); }
.t-task { position: relative; display: flex; align-items: center; gap: var(--mi-sp-2); min-height: 32px; font-size: var(--mi-fs-label); line-height: var(--mi-lh-label); color: var(--mi-text); cursor: pointer; }
.t-check { position: absolute; width: 16px; height: 16px; margin: 0; clip-path: inset(50%); cursor: pointer; }
.t-box { box-sizing: border-box; position: relative; flex-shrink: 0; width: 16px; height: 16px; border-radius: 4px; border: 1.5px solid var(--mi-border-control); }
.t-check:focus-visible + .t-box { outline: 2px solid var(--mi-blue-deep); outline-offset: 2px; }
.t-task.done { color: var(--mi-text-3); text-decoration: line-through; }
.t-task.done .t-box { background: var(--mi-blue-deep); border-color: var(--mi-blue-deep); }
.t-task.done .t-box::after { content: ''; position: absolute; left: 4px; top: 1px; width: 4px; height: 8px; border: solid var(--mi-btn-primary-text); border-width: 0 1.5px 1.5px 0; transform: rotate(45deg); }
.t-link { display: block; margin-top: var(--mi-sp-2); padding: 0; border: 0; background: transparent; font: inherit; font-size: var(--mi-fs-caption); color: var(--mi-blue-ink); cursor: pointer; }
.t-noplan { margin-bottom: var(--mi-sp-3); font-size: var(--mi-fs-label); color: var(--mi-text-3); }

/* 提问条 */
.t-ask { box-sizing: border-box; display: flex; align-items: center; gap: var(--mi-sp-3); height: 48px; padding: 0 var(--mi-sp-2) 0 var(--mi-sp-4); background: var(--mi-card); border: 1px solid var(--mi-border); border-radius: var(--mi-radius-input); }
.t-ask:focus-within { border-color: var(--mi-blue-deep); }
.t-ask-input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font: inherit; font-size: var(--mi-fs-body); color: var(--mi-text); }
.t-ask-input::placeholder { color: var(--mi-text-3); }
.t-chip { display: flex; align-items: center; gap: 6px; height: 28px; padding: 0 var(--mi-sp-2); border-radius: var(--mi-radius-ctl); font-size: var(--mi-fs-label); color: var(--mi-text-2); }
.t-chip-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--mi-text-3); }
.t-chip-dot.ready { background: var(--mi-success-deep); }
.t-send { display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 50%; background: var(--mi-blue); color: var(--mi-text-3); cursor: not-allowed; }
.t-send.ready { background: var(--mi-blue-deep); color: var(--mi-btn-primary-text); cursor: pointer; }
.t-send:focus-visible { outline: 2px solid var(--mi-blue-deep); outline-offset: 2px; }

/* 新用户 */
.t-start-list { border: 1px solid var(--mi-border); border-radius: var(--mi-radius-box); background: var(--mi-card); overflow: hidden; }
.t-start { box-sizing: border-box; display: flex; align-items: center; gap: var(--mi-sp-3); width: 100%; height: 48px; padding: 0 var(--mi-sp-4); border: 0; border-bottom: 1px solid var(--mi-border); background: transparent; color: var(--mi-text); font: inherit; font-size: var(--mi-fs-body); text-align: left; cursor: pointer; }
.t-start:last-child { border-bottom: 0; }
.t-start:hover { background: var(--cds-fill-ghost-hover); }
.t-lbl { flex: 1; min-width: 0; }
</style>
