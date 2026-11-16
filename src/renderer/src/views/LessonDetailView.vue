<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useContentStore } from '../stores/content'
import { useProgressStore } from '../stores/progress'
import { useRunnerStore } from '../stores/runner'
import { useSettingsStore } from '../stores/settings'
import { useAiAssistantStore } from '../stores/ai-assistant'
import { useMemoStore } from '../stores/memo'
import { validateDomSelection, saveLessonAnnotation } from '../lib/lesson-annotation'
import { useLessonOpener } from '../lib/openLesson'
import { isRemote } from '../lib/asset-base'
import { lessonPracticeQuestions, lessonPracticeRoute } from '../lib/startPractice'
import { isIntroLesson, lessonNoteTitle } from '../lib/course-navigation'
import { runView } from '../lib/run-result-view'
import { LANG_OF_CODE, type LangOfCode } from '../../../shared/types'
import { LANG_LABEL, STAGE_LABEL } from '../lib/labels'
import {
  firstRunnableBlock,
  hasRunnableEntry,
  renderMarkdown,
  collectCompare,
  splitSlots,
  type CompareBlock,
  type DemoBlock,
  type SlotPart
} from '../lib/md'
import MiCard from '../components/base/MiCard.vue'
import MiIcon from '../components/base/MiIcon.vue'
import MiHint from '../components/base/MiHint.vue'
import MiButton from '../components/base/MiButton.vue'
import MiTag from '../components/base/MiTag.vue'
import MiEmpty from '../components/base/MiEmpty.vue'
import MiDrawer from '../components/base/MiDrawer.vue'
import MiRichText from '../components/base/MiRichText.vue'
import CompareGrid from '../components/domain/CompareGrid.vue'
import DemoPlayer from '../components/domain/DemoPlayer.vue'
import VideoLibrary from '../components/domain/video/VideoLibrary.vue'
import { demoToVideo } from '../../../shared/video'
import { useVideoStore } from '../stores/video'
import FlashCardsDeck from '../components/domain/FlashCardsDeck.vue'
import PretestCard from '../components/domain/PretestCard.vue'
import MiModal from '../components/base/MiModal.vue'
import { toast } from '../components/base/toast'
import { ACTION, AI_ASSISTANT, EMPTY, LESSON, TOAST, ALGO_COURSE, ANNOTATION, PHONE, VIDEO_UI } from '../lib/copy'

// M3-02：知识点详情页（元信息 + markdown 正文 + compare 对比区 + 底部操作栏）
const route = useRoute()
const router = useRouter()
const content = useContentStore()
const progress = useProgressStore()
const runner = useRunnerStore()
const video = useVideoStore()
const settings = useSettingsStore()
const videoPreferred = computed(() => (settings.config as typeof settings.config & { learning?: { explainMode?: string } }).learning?.explainMode === 'video')
const showVideos = ref(false)
// 视频对话框 / 播放器开起时收起右侧视频抽屉，避免同处 z-index 9000 互相遮挡
watch(() => video.dialogOpen || Boolean(video.current), (open) => {
  if (open) showVideos.value = false
})
const { openLesson } = useLessonOpener()

const memoStore = useMemoStore()
// 手机上没有运行入口（runner:run 不在白名单，docs/29 §3.5）
const remote = isRemote()

// 随堂批注交互状态
const showAnnotationBtn = ref(false)
const annotationBtnPos = ref({ top: 0, left: 0 })
const currentSelection = ref<{ text: string; inCodeBlock: boolean } | null>(null)
const showAnnotationModal = ref(false)
const annotationNote = ref('')

// 触屏长按选词不会触发 mouseup：粗指针下改听 selectionchange，选区稳定后再出浮条，浮条放在选区下方避开系统选择手柄
const touchSelection = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true
let selectionTimer: ReturnType<typeof setTimeout> | undefined
function onSelectionChangeTouch() {
  clearTimeout(selectionTimer)
  selectionTimer = setTimeout(handleSelectionChange, 350)
}

function askAiAboutSelection() {
  if (!currentSelection.value) return
  const { left, top } = annotationBtnPos.value
  window.dispatchEvent(new CustomEvent('miai-ask-selection', {
    detail: { text: currentSelection.value.text, inCodeBlock: currentSelection.value.inCodeBlock, x: left, y: top }
  }))
  showAnnotationBtn.value = false
}

function handleSelectionChange() {
  const sel = window.getSelection()
  const res = validateDomSelection(sel, '.markdown-body')
  if (res.valid && sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0)
    const rect = range.getBoundingClientRect()
    annotationBtnPos.value = {
      top: touchSelection ? rect.bottom + 28 : Math.max(10, rect.top - 8),
      left: touchSelection
        ? Math.min(Math.max(100, rect.left + rect.width / 2), window.innerWidth - 100)
        : Math.max(10, rect.left + rect.width / 2)
    }
    currentSelection.value = { text: res.text, inCodeBlock: res.inCodeBlock }
    showAnnotationBtn.value = true
  } else {
    if (!showAnnotationModal.value) {
      showAnnotationBtn.value = false
    }
  }
}

function openAnnotationModal() {
  if (!currentSelection.value) return
  annotationNote.value = ''
  showAnnotationModal.value = true
  showAnnotationBtn.value = false
}

function onSaveAnnotation() {
  if (!annotationNote.value.trim()) {
    toast(ANNOTATION.EMPTY_NOTE_WARN, 'warn')
    return
  }
  if (!lesson.value || !currentSelection.value) return

  const res = saveLessonAnnotation({
    memoStore,
    lesson: lesson.value,
    quote: currentSelection.value.text,
    note: annotationNote.value,
    inCodeBlock: currentSelection.value.inCodeBlock
  })

  if (res.ok) {
    toast(ANNOTATION.SAVED_SUCCESS, 'success')
    showAnnotationModal.value = false
    currentSelection.value = null
    annotationNote.value = ''
    window.getSelection()?.removeAllRanges()
  } else {
    if (res.error === 'note_too_long') {
      toast(ANNOTATION.NOTE_TOO_LONG_WARN, 'error')
    } else {
      toast(ANNOTATION.SAVE_FAILED_WARN, 'error')
    }
  }
}


const id = computed(() => String(route.params.id ?? ''))

 
const ai = useAiAssistantStore()
/** 「← 回到 AI 对话」：回到记下的那个会话；串流中不切会话（切了会取消） */
function backToChat() {
  const target = ai.returnTarget
  if (!target) return
  if (target.sessionId !== ai.currentSessionId && !ai.isStreaming && ai.sessions.some((s) => s.id === target.sessionId)) {
    ai.selectSession(target.sessionId)
  }
  void router.push('/ai')
}
const lesson = computed(() => content.lessonOf(id.value))
const status = computed(() => (id.value ? content.statusOf(id.value) : 'draft'))
watch([id, lesson, status], ([current, body, state]) => {
  if (body && state !== 'draft') content.recordRecentLesson(current)
}, { immediate: true })
/**
 * 课号在不在大纲里 —— 和 `lesson` **不是一回事**：
 * `lesson` 只认写好正文的那 5 节，`inOutline` 认全部 194 节。
 * 判断「课号对不对」用它，判断「有没有正文可渲染」用 lesson。
 */
const inOutline = computed(() => (id.value ? content.inOutline(id.value) : false))

const isLearned = computed(() => progress.profile.learned.includes(id.value))
const isFavorite = computed(() => progress.profile.favorites.includes(id.value))

/**
 * 下一课（V2-15 / V1-24）：大纲顺序里**这一课之后**第一节有正文的课。
 * 判据在 content store → `shared/lesson-nav.ts`（纯函数、有单测；
 * 那里记着"为什么不能拿 nextUpId 顶用"的现场）。null = 没有下一课
 * （已经是最后一节），按钮整颗不出现 —— 不给一颗点不动的。
 */
const isAlgo = computed(() => id.value.startsWith('algo-'))
const quizCount = computed(() => lessonPracticeQuestions(lesson.value).length)
const prevId = computed(() => (id.value ? content.prevWrittenBeforeId(id.value) : null))
const nextId = computed(() => (id.value ? content.nextWrittenAfterId(id.value) : null))

/** 正文渲染结果（compare / demo 块都换成占位元素 + 结构数据） */
const rendered = computed(() => (lesson.value ? renderMarkdown(lesson.value.body, true) : null))
const lessonDemos = computed(() => (rendered.value?.demoBlocks ?? []).map(block => demoToVideo(block, id.value, block.title || VIDEO_UI.DEMO_TITLE)))

/**
 * 正文切成的片段序列：`html` 段直接贴，`compare` 段渲染 CompareGrid，
 * `demo` 段渲染 DemoPlayer。
 *
 * 【为什么要切开，而不是把整篇 HTML 一次 v-html】
 * 这两种块都是 Vue 组件（对比块列头带复制/运行按钮，演示块带步进控件），
 * 塞不进 `v-html` 的字符串里。详情页只能把正文按占位元素切成几截，
 * 在切缝里插组件 —— 这样它们就出现在**课文提到它的那个位置**，
 * 而不是被挪到整篇文章的最后。
 *
 * 【2026-09-19：`splitCompareSlots` 改名成 `splitSlots`】
 * 演示块和对比块走的是同一个切分器（判据只有一处，理由见 `lib/md.ts`）。
 * 切出来的片段多了 `demo` 这一种 kind，所以类型也从 `ComparePart` 变成 `SlotPart`。
 */
const bodyParts = computed<SlotPart[]>(() =>
  rendered.value ? splitSlots(rendered.value.html) : []
)

/**
 * 第 i 个演示块 —— 找不到时给 `null`。
 *
 * 【为什么要这个函数，而不是模板里直接 `rendered.demoBlocks[p.index]`】
 * 占位元素里的编号来自渲染那一侧，和 `demoBlocks` 数组本该一一对应；
 * 万一哪天线接错了（比如 `env` 传的是一个、读的是另一个），
 * 模板里的 `undefined` 会让组件在**渲染中途**炸掉，整页白屏。
 * 这里返回 `null`，模板用 `v-if` 跳过那一个块 —— 坏一个块，正文还在。
 */
function demoAt(index: number): DemoBlock | null {
  return rendered.value?.demoBlocks[index] ?? null
}

/**
 * 语言课引用的通用课对比块（lesson.compare: [common-XX]）。
 *
 * 这些块在**本课正文里没有位置**（它们来自另一课），所以只能整体附在文末。
 */
const referencedBlocks = computed<CompareBlock[]>(() => {
  const l = lesson.value
  if (!l || !l.compare || l.compare.length === 0) return []
  return l.compare.flatMap((refId) => {
    const refLesson = content.lessonOf(refId)
    return refLesson ? collectCompare(refLesson.body) : []
  })
})

const unmetPrereqs = computed(() => {
  if (!lesson.value || !lesson.value.required) return []
  const learnedSet = new Set(progress.profile.learned)
  return lesson.value.required
    .filter((r) => !learnedSet.has(r))
    .map((r) => ({ id: r, title: content.titleOf(r) ?? r }))
})

const lockedRequired = computed(() =>
  lesson.value && lesson.value.required ? lesson.value.required.map((r) => ({ id: r, title: content.titleOf(r) ?? r })) : []
)

// 正文内交互（事件委托）：复制按钮 + lesson:// 链接
function onBodyClick(e: MouseEvent) {
  const target = e.target as HTMLElement
  const runBtn = target.closest('[data-run]')
  if (runBtn) {
    const rawLang = runBtn.getAttribute('data-run') ?? ''
    const blockEl = runBtn.closest('.code-block') as HTMLElement | null
    const code = blockEl?.querySelector('code')?.textContent ?? ''
    const allowed = LANG_OF_CODE.find((item) => item === rawLang)
    if (blockEl && code.trim() && allowed) {
      if (activeRunBlock.value && activeRunBlock.value.blockEl === blockEl) {
        closeInlineRun()
      } else {
        openInlineRun(allowed, code, blockEl)
      }
    }
    return
  }
  const copyBtn = target.closest<HTMLElement>('[data-copy]')
  if (copyBtn) {
    const codeEl = copyBtn.closest('.code-block')?.querySelector('code')
    if (codeEl) void copyText(codeEl.textContent ?? '', copyBtn)
    return
  }
  const link = target.closest('[data-lesson]')
  if (link) {
    const targetId = link.getAttribute('data-lesson') ?? ''
    if (targetId) openLesson(targetId)
  }
}

async function copyText(text: string, btn?: HTMLElement | null) {
  let ok = false
  try {
    await navigator.clipboard.writeText(text)
    ok = true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      ok = document.execCommand('copy')
      document.body.removeChild(ta)
    } catch {
      ok = false
    }
  }
  if (ok) {
    toast(TOAST.CODE_COPIED, 'success')
    if (btn) {
      btn.classList.add('copied')
      setTimeout(() => {
        btn.classList.remove('copied')
      }, 1500)
    }
  } else {
    toast(TOAST.COPY_FAILED, 'error')
  }
}

function toggleLearned() {
  progress.markLearned(id.value, !isLearned.value)
  toast(isLearned.value ? TOAST.MARK_LEARNED_ON : TOAST.MARK_LEARNED_OFF, 'success')
}

function toggleFavorite() {
  progress.toggleFavorite(id.value)
  toast(isFavorite.value ? TOAST.FAVORITE_ON : TOAST.FAVORITE_OFF, 'success')
}

/**
 * 开始课后练习。
 *
 * 抽题、洗题目顺序、洗选项顺序**都在 `usePracticeStarter` 里**，这里只负责传课。
 * 之所以不再就地写那三行：右栏有一个一模一样的按钮，两份分开写的话，
 * 改了一处忘了另一处，同一个动作在两个位置点出来的卷子会不一样 —— 不报错。
 */
function startPractice() {
  if (lesson.value && quizCount.value > 0) void router.push(lessonPracticeRoute(lesson.value.id))
}

// P1-3：随堂笔记侧边抽屉（首字输入才创建/保存、焦点管理）
const showNoteDrawer = ref(false)
const currentNoteId = ref<string | null>(null)
const noteDraft = ref('')
const noteBtnRef = ref<InstanceType<typeof MiButton> | null>(null)
const noteTextareaRef = ref<HTMLTextAreaElement | null>(null)

function focusNoteBtn() {
  const el = noteBtnRef.value?.$el ?? noteBtnRef.value
  if (el && typeof el.focus === 'function') {
    el.focus()
  }
}

function openLessonNote() {
  if (!lesson.value) return
  const expectedTitle = lessonNoteTitle(lesson.value)
  const existing = memoStore.items.find((i) => i.title === expectedTitle)
  if (existing) {
    currentNoteId.value = existing.id
    noteDraft.value = existing.body
  } else {
    currentNoteId.value = null
    noteDraft.value = ''
  }
  showNoteDrawer.value = true
  void nextTick(() => {
    noteTextareaRef.value?.focus()
  })
}

function onNoteInput() {
  if (!lesson.value) return
  if (!currentNoteId.value) {
    if (noteDraft.value.trim().length === 0) return
    const expectedTitle = lessonNoteTitle(lesson.value)
    const item = memoStore.add('knowledge')
    memoStore.setTitle(item.id, expectedTitle)
    currentNoteId.value = item.id
  }
  memoStore.setBody(currentNoteId.value, noteDraft.value)
}

function onNoteDrawerClose() {
  if (currentNoteId.value) {
    memoStore.flush()
  }
  void nextTick(() => {
    focusNoteBtn()
  })
}

function goToMemoPage() {
  showNoteDrawer.value = false
  if (currentNoteId.value) memoStore.flush()
  void router.push('/memo')
}

// P1-2：在当前代码块下方直接展开运行区
const activeRunBlock = ref<{
  lang: LangOfCode
  code: string
  blockEl: HTMLElement
} | null>(null)
const inlineRunMount = ref<HTMLElement | null>(null)

const inlineView = computed(() =>
  runView(runner.lastResult, runner.running, {
    lang: runner.lang,
    errorLib: content.bundle.errorLib
  })
)

function openInlineRun(lang: LangOfCode, code: string, blockEl: HTMLElement) {
  if (inlineRunMount.value) {
    inlineRunMount.value.remove()
    inlineRunMount.value = null
  }
  const anchor = document.createElement('div')
  anchor.className = 'inline-runner-mount-point'
  blockEl.after(anchor)
  inlineRunMount.value = anchor
  activeRunBlock.value = { lang, code, blockEl }

  runner.setCode(lang, code)
  void runner.run()
}

function closeInlineRun() {
  if (inlineRunMount.value) {
    inlineRunMount.value.remove()
    inlineRunMount.value = null
  }
  activeRunBlock.value = null
}

function rerunInline() {
  if (activeRunBlock.value && !runner.running) {
    runner.setCode(activeRunBlock.value.lang, activeRunBlock.value.code)
    void runner.run()
  }
}

function sendToPlayground(lang: string, code: string) {
  const allowed = LANG_OF_CODE.find((item) => item === lang)
  if (!allowed || !code.trim()) return
  runner.setCode(allowed, code)
  const autoRun = hasRunnableEntry(allowed, code) && !runner.running
  toast(autoRun ? TOAST.CODE_AUTO_RUN : TOAST.CODE_SENT_TO_PLAYGROUND, 'success')
  const q = lesson.value ? { fromLesson: lesson.value.id } : undefined
  void router.push({ path: '/playground', query: q }).then(() => { if (autoRun) void runner.run() })
}

/**
 * 把这一课的示例代码运行起来（对应底部操作栏的「运行」）。
 * 优先就地在当前课文的第一个可运行代码块下展开，找不到时跳练习场。
 */
function runCode() {
  const block = lesson.value ? firstRunnableBlock(lesson.value.body) : null
  if (!block) {
    toast(TOAST.NO_RUNNABLE_CODE, 'warn')
    return
  }
  const codeBlocks = Array.from(document.querySelectorAll<HTMLElement>('.code-block'))
  const targetEl = codeBlocks.find((el) => {
    const codeText = el.querySelector('code')?.textContent ?? ''
    return codeText.trim() === block.code.trim()
  }) ?? codeBlocks[0]

  if (targetEl) {
    if (activeRunBlock.value && activeRunBlock.value.blockEl === targetEl) {
      rerunInline()
    } else {
      openInlineRun(block.lang, block.code, targetEl)
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  } else {
    sendToPlayground(block.lang, block.code)
  }
}

// 切课时滚动到顶部并清理运行区
function scrollTop() {
  closeInlineRun()
  document.querySelector('main.content')?.scrollTo({ top: 0 })
}
onMounted(() => {
  scrollTop()
  if (touchSelection) document.addEventListener('selectionchange', onSelectionChangeTouch)
})
watch(id, scrollTop)
onBeforeUnmount(() => {
  document.removeEventListener('selectionchange', onSelectionChangeTouch)
  clearTimeout(selectionTimer)
  closeInlineRun()
  if (currentNoteId.value) memoStore.flush()
})
</script>

<template>
  <div class="lesson-page">
    <!--
      课号在大纲里根本不存在（手改 URL / 过期链接）。**这一条必须问 inOutline，
      不能问 lesson** —— `lesson` 只认写好正文的那 5 节，用它判会把 189 节空壳课
      全部说成「课号不对」，正是主人抱怨的那类误导（详见 stores/content.ts）。
    -->
    <MiCard v-if="!inOutline" class="block-card">
      <MiEmpty v-bind="EMPTY.LESSON_NOT_FOUND" />
    </MiCard>

    <!-- 正文还没写：给他一条出路，别只把人晾在「还在写」三个字上 -->
    <MiCard v-else-if="status === 'draft'" class="block-card">
      <MiEmpty v-bind="EMPTY.LESSON_DRAFT">
        <div class="block-actions">
          <MiButton v-if="content.nextUpId" variant="primary" @click="openLesson(content.nextUpId)">
            {{ ACTION.GO_WRITTEN }}
          </MiButton>
          <MiButton class="icon-only" variant="ghost" icon="arrow-left" :title="ACTION.BACK" :aria-label="ACTION.BACK" @click="router.back()" />
        </div>
      </MiEmpty>
    </MiCard>



    <!-- 正文 -->
    <template v-else-if="lesson">
      <!-- 建议先修提示（非强制锁，温和呈现） -->
      <div v-if="unmetPrereqs.length > 0" class="prereq-recommend-banner">
        <span class="prereq-recommend-label">{{ LESSON.RECOMMENDED_PREREQ }}</span>
        <div class="prereq-recommend-list">
          <button
            v-for="r in unmetPrereqs"
            :key="r.id"
            type="button"
            class="prereq-recommend-chip"
            @click="openLesson(r.id)"
          >
            {{ r.title }} ›
          </button>
        </div>
      </div>

      <button v-if="ai.returnTarget" type="button" class="back-to-chat" @click="backToChat">
        {{ AI_ASSISTANT.backToChat(ai.returnTarget.title) }}
      </button>

      <div class="lesson-head">
        <h1 class="lesson-title">{{ lesson.title }}</h1>
        <div class="pg-meta lesson-meta">
          <template v-if="isAlgo">
            <span>{{ ALGO_COURSE.CAT_BADGE }}</span>
            <span v-if="lesson.chapterTitle">{{ lesson.chapterTitle }}</span>
            <a v-if="lesson.upstreamUrl" :href="lesson.upstreamUrl" target="_blank" rel="noopener noreferrer" class="algo-official-link pg-meta-item"><MiIcon name="external" :size="12" />{{ ALGO_COURSE.OFFICIAL_PAGE }}</a>
            <span v-if="lesson.upstreamCommit">{{ ALGO_COURSE.UPSTREAM_COMMIT_PREFIX }}{{ lesson.upstreamCommit.slice(0, 7) }}</span>
            <span>{{ ALGO_COURSE.LICENSE_LABEL }}</span>
            <span v-if="lesson.author">{{ ALGO_COURSE.AUTHOR_PREFIX }}{{ lesson.author }}</span>
          </template>
          <template v-else>
            <span>{{ LANG_LABEL[lesson.lang] }}</span>
            <span v-if="lesson.lang !== 'common'">{{ STAGE_LABEL[lesson.stage] ?? lesson.stage }}</span>
            <span class="pg-meta-item lesson-minutes"><MiIcon name="clock" :size="12" />{{ lesson.estMinutes }} min</span>
            <span v-if="isLearned" class="pg-meta-item lesson-done"><MiIcon name="circle-check" :size="12" />{{ LESSON.STATUS_LEARNED }}</span>
          </template>
        </div>
      </div>

      <MiCard>
        <!--
          正文按 `.compare-slot` 占位元素切成几截，在切缝里插 CompareGrid ——
          对比块于是出现在**课文提到它的那个位置**，而不是整篇文章的最后。

          ⚠️ **切出来的每一截各是一个 `<article class="markdown-body">`，
          不是一个 article 里套几个 div**。两种写法看着都对，差别在 CompareGrid：
          它一旦落进 `.markdown-body`，就会继承那儿的 `font-size: var(--mi-fs-body);
          line-height: 1.9`（`md.css`），而它原本是挂在 `.lesson-page` 下的。
          对比块的按钮和标题会被这行 1.9 悄悄撑高一点 —— 不报错、不崩，
          只是"看着和以前不一样了"。分成多个 article 就没有这个问题：
          对比块始终在 `.markdown-body` **外面**，样式上下文和以前一字不差。

          （正文里没有这两种块时，切出来就一截，DOM 和改动前完全一样。）

          ── 2026-09-19 新增：`demo` 段渲染 DemoPlayer ──
          它和 CompareGrid 落在**同一个层级**（`<article>` 外面），所以上一条
          「不要落进 .markdown-body」的理由对它一样成立：演示块的步骤条、
          变量行都是按自己的字号排的，被 `.markdown-body` 的 1.9 行高接管会整体发虚。
        -->
        <template v-for="(part, i) in bodyParts" :key="i">
          <article
            v-if="part.kind === 'html'"
            class="markdown-body"
            v-html="part.html"
            @click="onBodyClick"
            @mouseup="handleSelectionChange"
            @keyup="handleSelectionChange"
          />
          <CompareGrid
            v-else-if="part.kind === 'compare' && rendered?.compareBlocks[part.index]"
            :blocks="[rendered.compareBlocks[part.index]]" :default-collapsed="isIntroLesson(lesson)"
          />
          <DemoPlayer
            v-else-if="part.kind === 'demo' && demoAt(part.index)"
            :block="demoAt(part.index)!"
            @video="video.play(demoToVideo(demoAt(part.index)!, id, demoAt(part.index)!.title || VIDEO_UI.DEMO_TITLE))"
          />
          <FlashCardsDeck
            v-else-if="part.kind === 'flash-cards' && rendered?.flashCardsBlocks[part.index]"
            :block="rendered.flashCardsBlocks[part.index]"
          />
          <PretestCard
            v-else-if="part.kind === 'pretest' && rendered?.pretestBlocks[part.index]"
            :block="rendered.pretestBlocks[part.index]"
          />
        </template>
      </MiCard>

      <CompareGrid v-if="referencedBlocks.length > 0" :blocks="referencedBlocks" :default-collapsed="isIntroLesson(lesson)" />

      <!-- P1-5 明确「学完」的标准说明卡片 -->
      <div class="mastery-standards-card">
        <div class="mastery-header">
          <div class="mastery-title-group">
            <span class="mastery-title">{{ LESSON.STANDARDS_TITLE }}<MiHint :text="LESSON.STANDARDS_DESC" /></span>
          </div>
          <MiTag :color="isLearned ? 'green' : 'blue'" size="sm">
            {{ isLearned ? LESSON.STANDARD_STATUS_MASTERED : LESSON.STANDARD_STATUS_LEARNING }}
          </MiTag>
        </div>
        <div class="mastery-checklist">
          <div class="checklist-item done">
            <span class="check-mark">✓</span>
            <span>{{ LESSON.STANDARD_READ }}</span>
          </div>
          <div class="checklist-item" :class="{ done: quizCount === 0 || isLearned }">
            <span class="check-mark">{{ quizCount === 0 || isLearned ? '✓' : '○' }}</span>
            <span>{{ LESSON.STANDARD_QUIZ(isLearned, quizCount) }}</span>
          </div>
        </div>
      </div>

      <!-- P1-1 课程操作区（两层：学习工具行 + 独立章节导航行，自然换行、始终可见、不遮挡正文与焦点） -->
      <div class="lesson-actions fixed-bar">
        <div class="lesson-tools-row">
          <MiButton :variant="isLearned ? 'ghost' : 'secondary'" :icon="isLearned ? 'circle-check' : 'circle'" :title="isLearned ? LESSON.UNMARK_LEARNED : undefined" @click="toggleLearned">
            {{ isLearned ? ACTION.LEARNED : ACTION.MARK_LEARNED }}
          </MiButton>
          <MiButton v-if="quizCount > 0" variant="primary" icon="list-checks" @click="startPractice">{{ ACTION.lessonQuiz(quizCount) }}</MiButton>
          <span v-else-if="isAlgo" class="algo-no-quiz">{{ AI_ASSISTANT.ALGO_NO_QUIZ }}</span>
          <MiButton :variant="videoPreferred ? 'primary' : 'secondary'" icon="play" @click="showVideos = true">{{ VIDEO_UI.TITLE }}</MiButton>
          <MiButton v-if="!remote" class="icon-only" variant="ghost" icon="play" :title="ACTION.RUN_CODE" :aria-label="ACTION.RUN_CODE" @click="runCode" />
          <MiButton class="icon-only" variant="ghost" icon="star" :icon-filled="isFavorite" :title="isFavorite ? ACTION.FAVORITED : ACTION.FAVORITE" :aria-label="isFavorite ? ACTION.FAVORITED : ACTION.FAVORITE" :aria-pressed="isFavorite" @click="toggleFavorite" />
          <MiButton ref="noteBtnRef" class="icon-only" variant="ghost" icon="note" :title="ACTION.LESSON_NOTE" :aria-label="ACTION.LESSON_NOTE" @click="openLessonNote" />
        </div>
        <div v-if="lesson" class="lesson-nav-row" :class="{ 'nav-row-full': isAlgo }">
          <div class="lesson-current-title" :title="lesson.title">
            {{ lesson.title }}
          </div>
          <div class="lesson-nav-buttons">
            <div class="nav-col nav-prev">
              <MiButton
                v-if="isAlgo && prevId"
                variant="secondary"
                @click="openLesson(prevId)"
              >
                {{ ALGO_COURSE.PREV_LESSON }}
              </MiButton>
            </div>
            <div class="nav-col nav-catalog">
              <MiButton
                v-if="isAlgo"
                variant="ghost"
                @click="router.push('/courses?cat=algo')"
              >
                {{ ALGO_COURSE.BACK_TO_CATALOG }}
              </MiButton>
            </div>
            <div class="nav-col nav-next">
              <template v-if="isAlgo">
                <MiButton
                  v-if="nextId"
                  :variant="quizCount > 0 ? 'secondary' : 'primary'"
                  @click="openLesson(nextId)"
                >
                  {{ ALGO_COURSE.NEXT_LESSON }}
                </MiButton>
              </template>
              <template v-else>
                <MiButton
                  v-if="nextId"
                  variant="secondary"
                  icon="arrow-right"
                  :title="ACTION.nextLessonTitle(content.titleOf(nextId) ?? '')"
                  @click="openLesson(nextId)"
                >
                  {{ ACTION.NEXT_LESSON }}
                </MiButton>
              </template>
            </div>
          </div>
        </div>
      </div>

      <MiDrawer v-model:visible="showVideos" :title="VIDEO_UI.THIS_LESSON" :width="420"><VideoLibrary :lesson-id="id" :lesson-excerpt="lesson.body" :demos="lessonDemos" /></MiDrawer>
      <!-- P1-2 代码块下方展开内联运行区 -->
      <Teleport v-if="inlineRunMount && activeRunBlock" :to="inlineRunMount">
        <div class="inline-runner-card">
          <div class="inline-runner-head">
            <div class="inline-runner-title-group">
              <span class="inline-runner-badge">▶ {{ LESSON.INLINE_RUN_TITLE }}</span>
              <MiTag color="blue" size="sm">{{ activeRunBlock.lang }}</MiTag>
            </div>
            <div class="inline-runner-head-actions">
              <MiButton size="sm" variant="ghost" :disabled="runner.running" @click="rerunInline">
                {{ LESSON.INLINE_RUN_RERUN }}
              </MiButton>
              <MiButton size="sm" variant="ghost" @click="sendToPlayground(activeRunBlock.lang, activeRunBlock.code)">
                {{ LESSON.INLINE_RUN_DEBUG }}
              </MiButton>
              <button type="button" class="inline-runner-close" :title="LESSON.INLINE_RUN_CLOSE" @click="closeInlineRun">✕</button>
            </div>
          </div>
          <div class="inline-runner-body">
            <div v-if="runner.running" class="inline-runner-loading">
              <span class="loading-spin">⏳</span>
              <span>{{ LESSON.INLINE_RUN_RUNNING }}</span>
            </div>
            <template v-else-if="inlineView">
              <div v-if="inlineView.errorCard" class="err-card">
                <div class="ec-tag">{{ inlineView.errorCard.tag }}</div>
                <div class="ec-title"><MiRichText :text="inlineView.errorCard.title" /></div>
                <div class="ec-explain"><MiRichText :text="inlineView.errorCard.explain" /></div>
                <div v-if="inlineView.errorCard.fixHint" class="ec-fix">
                  <MiRichText :text="inlineView.errorCard.fixHint" />
                </div>
              </div>
              <div v-if="inlineView.statusText && !inlineView.showMessage" class="run-status-line" :class="`tone-${inlineView.tone}`">
                {{ inlineView.statusText }}
              </div>
              <div v-if="inlineView.showMessage" class="run-long-msg">
                {{ inlineView.statusText }}
              </div>
              <div v-if="inlineView.stdout" class="run-out-box">
                <div class="box-label">STDOUT</div>
                <pre class="run-pre stdout">{{ inlineView.stdout }}</pre>
              </div>
              <div v-if="inlineView.showStderr" class="run-out-box stderr">
                <div class="box-label">STDERR</div>
                <pre class="run-pre stderr">{{ inlineView.stderr }}</pre>
              </div>
            </template>
          </div>
        </div>
      </Teleport>

      <!-- P1-3 课程笔记侧边抽屉 -->
      <MiDrawer
        v-model:visible="showNoteDrawer"
        :title="LESSON.NOTE_DRAWER_TITLE"
        :width="420"
        @close="onNoteDrawerClose"
      >
        <template #header="{ close }">
          <div class="note-drawer-header">
            <button
              type="button"
              class="note-drawer-back-btn"
              @click="close"
            >
              {{ LESSON.NOTE_DRAWER_BACK }}
            </button>
            <span class="note-drawer-header-title">{{ LESSON.NOTE_DRAWER_TITLE }}</span>
          </div>
        </template>
        <div class="lesson-note-drawer">
          <div class="note-drawer-top">
            <div class="note-lesson-title">《{{ lesson?.title }}》</div>
          </div>
          <textarea
            ref="noteTextareaRef"
            v-model="noteDraft"
            class="note-textarea"
            :placeholder="LESSON.NOTE_DRAWER_PH"
            @input="onNoteInput"
          />
          <div class="note-drawer-footer">
            <span class="note-status-hint">
              {{ currentNoteId ? LESSON.NOTE_DRAWER_SAVED : LESSON.NOTE_DRAWER_NOT_SAVED }}
            </span>
            <MiButton variant="ghost" size="sm" @click="goToMemoPage">
              {{ LESSON.NOTE_DRAWER_ALL }}
            </MiButton>
          </div>
        </div>
      </MiDrawer>

      <!-- 随堂批注浮动按钮 -->
      <div
        v-if="showAnnotationBtn"
        class="annotation-float"
        :class="{ 'is-touch': touchSelection }"
        :style="{ top: `${annotationBtnPos.top}px`, left: `${annotationBtnPos.left}px` }"
      >
        <button type="button" class="annotation-float-btn" @mousedown.prevent @click="openAnnotationModal">
          <span>✏️</span>
          <span>{{ ANNOTATION.BTN_LABEL }}</span>
        </button>
        <!-- 触屏没有右键菜单：「问 AI」走同一个浮条，点开后复用 AiContextMenu 的三个动作 -->
        <button v-if="touchSelection" type="button" class="annotation-float-btn" @mousedown.prevent @click="askAiAboutSelection">
          <span>{{ PHONE.ASK_AI_SELECTION }}</span>
        </button>
      </div>

      <!-- 随堂批注弹窗 -->
      <MiModal
        v-model:visible="showAnnotationModal"
        :title="ANNOTATION.POPUP_TITLE"
        :width="520"
      >
        <div class="annotation-modal-body">
          <div class="annotation-quote-preview">
            <div class="quote-header">{{ ANNOTATION.QUOTE_LABEL }}</div>
            <pre v-if="currentSelection?.inCodeBlock" class="quote-content-code">{{ currentSelection?.text }}</pre>
            <div v-else class="quote-content-text">{{ currentSelection?.text }}</div>
          </div>
          <div class="annotation-note-input">
            <label class="note-label" for="annotation-textarea-input">{{ ANNOTATION.NOTE_LABEL }}</label>
            <textarea
              id="annotation-textarea-input"
              v-model="annotationNote"
              class="annotation-textarea"
              rows="4"
              :maxlength="2000"
              :placeholder="ANNOTATION.NOTE_PH"
            />
          </div>
        </div>
        <template #footer>
          <div class="annotation-modal-footer">
            <MiButton variant="ghost" @click="showAnnotationModal = false">
              {{ ANNOTATION.CANCEL }}
            </MiButton>
            <MiButton variant="primary" @click="onSaveAnnotation">
              {{ ANNOTATION.SAVE }}
            </MiButton>
          </div>
        </template>
      </MiModal>
    </template>
  </div>
</template>

<style scoped>
.lesson-page {
  /* 阅读列宽收到 736：一行约 40 个汉字，再宽眼睛回扫会找不到下一行开头 */
  max-width: var(--mi-reading-max);
  margin: 0 auto;
  position: relative;
  /* 课文底部留足余量，使正文滚动到底时完整显示在操作栏上方，不被遮挡 */
  padding-bottom: var(--mi-sp-6);
}
.lesson-page :is(.mastery-standards-card, .inline-runner-card, .block-card, article, .prereq-recommend-banner, .back-to-chat) {
  scroll-margin-bottom: 140px;
}
.lesson-page .markdown-body :is(p, h1, h2, h3, h4, pre, code, a, button, table) {
  scroll-margin-bottom: 120px;
}
.block-card {
  margin-top: 40px;
}
.required-list {
  display: flex;
  flex-direction: column;
  gap: var(--mi-sp-2);
  max-width: 420px;
  margin: var(--mi-sp-3) auto 0;
}
.required-item {
  display: flex;
  align-items: center;
  gap: var(--mi-sp-3);
  padding: var(--mi-sp-2) var(--mi-sp-4);
  border: 1px solid var(--mi-border);
  border-radius: var(--mi-radius-sm);
  /* glass 令牌：恒等于 --mi-card（壁纸已移除，令牌为静态值） */
  background: var(--mi-card-glass);
  cursor: var(--mi-cursor, pointer);
  /*
   * 原先这里是 `transition: all .15s ease`。改成把属性一个个写出来 ——
   * `all` 会连**你没打算动的东西**一起过渡（这个元素身上有 border-radius、
   * padding、font-size），将来谁调一下 padding，它会莫名其妙地「滑」过去。
   * 而且 `all` 和 auto-animate 的内联 transform 会抢同一个属性，埋雷。
   */
  transition:
    background var(--mi-dur-fast) var(--mi-ease),
    border-color var(--mi-dur-fast) var(--mi-ease),
    transform var(--mi-dur-fast) var(--mi-ease),
    box-shadow var(--mi-dur-fast) var(--mi-ease);
}
/*
 * button.required-item 重置（V2-41）：铺满 + 左对齐 + 字体/行高继承
 * （与 Sidebar button.lesson-item、RightPanel button.ref-item 同一份账）。
 * border 不动 —— 上面类里那条 1px 描边是它的卡片外观。
 */
button.required-item {
  width: 100%;
  text-align: left;
  color: inherit;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  margin: 0;
}
button.required-item:focus-visible {
  outline: 2px solid var(--mi-blue-deep);
  outline-offset: 2px;
}
.required-item:hover {
  background: var(--mi-blue-light);
  border-color: var(--mi-blue);
  transform: translateX(2px);
  box-shadow: var(--mi-shadow);
}
.required-icon {
  flex-shrink: 0;
  font-size: var(--mi-fs-label);
}
.required-title {
  flex: 1;
  font-size: var(--mi-fs-label);
  color: var(--mi-text);
}
.required-arrow {
  color: var(--mi-text-3);
}
.block-actions {
  display: flex;
  /* 备课中那个分支现在有两个按钮（去学写好的课 / 返回），没有缝它们会贴在一起。
     锁定分支只有一个，加 gap 对它无害。 */
  gap: var(--mi-sp-3);
  flex-wrap: wrap;
  justify-content: center;
  margin-top: var(--mi-sp-4);
}
.lesson-head {
  margin-bottom: var(--mi-sp-6);
}
.lesson-badges {
  display: flex;
  gap: var(--mi-sp-2);
  margin-bottom: var(--mi-sp-3);
}
/*
 * 标题用衬线、字重 500、22/28 —— 与页面标题同一套阅读尺度。
 * 原来是 700 的粗黑，压在衬线体上会糊成一块；500 才留得住笔画细节。
 */
.lesson-title {
  font-family: var(--mi-font-serif);
  font-size: var(--mi-fs-title);
  font-weight: 500;
  line-height: 1.3;
  margin-bottom: var(--mi-sp-3);
}
/* 与 /ai 往返的两枚入口（§2.3 / §5.1）：ghost，不抢正文 */
.back-to-chat {
  display: inline-block;
  margin: 0 0 var(--mi-sp-3);
  padding: var(--mi-sp-1) 0;
  border: 0;
  background: transparent;
  color: var(--mi-text-2);
  font: inherit;
  font-size: var(--mi-fs-label);
  cursor: pointer;
}
.back-to-chat:hover { color: var(--mi-text); text-decoration: underline; }
.back-to-chat:focus-visible { outline: 2px solid var(--mi-text); outline-offset: 2px; }
.back-to-chat:focus:not(:focus-visible) { outline: none; }

.lesson-meta {
  display: flex;
  align-items: center;
  gap: var(--mi-sp-2);
}
/*
 * 「⏱ 约 15 分钟」。它现在是最后一枚 MiTag（灰 chip，与同排标签同款）——
 * 右对齐（margin-left:auto）与 12px 不变。为什么必须上 chip：这一行里只有它是
 * **裸文字直接坐在 layout 玻璃面上**，而近白壁纸下那块合成底最亮（#4d5157），
 * 三级文字压上去只有 2.68（2026-10-09 审计实测）。chip 的底是实色 --mi-zebra
 * （α1），壁纸透不到字背后，链就断在这里。
 * 不写 color：字色由 MiTag 的 .gray（--mi-text-2）决定，免得同一元素两处各写一份。
 */
.lesson-minutes {
  margin-left: auto;
  font-size: var(--mi-fs-caption);
}
.lesson-actions {
  display: flex;
  gap: var(--mi-sp-3);
  flex-wrap: wrap;
  margin: var(--mi-sp-6) 0 40px;
  padding: var(--mi-sp-4);
  background: var(--mi-card-glass);
  border: 1px solid var(--mi-border);
  border-radius: var(--mi-radius-lg);
}
/* 课文操作区：两层操作栏（学习工具行 + 独立章节导航行），自然换行、始终可见、不横向溢出 */
#app .claude-app-container .lesson-actions.fixed-bar {
  position: sticky;
  bottom: 16px;
  z-index: 50;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--mi-sp-3);
  flex-wrap: wrap;
  overflow: visible;
  margin: var(--mi-sp-6) 0 var(--mi-sp-4);
  padding: var(--mi-sp-2) var(--mi-sp-3);
  background: var(--mi-card);
  border: 1px solid var(--mi-border);
  border-radius: var(--mi-radius-lg);
  box-shadow: var(--mi-shadow-lg);
  box-sizing: border-box;
  scroll-margin-bottom: 24px;
}
.lesson-tools-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  /* 相邻行各扩展 6px 命中区，行距至少 12px 才不重叠。 */
  gap: var(--mi-sp-3) var(--mi-sp-2);
}
.lesson-nav-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--mi-sp-4);
  flex-wrap: wrap;
  flex: 1 1 120px;
  min-width: 0;
  container-type: inline-size;
}
/* 算法课有上一节/目录/下一节三个按钮，一行放不下，保留独立一行 */
.lesson-nav-row.nav-row-full {
  flex-basis: 100%;
}
/* 课程名放不下时整段隐藏，不留一个字加省略号的残段 */
@container (max-width: 150px) {
  .lesson-current-title {
    display: none;
  }
}
.lesson-current-title {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--mi-fs-label);
  color: var(--mi-text-2);
  line-height: 1.5;
}
.lesson-nav-buttons {
  display: flex;
  align-items: center;
  gap: var(--mi-sp-3);
  flex-wrap: wrap;
  margin-left: auto;
}
.nav-col {
  display: flex;
  align-items: center;
  min-width: 0;
}
.nav-col.nav-prev {
  justify-content: flex-start;
}
.nav-col.nav-catalog {
  justify-content: center;
}
.nav-col.nav-next {
  justify-content: flex-end;
}
.lesson-actions .mi-btn {
  position: relative;
}
/* 44px 真实可点击命中区，避免各按钮相互重叠 */
.lesson-actions .mi-btn::after {
  content: '';
  position: absolute;
  top: -6px;
  bottom: -6px;
  left: 0;
  right: 0;
}

/* P1-5 明确学完标准卡片样式 */
.mastery-standards-card {
  margin: var(--mi-sp-6) 0 var(--mi-sp-4);
  padding: var(--mi-sp-4) var(--mi-sp-4);
  background: var(--mi-card);
  border: 1px solid var(--mi-border);
  border-radius: var(--mi-radius-lg);
  box-shadow: var(--mi-shadow);
}
.mastery-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--mi-sp-3);
}
.mastery-title-group {
  display: flex;
  align-items: center;
  gap: var(--mi-sp-2);
}
.mastery-icon {
  font-size: var(--mi-fs-read);
}
.mastery-title {
  font-size: var(--mi-fs-body);
  font-weight: 500;
  color: var(--mi-text);
}
.mastery-desc {
  font-size: var(--mi-fs-label);
  line-height: 1.6;
  color: var(--mi-text-2);
  margin: var(--mi-sp-2) 0 var(--mi-sp-3);
}
.mastery-checklist {
  display: flex;
  gap: var(--mi-sp-4);
  flex-wrap: wrap;
}
.checklist-item {
  display: inline-flex;
  align-items: center;
  gap: var(--mi-sp-2);
  font-size: var(--mi-fs-caption);
  color: var(--mi-text-3);
  padding: var(--mi-sp-1) var(--mi-sp-3);
  border-radius: var(--mi-radius-sm);
  background: var(--mi-bg);
  border: 1px solid var(--mi-border);
}
.checklist-item.done {
  color: var(--mi-text);
  border-color: var(--mi-border-strong, var(--mi-border));
}
.check-mark {
  font-weight: 500;
  color: var(--mi-green, #10b981);
}

/* P1-2 代码块下方展开内联运行区样式 */
.inline-runner-card {
  margin: var(--mi-sp-3) 0 var(--mi-sp-6);
  padding: var(--mi-sp-4) var(--mi-sp-4);
  background: var(--mi-card);
  border: 1px solid var(--mi-border);
  border-radius: var(--mi-radius-lg);
  box-shadow: var(--mi-shadow-lg);
}
.inline-runner-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: var(--mi-sp-3);
  border-bottom: 1px solid var(--mi-border-subtle, var(--mi-border));
  margin-bottom: var(--mi-sp-3);
}
.inline-runner-title-group {
  display: flex;
  align-items: center;
  gap: var(--mi-sp-2);
}
.inline-runner-badge {
  font-size: var(--mi-fs-label);
  font-weight: 500;
  color: var(--mi-text);
}
.inline-runner-head-actions {
  display: flex;
  align-items: center;
  gap: var(--mi-sp-2);
}
.inline-runner-close {
  background: transparent;
  border: 0;
  color: var(--mi-text-3);
  font-size: var(--mi-fs-body);
  padding: var(--mi-sp-1) var(--mi-sp-2);
  border-radius: var(--mi-radius-sm);
  cursor: pointer;
}
.inline-runner-close:hover {
  background: var(--mi-bg);
  color: var(--mi-text);
}
.inline-runner-loading {
  display: flex;
  align-items: center;
  gap: var(--mi-sp-2);
  padding: var(--mi-sp-4) 0;
  font-size: var(--mi-fs-label);
  color: var(--mi-text-2);
}
.loading-spin {
  display: inline-block;
  animation: spin 1.5s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.run-status-line {
  font-size: var(--mi-fs-label);
  font-weight: 500;
  padding: var(--mi-sp-2) var(--mi-sp-3);
  border-radius: var(--mi-radius-sm);
  margin-bottom: var(--mi-sp-2);
}
.run-status-line.tone-ok {
  background: var(--mi-green-light, rgba(16, 185, 129, 0.1));
  color: var(--mi-green, #10b981);
}
.run-status-line.tone-bad {
  background: var(--mi-red-light, rgba(239, 68, 68, 0.1));
  color: var(--mi-red, #ef4444);
}
.run-status-line.tone-warn {
  background: var(--mi-gold-light, rgba(245, 158, 11, 0.1));
  color: var(--mi-gold, #f59e0b);
}
.run-long-msg {
  font-size: var(--mi-fs-label);
  line-height: 1.6;
  color: var(--mi-text-2);
  margin-bottom: var(--mi-sp-2);
}
.run-out-box {
  margin-top: var(--mi-sp-2);
}
.box-label {
  font-size: var(--mi-fs-caption);
  font-weight: 500;
  color: var(--mi-text-3);
  margin-bottom: var(--mi-sp-1);
}
.run-pre {
  margin: 0;
  padding: var(--mi-sp-3) var(--mi-sp-3);
  background: var(--mi-code-bg);
  border: 1px solid var(--mi-border);
  border-radius: var(--mi-radius-sm);
  font-family: var(--mi-code);
  font-size: var(--mi-fs-caption);
  line-height: 1.6;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--mi-text);
}
.run-out-box.stderr .run-pre {
  color: var(--mi-red, #ef4444);
}
.err-card {
  padding: var(--mi-sp-3);
  margin-bottom: var(--mi-sp-3);
  border-radius: var(--mi-radius-sm);
  background: var(--mi-red-light, rgba(239, 68, 68, 0.08));
  border: 1px solid var(--mi-red, #ef4444);
}
.ec-tag {
  font-size: var(--mi-fs-caption);
  font-weight: 500;
  color: var(--mi-red, #ef4444);
  margin-bottom: var(--mi-sp-1);
}
.ec-title {
  font-size: var(--mi-fs-label);
  font-weight: 500;
  color: var(--mi-text);
  margin-bottom: var(--mi-sp-2);
}
.ec-explain {
  font-size: var(--mi-fs-caption);
  line-height: 1.6;
  color: var(--mi-text-2);
  margin-bottom: var(--mi-sp-2);
}
.ec-fix {
  font-size: var(--mi-fs-caption);
  padding: var(--mi-sp-2) var(--mi-sp-2);
  border-radius: var(--mi-radius-sm);
  background: var(--mi-card);
  color: var(--mi-text);
}

/* P1-3 课程笔记侧边抽屉样式 */
.note-drawer-header {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--mi-sp-3);
  padding: var(--mi-sp-4) var(--mi-sp-4);
  border-bottom: 1px solid var(--mi-border);
}
.note-drawer-back-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--mi-sp-1);
  padding: var(--mi-sp-1) var(--mi-sp-2);
  margin-left: -8px;
  background: transparent;
  border: 0;
  border-radius: var(--mi-radius-sm);
  color: var(--mi-text-2);
  font-family: inherit;
  font-size: var(--mi-fs-label);
  cursor: pointer;
  transition: background var(--mi-dur-fast) var(--mi-ease), color var(--mi-dur-fast) var(--mi-ease);
}
.note-drawer-back-btn:hover {
  background: var(--mi-hover);
  color: var(--mi-text);
}
.note-drawer-back-btn:focus-visible {
  outline: 2px solid var(--mi-blue);
  outline-offset: 1px;
}
.note-drawer-header-title {
  font-size: var(--mi-fs-body);
  font-weight: 500;
  color: var(--mi-text);
}
.lesson-note-drawer {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: var(--mi-sp-3);
  box-sizing: border-box;
}
.note-drawer-top {
  display: flex;
  flex-direction: column;
  gap: var(--mi-sp-1);
  flex-shrink: 0;
}
.note-lesson-title {
  font-size: var(--mi-fs-body);
  font-weight: 500;
  color: var(--mi-text);
  line-height: 1.4;
  margin: 0;
}
.note-drawer-tip {
  font-size: var(--mi-fs-caption);
  line-height: 1.5;
  color: var(--mi-text-3);
  margin: 0;
}
.note-textarea {
  flex: 1;
  min-height: 120px;
  width: 100%;
  box-sizing: border-box;
  padding: var(--mi-sp-3);
  background: var(--mi-card);
  border: 1px solid var(--mi-border);
  border-radius: var(--mi-radius-sm);
  color: var(--mi-text);
  font-family: inherit;
  font-size: var(--mi-fs-body);
  line-height: 1.6;
  resize: none;
  overflow-y: auto;
}
.note-textarea:focus {
  outline: 2px solid var(--mi-blue);
  border-color: transparent;
}
.note-drawer-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--mi-sp-3);
  padding-top: var(--mi-sp-2);
  flex-shrink: 0;
}
.note-status-hint {
  font-size: var(--mi-fs-caption);
  color: var(--mi-text-3);
}
.algo-no-quiz { align-self: center; color: var(--mi-text-3); font-size: var(--mi-fs-caption); }

.prereq-recommend-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--mi-sp-3);
  padding: var(--mi-sp-3) var(--mi-sp-4);
  margin-bottom: var(--mi-sp-4);
  border-radius: var(--mi-radius-sm);
  background: var(--mi-blue-light);
  border: 1px solid var(--mi-border);
  font-size: var(--mi-fs-label);
  color: var(--mi-text-2);
}
.prereq-recommend-label {
  font-weight: 500;
  color: var(--mi-text);
}
.prereq-recommend-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mi-sp-2);
}
.prereq-recommend-chip {
  padding: 3px var(--mi-sp-3);
  border-radius: 999px;
  background: var(--mi-bg);
  border: 1px solid var(--mi-border);
  font-size: var(--mi-fs-caption);
  color: var(--mi-blue-ink);
  cursor: pointer;
  transition: all var(--mi-dur-fast) ease;
}
.prereq-recommend-chip:hover {
  background: var(--mi-blue);
  border-color: var(--mi-blue-deep);
}

.algo-official-link {
  font-size: var(--mi-fs-caption);
  color: var(--mi-blue-ink);
  text-decoration: none;
  padding: 2px var(--mi-sp-2);
  border-radius: var(--mi-radius-sm);
  background: var(--mi-blue-light);
  border: 1px solid var(--mi-border);
  transition: all var(--mi-dur-fast) ease;
}
.algo-official-link:hover {
  background: var(--mi-blue);
  text-decoration: none;
}

/* 随堂批注相关样式（零 opacity，零玻璃令牌） */
.annotation-float {
  position: fixed;
  z-index: 1000;
  transform: translate(-50%, -100%);
  display: flex;
  gap: var(--mi-sp-2);
}
.annotation-float.is-touch {
  transform: translate(-50%, 0);
}
.annotation-float-btn {
  display: flex;
  align-items: center;
  gap: var(--mi-sp-1);
  padding: var(--mi-sp-2) var(--mi-sp-3);
  font-size: var(--mi-fs-label);
  font-weight: 500;
  color: var(--mi-btn-primary-text, #ffffff);
  background: var(--mi-blue-deep);
  border: none;
  border-radius: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  transition: transform 0.15s ease;
}
.annotation-float-btn:hover {
  transform: scale(1.05);
}

.annotation-modal-body {
  display: flex;
  flex-direction: column;
  gap: var(--mi-sp-4);
}
.annotation-quote-preview {
  background: var(--mi-zebra, #f4f8fd);
  border-left: 3px solid var(--mi-blue-deep);
  padding: var(--mi-sp-3) var(--mi-sp-3);
  border-radius: var(--mi-radius-sm, 6px);
}
.quote-header {
  font-size: var(--mi-fs-caption);
  font-weight: 500;
  color: var(--mi-text-2, #6A6864);
  margin-bottom: var(--mi-sp-2);
}
.quote-content-text {
  margin: 0;
  font-size: var(--mi-fs-label);
  line-height: 1.5;
  color: var(--mi-text, #181816);
  font-style: italic;
  max-height: 120px;
  overflow-y: auto;
  word-break: break-word;
  white-space: pre-wrap;
}
.quote-content-code {
  margin: 0;
  font-size: var(--mi-fs-caption);
  font-family: var(--mi-font-mono, monospace);
  background: var(--mi-code-bg);
  padding: var(--mi-sp-2);
  border-radius: var(--mi-radius-sm, 6px);
  max-height: 120px;
  overflow-y: auto;
  word-break: break-word;
  white-space: pre-wrap;
}
.annotation-note-input {
  display: flex;
  flex-direction: column;
  gap: var(--mi-sp-2);
}
.note-label {
  font-size: var(--mi-fs-label);
  font-weight: 500;
  color: var(--mi-text, #181816);
}
.annotation-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: var(--mi-sp-3);
  border: 1px solid var(--mi-border);
  border-radius: var(--mi-radius-sm, 6px);
  font-size: var(--mi-fs-body);
  line-height: 1.5;
  outline: none;
  resize: vertical;
  font-family: inherit;
  color: var(--mi-text, #181816);
  background: var(--mi-bg, #ffffff);
}
.annotation-textarea:focus {
  border-color: var(--mi-blue-deep);
}
.annotation-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--mi-sp-3);
}

.lesson-head { display: flex; flex-direction: column; gap: var(--mi-sp-2); }
.lesson-done { color: var(--mi-success-deep); }
.algo-official-link { color: var(--mi-blue-deep); text-decoration: none; }
.prereq-recommend-banner { background: transparent; border: 0; padding: 0; }
</style>
