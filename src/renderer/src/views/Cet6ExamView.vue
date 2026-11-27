<script setup lang="ts">
/**
 * 六级做题页（fullBleed，整页不滚；文章与题目各自滚）。行为基准 cet6_p/app.js，docs/27 §4.2 / §5。
 * 状态：当前部分、当前题、字号、弹窗在这里；作答记录和落盘在 stores/cet6.ts。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import { useCetStore } from '../stores/cet6'
import { useCet6VocabStore } from '../stores/cet6-vocab'
import { useAiAssistantStore } from '../stores/ai-assistant'
import { useSettingsStore } from '../stores/settings'
import { useStudyStore } from '../stores/study'
import { toast } from '../components/base/toast'
import { cetCopy, PHONE } from '../lib/copy'
import { assetBase } from '../lib/asset-base'
import { computeKbInset, isKbOpen } from '../lib/keyboard-inset'
import { usePhoneBackClose } from '../lib/phone-back-close'
import {
  answerKeys,
  answerTally,
  asMode,
  blockHeading,
  formatClock,
  formatTime,
  isObjective,
  isOpen,
  isRight,
  isScored,
  mediaUrl,
  normalizedAnswer,
  partTally,
  score,
  wrongQuestions,
  type Cet6Mode,
  type Cet6Question
} from '../../../shared/cet6'
import MiButton from '../components/base/MiButton.vue'
import MiIcon from '../components/base/MiIcon.vue'
import MiHint from '../components/base/MiHint.vue'
import MiModal from '../components/base/MiModal.vue'
import Cet6Paper from '../components/cet6/Cet6Paper.vue'
import Cet6Panel from '../components/cet6/Cet6Panel.vue'
import Cet6AudioBar from '../components/cet6/Cet6AudioBar.vue'
import Cet6SelectionBar from '../components/cet6/Cet6SelectionBar.vue'
import { useCet6Evidence } from '../lib/use-cet6-evidence'

const route = useRoute()
const router = useRouter()
const level = route.meta.cetLevel ?? 'cet6'
const cet6 = useCetStore(level)
const CET6 = cetCopy(level)
const ai = useAiAssistantStore()
const vocab = useCet6VocabStore()
const settings = useSettingsStore()
const study = useStudyStore()
const aiReady = computed(() => settings.config.ai.hasKey || Boolean(study.snapshot?.activeConnectionId))
const subjectiveQ = computed(() => (section.value?.questions || []).find((x) => x.kind === 'essay' || x.kind === 'translation') ?? null)
const subjectiveAiGrade = computed(() => (subjectiveQ.value ? cet6.record.aiGrades?.[subjectiveQ.value.id] : undefined))
const subjectiveGrading = computed(() => (subjectiveQ.value ? Boolean(cet6.grading[subjectiveQ.value.id]) : false))
const subjectiveGradeError = computed(() => (subjectiveQ.value ? cet6.gradeError[subjectiveQ.value.id] ?? '' : ''))

function onGradeSubjective(q: Cet6Question): void {
  const sec = section.value
  if (!sec) return
  const block = (sec.blocks || []).find((b) => b.id === q.blockId)
  const prompt = [q.stem, block?.text, sec.directions].filter(Boolean).join('\n\n') || sec.title
  void cet6.gradeSubjective({
    questionId: q.id,
    kind: q.kind === 'translation' ? 'translation' : 'writing',
    prompt,
    answer: answers.value[q.id] || ''
  })
}

const rootEl = ref<HTMLElement | null>(null)
const bodyEl = ref<HTMLElement | null>(null)
const paperEl = ref<HTMLElement | null>(null)
const panelEl = ref<HTMLElement | null>(null)
const audioBar = ref<InstanceType<typeof Cet6AudioBar> | null>(null)

const sectionIndex = ref(0)
const currentQid = ref<string | null>(null)
const fontDelta = ref(0)
const sheetW = ref<number | null>(null)
const timerRunning = ref(false)
const submitOpen = ref(false)
const resultOpen = ref(false)
const redoOpen = ref(false)
const leaveOpen = ref(false)
const wrongOnly = ref(false)

const exam = computed(() => cet6.exam)
const answers = computed(() => cet6.record.answers)
const submitted = computed(() => cet6.record.submitted)
const isExamMode = computed(() => cet6.record.mode === 'exam')
const clockSeconds = computed(() => (isExamMode.value && !submitted.value ? cet6.remaining : cet6.record.seconds))
const wrongIds = computed(() => new Set(exam.value && submitted.value ? wrongQuestions(exam.value, answers.value).map((q) => q.id) : []))
const section = computed(() => exam.value?.sections[sectionIndex.value] ?? null)
const isListening = computed(() => section.value?.type === 'listening')
const isSharedListening = computed(() => isListening.value && !!section.value?.sharedWithExamId)
const objective = computed(() => (section.value?.questions || []).filter(isObjective))
const currentQ = computed(() => objective.value.find((q) => q.id === currentQid.value) ?? null)
// 交卷后：当前题的解析依据在左侧原文标亮并滚过去
useCet6Evidence(rootEl, currentQ, submitted)
const isSubjective = computed(() => (section.value?.questions || []).some((q) => q.kind === 'essay' || q.kind === 'translation'))

/** 阅读一次只显示一篇文章和它的题目 */
const screenQs = computed(() => {
  const q = currentQ.value
  return section.value?.type === 'reading' && q ? objective.value.filter((x) => x.blockId === q.blockId) : objective.value
})
const currentBlock = computed(() => {
  const q = currentQ.value
  return section.value?.type === 'reading' && q ? (section.value.blocks || []).find((b) => b.id === q.blockId) ?? null : null
})
const readingTabs = computed(() => {
  const sec = section.value
  if (!sec || sec.type !== 'reading') return []
  return (sec.blocks || [])
    .filter((b) => objective.value.some((x) => x.blockId === b.id))
    .map((b) => {
      const h = blockHeading(sec, b, level)
      return { id: b.id, label: h.unit || h.section || b.title || b.id }
    })
})
const progress = computed(() => {
  const list = objective.value.filter((q) => q.unanswerable !== true)
  if (!list.length) return ''
  return CET6.sectionProgress(list.filter((q) => answers.value[q.id]).length, list.length)
})
const pickedLetter = computed(() => {
  const q = currentQ.value
  if (!q || q.kind !== 'matching') return ''
  return submitted.value && q.answer ? normalizedAnswer(q) : answers.value[q.id] || ''
})
const flagged = computed(() => !!currentQid.value && cet6.marks.has(currentQid.value))
const fontStyle = computed(() => ({ fontSize: `${16 + fontDelta.value}px` }))

// ---- 音频：<audio> 常驻，只看第一个听力部分
const listeningSection = computed(() => exam.value?.sections.find((s) => s.type === 'listening') ?? null)
const audioSrc = computed(() => {
  const ls = listeningSection.value
  return ls && !ls.sharedWithExamId && ls.audio?.src ? mediaUrl(ls.audio.src, assetBase()[level]) : ''
})
const audioTip = computed(() => {
  const ls = listeningSection.value
  if (!ls || ls.sharedWithExamId) return ''
  if (audioSrc.value) return cet6.media.ok ? ls.audio?.note || '' : CET6.MEDIA_MISSING
  const shared = ls.audio?.sharedWith
  return shared && shared.length > 0 ? CET6.sharedAudio(shared.join(', ')) : CET6.NO_AUDIO
})

const result = computed(() => (exam.value ? score(exam.value, answers.value) : { correct: 0, total: 0, accuracy: '0.0' }))
const parts = computed(() => (exam.value && submitted.value ? partTally(exam.value, answers.value) : []))
const tally = computed(() => (exam.value ? answerTally(exam.value, answers.value) : { total: 0, answered: 0 }))
const notes = computed(() => {
  const e = exam.value
  if (!e) return []
  const list = [...(e.issues || []), ...e.sections.map((s) => s.sharedNote).filter((x): x is string => !!x)]
  return [...list, ...(e.sources || []).map((s) => s.title).filter((t): t is string => !!t).map(CET6.source)]
})
const modalOpen = computed(() => submitOpen.value || resultOpen.value || redoOpen.value || leaveOpen.value)

// ---- 导航
function firstOpen(list: Cet6Question[]): Cet6Question | null {
  return (submitted.value ? null : list.find((q) => isOpen(q, answers.value))) || list[0] || null
}

function switchSection(i: number): void {
  const sec = exam.value?.sections[i]
  if (!sec) return
  sectionIndex.value = i
  sheetW.value = null
  currentQid.value = firstOpen((sec.questions || []).filter(isObjective))?.id ?? null
  if (sec.type !== 'listening') audioBar.value?.pause()
  void nextTick(() => {
    if (paperEl.value) paperEl.value.scrollTop = 0
    if (panelEl.value) panelEl.value.scrollTop = 0
  })
}

function goTo(q: Cet6Question): void {
  currentQid.value = q.id
}

/** 题号条与 ←→ 走的题：「只看错题」开着时只含答错的 */
const walkList = computed(() => (wrongOnly.value ? objective.value.filter((q) => wrongIds.value.has(q.id)) : objective.value))
const stripQs = computed(() => (wrongOnly.value ? screenQs.value.filter((q) => wrongIds.value.has(q.id)) : screenQs.value))

function toggleWrongOnly(): void {
  wrongOnly.value = !wrongOnly.value
  const first = wrongOnly.value ? walkList.value[0] : null
  if (first) goTo(first)
}

function step(delta: number): void {
  const list = walkList.value
  const target = list[list.findIndex((q) => q.id === currentQid.value) + delta]
  if (target) goTo(target)
}

/** 拖选文字时松开鼠标会在按钮上触发 click：有选区落在该按钮内就吞掉，免得选词变成作答 / 跳题 */
function guardSelectClick(e: MouseEvent): void {
  const btn = (e.target as Element | null)?.closest('button')
  const sel = window.getSelection()
  if (btn && sel && !sel.isCollapsed && sel.containsNode(btn, true)) {
    e.stopPropagation()
    e.preventDefault()
  }
}

function choose(q: Cet6Question, key: string): void {
  if (submitted.value || q.unanswerable === true) return
  cet6.toggleAnswer(q.id, key)
  const list = screenQs.value
  const from = list.findIndex((x) => x.id === q.id) + 1
  const next = answers.value[q.id] ? list.slice(from).find((x) => isOpen(x, answers.value)) : null
  if (next && q.kind === 'single-choice' && section.value?.type === 'reading') {
    // 整题换页前留一下，让人看到自己选中了哪个
    setTimeout(() => {
      if (currentQid.value === q.id) goTo(next)
    }, 180)
  } else {
    goTo(next || q)
  }
}

function pickParagraph(letter: string): void {
  const q = currentQ.value
  if (q && q.kind === 'matching') choose(q, letter)
}

function onText(q: Cet6Question, value: string): void {
  cet6.setText(q.id, value)
}

function openShared(id: string): void {
  void router.push({ path: `/${level}/${id}`, query: { section: 'listening' } })
}

// ---- 当前题 / 当前空滚入视野
watch(
  () => currentBlock.value?.id,
  () => {
    if (paperEl.value) paperEl.value.scrollTop = 0
  },
  { flush: 'post' }
)
watch(
  [currentQid, sectionIndex, submitted],
  () => {
    void nextTick(() => {
      const q = currentQ.value
      const root = rootEl.value
      if (!q || !root) return
      if (q.kind === 'word-bank') root.querySelector(`#blank-${q.number}`)?.scrollIntoView({ block: 'nearest' })
      else if (isListening.value) root.querySelector(`[id="q-card-${q.id}"]`)?.scrollIntoView({ block: 'nearest' })
      else if (q.kind === 'matching') {
        root.querySelector('.cet6-stmt.current')?.scrollIntoView({ block: 'nearest' })
        if (submitted.value) root.querySelector('.cet6-labelled.picked')?.scrollIntoView({ block: 'start' })
      }
    })
  }
)

// ---- 计时
let timer: ReturnType<typeof setInterval> | null = null
function startTimer(): void {
  stopTimer()
  timerRunning.value = true
  timer = setInterval(() => cet6.tick(), 1000)
}
function stopTimer(): void {
  timerRunning.value = false
  if (timer) clearInterval(timer)
  timer = null
}
function toggleTimer(): void {
  if (submitted.value || isExamMode.value) return
  if (timerRunning.value) stopTimer()
  else startTimer()
}

// ---- 交卷 / 重做
function onSubmitClick(): void {
  if (submitted.value) redoOpen.value = true
  else submitOpen.value = true
}

async function confirmSubmit(auto = false): Promise<void> {
  submitOpen.value = false
  stopTimer()
  audioBar.value?.pause()
  await cet6.submit()
  wrongOnly.value = false
  switchSection(sectionIndex.value)
  if (auto) toast(CET6.AUTO_SUBMITTED, 'info')
  resultOpen.value = true
}

async function confirmRedo(mode: Cet6Mode): Promise<void> {
  redoOpen.value = false
  if (!(await cet6.reset(mode))) return
  wrongOnly.value = false
  startTimer()
  switchSection(0)
}

// 考试模式：倒计时归零自动交卷（已有的 seconds 是已用时间，续考时从剩余时间继续）
function checkExpired(): void {
  if (isExamMode.value && !submitted.value && exam.value && cet6.remaining === 0) void confirmSubmit(true)
}
watch(() => cet6.record.seconds, checkExpired)

// ---- 退出考试确认：考试锁开着时离开做题页要先过这一关
let leaveResolve: ((ok: boolean) => void) | null = null
function guardLeave(): boolean | Promise<boolean> {
  if (!cet6.examLock) return true
  leaveResolve?.(false)
  return new Promise<boolean>((resolve) => {
    leaveResolve = resolve
    leaveOpen.value = true
  })
}
function answerLeave(ok: boolean): void {
  const resolve = leaveResolve
  leaveResolve = null
  leaveOpen.value = false
  resolve?.(ok)
}
watch(leaveOpen, (open) => {
  if (!open && leaveResolve) answerLeave(false)
})
onBeforeRouteLeave(guardLeave)
onBeforeRouteUpdate(guardLeave)

// ---- 字号 / 分隔线
function adjustFont(d: number): void {
  fontDelta.value = Math.max(-2, Math.min(6, fontDelta.value + d))
}

let dragging = false
// 手机（≤768px）上下分屏：拖动横条调比例，轻点横条在「均分 / 放大原文 / 放大题目」间切换
const phoneMq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(max-width: 768px)') : null
const phoneSplit = ref(phoneMq?.matches ?? false)
const onPhoneMq = (e: MediaQueryListEvent): void => { phoneSplit.value = e.matches }
const SPLIT_STEPS = [0.5, 0.75, 0.25]
const splitFrac = ref(0.5)
const splitStyle = computed(() => ({
  '--split-a': `${splitFrac.value}fr`,
  '--split-b': `${1 - splitFrac.value}fr`
}))
const splitLabel = computed(() => (phoneSplit.value ? PHONE.CET6_SPLIT_LABEL : CET6.SPLIT_HANDLE))
let dragStartY = 0
let dragMoved = false
function cycleSplit(): void {
  const i = SPLIT_STEPS.findIndex((v) => Math.abs(v - splitFrac.value) < 0.06)
  splitFrac.value = SPLIT_STEPS[(i + 1) % SPLIT_STEPS.length]
}
// 手机写作 / 翻译「专注作答」：作答框聚焦且键盘打开时，作答区占满键盘上方，题目收成一条横栏，
// 点「查看题目」以浮层展开；失焦即还原分屏（分屏比例 splitFrac 与原文滚动位置都不动）
const answerFocused = ref(false)
const kbOpenNow = ref(false)
const promptOpen = ref(false)
const promptBarEl = ref<HTMLElement | null>(null)
const promptTop = ref(0)
const writing = computed(() => phoneSplit.value && isSubjective.value && answerFocused.value && kbOpenNow.value)
function onVvResize(): void {
  const vv = window.visualViewport
  kbOpenNow.value = !!vv && isKbOpen(computeKbInset(window.innerHeight, vv.height, vv.offsetTop, vv.scale))
}
function onAnswerFocusIn(e: FocusEvent): void {
  if ((e.target as HTMLElement | null)?.tagName === 'TEXTAREA') answerFocused.value = true
}
function onAnswerFocusOut(e: FocusEvent): void {
  if ((e.target as HTMLElement | null)?.tagName === 'TEXTAREA') answerFocused.value = false
}
function togglePrompt(): void {
  if (!promptOpen.value) promptTop.value = promptBarEl.value?.getBoundingClientRect().bottom ?? 0
  promptOpen.value = !promptOpen.value
}
watch(writing, (w) => { if (!w) promptOpen.value = false })
// 系统返回先收起题目浮层
usePhoneBackClose(() => promptOpen.value, () => { promptOpen.value = false })
onMounted(() => {
  phoneMq?.addEventListener('change', onPhoneMq)
  window.visualViewport?.addEventListener('resize', onVvResize)
})
onBeforeUnmount(() => {
  phoneMq?.removeEventListener('change', onPhoneMq)
  window.visualViewport?.removeEventListener('resize', onVvResize)
})

function onDividerDown(e: PointerEvent): void {
  dragging = true
  dragMoved = false
  dragStartY = e.clientY
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  e.preventDefault()
}
function onDividerMove(e: PointerEvent): void {
  if (!dragging || !bodyEl.value) return
  const rect = bodyEl.value.getBoundingClientRect()
  if (phoneSplit.value) {
    if (Math.abs(e.clientY - dragStartY) < 6 && !dragMoved) return
    dragMoved = true
    splitFrac.value = Math.max(0.2, Math.min(0.8, (e.clientY - rect.top) / rect.height))
    return
  }
  sheetW.value = Math.max(360, Math.min(rect.right - e.clientX, rect.width - 360))
}
function onDividerUp(): void {
  if (dragging && phoneSplit.value && !dragMoved) cycleSplit()
  dragging = false
}

// ---- 键盘：输入框 / 下拉框 / 弹窗打开 / 带修饰键时不响应；卸载时移除
function onKey(e: KeyboardEvent): void {
  if (e.isComposing || modalOpen.value || e.ctrlKey || e.metaKey || e.altKey || !exam.value) return
  const t = e.target as HTMLElement | null
  if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return
  if (['1', '2', '3', '4'].includes(e.key)) {
    switchSection(parseInt(e.key, 10) - 1)
    return
  }
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault()
    paperEl.value?.scrollBy({ top: e.key === 'ArrowDown' ? 90 : -90 })
    return
  }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault()
    step(e.key === 'ArrowRight' ? 1 : -1)
    return
  }
  const q = currentQ.value
  const sec = section.value
  if (q && sec && e.key.length === 1 && answerKeys(sec, q).includes(e.key.toUpperCase())) {
    e.preventDefault()
    choose(q, e.key.toUpperCase())
  }
}
const onBeforeUnload = (): void => void cet6.flush()

// ---- 载入
async function open(id: string): Promise<void> {
  stopTimer()
  if (!cet6.catalogLoaded) await cet6.loadCatalog()
  await cet6.loadState()
  await cet6.openExam(id, asMode(route.query.mode))
  if (cet6.exam?.id !== id) return
  const target = route.query.section
  const idx = typeof target === 'string' ? cet6.exam.sections.findIndex((s) => s.type === target) : -1
  switchSection(idx >= 0 ? idx : 0)
  wrongOnly.value = false
  if (submitted.value) resultOpen.value = true
  else {
    startTimer()
    checkExpired()
  }
}

onMounted(() => {
  cet6.examPageActive = true
  void vocab.load()
  ai.isOpen = false
  window.addEventListener('keydown', onKey)
  window.addEventListener('beforeunload', onBeforeUnload)
  void open(String(route.params.id))
})

onBeforeUnmount(() => {
  cet6.examPageActive = false
  stopTimer()
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('beforeunload', onBeforeUnload)
  void cet6.closeExam()
})

function stripClass(q: Cet6Question): Record<string, boolean> {
  const out: Record<string, boolean> = {
    current: q.id === currentQid.value,
    done: !!answers.value[q.id],
    flagged: cet6.marks.has(q.id)
  }
  if (submitted.value && isScored(q)) out[isRight(q, answers.value[q.id]) ? 'right' : 'wrong'] = true
  return out
}
</script>

<template>
  <div ref="rootEl" class="cet6-exam" :class="{ 'sel-ok': !cet6.examLock }" @click.capture="guardSelectClick">
    <header class="cet6-top">
      <button type="button" class="icon-btn" :title="CET6.BACK" :aria-label="CET6.BACK" @click="router.push(`/${level}`)">
        <MiIcon name="arrow-left" :size="16" />
      </button>
      <span class="cet6-exam-title">{{ exam?.title || '' }}</span>
      <span v-if="exam" class="pg-chip cet6-mode" aria-disabled="true" data-mode-badge>
        <MiIcon v-if="isExamMode" name="clock" :size="14" />{{ isExamMode ? CET6.MODE_EXAM : CET6.MODE_PRACTICE }}
      </span>
      <nav v-if="exam" class="pg-chips" aria-label="Part">
        <button
          v-for="(s, i) in exam.sections"
          :key="s.id"
          type="button"
          class="pg-chip"
          :class="{ active: i === sectionIndex }"
          :title="CET6.PART[s.type]"
          :aria-current="i === sectionIndex ? 'true' : undefined"
          @click="switchSection(i)"
        >
          Part {{ CET6.PART_NO[s.type] }}
        </button>
      </nav>
      <nav v-if="readingTabs.length" class="pg-chips" aria-label="Reading">
        <button
          v-for="t in readingTabs"
          :key="t.id"
          type="button"
          class="pg-chip"
          :class="{ active: currentQ?.blockId === t.id }"
          @click="goTo(firstOpen(objective.filter((x) => x.blockId === t.id))!)"
        >
          {{ t.label }}
        </button>
      </nav>
      <span class="cet6-spacer" />
      <button
        v-if="!cet6.examLock"
        type="button"
        class="icon-btn cet6-vocab-btn"
        :title="CET6.vocabBtn(vocab.entries.length)"
        :aria-label="CET6.vocabBtn(vocab.entries.length)"
        @click="router.push('/cet6/vocab')"
      >
        <MiIcon name="book" :size="16" /><span v-if="vocab.entries.length" class="pg-count">{{ vocab.entries.length }}</span>
      </button>
      <button type="button" class="icon-btn" :title="CET6.FONT_DEC" :aria-label="CET6.FONT_DEC" @click="adjustFont(-1)">A-</button>
      <button type="button" class="icon-btn" :title="CET6.FONT_INC" :aria-label="CET6.FONT_INC" @click="adjustFont(1)">A+</button>
      <button
        type="button"
        class="pg-chip cet6-timer"
        :class="{ urgent: isExamMode && !submitted && cet6.remaining <= 300 }"
        :disabled="submitted || isExamMode"
        :title="isExamMode && !submitted ? CET6.EXAM_TIMER_TIP : timerRunning ? CET6.TIMER_PAUSE : CET6.TIMER_RESUME"
        :aria-label="isExamMode && !submitted ? CET6.EXAM_TIMER_TIP : timerRunning ? CET6.TIMER_PAUSE : CET6.TIMER_RESUME"
        @click="toggleTimer"
      >
        <MiIcon name="clock" :size="14" />{{ level === 'cet4' && isExamMode && !submitted ? formatTime(clockSeconds) : formatClock(clockSeconds) }}
      </button>
      <MiButton v-if="exam" :variant="submitted ? 'secondary' : 'primary'" data-action="submit" @click="onSubmitClick">
        {{ submitted ? CET6.REDO : CET6.SUBMIT }}
      </MiButton>
    </header>

    <p v-if="cet6.examError" class="mi-alert-error cet6-alert" role="alert">{{ cet6.examError }}</p>
    <div v-else-if="exam && exam.sections.length === 0" class="pg-empty"><p>{{ CET6.EXAM_EMPTY }}</p></div>

    <!-- 音频条常驻（v-show）：切到别的 Part 再回来不重载 -->
    <div v-show="exam && isListening && !isSharedListening" class="cet6-sticky">
      <Cet6AudioBar ref="audioBar" :src="audioSrc" :tip="audioTip" />
    </div>

    <div v-if="exam && section" ref="bodyEl" class="cet6-body" :class="{ full: isListening, writing, 'prompt-open': writing && promptOpen }" :style="[sheetW ? { '--sheet-w': `${sheetW}px` } : {}, splitStyle]">
      <!-- 题号条：听力吸顶，其余在右栏顶部 -->
      <div v-if="isListening && !isSharedListening && screenQs.length" class="cet6-sticky cet6-strip-row">
        <div class="cet6-strip" role="group">
          <button v-for="q in stripQs" :key="q.id" type="button" class="cet6-strip-no" :class="stripClass(q)" :aria-label="CET6.questionNo(q.number)" @click="goTo(q)">{{ q.number }}</button>
        </div>
        <button v-if="submitted && wrongIds.size" type="button" class="pg-chip" :class="{ active: wrongOnly }" :aria-pressed="wrongOnly" data-action="wrong-only" @click="toggleWrongOnly">{{ CET6.WRONG_ONLY }}</button>
        <span class="cet6-progress" :title="!isSubjective && screenQs.length ? CET6.KEY_HINT : undefined">{{ wrongOnly && !stripQs.length ? CET6.WRONG_NONE : progress }}</span>
      </div>

      <div v-if="writing" ref="promptBarEl" class="cet6-prompt-bar">
        <span class="cet6-prompt-title">{{ PHONE.PROMPT_SHEET }}</span>
        <button type="button" class="pg-chip" :aria-expanded="promptOpen" @pointerdown.prevent @click="togglePrompt">
          {{ promptOpen ? PHONE.HIDE_PROMPT : PHONE.VIEW_PROMPT }}
        </button>
      </div>

      <section ref="paperEl" class="cet6-left" :style="[fontStyle, promptOpen ? { '--prompt-top': `${promptTop}px` } : {}]">
        <Cet6Paper
          :section="section"
          :block="currentBlock"
          :current-q="currentQ"
          :answers="answers"
          :submitted="submitted"
          :picked-letter="pickedLetter"
          :metas="cet6.metas"
          :level="level"
          @blank="goTo"
          @para="pickParagraph"
          @choose="choose"
          @open-shared="openShared"
        />
      </section>

      <template v-if="!isListening">
        <div
          class="cet6-divider"
          role="separator"
          :aria-orientation="phoneSplit ? 'horizontal' : 'vertical'"
          :tabindex="phoneSplit ? 0 : undefined"
          :title="splitLabel"
          :aria-label="phoneSplit ? splitLabel : undefined"
          @keydown.enter.prevent="phoneSplit && cycleSplit()"
          @keydown.space.prevent="phoneSplit && cycleSplit()"
          @pointerdown="onDividerDown"
          @pointermove="onDividerMove"
          @pointerup="onDividerUp"
          @pointercancel="onDividerUp"
        />
        <section class="cet6-right">
          <div v-if="screenQs.length" class="cet6-strip-row">
            <div class="cet6-strip" role="group">
              <button v-for="q in stripQs" :key="q.id" type="button" class="cet6-strip-no" :class="stripClass(q)" :aria-label="CET6.questionNo(q.number)" @click="goTo(q)">{{ q.number }}</button>
            </div>
            <button
              type="button"
              class="icon-btn"
              :class="{ active: flagged }"
              :title="flagged ? CET6.UNFLAG : CET6.FLAG"
              :aria-label="flagged ? CET6.UNFLAG : CET6.FLAG"
              :aria-pressed="flagged"
              :disabled="!currentQid"
              @click="currentQid && cet6.toggleMark(currentQid)"
            >
              <MiIcon name="flag" :size="16" :filled="flagged" />
            </button>
            <button v-if="submitted && wrongIds.size" type="button" class="pg-chip" :class="{ active: wrongOnly }" :aria-pressed="wrongOnly" data-action="wrong-only" @click="toggleWrongOnly">{{ CET6.WRONG_ONLY }}</button>
            <span class="cet6-progress">{{ wrongOnly && !stripQs.length ? CET6.WRONG_NONE : progress }}</span>
          </div>
          <div ref="panelEl" class="cet6-right-scroll" :style="fontStyle" data-kb-managed @focusin="onAnswerFocusIn" @focusout="onAnswerFocusOut">
            <Cet6Panel
              :level="level"
              :section="section"
              :q="currentQ"
              :screen-qs="screenQs"
              :answers="answers"
              :submitted="submitted"
              :ai-grade="subjectiveAiGrade"
              :grading="subjectiveGrading"
              :grade-error="subjectiveGradeError"
              :ai-ready="aiReady"
              @choose="choose"
              @go-to="goTo"
              @text="onText"
              @grade="onGradeSubjective"
            />
          </div>
        </section>
      </template>
    </div>

    <!-- 交卷确认 -->
    <MiModal v-model:visible="submitOpen" :title="CET6.SUBMIT_TITLE" :width="420">
      <p>{{ CET6.submitSummary(tally.total, tally.answered) }}</p>
      <p v-if="tally.total > tally.answered" class="cet6-warn">{{ CET6.unansweredWarn(tally.total - tally.answered) }}</p>
      <template #footer>
        <MiButton @click="submitOpen = false">{{ CET6.CONTINUE }}</MiButton>
        <MiButton variant="primary" data-action="confirm-submit" @click="confirmSubmit()">{{ CET6.CONFIRM_SUBMIT }}</MiButton>
      </template>
    </MiModal>

    <!-- 成绩 -->
    <MiModal v-model:visible="resultOpen" :title="CET6.RESULT_TITLE" :width="460">
      <p class="cet6-score" data-result>{{ CET6.resultLine(result.correct, result.total, result.accuracy) }}<MiHint :text="CET6.RESULT_NOTE" /></p>
      <p v-if="parts.length" class="cet6-parts" data-parts>
        <span v-for="p in parts" :key="p.type">{{ CET6.partLine(CET6.PART_ZH[p.type], p.correct, p.total) }}</span>
      </p>
      <details v-if="notes.length">
        <summary>{{ CET6.NOTES_TITLE }}</summary>
        <ul>
          <li v-for="(n, i) in notes" :key="i">{{ n }}</li>
        </ul>
      </details>
      <template #footer>
        <MiButton variant="primary" @click="resultOpen = false">{{ CET6.VIEW_REVIEW }}</MiButton>
      </template>
    </MiModal>

    <!-- 重新作答 -->
    <MiModal v-model:visible="redoOpen" :title="CET6.REDO_TITLE" :width="420">
      <p>{{ CET6.REDO_BODY }}</p>
      <template #footer>
        <MiButton @click="redoOpen = false">{{ CET6.CANCEL }}</MiButton>
        <MiButton :variant="cet6.lastMode === 'practice' ? 'primary' : 'secondary'" data-action="confirm-redo" @click="confirmRedo('practice')">{{ CET6.REDO_PRACTICE }}</MiButton>
        <MiButton :variant="cet6.lastMode === 'exam' ? 'primary' : 'secondary'" data-action="confirm-redo-exam" @click="confirmRedo('exam')">{{ CET6.REDO_EXAM }}</MiButton>
      </template>
    </MiModal>

    <!-- 退出考试 -->
    <MiModal v-model:visible="leaveOpen" :title="CET6.LEAVE_TITLE" :width="420">
      <p>{{ CET6.LEAVE_BODY }}</p>
      <template #footer>
        <MiButton data-action="stay" @click="answerLeave(false)">{{ CET6.LEAVE_STAY }}</MiButton>
        <MiButton variant="primary" data-action="confirm-leave" @click="answerLeave(true)">{{ CET6.LEAVE_CONFIRM }}</MiButton>
      </template>
    </MiModal>

    <!-- 选词工具条：只在没有考试锁时存在（练习模式，或考试交卷后） -->
    <Cet6SelectionBar v-if="exam && section && !cet6.examLock" :root="rootEl" :exam-id="exam.id" :level="level" :section-type="section.type" />
  </div>
</template>

<style scoped>
.cet6-exam { display: flex; flex-direction: column; height: 100%; min-height: 0; padding: calc(var(--mi-topbar-h) + 4px) 16px 0; box-sizing: border-box; }
.cet6-top { display: flex; align-items: center; gap: var(--mi-sp-2) var(--mi-sp-3); flex-wrap: wrap; flex-shrink: 0; padding-bottom: var(--mi-sp-2); border-bottom: 1px solid var(--mi-border); }
.cet6-exam-title { font-family: var(--mi-font-serif); font-size: var(--mi-fs-body); font-weight: 500; white-space: nowrap; }
.cet6-spacer { flex: 1; }
.cet6-timer { font-variant-numeric: tabular-nums; }
.cet6-timer:disabled { color: var(--mi-text-3); cursor: default; }
.cet6-timer.urgent, .cet6-timer.urgent:disabled { color: var(--mi-error-deep); }
.cet6-mode { cursor: default; }
.cet6-mode:hover { background: transparent; color: var(--mi-text-2); }
.cet6-vocab-btn { width: auto; gap: var(--mi-sp-1); padding: 0 var(--mi-sp-2); }
.cet6-parts { display: flex; flex-wrap: wrap; gap: var(--mi-sp-1) var(--mi-sp-4); margin: 0 0 var(--mi-sp-2); font-size: var(--mi-fs-label); color: var(--mi-text-2); font-variant-numeric: tabular-nums; }
.cet6-alert { margin-top: var(--mi-sp-3); }
.cet6-sticky { flex-shrink: 0; padding: var(--mi-sp-2) 0; background: var(--mi-canvas); border-bottom: 1px solid var(--mi-border); }
.cet6-strip-row { display: flex; align-items: center; gap: var(--mi-sp-2); padding: var(--mi-sp-2) 0; flex-shrink: 0; }
.cet6-strip { display: flex; flex-wrap: wrap; gap: var(--mi-sp-1); flex: 1; min-width: 0; }
.cet6-strip-no { min-width: 30px; height: 26px; padding: 0 var(--mi-sp-2); border: 2px solid transparent; border-radius: var(--radius-lg, 8px); background: transparent; color: var(--mi-text-2); font: var(--mi-fs-caption) var(--mi-font-family); font-variant-numeric: tabular-nums; cursor: pointer; }
.cet6-strip-no:hover { background: var(--cds-fill-ghost-hover); }
.cet6-strip-no.done { background: var(--mi-blue-light); color: var(--mi-text); }
.cet6-strip-no.current { border-color: var(--mi-blue-deep); }
.cet6-strip-no.flagged { box-shadow: inset 0 -3px 0 var(--mi-warn); }
.cet6-strip-no.right { background: var(--mi-success-fill); color: var(--mi-success-deep); }
.cet6-strip-no.wrong { background: var(--mi-error-fill); color: var(--mi-error-deep); }
.cet6-strip-no:focus-visible { outline: 2px solid var(--mi-blue-deep); outline-offset: 1px; }
.cet6-progress { font: var(--mi-fs-caption) var(--mi-font-family); color: var(--mi-text-3); font-variant-numeric: tabular-nums; }
.cet6-hint { margin: 0 0 var(--mi-sp-2); font-size: var(--mi-fs-caption); color: var(--mi-text-3); flex-shrink: 0; }

.cet6-body { --sheet-w: 44%; flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 6px var(--sheet-w); padding-top: var(--mi-sp-2); }
.cet6-body.full { display: flex; flex-direction: column; }
.cet6-body.full .cet6-left { flex: 1; min-height: 0; max-width: 1160px; margin: 0 auto; width: 100%; }
/* 考试锁关闭时（练习模式 / 交卷后）试卷文字可鼠标选中，供选词工具条使用；全局 body 是 user-select:none（docs/27 §8.2） */
.cet6-exam.sel-ok :is(.cet6-left, .cet6-right-scroll),
.cet6-exam.sel-ok :is(.cet6-left, .cet6-right-scroll) :deep(*) { user-select: text; }
.cet6-left { min-width: 0; min-height: 0; overflow-y: auto; padding: var(--mi-sp-1) var(--mi-sp-4) var(--mi-sp-8) 0; }
.cet6-right { min-width: 0; min-height: 0; display: flex; flex-direction: column; padding-left: var(--mi-sp-3); }
.cet6-right-scroll { flex: 1; min-height: 0; overflow-y: auto; padding-bottom: var(--mi-sp-8); }
.cet6-divider { cursor: col-resize; border-radius: 3px; background: var(--mi-border); touch-action: none; }
.cet6-divider:hover { background: var(--mi-border-control); }
.cet6-warn { color: var(--mi-error-deep); }
.cet6-score { font-size: var(--mi-fs-title); font-weight: 500; margin: 0 0 var(--mi-sp-2); }
.cet6-note { font-size: var(--mi-fs-caption); color: var(--mi-text-3); }

@media (max-width: 1000px) {
  .cet6-body:not(.full) { grid-template-columns: minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) minmax(0, 1fr); }
  .cet6-divider { display: none; }
  .cet6-right { padding-left: 0; }
}
</style>
