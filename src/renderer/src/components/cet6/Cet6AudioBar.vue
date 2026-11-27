<script setup lang="ts">
/**
 * 听力音频条。<audio> 常驻（由父级 v-show 控制可见），所以切到别的 Part 再回来不会重载、不会从头播。
 * src 为空串 = 没有音频（共用别套 / 缺失）。倍速在换源后保持（defaultPlaybackRate）。
 */
import { ref, watch } from 'vue'
import { CET6 } from '../../lib/copy'
import MiIcon from '../base/MiIcon.vue'
import { formatTime } from '../../../../shared/cet6'

const props = defineProps<{ src: string; tip: string }>()

const SPEEDS = [0.8, 1, 1.2, 1.5]
const audio = ref<HTMLAudioElement | null>(null)
const playing = ref(false)
const current = ref(0)
const duration = ref(0)
const speed = ref(1)
const failed = ref(false)

watch(
  () => props.src,
  () => {
    current.value = 0
    duration.value = 0
    failed.value = false
    playing.value = false
    if (audio.value) audio.value.defaultPlaybackRate = speed.value
  }
)

function toggle(): void {
  const el = audio.value
  if (!el) return
  if (!el.paused) {
    el.pause()
    return
  }
  el.play().catch((err: Error) => {
    if (err.name !== 'AbortError') failed.value = true
  })
}

function pause(): void {
  audio.value?.pause()
}

function seekBy(sec: number): void {
  const el = audio.value
  if (el && el.duration) el.currentTime = Math.max(0, Math.min(el.duration, el.currentTime + sec))
}

function onSeek(e: Event): void {
  const el = audio.value
  const v = Number((e.target as HTMLInputElement).value)
  if (el && el.duration) el.currentTime = (v / 100) * el.duration
}

function setSpeed(s: number): void {
  speed.value = s
  if (audio.value) {
    audio.value.defaultPlaybackRate = s // load() 会把 playbackRate 重设成它
    audio.value.playbackRate = s
  }
}

function onTime(): void {
  const el = audio.value
  if (!el) return
  current.value = el.currentTime
  duration.value = el.duration || 0
}

defineExpose({ pause })
</script>

<template>
  <div class="cet6-audio">
    <audio
      ref="audio"
      class="cet6-audio-el"
      preload="metadata"
      :src="src || undefined"
      @play="playing = true"
      @pause="playing = false"
      @ended="playing = false"
      @timeupdate="onTime"
      @loadedmetadata="onTime"
      @error="failed = !!src"
    />
    <template v-if="src">
      <button type="button" class="icon-btn" :title="playing ? CET6.AUDIO_PAUSE : CET6.AUDIO_PLAY" :aria-label="playing ? CET6.AUDIO_PAUSE : CET6.AUDIO_PLAY" data-audio="toggle" @click="toggle">
        <MiIcon :name="playing ? 'pause' : 'play'" :size="16" />
      </button>
      <button type="button" class="pg-chip" :title="CET6.AUDIO_BACK" :aria-label="CET6.AUDIO_BACK" @click="seekBy(-10)">-10</button>
      <button type="button" class="pg-chip" :title="CET6.AUDIO_FORWARD" :aria-label="CET6.AUDIO_FORWARD" @click="seekBy(10)">+10</button>
      <span class="cet6-time">{{ formatTime(current) }}</span>
      <input
        class="cet6-seek"
        type="range"
        min="0"
        max="100"
        step="0.1"
        :value="duration > 0 ? (current / duration) * 100 : 0"
        :aria-label="CET6.AUDIO_SEEK"
        data-audio="seek"
        @input="onSeek"
      />
      <span class="cet6-time">{{ formatTime(duration) }}</span>
      <span class="pg-chips" role="group" :aria-label="CET6.AUDIO_SPEED">
        <button
          v-for="s in SPEEDS"
          :key="s"
          type="button"
          class="pg-chip"
          :class="{ active: speed === s }"
          :aria-pressed="speed === s"
          @click="setSpeed(s)"
        >
          {{ s.toFixed(1) }}
        </button>
      </span>
    </template>
    <span v-if="failed" class="cet6-audio-tip cet6-audio-fail" role="alert">{{ CET6.AUDIO_FAILED }}</span>
    <span v-else-if="tip" class="cet6-audio-tip">{{ tip }}</span>
  </div>
</template>

<style scoped>
.cet6-audio { display: flex; align-items: center; gap: var(--mi-sp-2); flex-wrap: wrap; min-height: 32px; }
.cet6-audio-el { display: none; }
.cet6-time { font-size: var(--mi-fs-caption); color: var(--mi-text-3); font-variant-numeric: tabular-nums; }
.cet6-seek { flex: 1 1 160px; min-width: 120px; accent-color: var(--mi-blue-deep); }
.cet6-audio-tip { font-size: var(--mi-fs-caption); color: var(--mi-text-3); }
.cet6-audio-fail { color: var(--mi-error-deep); }
</style>
