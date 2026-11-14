<script setup lang="ts">
/** 六级真题目录：按「年 月」分组，每套一枚小片；已交卷显示对勾，作答中显示已答题数 */
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCet6Store } from '../stores/cet6'
import { useCet6VocabStore } from '../stores/cet6-vocab'
import { CET6 } from '../lib/copy'
import { isRemote } from '../lib/asset-base'

const remote = isRemote()
import MiButton from '../components/base/MiButton.vue'
import MiIcon from '../components/base/MiIcon.vue'
import type { Cet6Meta } from '../../../shared/cet6'

const cet6 = useCet6Store()
const vocab = useCet6VocabStore()
const router = useRouter()

onMounted(() => {
  void cet6.loadState()
  void vocab.load()
  if (!cet6.catalogLoaded) void cet6.loadCatalog()
})

const rows = computed(() => {
  const map = new Map<string, { label: string; metas: Cet6Meta[] }>()
  for (const m of cet6.metas) {
    const label = CET6.yearMonth(m.year, m.month)
    if (!map.has(label)) map.set(label, { label, metas: [] })
    map.get(label)!.metas.push(m)
  }
  return [...map.values()]
})

function inProgressExam(id: string): boolean {
  const r = cet6.records[id]
  return !!r && r.mode === 'exam' && !r.submitted
}

function chipLabel(m: Cet6Meta): string {
  return [m.title, cet6.records[m.id]?.submitted ? CET6.STATE_SUBMITTED : '', inProgressExam(m.id) ? CET6.MODE_EXAM_TIP : ''].filter(Boolean).join(', ')
}

function open(m: Cet6Meta): void {
  void router.push({ path: `/cet6/${m.id}`, query: { mode: cet6.lastMode } })
}

function answered(id: string): number {
  return Object.values(cet6.records[id]?.answers ?? {}).filter((v) => v.trim() !== '').length
}
</script>

<template>
  <div class="pg cet6-catalog">
    <div class="pg-head">
      <h1 class="page-title pg-title">{{ CET6.TITLE }}</h1>
      <div class="pg-actions">
        <button type="button" class="icon-btn cet6-vocab-btn" :title="CET6.vocabBtn(vocab.entries.length)" :aria-label="CET6.vocabBtn(vocab.entries.length)" @click="router.push('/cet6/vocab')">
          <MiIcon name="book" :size="16" /><span v-if="vocab.entries.length" class="pg-count">{{ vocab.entries.length }}</span>
        </button>
        <button v-if="!remote" type="button" class="icon-btn" :title="CET6.MEDIA_BTN" :aria-label="CET6.MEDIA_BTN" @click="cet6.pickMediaRoot()">
          <MiIcon name="folder" :size="16" />
        </button>
      </div>
    </div>

    <div class="cet6-mode-row">
      <div class="pg-chips" role="group" :aria-label="CET6.MODE_LABEL">
        <button type="button" class="pg-chip" :class="{ active: cet6.lastMode === 'practice' }" :aria-pressed="cet6.lastMode === 'practice'" data-mode="practice" @click="cet6.setLastMode('practice')">{{ CET6.MODE_PRACTICE }}</button>
        <button type="button" class="pg-chip" :class="{ active: cet6.lastMode === 'exam' }" :aria-pressed="cet6.lastMode === 'exam'" data-mode="exam" @click="cet6.setLastMode('exam')">{{ CET6.MODE_EXAM }}</button>
      </div>
      <p class="pg-meta">{{ cet6.lastMode === 'exam' ? CET6.MODE_EXAM_DESC : CET6.MODE_PRACTICE_DESC }}</p>
    </div>

    <div v-if="!cet6.media.ok" class="mi-alert-error" role="status">
      <span>{{ remote ? CET6.MEDIA_MISSING_REMOTE : CET6.MEDIA_MISSING }}</span>
      <MiButton v-if="!remote" size="sm" @click="cet6.pickMediaRoot()">{{ CET6.MEDIA_PICK }}</MiButton>
    </div>
    <p v-else-if="cet6.media.root && !remote" class="pg-meta">{{ CET6.mediaRoot(cet6.media.root) }}</p>

    <p v-if="cet6.catalogError" class="mi-alert-error" role="alert">{{ cet6.catalogError }}</p>
    <div v-else-if="cet6.catalogLoaded && rows.length === 0" class="pg-empty"><p>{{ CET6.CATALOG_EMPTY }}</p></div>

    <div class="pg-rows">
      <div v-for="row in rows" :key="row.label" class="pg-row cet6-row">
        <span class="cet6-date">{{ row.label }}</span>
        <div class="pg-chips">
          <button
            v-for="m in row.metas"
            :key="m.id"
            type="button"
            class="pg-chip"
            :data-exam="m.id"
            :title="m.title"
            :aria-label="chipLabel(m)"
            @click="open(m)"
          >
            {{ CET6.setLabel(m.set) }}
            <MiIcon v-if="inProgressExam(m.id)" name="clock" :size="14" />
            <MiIcon v-if="cet6.records[m.id]?.submitted" name="circle-check" :size="14" />
            <span v-else-if="answered(m.id) > 0" class="pg-count">{{ answered(m.id) }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cet6-mode-row { display: flex; flex-direction: column; gap: var(--mi-sp-2); margin-top: -8px; }
.cet6-vocab-btn { width: auto; gap: var(--mi-sp-1); padding: 0 var(--mi-sp-2); }
.cet6-date { flex: 0 0 96px; font-size: var(--mi-fs-body); color: var(--mi-text-2); font-variant-numeric: tabular-nums; }
.cet6-row { align-items: center; }
</style>
