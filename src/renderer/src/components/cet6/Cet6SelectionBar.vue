<script setup lang="ts">
/**
 * 选词工具条（docs/27 §8.2）：在做题页的文章 / 题干 / 选项 / 解析里选中英文，选区上方浮出「释义 | 生词本」。
 * 只监听做题页根元素的 mouseup / keydown(Esc) / scroll / mousedown 与 document 的 selectionchange；
 * 输入框里的选区、跨出文章与题目区的选区不出条。考试锁开着时父组件根本不渲染本组件。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from '../base/toast'
import { CET6 } from '../../lib/copy'
import { classifyText, extractContext, validateSelection, type Cet6Gloss, type Cet6LookupFail } from '../../../../shared/cet6-vocab'
import { useCet6VocabStore } from '../../stores/cet6-vocab'
import { useAiAssistantStore } from '../../stores/ai-assistant'
import { usePhoneBackClose } from '../../lib/phone-back-close'
import { wordBoundsAt } from '../../lib/cet6-tap-select'
import { createRangeOverlay } from '../../lib/range-overlay'
import { useSettingsDialogStore } from '../../stores/settings-dialog'
import MiButton from '../base/MiButton.vue'
import MiIcon from '../base/MiIcon.vue'

const props = defineProps<{ root: HTMLElement | null; examId: string; sectionType: string }>()

const vocab = useCet6VocabStore()
const router = useRouter()
const ai = useAiAssistantStore()
const settingsDialog = useSettingsDialogStore()

const barEl = ref<HTMLElement | null>(null)
const shown = ref(false)
const expanded = ref(false)
const pos = ref({ left: 0, top: 0 })
const selText = ref('')
const context = ref('')
let anchor: DOMRect | null = null
// 触屏长按选词只触发 selectionchange、没有 mouseup：粗指针下选区稳定后再出条，并放在选区下方避开系统手柄与放大镜
const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true
let settleTimer: ReturnType<typeof setTimeout> | undefined

type Phase = 'idle' | 'loading' | 'ok' | 'fail'
const phase = ref<Phase>('idle')
const gloss = ref<Cet6Gloss | null>(null)
const failReason = ref<Cet6LookupFail>('network')
let lookupSeq = 0

const inVocab = computed(() => !!selText.value && !!vocab.find(selText.value))
const isSentence = computed(() => classifyText(selText.value) === 'sentence')

// 手机上系统返回先收起展开的释义卡片
usePhoneBackClose(() => shown.value && expanded.value, () => hide())

function hide(): void {
  picked = null
  paint(null)
  shown.value = false
  expanded.value = false
  phase.value = 'idle'
  gloss.value = null
  lookupSeq++
}

/** 向上找第一个非行内元素的文本，作为「所在句」的来源 */
function blockText(start: Element): string {
  let el: Element | null = start
  while (el && el !== props.root) {
    if (!getComputedStyle(el).display.startsWith('inline')) return el.textContent ?? ''
    el = el.parentElement
  }
  return ''
}

function place(): void {
  const rect = anchor
  const bar = barEl.value
  if (!rect || !bar) return
  const w = bar.offsetWidth
  const h = bar.offsetHeight
  const gap = 8
  const left = Math.min(Math.max(rect.left + rect.width / 2 - w / 2, gap), Math.max(gap, window.innerWidth - w - gap))
  let top = touch ? rect.bottom + 28 : rect.top - h - gap
  if (!touch && top < gap) top = rect.bottom + gap
  if (touch && top + h > window.innerHeight - gap) top = rect.top - h - 28
  top = Math.min(top, Math.max(gap, window.innerHeight - h - gap))
  pos.value = { left, top }
}

function capture(): void {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return hide()
  captureRange(sel.getRangeAt(0))
}

function captureRange(range: Range): void {
  const text = validateSelection(range.toString())
  if (!text) return hide()
  const node = range.commonAncestorContainer
  const el = node instanceof Element ? node : node.parentElement
  if (!el || !props.root || !props.root.contains(el)) return hide()
  if (el.closest('textarea, input, [data-sel-bar]') || !el.closest('.cet6-left, .cet6-right')) return hide()
  if (text !== selText.value) {
    expanded.value = false
    phase.value = 'idle'
    gloss.value = null
      lookupSeq++
  }
  selText.value = text
  context.value = extractContext(blockText(el), text)
  anchor = range.getBoundingClientRect()
  shown.value = true
  void nextTick(place)
}

function inBar(target: EventTarget | null): boolean {
  return target instanceof Node && !!barEl.value && barEl.value.contains(target)
}

function onMouseUp(e: MouseEvent): void {
  if (inBar(e.target)) return
  setTimeout(capture, 0)
}
function onMouseDown(e: MouseEvent): void {
  if (shown.value && !inBar(e.target)) hide()
}
function onScroll(e: Event): void {
  if (shown.value && !inBar(e.target)) hide()
}
function onSelectionChange(): void {
  // 长按选词不经过系统选区：系统选区的变化（点一下就会变）不该把它收起
  if (picked) return
  const sel = window.getSelection()
  if (shown.value && (!sel || sel.isCollapsed)) hide()
  if (touch && sel && !sel.isCollapsed) {
    clearTimeout(settleTimer)
    settleTimer = setTimeout(capture, 350)
  }
}
// ── 手机：应用自己的长按选词（2026-11-23）────────────────────────────────
// 系统选区一出现，手机就弹「复制 / 粘贴 / 全选」菜单挡住释义条，网页关不掉它；
// 所以粗指针下关掉原生选字（见下方无 scoped 样式），长按 450ms 由应用算出手指下的单词，
// 用覆盖层（lib/range-overlay.ts）画出来；选中后再点同一段里的另一个词，把选区扩成短语。
let picked: Range | null = null
let pressTimer: ReturnType<typeof setTimeout> | undefined
let pressAt = { x: 0, y: 0 }
let longPressed = false

// 用自画覆盖层而不是 CSS Highlight：旧版 iPadOS Safari 不支持后者，选中的词看不出来（2026-11-23 用户实测）
const pickLayer = typeof document === 'undefined' ? null : createRangeOverlay('pick')
function paint(range: Range | null): void {
  if (range) pickLayer?.set([range])
  else pickLayer?.clear()
}

function blockOf(node: Node): Element | null {
  let el: Element | null = node instanceof Element ? node : node.parentElement
  while (el && el !== props.root && getComputedStyle(el).display.startsWith('inline')) el = el.parentElement
  return el
}

function wordRangeAt(x: number, y: number): Range | null {
  const at = document.caretRangeFromPoint?.(x, y)
  const node = at?.startContainer
  if (!at || !node || node.nodeType !== Node.TEXT_NODE) return null
  const el = node.parentElement
  if (!el || !props.root?.contains(el) || !el.closest('.cet6-left, .cet6-right') || el.closest('textarea, input, [data-sel-bar]')) return null
  const b = wordBoundsAt((node as Text).data, at.startOffset)
  if (!b) return null
  const r = document.createRange()
  r.setStart(node, b[0])
  r.setEnd(node, b[1])
  return r
}

function spanOf(a: Range, b: Range): Range {
  const first = a.compareBoundaryPoints(Range.START_TO_START, b) <= 0 ? a : b
  const last = first === a ? b : a
  const r = document.createRange()
  r.setStart(first.startContainer, first.startOffset)
  r.setEnd(last.endContainer, last.endOffset)
  return r
}

function pick(r: Range): void {
  picked = r
  paint(r)
  captureRange(r)
}

function onTouchStart(e: TouchEvent): void {
  if (e.touches.length !== 1 || inBar(e.target)) return
  pressAt = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  longPressed = false
  clearTimeout(pressTimer)
  pressTimer = setTimeout(() => {
    const r = wordRangeAt(pressAt.x, pressAt.y)
    if (!r) return
    longPressed = true
    pick(r)
  }, 450)
}
function onTouchMove(e: TouchEvent): void {
  const t = e.touches[0]
  if (t && Math.hypot(t.clientX - pressAt.x, t.clientY - pressAt.y) > 10) clearTimeout(pressTimer)
}
function onTouchEnd(e: TouchEvent): void {
  clearTimeout(pressTimer)
  // 长按选词后松手：吞掉随后的 click，免得在选项上长按顺手选了答案
  if (longPressed) { longPressed = false; e.preventDefault(); return }
  if (!picked || !shown.value || inBar(e.target)) return
  const t = e.changedTouches[0]
  const r = t ? wordRangeAt(t.clientX, t.clientY) : null
  if (r && blockOf(r.startContainer) === blockOf(picked.startContainer)) {
    e.preventDefault()
    pick(spanOf(picked, r))
    return
  }
  // 点到别处：收起（触屏上不一定有合成的 mousedown 来触发 onMouseDown）
  hide()
}
function onContextMenu(e: Event): void {
  e.preventDefault()
}

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape' && shown.value) hide()
}

const spot = (): { text: string; context: string; source: { examId: string; sectionType: string } } => ({
  text: selText.value,
  context: context.value,
  source: { examId: props.examId, sectionType: props.sectionType }
})

async function addToVocab(): Promise<void> {
  if (inVocab.value) return
  // 加入后给个「查看」，用户不用再去找生词本在哪
  if (await vocab.add(spot())) toast(CET6.VOCAB_ADDED, 'success', 4000, { label: CET6.VOCAB_VIEW, run: () => void router.push('/cet6/vocab') })
}

async function lookup(): Promise<void> {
  const seq = ++lookupSeq
  expanded.value = true
  phase.value = 'loading'
  void nextTick(place)
  const res = await vocab.lookup(spot())
  if (seq !== lookupSeq) return
  if (res.ok) {
    gloss.value = res.entry.gloss
    phase.value = 'ok'
  } else {
    failReason.value = res.reason
    phase.value = 'fail'
  }
  void nextTick(place)
}

function askMore(): void {
  ai.openWithSelection({ text: CET6.askRef(selText.value, context.value), title: CET6.ASK_REF_TITLE, type: 'selection', action: 'ask' })
  hide()
}

function toSettings(): void {
  settingsDialog.openSettings('ai')
  hide()
}

function attach(el: HTMLElement | null): void {
  el?.addEventListener('mouseup', onMouseUp)
  el?.addEventListener('mousedown', onMouseDown, true)
  el?.addEventListener('scroll', onScroll, true)
  if (el && touch) {
    el.classList.add('cet6-tap-select')
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: false })
    el.addEventListener('contextmenu', onContextMenu)
  }
}
function detach(el: HTMLElement | null): void {
  el?.removeEventListener('mouseup', onMouseUp)
  el?.removeEventListener('mousedown', onMouseDown, true)
  el?.removeEventListener('scroll', onScroll, true)
  if (el) {
    el.classList.remove('cet6-tap-select')
    el.removeEventListener('touchstart', onTouchStart)
    el.removeEventListener('touchmove', onTouchMove)
    el.removeEventListener('touchend', onTouchEnd)
    el.removeEventListener('contextmenu', onContextMenu)
  }
}

watch(() => props.root, (next, prev) => {
  detach(prev ?? null)
  attach(next)
}, { immediate: true })

onMounted(() => {
  void vocab.load()
  document.addEventListener('selectionchange', onSelectionChange)
  window.addEventListener('keydown', onKeyDown)
})
onBeforeUnmount(() => {
  detach(props.root)
  document.removeEventListener('selectionchange', onSelectionChange)
  clearTimeout(settleTimer)
  clearTimeout(pressTimer)
  pickLayer?.destroy()
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<template>
  <div
    v-if="shown"
    ref="barEl"
    class="cet6-sel"
    :class="{ expanded }"
    data-sel-bar
    role="toolbar"
    :aria-label="CET6.SEL_BAR"
    :style="{ left: `${pos.left}px`, top: `${pos.top}px` }"
    @mousedown.prevent
  >
    <div v-if="!expanded" class="cet6-sel-bar">
      <MiButton size="sm" data-action="gloss" @click="lookup">{{ CET6.SEL_GLOSS }}</MiButton>
      <MiButton size="sm" icon="plus" data-action="add-vocab" :disabled="inVocab" @click="addToVocab">
        {{ inVocab ? CET6.SEL_IN_VOCAB : CET6.SEL_ADD }}
      </MiButton>
    </div>

    <section v-else class="cet6-sel-card" :aria-label="CET6.SEL_CARD">
      <header class="cet6-sel-head">
        <span class="cet6-sel-text" lang="en">{{ selText }}</span>
        <button type="button" class="icon-btn" :title="CET6.SEL_CLOSE" :aria-label="CET6.SEL_CLOSE" @click="hide">
          <MiIcon name="x" :size="14" />
        </button>
      </header>

      <div class="cet6-sel-body">
        <p v-if="phase === 'loading'" class="cet6-sel-muted" role="status">{{ CET6.SEL_LOADING }}</p>

        <template v-else-if="phase === 'fail'">
          <p class="cet6-sel-muted" role="status">{{ CET6.LOOKUP_FAIL[failReason] }}</p>
          <MiButton v-if="failReason === 'no-key'" size="sm" @click="toSettings">{{ CET6.SEL_SETTINGS }}</MiButton>
        </template>

        <template v-else-if="phase === 'ok' && gloss">
          <template v-if="!isSentence">
            <p v-if="gloss.phonetic || gloss.pos" class="cet6-sel-muted">{{ [gloss.phonetic, gloss.pos].filter(Boolean).join('  ') }}</p>
            <p v-if="gloss.meaning" class="cet6-sel-meaning">{{ gloss.meaning }}</p>
            <template v-if="gloss.collocations.length">
              <h4>{{ CET6.SEL_COLLOCATIONS }}</h4>
              <ul lang="en"><li v-for="(c, i) in gloss.collocations" :key="i">{{ c }}</li></ul>
            </template>
          </template>
          <template v-else>
            <p v-if="gloss.translation" class="cet6-sel-meaning">{{ gloss.translation }}</p>
            <template v-if="gloss.structure.length">
              <h4>{{ CET6.SEL_STRUCTURE }}</h4>
              <ul><li v-for="(c, i) in gloss.structure" :key="i">{{ c }}</li></ul>
            </template>
          </template>
        </template>
      </div>

      <footer class="cet6-sel-foot">
        <span class="cet6-sel-spacer" />
        <MiButton v-if="phase !== 'loading'" size="sm" icon="plus" data-action="add-vocab-card" :disabled="inVocab" @click="addToVocab">
          {{ inVocab ? CET6.SEL_IN_VOCAB : CET6.SEL_ADD }}
        </MiButton>
        <MiButton size="sm" icon="message" data-action="ask-more" @click="askMore">{{ CET6.SEL_ASK }}</MiButton>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.cet6-sel { position: fixed; z-index: 200; box-sizing: border-box; border: 1px solid var(--mi-border); border-radius: var(--radius-lg, 8px); background: var(--mi-card); color: var(--mi-text); font-family: var(--mi-font-family); }
.cet6-sel-bar { display: flex; gap: var(--mi-sp-1); padding: var(--mi-sp-1); }
.cet6-sel.expanded { width: 360px; max-width: calc(100vw - 16px); max-height: 50vh; overflow-y: auto; }
.cet6-sel-card { padding: var(--mi-sp-3); font-size: var(--mi-fs-label); line-height: 1.6; }
.cet6-sel-head { display: flex; align-items: flex-start; gap: var(--mi-sp-2); margin-bottom: var(--mi-sp-2); }
.cet6-sel-text { flex: 1; min-width: 0; font-family: var(--mi-font-serif); font-size: var(--mi-fs-body); font-weight: 500; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.cet6-sel-body p { margin: 0 0 var(--mi-sp-2); }
.cet6-sel-body h4 { margin: var(--mi-sp-2) 0 2px; font-size: var(--mi-fs-caption); font-weight: 500; color: var(--mi-text-2); }
.cet6-sel-body ul { margin: 0; padding-left: var(--mi-sp-4); }
.cet6-sel-meaning { color: var(--mi-text); }
.cet6-sel-muted { color: var(--mi-text-3); font-size: var(--mi-fs-caption); }
.cet6-sel-foot { display: flex; align-items: center; gap: var(--mi-sp-2); margin-top: var(--mi-sp-3); }
.cet6-sel-spacer { flex: 1; }
</style>

<style>
/* 粗指针（手机）下关掉文章与题目区的原生选字与长按菜单，改由组件自己的长按选词；输入框照常可选 */
.cet6-tap-select .cet6-left,
.cet6-tap-select .cet6-right { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
.cet6-tap-select textarea,
.cet6-tap-select input { -webkit-user-select: text; user-select: text; -webkit-touch-callout: default; }
</style>
