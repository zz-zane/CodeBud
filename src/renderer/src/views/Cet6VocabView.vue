<script setup lang="ts">
/**
 * 六级生词本（2026-11-24 重做，调研见 Codex research-vocab-todo.md）：
 * - 列表：按加入日分组，一行 = 词 + 音标 + 一行释义 + 出处；点开看原句（词标亮）、完整释义和操作。
 * - 翻卡：?review=1 进入。正面词 + 挖空原句，翻面看释义，自评 忘记 / 模糊 / 认识，主进程按 1/3/7/14/30/60 天排下次。
 * 删除走 toast 撤销，不弹确认。
 * 模板根节点只能是单个元素（v-if / v-else 二选一），根层不要写 HTML 注释：开发模式保留注释，
 * 根会变成片段，<Transition mode="out-in"> 卡在离场，之后所有页面空白（2026-11-24 用户实测）。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useCet6VocabStore } from '../stores/cet6-vocab'
import { toast } from '../components/base/toast'
import { CET6 } from '../lib/copy'
import { today } from '../lib/day-clock'
import { relativeDayLabel } from '../../../shared/today'
import { isVocabDue, VOCAB_GRADES, type Cet6VocabEntry, type Cet6VocabGrade } from '../../../shared/cet6-vocab'
import MiIcon from '../components/base/MiIcon.vue'
import MiSelect from '../components/base/MiSelect.vue'
import MiButton from '../components/base/MiButton.vue'

type Filter = 'all' | 'due' | 'word' | 'sentence' | 'mastered'
const FILTERS: Filter[] = ['all', 'due', 'word', 'sentence', 'mastered']

const route = useRoute()
const router = useRouter()
const vocab = useCet6VocabStore()

const filter = ref<Filter>('all')
const exam = ref('')
const query = ref('')
const open = ref<string | null>(null)
const busy = ref<Set<string>>(new Set())

onMounted(() => void vocab.load())
onBeforeUnmount(() => void vocab.flushPending())

const due = computed(() => vocab.entries.filter((e) => isVocabDue(e, today.value)))

function glossText(e: Cet6VocabEntry): string {
  const g = e.gloss
  return g ? [g.meaning, g.translation, ...g.collocations, ...g.structure].join(' ') : ''
}
/** 列表里那一行释义：词取 meaning，句子取 translation */
function shortGloss(e: Cet6VocabEntry): string {
  const g = e.gloss
  return g ? (e.kind === 'word' ? g.meaning || g.translation : g.translation || g.meaning) : ''
}

const examOptions = computed(() => {
  const ids = [...new Set(vocab.entries.map((e) => e.source?.examId).filter((x): x is string => !!x))].sort().reverse()
  return [{ label: CET6.VOCAB_EXAM_ALL, value: '' }, ...ids.map((id) => ({ label: examLabel(id), value: id }))]
})

const shown = computed(() => {
  const q = query.value.trim().toLowerCase()
  return vocab.entries.filter((e) => {
    if (filter.value === 'due' && !isVocabDue(e, today.value)) return false
    if (filter.value === 'word' && e.kind !== 'word') return false
    if (filter.value === 'sentence' && e.kind !== 'sentence') return false
    if (filter.value === 'mastered' && !e.mastered) return false
    if (exam.value && e.source?.examId !== exam.value) return false
    return !q || e.text.toLowerCase().includes(q) || glossText(e).toLowerCase().includes(q) || e.context.toLowerCase().includes(q)
  })
})

/** 按加入日分组（条目本来就按加入时间倒序） */
const groups = computed(() => {
  const out: Array<{ label: string; items: Cet6VocabEntry[] }> = []
  for (const e of shown.value) {
    const label = relativeDayLabel(e.addedAt, today.value)
    const last = out[out.length - 1]
    if (last && last.label === label) last.items.push(e)
    else out.push({ label, items: [e] })
  }
  return out
})

function filterCount(f: Filter): number | null {
  if (f === 'all') return vocab.entries.length
  if (f === 'due') return due.value.length
  return null
}

/** 所在句拆成 前 / 原文 / 后；找不到原文就整句当前文 */
function splitContext(e: Cet6VocabEntry): [string, string, string] {
  const at = e.context.toLowerCase().indexOf(e.text.toLowerCase())
  if (at < 0) return [e.context, '', '']
  return [e.context.slice(0, at), e.context.slice(at, at + e.text.length), e.context.slice(at + e.text.length)]
}

function examLabel(id: string): string {
  return CET6.vocabSource(Number(id.slice(0, 4)), Number(id.slice(5, 7)), Number(id.slice(8)), '').replace(/\s*·\s*$/, '')
}
function sourceLabel(e: Cet6VocabEntry): string {
  const s = e.source
  if (!s) return ''
  const part = (CET6.PART_ZH as Record<string, string>)[s.sectionType] ?? ''
  return CET6.vocabSource(Number(s.examId.slice(0, 4)), Number(s.examId.slice(5, 7)), Number(s.examId.slice(8)), part)
}

function openSource(e: Cet6VocabEntry): void {
  if (e.source) void router.push({ path: `/cet6/${e.source.examId}`, query: { section: e.source.sectionType } })
}

async function lookup(e: Cet6VocabEntry): Promise<void> {
  if (busy.value.has(e.id)) return
  busy.value = new Set(busy.value).add(e.id)
  const res = await vocab.lookup({ text: e.text, context: e.context, source: e.source })
  const next = new Set(busy.value)
  next.delete(e.id)
  busy.value = next
  if (!res.ok) toast(CET6.LOOKUP_FAIL[res.reason], 'warn')
}

// ---------------------------------------------------------------- 翻卡

/** 开始时定下这一轮的队列（到期的，最早到期在前），之后评分不改队列 */
const queue = ref<string[]>([])
const pos = ref(0)
const flipped = ref(false)
const reviewing = computed(() => route.query.review === '1')
const card = computed(() => vocab.entries.find((e) => e.id === queue.value[pos.value]) ?? null)
const finished = computed(() => reviewing.value && queue.value.length > 0 && pos.value >= queue.value.length)

function startReview(): void {
  void router.push({ path: route.path, query: { review: '1' } })
}
function exitReview(): void {
  void router.push({ path: route.path })
}
function buildQueue(): void {
  queue.value = [...due.value].sort((a, b) => (a.review?.due ?? '').localeCompare(b.review?.due ?? '')).map((e) => e.id)
  pos.value = 0
  flipped.value = false
}
// 进入复习时（含从「今天」页直达、列表加载完成）建队列
watch([reviewing, () => vocab.loaded], ([r, loaded]) => { if (r && loaded && queue.value.length === 0) buildQueue() }, { immediate: true })
watch(reviewing, (r) => { if (!r) queue.value = [] })

/** 挖空原句：把词换成下划线 */
function clozeContext(e: Cet6VocabEntry): string {
  const [a, w, b] = splitContext(e)
  return w ? `${a}${'_'.repeat(Math.min(12, Math.max(4, w.length)))}${b}` : ''
}

async function grade(g: Cet6VocabGrade): Promise<void> {
  const c = card.value
  if (!c || !flipped.value) return
  await vocab.grade(c.id, g)
  pos.value++
  flipped.value = false
}

function onKey(e: KeyboardEvent): void {
  if (!reviewing.value || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  if (e.key === 'Escape') { exitReview(); return }
  if (finished.value || !card.value) return
  if (e.key === ' ' && !flipped.value) { e.preventDefault(); flipped.value = true; return }
  const g = VOCAB_GRADES[Number(e.key) - 1]
  if (g && flipped.value) { e.preventDefault(); void grade(g) }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div v-if="reviewing" class="pg cv-review">
    <div class="cv-review-bar">
      <button type="button" class="cv-link" @click="exitReview"><MiIcon name="arrow-left" :size="14" />{{ CET6.VOCAB_REVIEW_EXIT }}</button>
      <span v-if="!finished && queue.length" class="pg-meta cv-num">{{ CET6.vocabReviewProgress(pos + 1, queue.length) }}</span>
    </div>
    <div v-if="queue.length" class="cv-progress" aria-hidden="true"><span :style="{ width: `${(pos / queue.length) * 100}%` }" /></div>

    <div v-if="finished || (vocab.loaded && queue.length === 0)" class="cv-done">
      <MiIcon name="circle-check" :size="28" />
      <h2>{{ CET6.VOCAB_REVIEW_DONE }}</h2>
      <p v-if="queue.length" class="pg-meta">{{ CET6.vocabReviewDone(queue.length) }}</p>
      <MiButton variant="primary" @click="exitReview">{{ CET6.VOCAB_BACK_LIST }}</MiButton>
    </div>

    <section v-else-if="card" :key="card.id" class="cv-card" :class="{ flipped }" aria-live="polite">
      <p class="cv-word" :class="{ sentence: card.kind === 'sentence' }" lang="en">{{ card.text }}</p>
      <p v-if="!flipped && clozeContext(card)" class="cv-ctx" lang="en">{{ clozeContext(card) }}</p>

      <template v-if="flipped">
        <div class="cv-back">
          <p v-if="card.gloss && (card.gloss.phonetic || card.gloss.pos)" class="pg-meta">{{ [card.gloss.phonetic, card.gloss.pos].filter(Boolean).join('  ') }}</p>
          <template v-if="card.gloss">
            <p v-if="card.gloss.meaning" class="cv-meaning">{{ card.gloss.meaning }}</p>
            <p v-if="card.gloss.translation" class="cv-meaning">{{ card.gloss.translation }}</p>
            <p v-if="card.gloss.collocations.length" class="pg-meta" lang="en">{{ card.gloss.collocations.join(' / ') }}</p>
          </template>
          <p v-else class="pg-meta">{{ CET6.VOCAB_NO_GLOSS }}</p>
          <p v-if="card.context" class="cv-ctx" lang="en">
            <template v-for="(part, i) in splitContext(card)" :key="i"><mark v-if="i === 1">{{ part }}</mark><template v-else>{{ part }}</template></template>
          </p>
          <p v-if="card.source" class="pg-meta">{{ sourceLabel(card) }}</p>
        </div>
        <div class="cv-grades">
          <button v-for="(g, i) in VOCAB_GRADES" :key="g" type="button" class="cv-grade" :data-grade="g" @click="grade(g)">
            <span class="cv-grade-label">{{ CET6.VOCAB_GRADE[g] }}<kbd>{{ i + 1 }}</kbd></span>
            <span class="cv-grade-hint">{{ CET6.VOCAB_GRADE_HINT[g] }}</span>
          </button>
        </div>
      </template>
      <MiButton v-else variant="primary" class="cv-show" @click="flipped = true">{{ CET6.VOCAB_SHOW }}</MiButton>
      <p class="pg-meta cv-keys">{{ CET6.VOCAB_REVIEW_KEYS }}</p>
    </section>
  </div>
  <div v-else class="pg cet6-vocab">
    <div class="pg-head">
      <h1 class="page-title pg-title">{{ CET6.VOCAB_TITLE }}</h1>
      <div class="cv-head-actions">
        <label class="pg-search">
          <MiIcon name="search" :size="14" />
          <input v-model="query" type="search" :placeholder="CET6.VOCAB_SEARCH" :aria-label="CET6.VOCAB_SEARCH" />
        </label>
        <MiButton variant="primary" icon="play" :disabled="due.length === 0" data-action="start-review" @click="startReview">
          {{ CET6.vocabStartReview(due.length) }}
        </MiButton>
      </div>
    </div>

    <div class="pg-toolbar">
      <div class="pg-chips" role="group" :aria-label="CET6.VOCAB_FILTER_LABEL">
        <button
          v-for="f in FILTERS"
          :key="f"
          type="button"
          class="pg-chip"
          :class="{ active: filter === f }"
          :aria-pressed="filter === f"
          @click="filter = f"
        >
          {{ CET6.VOCAB_FILTER[f] }}<span v-if="filterCount(f) !== null" class="cv-chip-num">{{ filterCount(f) }}</span>
        </button>
      </div>
      <MiSelect v-if="examOptions.length > 2" v-model="exam" :options="examOptions" />
    </div>

    <div v-if="shown.length === 0" class="pg-empty">
      <p>{{ vocab.entries.length === 0 ? CET6.VOCAB_EMPTY : CET6.VOCAB_NO_MATCH }}</p>
    </div>

    <div v-if="groups.length" class="cv-groups">
    <section v-for="g in groups" :key="g.label" class="cv-group">
      <h2 class="cv-group-label">{{ g.label }}</h2>
      <div class="pg-rows">
        <div v-for="e in g.items" :key="e.id" class="cv-item" :class="{ open: open === e.id, mastered: e.mastered }" :data-entry="e.id">
          <button type="button" class="cv-row" :aria-expanded="open === e.id" @click="open = open === e.id ? null : e.id">
            <span class="cv-row-word" :class="{ sentence: e.kind === 'sentence' }" lang="en">{{ e.text }}</span>
            <span v-if="e.kind === 'word' && e.gloss?.phonetic" class="cv-row-ph">{{ e.gloss.phonetic }}</span>
            <span class="cv-row-gloss" :class="{ empty: !shortGloss(e) }">{{ shortGloss(e) || CET6.VOCAB_NO_GLOSS }}</span>
            <span v-if="isVocabDue(e, today)" class="cv-tag">{{ CET6.VOCAB_DUE_TAG }}</span>
            <MiIcon v-else-if="e.mastered" name="circle-check" :size="14" class="cv-row-ok" />
            <MiIcon name="chevron-right" :size="14" class="cv-row-chev" />
          </button>

          <div v-if="open === e.id" class="cv-detail">
            <p v-if="e.gloss?.pos" class="pg-meta">{{ e.gloss.pos }}</p>
            <template v-if="e.gloss">
              <p v-if="e.gloss.meaning" class="cv-meaning">{{ e.gloss.meaning }}</p>
              <p v-if="e.gloss.translation" class="cv-meaning">{{ e.gloss.translation }}</p>
              <p v-if="e.gloss.collocations.length" class="pg-meta" lang="en">{{ e.gloss.collocations.join(' / ') }}</p>
              <ul v-if="e.gloss.structure.length" class="pg-meta cv-structure">
                <li v-for="(line, i) in e.gloss.structure" :key="i">{{ line }}</li>
              </ul>
            </template>
            <p v-if="e.context" class="cv-ctx" lang="en">
              <template v-for="(part, i) in splitContext(e)" :key="i"><mark v-if="i === 1">{{ part }}</mark><template v-else>{{ part }}</template></template>
            </p>
            <div class="cv-actions">
              <MiButton v-if="e.source" size="sm" icon="external" @click="openSource(e)">{{ CET6.VOCAB_OPEN_SOURCE }}</MiButton>
              <MiButton v-if="!e.gloss" size="sm" icon="sparkles" :disabled="busy.has(e.id)" @click="lookup(e)">
                {{ busy.has(e.id) ? CET6.VOCAB_LOOKUP_BUSY : CET6.VOCAB_LOOKUP }}
              </MiButton>
              <MiButton size="sm" icon="circle-check" :aria-pressed="e.mastered" @click="vocab.setMastered(e.id, !e.mastered)">
                {{ e.mastered ? CET6.VOCAB_UNMASTERED : CET6.VOCAB_MASTERED }}
              </MiButton>
              <span class="cv-spacer" />
              <span v-if="e.source" class="pg-meta">{{ sourceLabel(e) }}</span>
              <MiButton size="sm" variant="ghost" icon="trash" :aria-label="CET6.VOCAB_DELETE" @click="vocab.removeWithUndo(e)">{{ CET6.VOCAB_DELETE }}</MiButton>
            </div>
          </div>
        </div>
      </div>
    </section>
    </div>
  </div>
</template>

<style scoped>
.cv-head-actions { display: flex; align-items: center; gap: var(--mi-sp-2); flex-wrap: wrap; }
.cv-chip-num { margin-left: 4px; color: var(--mi-text-3); font-variant-numeric: tabular-nums; }
.pg-chip.active .cv-chip-num { color: inherit; }

/* 分组：日期小标题 + 行 */
.cv-groups { display: flex; flex-direction: column; gap: 20px; }
.cv-group-label { margin: 0 0 var(--mi-sp-1); font-size: var(--mi-fs-caption); font-weight: 500; color: var(--mi-text-3); }
.cv-item { border-bottom: 1px solid var(--mi-border); }
.cv-item:last-child { border-bottom: 0; }
.cv-row {
  display: flex; align-items: baseline; gap: var(--mi-sp-3); width: 100%; min-height: var(--mi-row-h); padding: var(--mi-sp-2) var(--mi-sp-1);
  border: 0; border-radius: 6px; background: transparent; color: var(--mi-text); font: inherit; text-align: left; cursor: pointer;
  transition: background-color var(--mi-dur-fast) var(--mi-ease);
}
.cv-row:hover { background: var(--mi-blue-light); }
.cv-row:focus-visible { outline: 2px solid var(--mi-border-control); outline-offset: -2px; }
.cv-row-word { flex: 0 1 auto; min-width: 0; font-family: var(--mi-font-serif); font-size: var(--mi-fs-read); font-weight: 500; overflow-wrap: anywhere; }
.cv-row-word.sentence { flex: 1 1 60%; font-size: var(--mi-fs-body); font-weight: 400; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cv-row-ph { flex-shrink: 0; color: var(--mi-text-3); font-size: var(--mi-fs-caption); }
.cv-row-gloss { flex: 1 1 0; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--mi-text-2); font-size: var(--mi-fs-label); }
.cv-row-gloss.empty { color: var(--mi-text-3); }
.cv-tag { flex-shrink: 0; padding: 1px 8px; border-radius: 999px; background: var(--mi-warn-fill); color: var(--mi-warn-deep); font-size: var(--mi-fs-caption); }
.cv-row-ok { flex-shrink: 0; color: var(--mi-success-deep); align-self: center; }
.cv-row-chev { flex-shrink: 0; align-self: center; color: var(--mi-text-3); transition: transform var(--mi-dur-fast) var(--mi-ease); }
.cv-item.open .cv-row-chev { transform: rotate(90deg); }
.cv-item.mastered .cv-row-word { color: var(--mi-text-2); }

.cv-detail { display: flex; flex-direction: column; gap: 4px; padding: 0 var(--mi-sp-1) var(--mi-sp-3); }
.cv-meaning { margin: 0; font-size: var(--mi-fs-body); line-height: 1.6; }
.cv-structure { margin: 0; padding-left: var(--mi-sp-4); }
.cv-ctx { margin: 4px 0 0; font-family: var(--mi-font-serif); font-size: var(--mi-fs-label); line-height: 1.7; color: var(--mi-text-2); }
.cv-ctx mark { padding: 0 2px; border-radius: 3px; background: var(--mi-warn-fill); color: var(--mi-text); }
.cv-actions { display: flex; align-items: center; flex-wrap: wrap; gap: var(--mi-sp-2); margin-top: var(--mi-sp-2); }
.cv-spacer { flex: 1; }
.cv-link { display: inline-flex; align-items: center; gap: 4px; padding: 0; border: 0; background: transparent; color: var(--mi-text-2); font: var(--mi-fs-label) var(--mi-font-family); cursor: pointer; }
.cv-link:hover { color: var(--mi-text); }

/* 翻卡 */
.cv-review { max-width: 640px; margin-inline: auto; }
.cv-review-bar { display: flex; align-items: center; justify-content: space-between; }
.cv-num { font-variant-numeric: tabular-nums; }
.cv-progress { height: 3px; margin: var(--mi-sp-2) 0 var(--mi-sp-6); border-radius: 999px; background: var(--mi-border); overflow: hidden; }
.cv-progress span { display: block; height: 100%; background: var(--mi-blue-deep); transition: width var(--mi-dur-slow) var(--mi-ease-out); }
.cv-card { display: flex; flex-direction: column; align-items: center; gap: var(--mi-sp-3); padding: var(--mi-sp-8) var(--mi-sp-6); border: 1px solid var(--mi-border); border-radius: 14px; background: var(--mi-card); text-align: center; }
.cv-word { margin: 0; font-family: var(--mi-font-serif); font-size: var(--mi-fs-hero); font-weight: 500; line-height: 1.25; overflow-wrap: anywhere; }
.cv-word.sentence { font-size: var(--mi-fs-read); font-weight: 400; line-height: 1.6; }
.cv-card .cv-ctx { max-width: 52ch; }
.cv-back { display: flex; flex-direction: column; align-items: center; gap: 6px; width: 100%; padding-top: var(--mi-sp-3); border-top: 1px dashed var(--mi-border); animation: cv-in var(--mi-dur-slow) var(--mi-ease-out) both; }
@keyframes cv-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.cv-show { margin-top: var(--mi-sp-2); }
.cv-grades { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--mi-sp-2); width: 100%; margin-top: var(--mi-sp-2); }
.cv-grade { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 10px var(--mi-sp-2); border: 1px solid var(--mi-border); border-radius: 10px; background: var(--mi-card); font: inherit; cursor: pointer; transition: border-color var(--mi-dur-fast) var(--mi-ease), background-color var(--mi-dur-fast) var(--mi-ease), transform 60ms var(--mi-ease-out); }
.cv-grade:active { transform: scale(0.97); }
.cv-grade:focus-visible { outline: 2px solid var(--mi-border-control); outline-offset: 2px; }
.cv-grade[data-grade='again']:hover { border-color: var(--mi-error-deep); background: var(--mi-error-fill, var(--mi-blue-light)); }
.cv-grade[data-grade='hard']:hover { border-color: var(--mi-warn-edge); background: var(--mi-warn-fill); }
.cv-grade[data-grade='good']:hover { border-color: var(--mi-success-deep); background: var(--mi-success-fill); }
.cv-grade-label { display: inline-flex; align-items: center; gap: 6px; font-size: var(--mi-fs-body); font-weight: 500; color: var(--mi-text); }
.cv-grade-label kbd { padding: 0 5px; border: 1px solid var(--mi-border); border-radius: 4px; font: var(--mi-fs-caption) var(--mi-font-family); color: var(--mi-text-3); }
.cv-grade-hint { font-size: var(--mi-fs-caption); color: var(--mi-text-3); }
.cv-keys { margin-top: var(--mi-sp-2); }
.cv-done { display: flex; flex-direction: column; align-items: center; gap: var(--mi-sp-3); padding: var(--mi-sp-8) 0; color: var(--mi-success-deep); text-align: center; }
.cv-done h2 { margin: 0; color: var(--mi-text); font-size: var(--mi-fs-title); font-weight: 500; }

@media (max-width: 560px) {
  .cv-row-ph { display: none; }
  .cv-card { padding: var(--mi-sp-6) var(--mi-sp-3); }
  .cv-word { font-size: var(--mi-fs-title); }
  .cv-keys { display: none; }
}
</style>
