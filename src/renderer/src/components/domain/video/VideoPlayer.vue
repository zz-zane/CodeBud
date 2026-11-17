<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { animate } from 'animejs'
import type { ExplainerVideo } from '../../../../../shared/video'
import { questionKey } from '../../../../../shared/question-key'
import { useVideoStore } from '../../../stores/video'
import { useAiAssistantStore } from '../../../stores/ai-assistant'
import { usePracticeStore } from '../../../stores/practice'
import { VideoEngine, type VideoPlaybackSnapshot } from '../../../lib/video-engine'
import { handlePlayerArrowKey, pickProgressSegment } from '../../../lib/video-player-controls'
import { createVideoNarrator, readVideoPreference, writeVideoPreference, VIDEO_NARRATION_ENABLED_KEY, VIDEO_NARRATION_RATE_KEY } from '../../../lib/video-narrator'
import { VIDEO_UI } from '../../../lib/copy'
import MiButton from '../../base/MiButton.vue'
import MiIcon from '../../base/MiIcon.vue'
import MiRichText from '../../base/MiRichText.vue'
import { toast } from '../../base/toast'
import VideoStage from './VideoStage.vue'

const props = defineProps<{ video: ExplainerVideo }>()
const store = useVideoStore()
const ai = useAiAssistantStore()
const practice = usePracticeStore()
const snapshot = ref<VideoPlaybackSnapshot>({ state: 'idle', sceneIndex: 0, stepIndex: 0, rate: 1 })
const stage = ref<InstanceType<typeof VideoStage> | null>(null)
const dialog = ref<HTMLElement | null>(null)
const progressBar = ref<HTMLElement | null>(null)
const highlight = ref<HTMLElement | null>(null)
let lastLine: number | undefined
let previousFocus: HTMLElement | null = null
let askTimer: number | undefined
let scrubbing = false
let scrubWasPlaying = false
const selected = ref<number | null>(null)
const checked = ref(false)
const recording = ref(false)
const narration = ref(readVideoPreference(VIDEO_NARRATION_ENABLED_KEY) !== 'false')
const motion = ref(readVideoPreference('codebud.video.motion.enabled') !== 'false')
const motionMedia = window.matchMedia('(prefers-reduced-motion: reduce)')
const systemReduced = ref(motionMedia.matches)
const onMotionChange = (event: MediaQueryListEvent): void => { systemReduced.value = event.matches }
const reduced = computed(() => !motion.value || systemReduced.value)
const act = computed(() => props.video.acts[snapshot.value.sceneIndex])
const step = computed(() => act.value?.steps[snapshot.value.stepIndex])
const shownAct = computed(() => snapshot.value.state === 'asking' && snapshot.value.stepIndex === 0 && snapshot.value.sceneIndex > 0 ? props.video.acts[snapshot.value.sceneIndex - 1] : act.value)
const shownStep = computed(() => snapshot.value.state === 'asking' ? (snapshot.value.stepIndex > 0 ? act.value?.steps[snapshot.value.stepIndex - 1] : shownAct.value?.steps.at(-1)) ?? step.value : step.value)
const total = computed(() => props.video.acts.reduce((n, a) => n + a.steps.length, 0))
const progress = computed(() => props.video.acts.slice(0, snapshot.value.sceneIndex).reduce((n, a) => n + a.steps.length, 0) + snapshot.value.stepIndex + 1)

function stepIndexOf(actIndex: number, stepIndex: number): number {
  return props.video.acts.slice(0, actIndex).reduce((n, a) => n + a.steps.length, 0) + stepIndex + 1
}

function replay(): void {
  clearAskTimer()
  engine.seek(0, 0)
  engine.play()
}

function clearAskTimer(): void {
  if (askTimer !== undefined) {
    window.clearTimeout(askTimer)
    askTimer = undefined
  }
}

const engine = new VideoEngine(props.video, createVideoNarrator(), value => {
  snapshot.value = value
  store.currentStep = progress.value
  store.totalSteps = total.value
}, async () => {
  await nextTick()
  const line = step.value?.line
  const marker = highlight.value
  const movement = !reduced.value && marker && line && lastLine && line !== lastLine
    ? Promise.resolve(animate(marker, { translateY: [(lastLine - line) * 30, 0], duration: 250 }))
    : Promise.resolve()
  lastLine = line
  await Promise.all([stage.value?.transition(), movement])
})

watch(() => [snapshot.value.sceneIndex, snapshot.value.stepIndex], () => {
  clearAskTimer()
  selected.value = null
  checked.value = false
})

function setRate(rate: number): void {
  engine.setRate(rate)
  writeVideoPreference(VIDEO_NARRATION_RATE_KEY, String(rate))
}

function toggleNarration(): void {
  narration.value = !narration.value
  writeVideoPreference(VIDEO_NARRATION_ENABLED_KEY, String(narration.value))
  if (snapshot.value.state === 'playing') {
    engine.pause()
    engine.play()
  }
}

function proceedFromAsk(): void {
  clearAskTimer()
  if (snapshot.value.state === 'asking') engine.reveal()
}

async function chooseOption(index: number): Promise<void> {
  if (checked.value || recording.value || !step.value?.ask) return
  selected.value = index
  recording.value = true
  try {
    if (props.video.lessonId) {
      const file = await window.miai.recordPractice({
        mode: 'video-check',
        items: [{ key: questionKey(props.video.lessonId, `video-${props.video.id}-${snapshot.value.sceneIndex}-${snapshot.value.stepIndex}`), ok: index === step.value.ask.answer }]
      })
      practice.adopt(file)
    }
    checked.value = true
    clearAskTimer()
    askTimer = window.setTimeout(() => proceedFromAsk(), 2500)
  } catch (error) {
    toast(error instanceof Error ? error.message : String(error), 'error')
  } finally {
    recording.value = false
  }
}

function ask(): void {
  clearAskTimer()
  engine.pause()
  ai.openWithSelection({
    text: `${step.value?.say ?? ''}\n${VIDEO_UI.UNKNOWN_STATE}${JSON.stringify(step.value)}`,
    title: act.value?.title,
    type: 'selection',
    action: 'ask',
    lessonId: props.video.lessonId
  })
  if (!ai.draft.startsWith(VIDEO_UI.UNKNOWN_DRAFT)) ai.draft = VIDEO_UI.UNKNOWN_DRAFT + (ai.draft ? `\n${ai.draft}` : '')
  store.currentStep = progress.value
  store.totalSteps = total.value
  store.minimized = true
}

function seekAtPointer(event: PointerEvent): void {
  const bar = progressBar.value
  if (!bar) return
  const pointed = document.elementFromPoint?.(event.clientX, event.clientY) as HTMLElement | null
  const direct = pointed?.closest?.<HTMLElement>('.progress-seg[data-act][data-step]') ?? null
  let target: { act: number; step: number } | null = null
  if (direct && bar.contains(direct)) {
    target = { act: Number(direct.dataset.act), step: Number(direct.dataset.step) }
  } else {
    const rects = [...bar.querySelectorAll<HTMLElement>('.progress-seg[data-act][data-step]')].map(el => {
      const r = el.getBoundingClientRect()
      return { act: Number(el.dataset.act), step: Number(el.dataset.step), left: r.left, right: r.right }
    })
    target = pickProgressSegment(rects, event.clientX)
  }
  if (!target) return
  if (Number.isInteger(target.act) && Number.isInteger(target.step) && (target.act !== snapshot.value.sceneIndex || target.step !== snapshot.value.stepIndex)) {
    engine.seek(target.act, target.step)
  }
}

function onProgressPointerDown(event: PointerEvent): void {
  if (event.button !== 0 && event.pointerType === 'mouse') return
  scrubbing = true
  scrubWasPlaying = snapshot.value.state === 'playing'
  if (scrubWasPlaying) engine.pause()
  progressBar.value?.setPointerCapture?.(event.pointerId)
  seekAtPointer(event)
}

function onProgressPointerMove(event: PointerEvent): void {
  if (!scrubbing) return
  seekAtPointer(event)
}

function onProgressPointerUp(event: PointerEvent): void {
  if (!scrubbing) return
  scrubbing = false
  progressBar.value?.releasePointerCapture?.(event.pointerId)
  if (scrubWasPlaying && snapshot.value.state === 'paused') engine.play()
  scrubWasPlaying = false
}

function onRootKeydown(event: KeyboardEvent): void {
  if (store.minimized) return
  handlePlayerArrowKey(event.key, {
    state: snapshot.value.state,
    isEditableTarget: !!(event.target as HTMLElement)?.matches('input,textarea,select'),
    preventDefault: () => event.preventDefault(),
    previous: () => engine.previous(),
    next: () => engine.next(),
    skipAsk: () => proceedFromAsk()
  })
}

function keydown(event: KeyboardEvent): void {
  if (store.minimized) return
  if (event.key === 'Escape') { store.current = null; return }
  if (event.key === 'Tab' && dialog.value) {
    const items = [...dialog.value.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]')].filter(el => el.getClientRects().length > 0)
    if (!items.length) { event.preventDefault(); return }
    const first = items[0], last = items[items.length - 1]
    if (event.shiftKey && (document.activeElement === first || !dialog.value.contains(document.activeElement))) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && (document.activeElement === last || !dialog.value.contains(document.activeElement))) { event.preventDefault(); first.focus() }
    return
  }
  if ((event.target as HTMLElement)?.matches('input,textarea,select,button')) return
  if (event.key === ' ') { event.preventDefault(); snapshot.value.state === 'playing' ? engine.pause() : engine.play() }
}

onMounted(() => {
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  motionMedia.addEventListener('change', onMotionChange)
  engine.setRate(Number(readVideoPreference(VIDEO_NARRATION_RATE_KEY) ?? 1))
  engine.play()
  window.addEventListener('keydown', keydown)
  void nextTick(() => dialog.value?.focus())
})
watch(() => store.minimized, value => { if (!value) void nextTick(() => dialog.value?.focus()) })
onBeforeUnmount(() => {
  clearAskTimer()
  engine.dispose()
  motionMedia.removeEventListener('change', onMotionChange)
  window.removeEventListener('keydown', keydown)
  previousFocus?.focus()
})
</script>

<template>
  <Teleport to="body">
    <div v-show="!store.minimized" ref="dialog" class="overlay" tabindex="-1" role="dialog" aria-modal="true" :aria-label="video.title" @keydown="onRootKeydown">
      <div class="player">
        <header class="vp-head">
          <div class="vp-head-left">
            <MiIcon name="film" :size="18" class="vp-head-icon" />
            <strong class="vp-title">{{ video.title }}</strong>
            <nav class="vp-acts" :aria-label="VIDEO_UI.SCENES">
              <button
                v-for="(a, i) in video.acts"
                :key="i"
                type="button"
                class="vp-act-btn"
                :class="{ active: i === snapshot.sceneIndex }"
                @click="engine.seek(i)"
              >{{ a.title }}</button>
            </nav>
          </div>
          <div class="vp-head-right">
            <span v-if="video.codeVerified === true" class="vp-verify is-ok">
              <MiIcon name="check" :size="14" />
              {{ VIDEO_UI.VERIFIED_SHORT }}
            </span>
            <span v-else-if="video.codeVerified === false" class="vp-verify is-warn">
              {{ VIDEO_UI.UNVERIFIED }}
            </span>
            <MiButton variant="ghost" icon="x" class="vp-close" :aria-label="VIDEO_UI.CLOSE" @click="store.current = null" />
          </div>
        </header>

        <div v-if="shownAct && shownStep" class="stage-wrap">
          <div v-if="shownAct.code" class="code">
            <i v-if="shownStep.line" ref="highlight" class="line-highlight" :style="{ top: `${(shownStep.line - 1) * 30}px` }" />
            <div v-for="(line, i) in shownAct.code.lines" :key="i">
              <span>{{ i + 1 }}</span><code>{{ line }}</code>
            </div>
          </div>
          <VideoStage ref="stage" :act="shownAct" :step="shownStep" :reduced="reduced" />
        </div>

        <div v-if="snapshot.state === 'asking' && step?.ask" class="caption question">
          <div class="ask-stem">
            <span class="ask-badge">{{ VIDEO_UI.ASK_BADGE }}</span>
            <MiRichText :text="step.ask.stem" />
          </div>
          <div class="options">
            <button
              v-for="(option, i) in step.ask.options"
              :key="i"
              type="button"
              class="vp-opt-btn"
              :class="{
                chosen: selected === i,
                correct: checked && i === step.ask.answer,
                wrong: checked && i === selected && i !== step.ask.answer
              }"
              :disabled="checked || recording"
              @click="chooseOption(i)"
            >
              <MiRichText :text="option" />
            </button>
          </div>
          <p v-if="checked" class="ask-why" :class="selected === step.ask.answer ? 'is-ok' : 'is-bad'">
            <MiRichText :text="step.ask.why" />
          </p>
          <div v-if="checked" class="ask-actions">
            <MiButton variant="primary" size="sm" @click="proceedFromAsk">{{ VIDEO_UI.ASK_CONTINUE }}</MiButton>
          </div>
        </div>
        <div v-else class="caption">
          <MiRichText :text="step?.say ?? ''" />
        </div>

        <footer class="vp-foot">
          <MiButton variant="ghost" icon="chevron-left" class="vp-icon-btn" :aria-label="VIDEO_UI.PREVIOUS" @click="engine.previous()" />
          <MiButton
            variant="primary"
            :icon="snapshot.state === 'playing' ? 'pause' : 'play'"
            class="vp-play-btn"
            :aria-label="snapshot.state === 'playing' ? VIDEO_UI.PAUSE : VIDEO_UI.PLAY"
            @click="snapshot.state === 'playing' ? engine.pause() : engine.play()"
          />
          <MiButton variant="ghost" icon="chevron-right" class="vp-icon-btn" :aria-label="VIDEO_UI.NEXT" @click="engine.next()" />
          <span class="vp-count">{{ progress }} / {{ total }}</span>
          <div
            ref="progressBar"
            class="progress"
            role="progressbar"
            :aria-label="VIDEO_UI.PROGRESS"
            :aria-valuenow="progress"
            :aria-valuemin="1"
            :aria-valuemax="total"
            @pointerdown="onProgressPointerDown"
            @pointermove="onProgressPointerMove"
            @pointerup="onProgressPointerUp"
            @pointercancel="onProgressPointerUp"
          >
            <div v-for="(a, ai) in video.acts" :key="ai" class="progress-act">
              <button
                v-for="(_, si) in a.steps"
                :key="si"
                type="button"
                class="progress-seg"
                :data-act="ai"
                :data-step="si"
                :class="{ active: stepIndexOf(ai, si) <= progress }"
                :aria-label="VIDEO_UI.STEP(stepIndexOf(ai, si), total)"
                @click="engine.seek(ai, si)"
              />
            </div>
          </div>
          <MiButton :variant="narration ? 'secondary' : 'ghost'" :icon="narration ? 'volume' : 'volume-x'" size="sm" class="vp-ctl-btn" :class="{ 'is-muted': !narration }" :aria-pressed="narration" @click="toggleNarration">
            {{ VIDEO_UI.NARRATION }}
          </MiButton>
          <div class="rates" role="group" :aria-label="VIDEO_UI.RATE">
            <button
              v-for="rate in [0.75, 1, 1.25, 1.5]"
              :key="rate"
              type="button"
              class="vp-rate-btn"
              :class="{ active: snapshot.rate === rate }"
              @click="setRate(rate)"
            >{{ rate }}×</button>
          </div>
          <MiButton v-if="snapshot.state === 'ended'" variant="secondary" size="sm" class="vp-replay-btn" @click="replay">
            {{ VIDEO_UI.REPLAY }}
          </MiButton>
          <MiButton v-else variant="secondary" icon="help" size="sm" class="vp-ctl-btn" @click="ask">
            {{ VIDEO_UI.UNKNOWN }}
          </MiButton>
        </footer>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  z-index: 15000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #2d3a4a99;
}
.player {
  width: min(1160px, calc(100vw - 32px));
  height: min(720px, calc(100vh - 32px));
  background: var(--mi-bg);
  border-radius: var(--mi-radius-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--mi-shadow-lg);
}
.vp-head, .vp-foot {
  display: flex;
  align-items: center;
  gap: var(--mi-sp-3);
  padding: var(--mi-sp-3) var(--mi-sp-4);
}
.vp-head {
  border-bottom: 1px solid var(--mi-border);
  justify-content: space-between;
}
.vp-head-left {
  display: flex;
  align-items: center;
  gap: var(--mi-sp-3);
  min-width: 0;
  flex: 1;
}
.vp-head-icon { color: var(--mi-blue-deep); }
.vp-title {
  font-size: var(--mi-fs-read);
  font-weight: var(--mi-fw-medium);
  color: var(--mi-text);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.vp-acts { display: flex; gap: 6px; flex-wrap: wrap; }
.vp-head-right { display: flex; align-items: center; gap: var(--mi-sp-2); flex: none; }
.vp-verify {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: var(--mi-fs-caption);
  font-weight: var(--mi-fw-medium);
}
.vp-verify.is-ok { background: var(--mi-success-fill); color: var(--mi-success-deep); }
.vp-verify.is-warn { background: var(--mi-warn-fill, var(--mi-warn-light)); color: var(--mi-warn-deep); }
.vp-act-btn, .vp-rate-btn, .vp-opt-btn {
  border: 1px solid var(--mi-border);
  background: var(--mi-bg);
  color: var(--mi-text-2);
  font: inherit;
  font-size: var(--mi-fs-label);
  cursor: var(--mi-cursor, pointer);
  min-width: 32px;
  min-height: 32px;
  padding: 0 var(--mi-sp-3);
  border-radius: var(--mi-radius);
  transition: background var(--mi-dur-fast) var(--mi-ease), color var(--mi-dur-fast) var(--mi-ease), border-color var(--mi-dur-fast) var(--mi-ease);
}
.vp-act-btn { border-radius: 999px; }
.vp-act-btn.active {
  background: var(--mi-blue-light);
  border-color: transparent;
  color: var(--mi-blue-deep);
  font-weight: var(--mi-fw-medium);
}
.vp-rate-btn {
  border-color: transparent;
  background: transparent;
  border-radius: 6px;
  padding: 0 var(--mi-sp-2);
  font-size: var(--mi-fs-caption);
}
.vp-rate-btn.active {
  background: var(--mi-bg);
  color: var(--mi-text);
  box-shadow: var(--mi-shadow-sm);
}
.vp-act-btn:focus-visible, .vp-rate-btn:focus-visible, .vp-opt-btn:focus-visible {
  outline: 2px solid var(--mi-blue-deep);
  outline-offset: 2px;
}
.vp-close, .vp-icon-btn {
  width: 32px;
  height: 32px;
  min-width: 32px;
  min-height: 32px;
  padding: 0;
}
.vp-play-btn {
  width: 40px;
  height: 40px;
  min-width: 40px;
  min-height: 40px;
  padding: 0;
  border-radius: 50%;
}
.vp-count {
  font-size: var(--mi-fs-caption);
  color: var(--mi-text-3);
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
.stage-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 20px;
  padding: 20px;
  background: var(--mi-canvas);
}
.code {
  --video-code-size: 15px;
  position: relative;
  width: 300px;
  min-width: 300px;
  max-width: 300px;
  flex: 0 0 300px;
  max-height: 100%;
  align-self: center;
  overflow: auto;
  background: var(--mi-bg);
  border: 1px solid var(--mi-border);
  border-radius: var(--mi-radius);
  font: var(--video-code-size)/30px var(--mi-code);
}
.line-highlight {
  position: absolute;
  left: 0;
  right: 0;
  height: 30px;
  background: var(--mi-blue-light);
  box-shadow: inset 3px 0 var(--mi-blue-deep);
}
.code div { position: relative; display: flex; white-space: pre; padding: 0 12px; }
.code span { color: var(--mi-text-3); width: 28px; flex: none; }
.caption {
  min-height: 76px;
  padding: var(--mi-sp-4) var(--mi-sp-6);
  text-align: center;
  font-size: calc(var(--mi-fs-read) + 4px);
  line-height: 1.55;
  color: var(--mi-text);
  display: flex;
  align-items: center;
  justify-content: center;
}
.question {
  flex-direction: column;
  gap: var(--mi-sp-3);
  padding: var(--mi-sp-4) var(--mi-sp-6);
  border-top: 1px solid var(--mi-border);
}
.ask-stem {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--mi-sp-2);
  font-size: calc(var(--mi-fs-read) + 4px);
  font-weight: var(--mi-fw-medium);
}
.ask-badge {
  flex: none;
  white-space: nowrap;
  font-size: var(--mi-fs-caption);
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--mi-blue-light);
  color: var(--mi-blue-deep);
}
.options { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--mi-sp-2); }
.vp-opt-btn { min-width: 120px; padding: var(--mi-sp-2) var(--mi-sp-4); font-size: var(--mi-fs-read); color: var(--mi-text); }
.vp-opt-btn.chosen { border-color: var(--mi-blue-deep); }
.vp-opt-btn.correct { border-color: var(--mi-success-deep); background: var(--mi-success-fill); color: var(--mi-success-deep); }
.vp-opt-btn.wrong { border-color: var(--mi-error-deep); background: var(--mi-error-fill); color: var(--mi-error-deep); }
.ask-why { font-size: var(--mi-fs-body); margin: 0; }
.ask-why.is-ok { color: var(--mi-success-deep); }
.ask-why.is-bad { color: var(--mi-error-deep); }
.ask-actions { display: flex; justify-content: center; }
.vp-foot { border-top: 1px solid var(--mi-border); justify-content: space-between; }
.progress { display: flex; flex: 1; min-width: 60px; gap: 10px; align-items: center; touch-action: none; }
.progress-act { display: flex; flex: 1; gap: 3px; }
.progress-seg {
  position: relative;
  flex: 1;
  height: 6px;
  min-width: 6px;
  padding: 0;
  border: 0;
  border-radius: 3px;
  background: var(--mi-border);
  cursor: var(--mi-cursor, pointer);
  transition: background var(--mi-dur-fast) var(--mi-ease);
}
.progress-seg::after { content: ''; position: absolute; inset: -13px 0; }
.progress-seg.active { background: var(--mi-blue-deep); }
.progress-seg:focus-visible { outline: 2px solid var(--mi-blue-deep); outline-offset: 2px; }
.vp-ctl-btn.is-muted { color: var(--mi-text-3); border: 1px solid var(--mi-border); }
.vp-replay-btn { border-color: var(--mi-blue); color: var(--mi-blue-deep); background: var(--mi-bg); }
.rates { display: inline-flex; background: var(--mi-canvas); border-radius: var(--mi-radius); padding: 2px; border: 1px solid var(--mi-border); }
@media (max-width: 700px) {
  .player { width: 100vw; height: 100dvh; border-radius: 0; }
  .vp-head { flex-wrap: wrap; }
  .vp-acts { order: 3; flex-basis: 100%; }
  .stage-wrap { flex-direction: column; padding: 8px; gap: 8px; }
  .code { width: 100%; min-width: 0; max-width: none; max-height: 35%; flex: 0 1 auto; }
  .caption { text-align: left; font-size: var(--mi-fs-read); padding: var(--mi-sp-3); }
  .vp-foot { flex-wrap: wrap; justify-content: center; }
  .progress { order: -1; flex-basis: 100%; }
  .rates { width: 100%; justify-content: center; }
}
</style>
