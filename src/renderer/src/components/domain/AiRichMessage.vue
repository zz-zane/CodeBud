<script setup lang="ts">
import { computed, ref, onBeforeUnmount, onMounted } from 'vue'
import {
  parseAiRichBlocks,
  type AiRichSegment,
  type DiagnosisBlockData,
  type FeynmanBlockData,
  type AlgoVizBlockData,
  type AskUserBlockData,
  type SolveStepsBlockData
} from '../../lib/ai-rich-blocks'
import { renderMarkdown } from '../../lib/md'
import { AI_ASSISTANT } from '../../lib/copy'
import InteractiveHtmlSandbox from '../study/InteractiveHtmlSandbox.vue'
import VideoCard from './video/VideoCard.vue'
import { useContentStore } from '../../stores/content'
import { useVideoStore } from '../../stores/video'
import { VIDEO_GENERATION_TEXT as VT } from '../../../../shared/video-copy'
const content = useContentStore()
const video = useVideoStore()
onMounted(() => { if (!video.videos.length && !window.miai.isRemote) void video.refresh() })
function videoOf(id: string) {
  return video.videos.find(item => item.id === id)
    ?? content.bundle.animations?.find(item => item.id === id)
}
function regenerate(id: string): void {
  const item = videoOf(id)
  if (item) video.open({ question: item.question, lessonId: item.lessonId, avoid: item.acts.map(act => act.skin) })
}

const props = defineProps<{
  content: string
}>()

const emit = defineEmits<{
  (e: 'action', payload: { type: 'feynman' | 'visualize' | 'prompt' | 'select-option'; text?: string; concept?: string; topic?: string; option?: string }): void
  (e: 'select-option', option: string): void
}>()

const segments = computed<AiRichSegment[]>(() => {
  return parseAiRichBlocks(props.content || '')
})


function safeScore(score: unknown): number {
  const n = Number(score)
  return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0
}

function renderHtml(raw?: string): string {
  const safe = typeof raw === 'string' ? raw : ''
  if (!safe) return ''
  try {
    return renderMarkdown(safe).html
  } catch {
    return safe.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
}

function diagnosisBadge(type: string): string {
  switch (type) {
    case 'structural':
      return AI_ASSISTANT.DIAGNOSIS_STRUCTURAL
    case 'deviation':
      return AI_ASSISTANT.DIAGNOSIS_DEVIATION
    case 'application':
      return AI_ASSISTANT.DIAGNOSIS_APPLICATION
    case 'metacognitive':
      return AI_ASSISTANT.DIAGNOSIS_METACOGNITIVE
    default:
      return AI_ASSISTANT.DIAGNOSIS_BADGE
  }
}

// ── Algo Viz Stepper 状态管理 ──
const activeSteps = ref<Record<number, number>>({})
const playingTimers = ref<Record<number, ReturnType<typeof setInterval>>>({})
const isPlaying = ref<Record<number, boolean>>({})

function currentStepOf(idx: number): number {
  return activeSteps.value[idx] ?? 0
}

function setStep(idx: number, step: number, max: number): void {
  activeSteps.value[idx] = Math.max(0, Math.min(max - 1, step))
}

function togglePlay(idx: number, max: number): void {
  if (isPlaying.value[idx]) {
    clearInterval(playingTimers.value[idx])
    delete playingTimers.value[idx]
    isPlaying.value[idx] = false
  } else {
    isPlaying.value[idx] = true
    playingTimers.value[idx] = setInterval(() => {
      const cur = currentStepOf(idx)
      if (cur >= max - 1) {
        setStep(idx, 0, max)
      } else {
        setStep(idx, cur + 1, max)
      }
    }, 1200)
  }
}

// ── Diagram 缩放与源码切换 ──
const diagramZoom = ref<Record<number, number>>({})
const diagramViewSource = ref<Record<number, boolean>>({})

function zoomOf(idx: number): number {
  return diagramZoom.value[idx] ?? 1.0
}

function adjustZoom(idx: number, delta: number): void {
  const cur = zoomOf(idx)
  diagramZoom.value[idx] = Math.max(0.5, Math.min(2.0, parseFloat((cur + delta).toFixed(1))))
}

function resetZoom(idx: number): void {
  diagramZoom.value[idx] = 1.0
}

function toggleSource(idx: number): void {
  diagramViewSource.value[idx] = !diagramViewSource.value[idx]
}


// ── Progressive Solve-Steps 状态管理 ──
const unlockedSteps = ref<Record<number, number>>({})

function unlockedCountOf(idx: number): number {
  return unlockedSteps.value[idx] ?? 1 // 默认解锁第 1 步
}

function unlockNext(idx: number, total: number): void {
  const cur = unlockedCountOf(idx)
  if (cur < total) unlockedSteps.value[idx] = cur + 1
}

function unlockAll(idx: number, total: number): void {
  unlockedSteps.value[idx] = total
}

function unlockTo(idx: number, stepIndex: number): void {
  const cur = unlockedCountOf(idx)
  if (stepIndex + 1 > cur) unlockedSteps.value[idx] = stepIndex + 1
}

function chooseAskOption(label: string): void {
  emit('select-option', label)
}

onBeforeUnmount(() => {
  Object.values(playingTimers.value).forEach((t) => clearInterval(t))
})
</script>

<template>
  <div class="ai-rich-message-container">
    <template v-for="(seg, idx) in segments" :key="idx">
      <!-- 1. 普通 Markdown 段落 -->
      <div v-if="seg.type === 'markdown'" class="markdown-body rich-markdown" v-html="renderHtml(seg.content)" />
      <div v-else-if="seg.type === 'anim-card'" class="anim-card-wrap">
        <VideoCard
          v-if="videoOf(seg.videoId)"
          :video="videoOf(seg.videoId)!"
          :show-regenerate="true"
          @play="video.play($event)"
          @regenerate="regenerate($event.id)"
        />
        <div v-else class="rich-card anim-card"><span>{{ VT.unavailable }}</span></div>
      </div>
      <InteractiveHtmlSandbox v-else-if="seg.type === 'artifact'" :html="seg.html" :title="seg.title" />

      
      <!-- 5. 交互式追问澄清卡 (ask-user) -->
      <div v-else-if="seg.type === 'ask-user'" class="rich-card ask-user-card">
        <div class="card-header ask-user-header">
          <div class="badge-row">
            <span class="category-badge ask-user-badge">
              {{ AI_ASSISTANT.ASK_USER_BADGE }}
            </span>
            <span class="card-title">{{ seg.data.question }}</span>
          </div>
        </div>

        <div class="card-body">
          <div v-if="seg.data.reason" class="ask-reason-row">
            <span class="row-text ask-reason">{{ seg.data.reason }}</span>
          </div>

          <div class="ask-options-title">
            {{ AI_ASSISTANT.ASK_USER_OPTIONS_TITLE }}
          </div>

          <div class="ask-options-list">
            <button
              v-for="(opt, optIdx) in seg.data.options"
              :key="optIdx"
              type="button"
              class="ask-option-btn"
              @click="chooseAskOption(opt.label)"
            >
              <span class="opt-label">{{ opt.label }}</span>
              <span v-if="opt.description" class="opt-desc">{{ opt.description }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 6. 渐进式分步解题引导卡 (solve-steps) -->
      <div v-else-if="seg.type === 'solve-steps'" class="rich-card solve-steps-card">
        <div class="card-header solve-steps-header">
          <div>
            <span class="card-title">{{ seg.data.title }}</span>
            <span v-if="seg.data.strategy" class="card-subtitle"> · {{ seg.data.strategy }}</span>
          </div>
          <div class="solve-header-right">
            <span class="solve-progress-pill">
              {{ AI_ASSISTANT.solveStepsProgress(unlockedCountOf(idx), seg.data.steps.length) }}
            </span>
            <button
              v-if="unlockedCountOf(idx) < seg.data.steps.length"
              type="button"
              class="solve-top-btn"
              @click="unlockNext(idx, seg.data.steps.length)"
            >
              {{ AI_ASSISTANT.SOLVE_STEPS_UNLOCK_NEXT }}
            </button>
            <button
              v-if="unlockedCountOf(idx) < seg.data.steps.length"
              type="button"
              class="solve-top-btn ghost"
              @click="unlockAll(idx, seg.data.steps.length)"
            >
              {{ AI_ASSISTANT.SOLVE_STEPS_UNLOCK_ALL }}
            </button>
          </div>
        </div>

        <div class="card-body solve-body">
          <div
            v-for="(step, sIdx) in seg.data.steps"
            :key="sIdx"
            class="step-panel"
            :class="{ locked: sIdx >= unlockedCountOf(idx), unlocked: sIdx < unlockedCountOf(idx) }"
          >
            <div class="step-head">
              <span class="step-num-badge">{{ sIdx + 1 }}</span>
              <span class="step-head-title">{{ step.title }}</span>
              <button
                v-if="sIdx >= unlockedCountOf(idx)"
                type="button"
                class="step-reveal-btn"
                @click="unlockTo(idx, sIdx)"
              >
                {{ AI_ASSISTANT.SOLVE_STEPS_REVEAL_STEP }}
              </button>
            </div>

            <div class="step-hint-box">
              <span class="hint-bullet">💡</span>
              <span class="hint-text">{{ step.hint }}</span>
            </div>

            <!-- 仅在解锁后揭晓具体推导与代码 -->
            <div v-if="sIdx < unlockedCountOf(idx)" class="step-unlocked-content">
              <div class="step-detail-text" v-html="renderHtml(step.detail)" />
              <pre v-if="step.code" class="step-code-block"><code>{{ step.code }}</code></pre>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. DeepTutor 错因诊断卡 -->
      <div v-else-if="seg.type === 'diagnosis'" class="rich-card diagnosis-card">
        <div class="card-header">
          <div class="badge-row">
            <span class="category-badge" :class="'type-' + seg.data.errorType">
              {{ diagnosisBadge(seg.data.errorType) }}
            </span>
            <span class="card-title">{{ seg.data.title }}</span>
          </div>
          <span class="sub-badge">{{ AI_ASSISTANT.DIAGNOSIS_BADGE }}</span>
        </div>

        <div class="card-body">
          <div v-if="seg.data.location" class="info-row">
            <span class="row-label">{{ AI_ASSISTANT.DIAGNOSIS_LOCATION_LABEL }}</span>
            <code class="code-loc">{{ seg.data.location }}</code>
          </div>

          <div class="info-row">
            <span class="row-label">{{ AI_ASSISTANT.DIAGNOSIS_CAUSE_LABEL }}</span>
            <p class="row-text cause-text">{{ seg.data.rootCause }}</p>
          </div>

          <div class="info-row">
            <span class="row-label">{{ AI_ASSISTANT.DIAGNOSIS_REMEDY_LABEL }}</span>
            <p class="row-text remedy-text">{{ seg.data.remediation }}</p>
          </div>

          <div v-if="seg.data.checkQuestion" class="check-box">
            <div class="check-header">
              <span class="check-icon">💡</span>
              <span class="check-label">{{ AI_ASSISTANT.DIAGNOSIS_QUESTION_LABEL }}</span>
            </div>
            <p class="check-question">{{ seg.data.checkQuestion }}</p>
          </div>
        </div>

        <div class="card-actions">
          <button
            type="button"
            class="action-btn feynman-btn"
            @click="emit('action', { type: 'feynman', concept: seg.data.title })"
          >
            {{ AI_ASSISTANT.ACTION_ENTER_FEYNMAN }}
          </button>
          <button
            type="button"
            class="action-btn viz-btn"
            @click="emit('action', { type: 'visualize', topic: seg.data.title })"
          >
            {{ AI_ASSISTANT.ACTION_GEN_VIZ }}
          </button>
        </div>
      </div>

      <!-- 3. DeepTutor 费曼复述检验卡 -->
      <div v-else-if="seg.type === 'feynman'" class="rich-card feynman-card">
        <div class="card-header">
          <div class="badge-row">
            <span class="feynman-status-badge" :class="{ passed: seg.data.passed, retry: !seg.data.passed }">
              {{ seg.data.passed ? AI_ASSISTANT.FEYNMAN_PASSED : AI_ASSISTANT.FEYNMAN_RETRY }}
            </span>
            <span class="card-title">{{ seg.data.concept }}</span>
          </div>
          <span class="sub-badge">{{ AI_ASSISTANT.FEYNMAN_BADGE }}</span>
        </div>

        <div class="card-body">
          <div class="score-section">
            <div class="score-header">
              <span class="score-label">{{ AI_ASSISTANT.FEYNMAN_MASTERY_SCORE }}</span>
              <span class="score-val">{{ safeScore(seg.data.score) }}%</span>
            </div>
            <div class="progress-bar-bg">
              <div
                class="progress-bar-fill"
                :style="{ width: safeScore(seg.data.score) + '%' }"
                :class="{ passed: seg.data.passed }"
              />
            </div>
          </div>

          <div class="info-row">
            <span class="row-label">{{ AI_ASSISTANT.FEYNMAN_FEEDBACK_LABEL }}</span>
            <p class="row-text">{{ seg.data.feedback }}</p>
          </div>

          <div v-if="seg.data.gap" class="info-row">
            <span class="row-label">{{ AI_ASSISTANT.FEYNMAN_GAP_LABEL }}</span>
            <p class="row-text gap-text">{{ seg.data.gap }}</p>
          </div>
        </div>

        <div v-if="seg.data.followUpPrompt" class="card-actions">
          <button
            type="button"
            class="action-btn prompt-btn"
            @click="emit('action', { type: 'prompt', text: seg.data.followUpPrompt })"
          >
            {{ AI_ASSISTANT.ACTION_ANSWER_PROMPT }}
          </button>
        </div>
      </div>

      <!-- 4. 交互式算法演化沙盒 (algo-viz) -->
      <div v-else-if="seg.type === 'algo-viz'" class="rich-card algo-viz-card">
        <div class="card-header">
          <div>
            <span class="card-title">{{ seg.data.title }}</span>
            <span v-if="seg.data.subtitle" class="card-subtitle"> · {{ seg.data.subtitle }}</span>
          </div>
          <span class="sub-badge">{{ AI_ASSISTANT.ALGO_VIZ_BADGE }}</span>
        </div>

        <div v-if="seg.data.steps && seg.data.steps.length" class="card-body">
          <div class="step-indicator-row">
            <span class="step-label-tag">{{ seg.data.steps[currentStepOf(idx)]?.label }}</span>
            <span class="step-counter">{{ AI_ASSISTANT.stepCounter(currentStepOf(idx) + 1, seg.data.steps.length) }}</span>
          </div>

          <!-- 元素数组可视化 -->
          <div v-if="seg.data.steps[currentStepOf(idx)]?.items?.length" class="items-canvas">
            <div
              v-for="(item, itemIdx) in seg.data.steps[currentStepOf(idx)].items"
              :key="itemIdx"
              class="item-node"
              :class="{
                highlighted: seg.data.steps[currentStepOf(idx)].highlights?.includes(itemIdx)
              }"
            >
              <!-- 顶部指针徽章 -->
              <div class="pointer-slot">
                <span
                  v-if="seg.data.steps[currentStepOf(idx)].pointers?.[String(itemIdx)]"
                  class="pointer-chip"
                >
                  {{ seg.data.steps[currentStepOf(idx)].pointers?.[String(itemIdx)] }}
                </span>
              </div>
              <div class="item-box">
                {{ item }}
              </div>
              <div class="item-index">{{ itemIdx }}</div>
            </div>
          </div>

          <!-- 步骤讲解与备注 -->
          <div v-if="seg.data.steps[currentStepOf(idx)]?.explanation" class="step-explanation">
            {{ seg.data.steps[currentStepOf(idx)].explanation }}
          </div>
          <div v-if="seg.data.steps[currentStepOf(idx)]?.note" class="step-note">
            {{ seg.data.steps[currentStepOf(idx)].note }}
          </div>
        </div>

        <!-- 步进交互控制栏 -->
        <div class="stepper-controls">
          <button
            type="button"
            class="step-ctrl-btn"
            :disabled="currentStepOf(idx) <= 0"
            @click="setStep(idx, 0, seg.data.steps.length)"
          >
            {{ AI_ASSISTANT.STEP_RESET }}
          </button>
          <button
            type="button"
            class="step-ctrl-btn"
            :disabled="currentStepOf(idx) <= 0"
            @click="setStep(idx, currentStepOf(idx) - 1, seg.data.steps.length)"
          >
            {{ AI_ASSISTANT.STEP_PREV }}
          </button>
          <button
            type="button"
            class="step-ctrl-btn play-btn"
            @click="togglePlay(idx, seg.data.steps.length)"
          >
            {{ isPlaying[idx] ? AI_ASSISTANT.STEP_PAUSE : AI_ASSISTANT.STEP_AUTOPLAY }}
          </button>
          <button
            type="button"
            class="step-ctrl-btn"
            :disabled="currentStepOf(idx) >= seg.data.steps.length - 1"
            @click="setStep(idx, currentStepOf(idx) + 1, seg.data.steps.length)"
          >
            {{ AI_ASSISTANT.STEP_NEXT }}
          </button>
        </div>
      </div>

      <!-- 5. 流程图与 SVG 矢量图解 (mermaid / svg) -->
      <div v-else-if="seg.type === 'mermaid' || seg.type === 'svg'" class="rich-card diagram-card">
        <div class="card-header">
          <span class="card-title">{{ AI_ASSISTANT.DIAGRAM_BADGE }}</span>
          <div class="diagram-tools">
            <button
              type="button"
              class="tool-btn"
              @click="adjustZoom(idx, -0.2)"
            >
              {{ AI_ASSISTANT.ZOOM_OUT }}
            </button>
            <button
              type="button"
              class="tool-btn"
              @click="resetZoom(idx)"
            >
              {{ AI_ASSISTANT.ZOOM_RESET }}
            </button>
            <button
              type="button"
              class="tool-btn"
              @click="adjustZoom(idx, 0.2)"
            >
              {{ AI_ASSISTANT.ZOOM_IN }}
            </button>
            <button
              type="button"
              class="tool-btn source-btn"
              @click="toggleSource(idx)"
            >
              {{ diagramViewSource[idx] ? AI_ASSISTANT.PREVIEW_CHART : AI_ASSISTANT.VIEW_SOURCE }}
            </button>
          </div>
        </div>

        <div class="diagram-viewport">
          <pre v-if="diagramViewSource[idx]" class="diagram-code"><code>{{ seg.raw }}</code></pre>
          <div
            v-else
            class="svg-renderer"
            :style="{ transform: 'scale(' + zoomOf(idx) + ')', transformOrigin: 'top center' }"
            v-html="seg.svg"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.anim-card { display:flex; flex-direction:column; gap:8px; padding:12px; }
.anim-card button { margin-right:8px; cursor:pointer; }
.anim-preview { height:100px; overflow:hidden; border-radius:var(--mi-radius); background:var(--mi-canvas); }
.anim-preview :deep(.world) { width:200%; height:200px; min-height:200px; transform:scale(.5); transform-origin:top left; pointer-events:none; }
.ai-rich-message-container {
  display: flex;
  flex-direction: column;
  gap: var(--mi-sp-3);
  width: 100%;
}

.rich-card {
  border-radius: var(--radius-lg, 12px);
  background: var(--cds-surface-1, #f8fafc);
  border: 1px solid var(--mi-border, #e2e8f0);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  transition: border-color var(--mi-dur-fast, 0.2s) ease;
}

.rich-card:hover {
  border-color: var(--mi-blue-deep, #2563eb);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--mi-sp-3) var(--mi-sp-4);
  border-bottom: 1px solid var(--mi-border, #e2e8f0);
  background: rgba(255, 255, 255, 0.5);
}

.badge-row {
  display: flex;
  align-items: center;
  gap: var(--mi-sp-2);
}

.category-badge {
  padding: 2px var(--mi-sp-2);
  border-radius: 4px;
  font-size: var(--mi-fs-caption);
  font-weight: 500;
}

.type-structural {
  background: #fef2f2;
  color: #dc2626;
  border: 1px solid #fecaca;
}
.type-deviation {
  background: #fffbeb;
  color: #d97706;
  border: 1px solid #fde68a;
}
.type-application {
  background: #eff6ff;
  color: #2563eb;
  border: 1px solid #bfdbfe;
}
.type-metacognitive {
  background: #faf5ff;
  color: #9333ea;
  border: 1px solid #e9d5ff;
}

.card-title {
  font-weight: 500;
  font-size: var(--mi-fs-label);
  color: var(--mi-text, #0f172a);
}

.card-subtitle {
  font-size: var(--mi-fs-caption);
  color: var(--mi-text-2, #64748b);
}

.sub-badge {
  font-size: var(--mi-fs-caption);
  color: var(--mi-text-3, #94a3b8);
}

.card-body {
  padding: var(--mi-sp-3) var(--mi-sp-4);
  display: flex;
  flex-direction: column;
  gap: var(--mi-sp-3);
}

.info-row {
  display: flex;
  flex-direction: column;
  gap: var(--mi-sp-1);
}

.row-label {
  font-size: var(--mi-fs-caption);
  font-weight: 500;
  color: var(--mi-text-2, #64748b);
  text-transform: uppercase;
}

.row-text {
  font-size: var(--mi-fs-label);
  line-height: 1.6;
  color: var(--mi-text, #1e293b);
  margin: 0;
}

.cause-text {
  color: #b91c1c;
}

.remedy-text {
  color: #15803d;
}

.code-loc {
  font-family: var(--mi-code, monospace);
  font-size: var(--mi-fs-caption);
  background: var(--mi-bg, #f1f5f9);
  padding: 2px var(--mi-sp-2);
  border-radius: 4px;
  border: 1px solid var(--mi-border, #cbd5e1);
  color: #dc2626;
  align-self: flex-start;
}

.check-box {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  padding: var(--mi-sp-2) var(--mi-sp-3);
}

.check-header {
  display: flex;
  align-items: center;
  gap: var(--mi-sp-2);
  font-size: var(--mi-fs-caption);
  font-weight: 500;
  color: #1d4ed8;
  margin-bottom: var(--mi-sp-1);
}

.check-question {
  font-size: var(--mi-fs-label);
  color: #1e3a8a;
  margin: 0;
  line-height: 1.5;
}

.card-actions {
  display: flex;
  gap: var(--mi-sp-3);
  padding: var(--mi-sp-3) var(--mi-sp-4);
  background: rgba(255, 255, 255, 0.4);
  border-top: 1px solid var(--mi-border, #e2e8f0);
}

.action-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--mi-sp-2);
  padding: var(--mi-sp-1) var(--mi-sp-3);
  border-radius: 6px;
  font-size: var(--mi-fs-caption);
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all var(--mi-dur-fast, 0.2s) ease;
}

.feynman-btn {
  background: #f0fdf4;
  color: #166534;
  border-color: #bbf7d0;
}
.feynman-btn:hover {
  background: #dcfce7;
}

.viz-btn {
  background: #eff6ff;
  color: #1d4ed8;
  border-color: #bfdbfe;
}
.viz-btn:hover {
  background: #dbeafe;
}

.prompt-btn {
  background: var(--mi-blue-deep, #2563eb);
  color: #ffffff;
}
.prompt-btn:hover {
  filter: brightness(0.92);
}

/* 费曼卡 */
.feynman-status-badge {
  padding: 2px var(--mi-sp-2);
  border-radius: 4px;
  font-size: var(--mi-fs-caption);
  font-weight: 500;
}
.feynman-status-badge.passed {
  background: #f0fdf4;
  color: #16a34a;
  border: 1px solid #bbf7d0;
}
.feynman-status-badge.retry {
  background: #fffbeb;
  color: #d97706;
  border: 1px solid #fde68a;
}

.score-section {
  display: flex;
  flex-direction: column;
  gap: var(--mi-sp-1);
}

.score-header {
  display: flex;
  justify-content: space-between;
  font-size: var(--mi-fs-caption);
  font-weight: 500;
}

.progress-bar-bg {
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background: var(--mi-border, #e2e8f0);
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  border-radius: 4px;
  background: #f59e0b;
  transition: width 0.4s ease;
}
.progress-bar-fill.passed {
  background: #10b981;
}

.gap-text {
  color: #b45309;
}

/* 算法沙盒 */
.step-indicator-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.step-label-tag {
  font-size: var(--mi-fs-caption);
  font-weight: 500;
  color: #1d4ed8;
  background: #eff6ff;
  padding: 2px var(--mi-sp-2);
  border-radius: 4px;
}

.step-counter {
  font-size: var(--mi-fs-caption);
  color: var(--mi-text-2, #64748b);
}

.items-canvas {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: var(--mi-sp-2);
  padding: var(--mi-sp-4) var(--mi-sp-2) var(--mi-sp-3);
  background: var(--mi-card, #ffffff);
  border: 1px solid var(--mi-border, #e2e8f0);
  border-radius: 8px;
  overflow-x: auto;
}

.item-node {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 44px;
}

.pointer-slot {
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pointer-chip {
  font-size: var(--mi-fs-caption);
  font-weight: 500;
  padding: 1px var(--mi-sp-1);
  border-radius: 3px;
  background: #2563eb;
  color: #ffffff;
}

.item-box {
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid #cbd5e1;
  border-radius: 8px;
  font-family: var(--mi-code, monospace);
  font-weight: 500;
  font-size: var(--mi-fs-body);
  color: #1e293b;
  background: #f8fafc;
  transition: all 0.2s ease;
}

.item-node.highlighted .item-box {
  border-color: #2563eb;
  background: #eff6ff;
  color: #1d4ed8;
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(37, 99, 235, 0.18);
}

.item-index {
  font-size: var(--mi-fs-caption);
  color: #94a3b8;
  margin-top: var(--mi-sp-1);
}

.step-explanation {
  font-size: var(--mi-fs-label);
  line-height: 1.6;
  color: var(--mi-text, #1e293b);
  background: rgba(255, 255, 255, 0.7);
  padding: var(--mi-sp-2) var(--mi-sp-3);
  border-radius: 6px;
  border: 1px solid var(--mi-border, #e2e8f0);
}

.step-note {
  font-size: var(--mi-fs-caption);
  color: var(--mi-text-2, #64748b);
  font-style: italic;
}

.stepper-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--mi-sp-2);
  padding: var(--mi-sp-3);
  background: rgba(255, 255, 255, 0.5);
  border-top: 1px solid var(--mi-border, #e2e8f0);
}

.step-ctrl-btn {
  padding: var(--mi-sp-1) var(--mi-sp-3);
  border-radius: 6px;
  border: 1px solid var(--mi-border, #cbd5e1);
  background: var(--mi-card, #ffffff);
  font-size: var(--mi-fs-caption);
  color: var(--mi-text, #1e293b);
  cursor: pointer;
  transition: all 0.15s ease;
}
.step-ctrl-btn:hover:not(:disabled) {
  background: var(--mi-blue-light, #eff6ff);
  border-color: var(--mi-blue-deep, #2563eb);
}
.step-ctrl-btn:disabled {
  color: var(--mi-text-3, #94a3b8);
  border-color: var(--mi-border, #e2e8f0);
  background: var(--mi-bg, #f1f5f9);
  cursor: not-allowed;
}

.step-ctrl-btn.play-btn {
  background: var(--mi-blue-deep, #2563eb);
  color: #ffffff;
  border-color: var(--mi-blue-deep, #2563eb);
}
.step-ctrl-btn.play-btn:hover {
  filter: brightness(0.92);
}

/* 图解卡 */
.diagram-tools {
  display: flex;
  align-items: center;
  gap: var(--mi-sp-2);
}

.tool-btn {
  padding: 2px var(--mi-sp-2);
  border-radius: 4px;
  border: 1px solid var(--mi-border, #cbd5e1);
  background: var(--mi-card, #ffffff);
  font-size: var(--mi-fs-caption);
  color: var(--mi-text-2, #64748b);
  cursor: pointer;
}
.tool-btn:hover {
  background: var(--mi-bg, #f1f5f9);
}

.diagram-viewport {
  padding: var(--mi-sp-4);
  display: flex;
  justify-content: center;
  overflow: auto;
  background: var(--mi-card, #ffffff);
}

.svg-renderer {
  transition: transform 0.2s ease;
  width: 100%;
  display: flex;
  justify-content: center;
}

.diagram-code {
  margin: 0;
  padding: var(--mi-sp-3);
  background: #0f172a;
  color: #f8fafc;
  border-radius: 6px;
  font-family: var(--mi-code, monospace);
  font-size: var(--mi-fs-caption);
  width: 100%;
  overflow-x: auto;
}

/* 追问澄清卡 */
.ask-user-card {
  border-color: #cbd5e1;
}
.ask-user-badge {
  background: #f0fdfa;
  color: #0d9488;
  border: 1px solid #99f6e4;
}
.ask-reason-row {
  margin-bottom: var(--mi-sp-2);
}
.ask-reason {
  color: var(--mi-text-2, #64748b);
  font-size: var(--mi-fs-label);
  line-height: 1.5;
}
.ask-options-title {
  font-size: var(--mi-fs-caption);
  font-weight: 500;
  color: var(--mi-text, #1e293b);
  margin-bottom: var(--mi-sp-2);
}
.ask-options-list {
  display: flex;
  flex-direction: column;
  gap: var(--mi-sp-2);
}
.ask-option-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: var(--mi-sp-2) var(--mi-sp-3);
  border-radius: 8px;
  border: 1px solid var(--mi-border, #cbd5e1);
  background: var(--mi-card, #ffffff);
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}
.ask-option-btn:hover {
  border-color: var(--mi-blue-deep, #2563eb);
  background: var(--mi-blue-light, #eff6ff);
}
.opt-label {
  font-size: var(--mi-fs-label);
  font-weight: 500;
  color: var(--mi-text, #0f172a);
}
.opt-desc {
  font-size: var(--mi-fs-caption);
  color: var(--mi-text-2, #64748b);
}

/* 分步解题卡 */
.solve-steps-card {
  border-color: #cbd5e1;
}
.solve-header-right {
  display: flex;
  align-items: center;
  gap: var(--mi-sp-2);
}
.solve-progress-pill {
  font-size: var(--mi-fs-caption);
  font-weight: 500;
  color: #1d4ed8;
  background: #eff6ff;
  padding: 2px var(--mi-sp-2);
  border-radius: 12px;
}
.solve-top-btn {
  padding: 3px var(--mi-sp-2);
  border-radius: 6px;
  font-size: var(--mi-fs-caption);
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--mi-border, #cbd5e1);
  background: var(--mi-card, #ffffff);
  color: var(--mi-text, #1e293b);
}
.solve-top-btn:hover {
  background: var(--mi-blue-light, #eff6ff);
  border-color: var(--mi-blue-deep, #2563eb);
}
.solve-top-btn.ghost {
  background: transparent;
  border-color: transparent;
  color: var(--mi-text-2, #64748b);
}
.solve-top-btn.ghost:hover {
  background: var(--mi-bg, #f1f5f9);
}
.solve-body {
  display: flex;
  flex-direction: column;
  gap: var(--mi-sp-3);
}
.step-panel {
  border-radius: 8px;
  border: 1px solid var(--mi-border, #e2e8f0);
  background: var(--mi-card, #ffffff);
  padding: var(--mi-sp-3) var(--mi-sp-3);
  display: flex;
  flex-direction: column;
  gap: var(--mi-sp-2);
}
.step-panel.locked {
  border-style: dashed;
  background: var(--mi-bg, #f8fafc);
}
.step-head {
  display: flex;
  align-items: center;
  gap: var(--mi-sp-2);
}
.step-num-badge {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #dbeafe;
  color: #1d4ed8;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--mi-fs-caption);
  font-weight: 500;
  flex-shrink: 0;
}
.step-head-title {
  font-size: var(--mi-fs-label);
  font-weight: 500;
  color: var(--mi-text, #1e293b);
  flex: 1;
}
.step-reveal-btn {
  padding: 2px var(--mi-sp-2);
  border-radius: 4px;
  font-size: var(--mi-fs-caption);
  font-weight: 500;
  cursor: pointer;
  border: 1px solid #bfdbfe;
  background: #eff6ff;
  color: #1d4ed8;
}
.step-reveal-btn:hover {
  background: #dbeafe;
}
.step-hint-box {
  display: flex;
  align-items: flex-start;
  gap: var(--mi-sp-2);
  font-size: var(--mi-fs-caption);
  color: var(--mi-text-2, #475569);
  background: #fffbeb;
  padding: var(--mi-sp-2) var(--mi-sp-2);
  border-radius: 6px;
  border: 1px solid #fde68a;
}
.hint-bullet {
  flex-shrink: 0;
}
.hint-text {
  line-height: 1.5;
}
.step-unlocked-content {
  display: flex;
  flex-direction: column;
  gap: var(--mi-sp-2);
  margin-top: var(--mi-sp-1);
}
.step-detail-text {
  font-size: var(--mi-fs-label);
  line-height: 1.6;
  color: var(--mi-text, #1e293b);
}
.step-code-block {
  margin: 0;
  padding: var(--mi-sp-2) var(--mi-sp-3);
  background: #0f172a;
  color: #f8fafc;
  border-radius: 6px;
  font-family: var(--mi-code, monospace);
  font-size: var(--mi-fs-caption);
  overflow-x: auto;
}

</style>
