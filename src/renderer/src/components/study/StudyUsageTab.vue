<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useStudyStore } from '../../stores/study'
import type { StudyQuota, StudyUsageRecord } from '../../../../shared/study-companion'
import { STUDY_COPY } from '../../lib/study-copy'
import MiIcon from '../base/MiIcon.vue'

const study = useStudyStore()

const isRefreshing = ref(false)
const actionError = ref<string | null>(null)

onMounted(() => {
  void refreshUsage(false)
})

const quotas = computed<StudyQuota[]>(() => study.usage?.quotas ?? [])
const records = computed<StudyUsageRecord[]>(() => study.usage?.records ?? [])

async function refreshUsage(force = true): Promise<void> {
  isRefreshing.value = true
  actionError.value = null
  const res = await study.getUsage(force)
  isRefreshing.value = false
  if (!res.ok) {
    actionError.value = res.error
  }
}

/** 未报告不等于 0，用破折号占位，悬停看原因 */
function formatTokenVal(val: number | null): string {
  if (val === null || val === undefined) return '—'
  return val.toLocaleString()
}

const totals = computed(() => study.tokenTotals)
const segments = computed(() => [
  { key: 'input', icon: 'arrow-up', label: STUDY_COPY.USAGE.NEW_INPUT, value: totals.value.uncachedInput },
  { key: 'cached', icon: 'zap', label: STUDY_COPY.USAGE.COL_CACHED, value: totals.value.cachedInput },
  { key: 'output', icon: 'arrow-down', label: STUDY_COPY.USAGE.COL_OUTPUT, value: totals.value.output }
] as const)
const hasCost = computed(() => records.value.some((r) => r.costUsd !== undefined))

function formatRemaining(quota: StudyQuota): string {
  if (quota.remaining === null || quota.remaining === undefined) {
    return quota.detail || STUDY_COPY.USAGE.QUOTA_REMAINING_NULL
  }
  return `${quota.remaining.toLocaleString()} ${quota.unit}`
}

function formatTime(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<template>
  <div class="study-usage-pane pg">
    <div v-if="actionError" class="mi-alert-error" role="alert">
      <span>{{ actionError }}</span>
      <button type="button" class="alert-close-btn" :aria-label="STUDY_COPY.COMMON.CLOSE" @click="actionError = null"><MiIcon name="x" :size="14" /></button>
    </div>

    <section class="usage-top">
      <div class="balances">
        <div
          v-for="q in quotas"
          :key="q.provider + q.label"
          class="balance"
          :title="[q.source && STUDY_COPY.USAGE.SOURCE_LABEL + q.source, STUDY_COPY.USAGE.UPDATED_LABEL + formatTime(q.updatedAt)].filter(Boolean).join('\n')"
        >
          <div v-if="q.remaining !== null && q.remaining !== undefined" class="balance-val">{{ formatRemaining(q) }}</div>
          <div v-else class="balance-note">{{ formatRemaining(q) }}</div>
          <div class="pg-meta">
            <span class="pg-meta-item"><MiIcon name="wallet" :size="13" />{{ q.provider }} {{ q.label }}</span>
            <span v-if="q.resetsAt">{{ STUDY_COPY.USAGE.RESET_CYCLE_LABEL }}{{ q.resetsAt }}</span>
          </div>
        </div>
        <div v-if="quotas.length === 0" class="pg-meta">
          <span class="pg-meta-item"><MiIcon name="wallet" :size="14" />{{ STUDY_COPY.USAGE.QUOTA_REMAINING_NULL }}</span>
        </div>
      </div>
      <button
        type="button"
        class="icon-btn"
        :title="STUDY_COPY.USAGE.REFRESH_USAGE"
        :aria-label="STUDY_COPY.USAGE.REFRESH_USAGE"
        :disabled="isRefreshing"
        @click="refreshUsage(true)"
      >
        <span v-if="isRefreshing" class="mini-spinner mi-motion-keep" />
        <MiIcon v-else name="refresh" />
      </button>
    </section>

    <section v-if="records.length > 0" class="token-meter" :aria-label="STUDY_COPY.USAGE.TOTAL_TOKENS">
      <div class="token-total">
        <span class="token-total-num">{{ totals.total.toLocaleString() }}</span>
        <span class="pg-meta">{{ STUDY_COPY.USAGE.TOTAL_TOKENS }}</span>
      </div>
      <div class="meter-bar" aria-hidden="true">
        <span v-for="s in segments" v-show="s.value > 0" :key="s.key" class="meter-seg" :class="s.key" :style="{ flexGrow: s.value }" />
      </div>
      <div class="pg-meta">
        <span v-for="s in segments" :key="s.key" class="pg-meta-item legend" :class="s.key">
          <MiIcon :name="s.icon" :size="13" />{{ s.label }} {{ s.value.toLocaleString() }}
        </span>
      </div>
    </section>

    <section class="pg-section">
      <h3 class="pg-section-title">{{ STUDY_COPY.USAGE.RECORDS_TITLE }}</h3>
      <div v-if="records.length === 0" class="pg-empty">
        <MiIcon name="chart" :size="24" />
        <p>{{ STUDY_COPY.USAGE.EMPTY_RECORDS }}</p>
      </div>
      <div v-else class="records-table-wrap">
        <table class="records-table">
          <thead>
            <tr>
              <th>{{ STUDY_COPY.USAGE.COL_TIME }}</th>
              <th>{{ STUDY_COPY.USAGE.COL_PROVIDER }}</th>
              <th>{{ STUDY_COPY.USAGE.COL_SESSION }}</th>
              <th class="num" :title="STUDY_COPY.USAGE.INPUT_TOKENS" :aria-label="STUDY_COPY.USAGE.INPUT_TOKENS"><MiIcon class="th-icon" name="arrow-up" :size="13" /></th>
              <th class="num" :title="STUDY_COPY.USAGE.CACHED_INPUT_TOKENS" :aria-label="STUDY_COPY.USAGE.CACHED_INPUT_TOKENS"><MiIcon class="th-icon" name="zap" :size="13" /></th>
              <th class="num" :title="STUDY_COPY.USAGE.OUTPUT_TOKENS" :aria-label="STUDY_COPY.USAGE.OUTPUT_TOKENS"><MiIcon class="th-icon" name="arrow-down" :size="13" /></th>
              <th class="num">{{ STUDY_COPY.USAGE.COL_TOTAL }}</th>
              <th v-if="hasCost" class="num">{{ STUDY_COPY.USAGE.ESTIMATED_COST_COL }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in records" :key="r.id">
              <td class="col-dim">{{ formatTime(r.at) }}</td>
              <td :title="r.provider">{{ r.model }}</td>
              <td class="col-dim col-session">{{ r.sessionId === 'study-main' ? STUDY_COPY.USAGE.MAIN_SESSION_LABEL : r.sessionId }}</td>
              <td class="num" :title="r.inputTokens === null ? STUDY_COPY.USAGE.TOKENS_UNKNOWN : undefined">{{ formatTokenVal(r.inputTokens) }}</td>
              <td class="num" :title="r.cachedInputTokens === null ? STUDY_COPY.USAGE.TOKENS_UNKNOWN : undefined">{{ formatTokenVal(r.cachedInputTokens) }}</td>
              <td class="num" :title="r.outputTokens === null ? STUDY_COPY.USAGE.TOKENS_UNKNOWN : undefined">{{ formatTokenVal(r.outputTokens) }}</td>
              <td class="num col-total" :title="r.totalTokens === null ? STUDY_COPY.USAGE.TOKENS_UNKNOWN : undefined">{{ formatTokenVal(r.totalTokens) }}</td>
              <td v-if="hasCost" class="num" :title="r.costUsd === undefined ? STUDY_COPY.USAGE.COST_UNPRICED : undefined">{{ r.costUsd !== undefined ? `$${r.costUsd.toFixed(4)}` : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.usage-top { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--mi-sp-4); }
.balances { display: flex; flex-wrap: wrap; gap: var(--mi-sp-4) 40px; min-width: 0; }
.balance { display: flex; flex-direction: column; gap: var(--mi-sp-1); min-width: 0; }
.balance-val { font-family: var(--mi-font-serif); font-size: var(--mi-fs-title); line-height: 1.15; color: var(--mi-blue-deep); font-variant-numeric: tabular-nums; }
.balance-note { max-width: 56ch; font-size: var(--mi-fs-label); line-height: 1.6; color: var(--mi-text-2); }
.token-meter { display: flex; flex-direction: column; gap: var(--mi-sp-2); padding-block: var(--mi-sp-4); border-block: 1px solid var(--mi-border); }
.token-total { display: flex; align-items: baseline; gap: var(--mi-sp-2); }
.token-total-num { font-size: var(--mi-fs-title); font-weight: 500; color: var(--mi-text); font-variant-numeric: tabular-nums; }
.meter-bar { display: flex; gap: 2px; height: 8px; border-radius: 4px; overflow: hidden; background: var(--mi-blue-light); }
.meter-seg { flex-basis: 0; min-width: 3px; }
.meter-seg.input { background: var(--mi-blue-deep); }
.meter-seg.cached { background: color-mix(in srgb, var(--mi-blue-deep) 35%, var(--mi-card)); }
.meter-seg.output { background: var(--mi-text-2); }
.legend.input { color: var(--mi-blue-deep); }
.legend.output { color: var(--mi-text-2); }
.records-table-wrap { overflow-x: auto; }
.records-table { width: 100%; border-collapse: collapse; font-size: var(--mi-fs-label); text-align: left; }
.records-table th { padding: var(--mi-sp-2) var(--mi-sp-3) var(--mi-sp-2) 0; font-size: var(--mi-fs-caption); font-weight: 400; color: var(--mi-text-3); border-bottom: 1px solid var(--mi-border); white-space: nowrap; }
.th-icon { margin-left: auto; }
.records-table td { padding: var(--mi-sp-3) var(--mi-sp-3) var(--mi-sp-3) 0; border-bottom: 1px solid var(--mi-border); color: var(--mi-text); white-space: nowrap; }
.records-table tr:last-child td { border-bottom: 0; }
.records-table th:last-child, .records-table td:last-child { padding-right: 0; }
.records-table .num { text-align: right; font-variant-numeric: tabular-nums; }
.records-table .col-dim { color: var(--mi-text-2); }
.col-session { max-width: 140px; overflow: hidden; text-overflow: ellipsis; }
.col-total { font-weight: 500; }
.mini-spinner { width: 14px; height: 14px; border: 2px solid var(--mi-border); border-top-color: var(--mi-blue-deep); border-radius: 50%; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
