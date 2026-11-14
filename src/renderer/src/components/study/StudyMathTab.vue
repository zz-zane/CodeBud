<script setup lang="ts">
import { ref } from 'vue'
import { useStudyStore } from '../../stores/study'
import { STUDY_COPY } from '../../lib/study-copy'
import MiIcon from '../base/MiIcon.vue'

const study = useStudyStore()

const scriptText = ref(STUDY_COPY.MATH.SAMPLE_SCRIPT)

const isRunning = ref(false)
const outputText = ref<string | null>(null)
const plots = ref<string[]>([])
const actionError = ref<string | null>(null)
const runtimeMissing = ref(false)

async function handleRun(): Promise<void> {
  const code = scriptText.value.trim()
  if (!code) return

  isRunning.value = true
  actionError.value = null
  runtimeMissing.value = false
  outputText.value = null
  plots.value = []

  const res = await study.runMath(code, true)
  isRunning.value = false

  if (res.ok) {
    outputText.value = res.data.output
    plots.value = res.data.plots || []
  } else {
    // 检查是否为缺少 Octave 运行时的错误
    if (res.error.toLowerCase().includes('not found') || res.error.toLowerCase().includes('octave') || res.error.includes('ENOENT')) {
      runtimeMissing.value = true
    }
    actionError.value = res.error
  }
}
</script>

<template>
  <div class="study-math-pane">
    <div v-if="runtimeMissing" class="runtime-missing-banner" role="alert">
      <MiIcon name="alert" />
      <div class="missing-body">
        <strong>{{ STUDY_COPY.MATH.RUNTIME_MISSING_TITLE }}</strong>
        <p>{{ STUDY_COPY.MATH.RUNTIME_MISSING_TIP }} <code>MIAI_OCTAVE_PATH=…/octave-cli.exe</code></p>
      </div>
    </div>

    <div v-if="actionError && !runtimeMissing" class="mi-alert-error" role="alert">
      <span>{{ actionError }}</span>
      <button type="button" class="alert-close-btn" :aria-label="STUDY_COPY.COMMON.CLOSE" @click="actionError = null"><MiIcon name="x" :size="14" /></button>
    </div>

    <div class="math-split-layout">
      <div class="math-editor-col">
        <div class="col-head">
          <span class="pg-meta-item"><MiIcon name="code" :size="14" />Octave</span>
          <button type="button" class="mi-btn-primary" :disabled="isRunning || !scriptText.trim()" @click="handleRun">
            <span v-if="isRunning" class="mini-spinner mi-motion-keep" />
            <MiIcon v-else name="play" :size="14" />
            {{ isRunning ? STUDY_COPY.MATH.RUNTIME_RUNNING : STUDY_COPY.MATH.RUN_BTN }}
          </button>
        </div>
        <textarea v-model="scriptText" class="mi-textarea math-code-area" spellcheck="false" :aria-label="STUDY_COPY.MATH.EDITOR_LABEL" :placeholder="STUDY_COPY.MATH.SCRIPT_PLACEHOLDER" :disabled="isRunning" />
      </div>

      <div class="math-results-col">
        <pre v-if="outputText !== null" class="stdout-box" :aria-label="STUDY_COPY.MATH.OUTPUT_LABEL">{{ outputText || STUDY_COPY.MATH.NO_STDOUT }}</pre>
        <img v-for="(plotUrl, idx) in plots" :key="idx" :src="plotUrl" :alt="`${STUDY_COPY.MATH.PLOTS_LABEL} ${idx + 1}`" class="plot-img" />
        <div v-if="outputText === null && !isRunning" class="pg-empty">
          <MiIcon name="curve" :size="24" />
          <p>{{ STUDY_COPY.MATH.RUN_HINT }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.study-math-pane { display: flex; flex-direction: column; gap: var(--mi-sp-3); height: calc(100vh - 150px); min-height: 380px; }
.runtime-missing-banner { display: flex; gap: var(--mi-sp-3); padding: var(--mi-sp-3) var(--mi-sp-3); border-radius: var(--radius-lg, 8px); background: var(--mi-blue-light); color: var(--mi-warn-deep); font-size: var(--mi-fs-label); }
.missing-body { min-width: 0; color: var(--mi-text); }
.missing-body p { margin: 2px 0 0; color: var(--mi-text-2); word-break: break-word; }
.math-split-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); flex: 1; min-height: 0; gap: var(--mi-sp-6); }
.math-editor-col, .math-results-col { display: flex; flex-direction: column; min-height: 0; min-width: 0; }
.col-head { display: flex; align-items: center; justify-content: space-between; gap: var(--mi-sp-2); margin-bottom: var(--mi-sp-2); font-size: var(--mi-fs-label); color: var(--mi-text-2); }
.math-code-area { flex: 1; resize: none; }
.study-math-pane .math-code-area { font-family: var(--cds-font-mono, ui-monospace, Consolas, monospace); line-height: 1.6; }
.math-results-col { gap: var(--mi-sp-3); overflow-y: auto; }
.math-results-col .pg-empty { flex: 1; }
.stdout-box { margin: 0; padding: var(--mi-sp-3); border-radius: var(--radius-lg, 8px); background: var(--mi-code-bg); color: var(--mi-text); font-family: var(--cds-font-mono, ui-monospace, Consolas, monospace); font-size: var(--mi-fs-caption); line-height: 1.5; white-space: pre-wrap; word-break: break-word; }
.plot-img { display: block; max-width: 100%; height: auto; border-radius: var(--radius-lg, 8px); background: #fff; }
.mini-spinner { width: 12px; height: 12px; border: 2px solid color-mix(in srgb, currentColor 30%, transparent); border-top-color: currentColor; border-radius: 50%; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 860px) { .study-math-pane { height: auto; } .math-split-layout { grid-template-columns: 1fr; } .math-code-area { min-height: 240px; } }
</style>
