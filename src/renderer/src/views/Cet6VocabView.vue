<script setup lang="ts">
/** 六级生词本（docs/27 §8.3）：筛选 + 搜索 + 自测遮罩；删除走 toast 撤销，不弹确认 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useCet6VocabStore } from '../stores/cet6-vocab'
import { toast } from '../components/base/toast'
import { CET6 } from '../lib/copy'
import type { Cet6VocabEntry } from '../../../shared/cet6-vocab'
import MiIcon from '../components/base/MiIcon.vue'

type Filter = 'all' | 'word' | 'sentence' | 'open'

const router = useRouter()
const vocab = useCet6VocabStore()

const filter = ref<Filter>('all')
const query = ref('')
const masked = ref(false)
const revealed = ref<Set<string>>(new Set())
const busy = ref<Set<string>>(new Set())

onMounted(() => void vocab.load())
onBeforeUnmount(() => void vocab.flushPending())

const FILTERS: Filter[] = ['all', 'word', 'sentence', 'open']

function glossText(e: Cet6VocabEntry): string {
  const g = e.gloss
  return g ? [g.meaning, g.translation, ...g.collocations, ...g.structure].join(' ') : ''
}

const shown = computed(() => {
  const q = query.value.trim().toLowerCase()
  return vocab.entries.filter((e) => {
    if (filter.value === 'word' && e.kind !== 'word') return false
    if (filter.value === 'sentence' && e.kind !== 'sentence') return false
    if (filter.value === 'open' && e.mastered) return false
    return !q || e.text.toLowerCase().includes(q) || glossText(e).toLowerCase().includes(q)
  })
})

function toggleMask(): void {
  masked.value = !masked.value
  revealed.value = new Set()
}
function reveal(id: string): void {
  revealed.value = new Set(revealed.value).add(id)
}
const hidden = (e: Cet6VocabEntry): boolean => masked.value && !revealed.value.has(e.id)

/** 所在句拆成 前 / 原文 / 后，原文加粗；找不到原文就整句当前文 */
function splitContext(e: Cet6VocabEntry): [string, string, string] {
  const at = e.context.toLowerCase().indexOf(e.text.toLowerCase())
  if (at < 0) return [e.context, '', '']
  return [e.context.slice(0, at), e.context.slice(at, at + e.text.length), e.context.slice(at + e.text.length)]
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
</script>

<template>
  <div class="pg cet6-vocab">
    <div class="pg-head">
      <h1 class="page-title pg-title">
        {{ CET6.VOCAB_TITLE }} <span class="pg-count">{{ CET6.vocabCount(vocab.entries.length) }}</span>
      </h1>
      <div class="pg-actions">
        <button type="button" class="pg-chip" :class="{ active: masked }" :aria-pressed="masked" data-action="mask" @click="toggleMask">
          {{ CET6.VOCAB_MASK }}
        </button>
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
          {{ CET6.VOCAB_FILTER[f] }}
        </button>
      </div>
      <label class="pg-search">
        <MiIcon name="search" :size="14" />
        <input v-model="query" type="search" :placeholder="CET6.VOCAB_SEARCH" :aria-label="CET6.VOCAB_SEARCH" />
      </label>
    </div>

    <div v-if="shown.length === 0" class="pg-empty">
      <p>{{ vocab.entries.length === 0 ? CET6.VOCAB_EMPTY : CET6.VOCAB_NO_MATCH }}</p>
    </div>

    <div v-else class="pg-rows">
      <div v-for="e in shown" :key="e.id" class="pg-row cet6-v-row" :data-entry="e.id">
        <div class="pg-row-main">
          <div class="cet6-v-head">
            <span class="cet6-v-text" :class="{ sentence: e.kind === 'sentence' }" lang="en">{{ e.text }}</span>
            <span v-if="e.gloss && (e.gloss.phonetic || e.gloss.pos)" class="pg-meta">{{ [e.gloss.phonetic, e.gloss.pos].filter(Boolean).join('  ') }}</span>
          </div>

          <template v-if="e.gloss">
            <button v-if="hidden(e)" type="button" class="cet6-v-reveal" @click="reveal(e.id)">{{ CET6.VOCAB_REVEAL }}</button>
            <div v-else class="cet6-v-gloss">
              <p v-if="e.gloss.meaning">{{ e.gloss.meaning }}</p>
              <p v-if="e.gloss.translation">{{ e.gloss.translation }}</p>
              <p v-if="e.gloss.collocations.length" class="pg-meta" lang="en">{{ e.gloss.collocations.join(' / ') }}</p>
              <ul v-if="e.gloss.structure.length" class="pg-meta cet6-v-structure">
                <li v-for="(line, i) in e.gloss.structure" :key="i">{{ line }}</li>
              </ul>
            </div>
          </template>

          <p v-if="e.context" class="cet6-v-ctx" lang="en">
            <template v-for="(part, i) in splitContext(e)" :key="i">
              <b v-if="i === 1">{{ part }}</b><template v-else>{{ part }}</template>
            </template>
          </p>
          <p v-if="e.source" class="pg-meta">
            <button type="button" class="cet6-v-source" @click="openSource(e)">{{ sourceLabel(e) }}</button>
          </p>
        </div>

        <div class="pg-row-actions">
          <button
            v-if="!e.gloss"
            type="button"
            class="icon-btn"
            :disabled="busy.has(e.id)"
            :title="busy.has(e.id) ? CET6.VOCAB_LOOKUP_BUSY : CET6.VOCAB_LOOKUP"
            :aria-label="busy.has(e.id) ? CET6.VOCAB_LOOKUP_BUSY : CET6.VOCAB_LOOKUP"
            @click="lookup(e)"
          >
            <MiIcon name="sparkles" :size="16" />
          </button>
          <button
            type="button"
            class="icon-btn"
            :class="{ active: e.mastered }"
            :aria-pressed="e.mastered"
            :title="e.mastered ? CET6.VOCAB_UNMASTERED : CET6.VOCAB_MASTERED"
            :aria-label="e.mastered ? CET6.VOCAB_UNMASTERED : CET6.VOCAB_MASTERED"
            @click="vocab.setMastered(e.id, !e.mastered)"
          >
            <MiIcon name="circle-check" :size="16" />
          </button>
          <button type="button" class="icon-btn danger" :title="CET6.VOCAB_DELETE" :aria-label="CET6.VOCAB_DELETE" @click="vocab.removeWithUndo(e)">
            <MiIcon name="trash" :size="16" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cet6-v-row { align-items: flex-start; }
.cet6-v-head { display: flex; align-items: baseline; flex-wrap: wrap; gap: var(--mi-sp-1) var(--mi-sp-3); }
.cet6-v-text { font-family: var(--mi-font-serif); font-size: var(--mi-fs-read); font-weight: 500; overflow-wrap: anywhere; }
.cet6-v-text.sentence { font-size: var(--mi-fs-body); font-weight: 400; line-height: 1.6; }
.cet6-v-gloss p { margin: 0 0 2px; font-size: var(--mi-fs-body); }
.cet6-v-gloss p.pg-meta { font-size: var(--mi-fs-caption); }
.cet6-v-structure { margin: 0; padding-left: var(--mi-sp-4); flex-direction: column; align-items: flex-start; }
.cet6-v-reveal { align-self: flex-start; padding: 0; border: 0; background: transparent; color: var(--mi-text-3); font: var(--mi-fs-label) var(--mi-font-family); cursor: pointer; text-decoration: underline; }
.cet6-v-reveal:focus-visible, .cet6-v-source:focus-visible { outline: 2px solid var(--mi-blue-deep); outline-offset: 1px; }
.cet6-v-ctx { margin: 2px 0 0; font-family: var(--mi-font-serif); font-size: var(--mi-fs-label); line-height: 1.6; color: var(--mi-text-2); }
.cet6-v-ctx b { color: var(--mi-text); font-weight: 500; }
.cet6-v-source { padding: 0; border: 0; background: transparent; color: var(--mi-text-3); font: inherit; cursor: pointer; }
.cet6-v-source:hover { color: var(--mi-blue-deep); text-decoration: underline; }
</style>
