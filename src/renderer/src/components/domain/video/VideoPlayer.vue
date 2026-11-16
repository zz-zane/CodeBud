<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ExplainerVideo } from '../../../../../shared/video'
import { questionKey } from '../../../../../shared/question-key'
import { useVideoStore } from '../../../stores/video'
import { useAiAssistantStore } from '../../../stores/ai-assistant'
import { usePracticeStore } from '../../../stores/practice'
import { VideoEngine, type VideoPlaybackSnapshot } from '../../../lib/video-engine'
import { createVideoNarrator, readVideoPreference, writeVideoPreference, VIDEO_NARRATION_ENABLED_KEY, VIDEO_NARRATION_RATE_KEY } from '../../../lib/video-narrator'
import { VIDEO_UI } from '../../../lib/copy'
import MiButton from '../../base/MiButton.vue'
import MiIcon from '../../base/MiIcon.vue'
import MiRichText from '../../base/MiRichText.vue'
import { splitInline } from '../../../lib/rich-text'
import { toast } from '../../base/toast'
import StageCard from './StageCard.vue'
import StageTrace from './StageTrace.vue'
import StageMemory from './StageMemory.vue'
import StageArray from './StageArray.vue'

const props = defineProps<{ video: ExplainerVideo }>()
const videoStore = useVideoStore()
const dialog = ref<HTMLElement | null>(null)
let previousFocus: HTMLElement | null = null
const ai = useAiAssistantStore()
const practice = usePracticeStore()
const snapshot = ref<VideoPlaybackSnapshot>({ state: 'idle', sceneIndex: 0, stepIndex: 0, rate: 1 })
const baseNarrator = createVideoNarrator()
const narrator = {
  speak: (say: string, rate: number) =>
    baseNarrator.speak(props.video.source === 'demo' ? splitInline(say).map(seg => seg.text).join('') : say, rate),
  cancel: () => baseNarrator.cancel()
}
const engine = new VideoEngine(props.video, narrator, value => { snapshot.value = value })
const scene = computed(() => props.video.scenes[snapshot.value.sceneIndex])
const step = computed(() => scene.value?.kind === 'card' ? null : scene.value?.steps[snapshot.value.stepIndex])
const subtitle = computed(() => scene.value?.kind === 'card' ? scene.value.say : step.value?.say ?? '')
const title = computed(() => scene.value?.kind === 'card' ? scene.value.heading : scene.value?.title ?? '')
const analogy = computed(() => {
  const item = props.video.scenes.find(s => s.kind === 'card' && s.role === 'analogy')
  return item?.kind === 'card' ? item.body : ''
})
const narration = ref(readVideoPreference(VIDEO_NARRATION_ENABLED_KEY) !== 'false')
const answers = ref<number[]>([])
const checkIndex = ref(0)
const selected = ref<number | null>(null)
const checked = ref(false)
const check = computed(() => props.video.checks[checkIndex.value])
const recording = ref(false)
const totalSteps = computed(() => props.video.scenes.reduce((n, s) => n + (s.kind === 'card' ? 1 : s.steps.length), 0))
const progress = computed(() => props.video.scenes.slice(0, snapshot.value.sceneIndex).reduce((n, s) => n + (s.kind === 'card' ? 1 : s.steps.length), 0) + snapshot.value.stepIndex)

function seekGlobal(value: number): void {
  for (let i = 0; i < props.video.scenes.length; i++) {
    const s = props.video.scenes[i], count = s.kind === 'card' ? 1 : s.steps.length
    if (value < count) { engine.seek(i, value); return }
    value -= count
  }
}
function setRate(event: Event): void {
  const value = Number((event.target as HTMLSelectElement).value)
  engine.setRate(value); writeVideoPreference(VIDEO_NARRATION_RATE_KEY, String(value))
}
function toggleNarration(): void {
  narration.value = !narration.value
  writeVideoPreference(VIDEO_NARRATION_ENABLED_KEY, String(narration.value))
  if (snapshot.value.state === 'playing') { engine.pause(); engine.play() }
}
function ask(): void {
  engine.pause()
  const content = `${subtitle.value}\n${VIDEO_UI.UNKNOWN_STATE}${JSON.stringify(step.value ?? scene.value)}`
  ai.openWithSelection({ text: content, title: title.value, type: 'selection', action: 'ask', lessonId: props.video.lessonId })
  ai.draft = VIDEO_UI.UNKNOWN_DRAFT + (ai.draft ? `\n${ai.draft}` : '')
  videoStore.minimized = true
}
async function finishCheck(): Promise<void> {
  if (selected.value === null || !check.value || recording.value) return
  if (!checked.value) { checked.value = true; return }
  const completed = [...answers.value, selected.value]
  if (checkIndex.value + 1 < props.video.checks.length) { answers.value = completed; checkIndex.value++; selected.value = null; checked.value = false; return }
  recording.value = true
  try {
    await recordAnswers(completed)
    videoStore.current = null
  } catch (error) {
    toast(error instanceof Error ? error.message : String(error), 'error')
  } finally { recording.value = false }
}
async function recordAnswers(completed: number[]): Promise<void> {
  if (props.video.lessonId) {
    const file = await window.miai.recordPractice({ mode: 'video-check', items: completed.map((answer, i) => ({ key: questionKey(props.video.lessonId!, `video-${props.video.id}-${i}`), ok: answer === props.video.checks[i].answer })) })
    practice.adopt(file)
  }
}
async function explainAnotherWay(): Promise<void> {
  if (selected.value === null || recording.value) return
  recording.value = true
  try {
    await recordAnswers([...answers.value, selected.value])
    videoStore.open({ question: props.video.question, lessonId: props.video.lessonId, avoid: analogy.value })
    videoStore.current = null
  } catch (error) {
    toast(error instanceof Error ? error.message : String(error), 'error')
  } finally { recording.value = false }
}
function keydown(event: KeyboardEvent): void {
  if (videoStore.minimized) return
  if (event.key === 'Escape') { videoStore.current = null; return }
  if (event.key === 'Tab' && dialog.value) {
    const focusable = [...dialog.value.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')].filter(el => el.getClientRects().length > 0)
    if (!focusable.length) { event.preventDefault(); return }
    const first = focusable[0], last = focusable[focusable.length - 1]
    if (event.shiftKey && (document.activeElement === first || !dialog.value.contains(document.activeElement))) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && (document.activeElement === last || !dialog.value.contains(document.activeElement))) { event.preventDefault(); first.focus() }
    return
  }
  if ((event.target as HTMLElement)?.matches('input,textarea,select,button')) return
  if (snapshot.value.state === 'ended') return
  if (event.key === ' ') { event.preventDefault(); snapshot.value.state === 'playing' ? engine.pause() : engine.play() }
  else if (event.key === 'ArrowLeft') { event.preventDefault(); engine.previous() }
  else if (event.key === 'ArrowRight') { event.preventDefault(); engine.next() }
}
onMounted(() => {
  previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const rate = Number(readVideoPreference(VIDEO_NARRATION_RATE_KEY) ?? 1)
  engine.setRate(rate); engine.play(); window.addEventListener('keydown', keydown); void nextTick(() => dialog.value?.focus())
})
watch(() => videoStore.minimized, minimized => { if (!minimized) void nextTick(() => dialog.value?.focus()) })
onBeforeUnmount(() => { engine.dispose(); window.removeEventListener('keydown', keydown); previousFocus?.focus() })
</script>

<template>
  <Teleport to="body"><div v-show="!videoStore.minimized" ref="dialog" class="overlay" tabindex="-1" role="dialog" aria-modal="true" :aria-label="video.title">
    <div class="player">
      <header class="head">
        <MiIcon name="film" :size="18" class="head-icon" />
        <strong>{{ video.title }}</strong>
        <span v-if="video.codeVerified === false" class="badge">{{ VIDEO_UI.UNVERIFIED }}</span>
        <span v-else-if="video.codeVerified" class="badge verified"><MiIcon name="check" :size="12" />{{ VIDEO_UI.VERIFIED }}</span>
        <button type="button" class="close" :aria-label="VIDEO_UI.CLOSE" @click="videoStore.current = null"><MiIcon name="x" :size="16" /></button>
      </header>
      <div v-if="snapshot.state !== 'ended' || !video.checks.length" class="body">
        <nav class="scenes" :aria-label="VIDEO_UI.SCENES"><button v-for="(item, i) in video.scenes" :key="i" type="button" :class="{ active: snapshot.sceneIndex === i }" @click="engine.seek(i)"><span>{{ i + 1 }}</span>{{ item.kind === 'card' ? item.heading : item.title }}</button></nav>
        <main class="stage"><h3>{{ title }}</h3>
          <StageCard v-if="scene?.kind === 'card'" :scene="scene" />
          <StageTrace v-else-if="scene?.kind === 'trace'" :scene="scene" :step-index="snapshot.stepIndex" />
          <StageMemory v-else-if="scene?.kind === 'memory'" :scene="scene" :step-index="snapshot.stepIndex" />
          <StageArray v-else-if="scene?.kind === 'array'" :scene="scene" :step-index="snapshot.stepIndex" />
          <div class="caption" aria-live="polite"><MiRichText v-if="video.source === 'demo'" :text="subtitle" /><template v-else>{{ subtitle }}</template></div>
        </main>
      </div>
      <div v-else class="check"><h2>{{ VIDEO_UI.CHECK_TITLE }}</h2><p>{{ VIDEO_UI.CHECK_NUMBER(checkIndex + 1, video.checks.length) }}</p><h3>{{ check?.stem }}</h3>
        <label v-for="(option, i) in check?.options" :key="i" class="option" :class="{ right: checked && i === check?.answer, wrong: checked && i === selected && i !== check?.answer }"><input v-model="selected" type="radio" :value="i" :disabled="checked">{{ option }}</label>
        <p v-if="checked" class="explanation">{{ selected === check?.answer ? VIDEO_UI.CHECK_RIGHT : VIDEO_UI.CHECK_WRONG }} · {{ VIDEO_UI.EXPLANATION }}：{{ check?.explanation }}</p>
        <div class="check-actions"><MiButton v-if="checked && selected !== check?.answer" variant="secondary" :disabled="recording" @click="explainAnotherWay">{{ VIDEO_UI.REGENERATE }}</MiButton><MiButton variant="primary" :disabled="selected === null || recording" @click="finishCheck">{{ checked ? (checkIndex + 1 < video.checks.length ? VIDEO_UI.CHECK_NEXT : VIDEO_UI.CHECK_DONE) : VIDEO_UI.CHECK_SUBMIT }}</MiButton></div>
      </div>
      <footer v-if="snapshot.state !== 'ended' || !video.checks.length" class="foot">
        <button type="button" class="nav-btn nav-prev" :aria-label="VIDEO_UI.PREVIOUS" @click="engine.previous()"><MiIcon name="chevron-left" :size="16" /></button>
        <button type="button" class="play" :aria-label="snapshot.state === 'playing' ? VIDEO_UI.PAUSE : VIDEO_UI.PLAY" @click="snapshot.state === 'playing' ? engine.pause() : engine.play()"><MiIcon :name="snapshot.state === 'playing' ? 'pause' : 'play'" :size="18" :filled="snapshot.state !== 'playing'" /></button>
        <button type="button" class="nav-btn nav-next" :aria-label="VIDEO_UI.NEXT" @click="engine.next()"><MiIcon name="chevron-right" :size="16" /></button>
        <span class="count">{{ VIDEO_UI.STEP(progress + 1, totalSteps) }}</span>
        <div class="timeline"><div class="segments" aria-hidden="true"><span v-for="(part, i) in video.scenes" :key="i" :style="{ flex: part.kind === 'card' ? 1 : part.steps.length }"><i :style="{ width: i < snapshot.sceneIndex ? '100%' : i > snapshot.sceneIndex ? '0%' : `${(snapshot.stepIndex + 1) * 100 / (part.kind === 'card' ? 1 : part.steps.length)}%` }" /></span></div><input type="range" :aria-label="VIDEO_UI.PROGRESS" min="0" :max="Math.max(0, totalSteps - 1)" :value="progress" @input="seekGlobal(Number(($event.target as HTMLInputElement).value))"></div>
        <button type="button" class="foot-btn narration-btn" :class="{ off: !narration }" :aria-pressed="narration" :aria-label="VIDEO_UI.NARRATION" :title="VIDEO_UI.NARRATION" @click="toggleNarration"><MiIcon name="volume" :size="16" /><span class="narration-label">{{ VIDEO_UI.NARRATION }}</span></button>
        <select class="rate-select" :value="snapshot.rate" :aria-label="VIDEO_UI.RATE" @change="setRate"><option :value="0.75">0.75×</option><option :value="1">1.0×</option><option :value="1.25">1.25×</option><option :value="1.5">1.5×</option></select>
        <MiButton variant="secondary" icon="help" @click="ask">{{ VIDEO_UI.UNKNOWN }}</MiButton>
      </footer>
    </div>
  </div></Teleport>
</template>
<style scoped>
.overlay { position:fixed; inset:0; z-index:15000; display:flex; align-items:center; justify-content:center; background:color-mix(in srgb, var(--mi-overlay) 55%, transparent); font-family:var(--mi-font-family); }
.player { width:min(1120px, calc(100vw - 32px)); height:min(700px, calc(100vh - 32px)); background:var(--mi-bg); border-radius:var(--mi-radius-lg); box-shadow:var(--mi-shadow-lg); overflow:hidden; display:flex; flex-direction:column; }
.head { flex:none; height:48px; display:flex; align-items:center; gap:var(--mi-sp-3); padding:0 var(--mi-sp-4); border-bottom:1px solid var(--mi-border); }.head-icon { color:var(--mi-blue-deep); }.head strong { font-size:var(--mi-fs-read); font-weight:var(--mi-fw-medium); flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.badge { display:inline-flex; align-items:center; gap:var(--mi-sp-1); padding:2px var(--mi-sp-3); border-radius:999px; background:var(--mi-warn-fill); color:var(--mi-warn-deep); font-size:var(--mi-fs-caption); white-space:nowrap; }.badge.verified { background:var(--mi-success-fill); color:var(--mi-success-deep); }
.close,.nav-btn { min-width:var(--mi-ctl); min-height:var(--mi-ctl); display:inline-flex; align-items:center; justify-content:center; border-radius:var(--mi-radius-ctl); color:var(--mi-text-2); }.close:hover,.nav-btn:hover,.foot-btn:hover { background:var(--mi-blue-light); color:var(--mi-text); }
button { font:inherit; border:0; background:transparent; color:inherit; cursor:pointer; }.body { flex:1; min-height:0; display:flex; }.scenes { width:216px; flex:none; padding:var(--mi-sp-3) var(--mi-sp-2); overflow:auto; border-right:1px solid var(--mi-border); background:var(--mi-canvas); }.scenes button { display:flex; width:100%; gap:var(--mi-sp-2); text-align:left; padding:var(--mi-sp-2); border-radius:var(--mi-radius); color:var(--mi-text-2); }.scenes button.active { background:var(--mi-blue); color:var(--mi-text); }.scenes span { color:var(--mi-text-3); }
.stage { flex:1; min-width:0; min-height:0; display:flex; flex-direction:column; gap:var(--mi-sp-4); padding:var(--mi-sp-6) var(--mi-sp-8); background:var(--mi-blue-light); }.stage h3 { font-size:var(--mi-fs-read); font-weight:var(--mi-fw-medium); }.caption { margin:auto auto 0; max-width:720px; background:var(--mi-bg); border:1px solid var(--mi-border); border-radius:var(--mi-radius-lg); padding:var(--mi-sp-3) var(--mi-sp-4); text-align:center; font-size:var(--mi-fs-read); line-height:1.6; white-space:pre-wrap; }
.foot { min-height:64px; border-top:1px solid var(--mi-border); padding:var(--mi-sp-2) var(--mi-sp-4); display:flex; align-items:center; gap:var(--mi-sp-3); }.foot .play { width:40px; height:40px; flex:none; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; background:var(--mi-blue-deep); color:var(--mi-btn-primary-text); }
.foot-btn { min-width:var(--mi-ctl); min-height:var(--mi-ctl); padding:0 var(--mi-sp-3); border:1px solid var(--mi-border); border-radius:var(--mi-radius-ctl); background:var(--mi-bg); display:inline-flex; align-items:center; justify-content:center; gap:var(--mi-sp-1); font-size:var(--mi-fs-label); white-space:nowrap; }.foot-btn.off { color:var(--mi-text-3); }
.rate-select { min-width:var(--mi-ctl); min-height:var(--mi-ctl); padding:0 var(--mi-sp-2); border:1px solid var(--mi-border); border-radius:var(--mi-radius-ctl); background:var(--mi-bg); font-family:var(--mi-code); font-size:var(--mi-fs-label); color:inherit; cursor:pointer; }
.timeline { position:relative; flex:1; min-width:0; display:flex; align-items:center; }.segments { display:flex; gap:3px; width:100%; height:6px; }.segments span { background:var(--mi-blue); border-radius:var(--mi-radius); overflow:hidden; }.segments i { display:block; height:100%; background:var(--mi-blue-deep); }.timeline input { position:absolute; left:0; top:50%; transform:translateY(-50%); width:100%; height:var(--mi-ctl-lg); appearance:none; background:transparent; cursor:pointer; }.timeline input::-webkit-slider-thumb { appearance:none; width:1px; height:1px; background:transparent; }.timeline input::-moz-range-thumb { width:1px; height:1px; border:0; background:transparent; }
.count { font-family:var(--mi-code); font-size:var(--mi-fs-caption); white-space:nowrap; color:var(--mi-text-3); }
.check { flex:1; overflow:auto; width:min(100%, 620px); margin:auto; padding:var(--mi-sp-8); }.check h2 { font-size:var(--mi-fs-title); }.check h3 { margin:var(--mi-sp-6) 0; font-size:var(--mi-fs-read); }.option { display:flex; align-items:center; gap:var(--mi-sp-3); border:1px solid var(--mi-border); border-radius:var(--mi-radius); padding:var(--mi-sp-3); margin:var(--mi-sp-2) 0; }.option.right { border-color:var(--mi-success-deep); }.option.wrong { border-color:var(--mi-error-deep); }.explanation { margin:var(--mi-sp-4) 0; }.check-actions { display:flex; justify-content:flex-end; gap:var(--mi-sp-2); margin-top:var(--mi-sp-4); }
.timeline:focus-within { outline:2px solid var(--mi-blue-deep); outline-offset:4px; }
@media(max-width:700px) { .player { width:100vw; height:100dvh; border-radius:0; }.scenes { display:none; }.stage { padding:var(--mi-sp-4); }.caption { align-self:stretch; min-height:38%; width:calc(100% + 32px); max-width:none; margin-left:calc(-1 * var(--mi-sp-4)); margin-bottom:calc(-1 * var(--mi-sp-4)); border:0; border-radius:0; text-align:left; }.foot { flex-wrap:wrap; justify-content:space-between; }.foot .timeline { order:1; flex:1 1 80%; }.foot .count { order:2; }.foot .rate-select { order:3; }.foot .nav-prev { order:4; }.foot .play { order:5; width:48px; height:48px; }.foot .nav-next { order:6; }.foot .narration-btn { order:7; padding:0 var(--mi-sp-2); }.foot .narration-label { display:none; }.foot :deep(.mi-btn) { order:8; flex-basis:100%; }.check { padding:var(--mi-sp-4); } }
</style>
