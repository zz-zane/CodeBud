<script setup lang="ts">
/**
 * 诊断卡 —— 真跑题型「没做对」时，界面上的辅助提示
 */
import { computed } from 'vue'
import type { RunDiagnosisView } from '../../../lib/run-diagnosis'
import { QUIZ } from '../../../lib/copy'

const props = defineProps<{ diagnosis: RunDiagnosisView }>()

const head = computed(() => {
  if (props.diagnosis.kind === 'output') return QUIZ.OUTPUT_TITLE
  return QUIZ.FAIL_TITLE
})

const body = computed(() => {
  if (props.diagnosis.kind === 'output') return QUIZ.OUTPUT_BODY
  return QUIZ.failDiagnosis(props.diagnosis.failKind ?? 'run', props.diagnosis.line)
})
</script>

<template>
  <div class="run-diag">
    <div class="diag-icon" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    </div>
    <div class="diag-body">
      <div class="diag-title">{{ head }}</div>
      <div class="diag-said">{{ body }}</div>

      <div v-if="diagnosis.kind === 'output'" class="diag-pair">
        <div class="pair-row">
          <span class="pair-label">{{ QUIZ.DIAG_EXPECTED }}</span>
          <pre class="pair-text want">{{ diagnosis.expected }}</pre>
        </div>
        <div class="pair-row">
          <span class="pair-label">{{ QUIZ.DIAG_ACTUAL }}</span>
          <pre class="pair-text got">{{ diagnosis.actual }}</pre>
        </div>
      </div>

      <div class="diag-next">{{ QUIZ.DIAG_TRY_AGAIN }}</div>
    </div>
  </div>
</template>

<style scoped>
.run-diag {
  display: flex;
  align-items: flex-start;
  gap: var(--mi-sp-3);
  padding: var(--mi-sp-3) var(--mi-sp-4);
  border-radius: var(--mi-radius-sm);
  background: color-mix(in srgb, var(--mi-warn) 14%, var(--mi-card));
  border: 1px solid color-mix(in srgb, var(--mi-warn) 45%, var(--mi-border));
  border-left: 4px solid var(--mi-warn-deep);
  font-size: var(--mi-fs-label);
  line-height: 1.8;
}
.diag-icon {
  flex-shrink: 0;
  color: var(--mi-warn-deep);
  margin-top: 2px;
}
.diag-body {
  flex: 1;
  min-width: 0;
}
.diag-title {
  font-weight: 500;
  color: var(--mi-warn-deep);
}
.diag-said {
  margin-top: 2px;
  color: var(--mi-text);
}

.diag-pair {
  margin-top: var(--mi-sp-2);
  padding-top: var(--mi-sp-2);
  border-top: 1px dashed color-mix(in srgb, var(--mi-warn) 45%, var(--mi-border));
}
.pair-row {
  display: flex;
  align-items: baseline;
  gap: var(--mi-sp-2);
}
.pair-row + .pair-row {
  margin-top: var(--mi-sp-1);
}
.pair-label {
  flex-shrink: 0;
  width: 3em;
  font-size: var(--mi-fs-caption);
  color: var(--mi-text-2);
}
.pair-text {
  flex: 1;
  min-width: 0;
  margin: 0;
  padding: 1px var(--mi-sp-2);
  border-radius: var(--mi-radius-sm);
  font-family: var(--mi-code);
  font-size: var(--mi-fs-caption);
  line-height: 1.7;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}
.pair-text.want {
  background: var(--mi-success-fill);
  color: var(--mi-success-deep);
}
.pair-text.got {
  background: var(--mi-error-fill);
  color: var(--mi-error-deep);
}

.diag-next {
  margin-top: var(--mi-sp-2);
  font-size: var(--mi-fs-label);
  color: var(--mi-text-2);
}
</style>
