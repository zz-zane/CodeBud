<script setup lang="ts">
/**
 * 选词工具条（docs/27 §8.2）：在做题页的文章 / 题干 / 选项 / 解析里选中英文，选区上方浮出「释义 | 生词本」。
 * 只监听做题页根元素的 mouseup / keydown(Esc) / scroll / mousedown 与 document 的 selectionchange；
 * 输入框里的选区、跨出文章与题目区的选区不出条。考试锁开着时父组件根本不渲染本组件。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { CET6 } from '../../lib/copy'
import { classifyText, extractContext, validateSelection, type Cet6Gloss, type Cet6LookupFail } from '../../../../shared/cet6-vocab'
import { useCet6VocabStore } from '../../stores/cet6-vocab'
import { useAiAssistantStore } from '../../stores/ai-assistant'
import { usePhoneBackClose } from '../../lib/phone-back-close'
import { useSettingsDialogStore } from '../../stores/settings-dialog'
import MiButton from '../base/MiButton.vue'
import MiIcon from '../base/MiIcon.vue'

const props = defineProps<{ root: HTMLElement | null; examId: string; sectionType: string }>()

const vocab = useCet6VocabStore()
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
const addedEntryId = ref('')
let lookupSeq = 0

const inVocab = computed(() => !!selText.value && !!vocab.find(selText.value))
const isSentence = computed(() => classifyText(selText.value) === 'sentence')

// 手机上系统返回先收起展开的释义卡片
usePhoneBackClose(() => shown.value && expanded.value, () => hide())

function hide(): void {
  shown.value = false
  expanded.value = false
  phase.value = 'idle'
  gloss.value = null
  addedEntryId.value = ''
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
  const text = validateSelection(sel.toString())
  if (!text) return hide()
  const range = sel.getRangeAt(0)
  const node = range.commonAncestorContainer
  const el = node instanceof Element ? node : node.parentElement
  if (!el || !props.root || !props.root.contains(el)) return hide()
  if (el.closest('textarea, input, [data-sel-bar]') || !el.closest('.cet6-left, .cet6-right')) return hide()
  if (text !== selText.value) {
    expanded.value = false
    phase.value = 'idle'
    gloss.value = null
    addedEntryId.value = ''
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
  const sel = window.getSelection()
  if (shown.value && (!sel || sel.isCollapsed)) hide()
  if (touch && sel && !sel.isCollapsed) {
    clearTimeout(settleTimer)
    settleTimer = setTimeout(capture, 350)
  }
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
  await vocab.add(spot())
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
    addedEntryId.value = res.added ? res.entry.id : ''
    phase.value = 'ok'
  } else {
    failReason.value = res.reason
    phase.value = 'fail'
  }
  void nextTick(place)
}

async function undoAdd(): Promise<void> {
  const id = addedEntryId.value
  addedEntryId.value = ''
  if (id) await vocab.removeNow([id])
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
}
function detach(el: HTMLElement | null): void {
  el?.removeEventListener('mouseup', onMouseUp)
  el?.removeEventListener('mousedown', onMouseDown, true)
  el?.removeEventListener('scroll', onScroll, true)
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
        <span v-if="phase === 'ok'" class="cet6-sel-muted">
          {{ addedEntryId ? CET6.SEL_ADDED : CET6.SEL_UPDATED }}
          <button v-if="addedEntryId" type="button" class="cet6-sel-link" @click="undoAdd">{{ CET6.UNDO }}</button>
        </span>
        <span class="cet6-sel-spacer" />
        <MiButton v-if="phase === 'fail'" size="sm" icon="plus" :disabled="inVocab" @click="addToVocab">
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
.cet6-sel-link { margin-left: var(--mi-sp-2); padding: 0; border: 0; background: transparent; color: var(--mi-blue-deep); font: inherit; cursor: pointer; text-decoration: underline; }
.cet6-sel-link:focus-visible { outline: 2px solid var(--mi-blue-deep); outline-offset: 1px; }
</style>
