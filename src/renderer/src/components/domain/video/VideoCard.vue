<script setup lang="ts">
import { computed } from 'vue'
import type { ExplainerVideo } from '../../../../../shared/video'
import { VIDEO_UI } from '../../../lib/copy'
import MiButton from '../../base/MiButton.vue'
import MiIcon from '../../base/MiIcon.vue'
import MiRichText from '../../base/MiRichText.vue'
import VideoStage from './VideoStage.vue'

const props = withDefaults(defineProps<{
  video: ExplainerVideo
  showRegenerate?: boolean
  showDelete?: boolean
  subtitle?: string
}>(), {
  showRegenerate: false,
  showDelete: false,
  subtitle: ''
})

defineEmits<{
  play: [video: ExplainerVideo]
  regenerate: [video: ExplainerVideo]
  delete: [video: ExplainerVideo]
}>()

const firstAct = computed(() => props.video.acts?.[0])
const lastStep = computed(() => firstAct.value?.steps?.[firstAct.value.steps.length - 1])

const seconds = computed(() => {
  const text = (props.video.acts ?? []).flatMap(act => act.steps.map(step => step.say)).join('')
  return Math.round(Array.from(text.replace(/[\u0000-\u001f\u007f-\u009f]/g, '')).length / 4.5)
})

const asks = computed(() =>
  (props.video.acts ?? []).reduce((sum, act) => sum + act.steps.filter(step => step.ask).length, 0)
)
</script>

<template>
  <article class="video-card">
    <button
      type="button"
      class="vc-thumb-box"
      :aria-label="`${VIDEO_UI.PLAY} ${video.title}`"
      @click="$emit('play', video)"
    >
      <span class="vc-thumb">
        <span v-if="firstAct && lastStep" class="vc-stage-wrap" aria-hidden="true">
          <VideoStage :act="firstAct" :step="lastStep" :reduced="true" :static="true" />
        </span>
      </span>
      <span class="vc-play-circle" aria-hidden="true">
        <MiIcon name="play" :size="16" />
      </span>
    </button>

    <div class="vc-body">
      <div v-if="video.source === 'builtin'" class="vc-tags">
        <span class="vc-builtin-badge">{{ VIDEO_UI.BUILTIN_TITLE }}</span>
      </div>
      <div class="vc-title-row">
        <strong class="vc-title">{{ video.title }}</strong>
        <span v-if="video.codeVerified === true" class="vc-badge is-ok">
          <MiIcon name="check" :size="12" />
          {{ VIDEO_UI.VERIFIED_SHORT }}
        </span>
        <span v-else-if="video.codeVerified === false" class="vc-badge is-warn">
          {{ VIDEO_UI.UNVERIFIED }}
        </span>
      </div>

      <span v-if="subtitle" class="vc-sub">
        <MiRichText :text="subtitle" />
      </span>

      <span class="vc-meta">{{ VIDEO_UI.CARD_META(video.acts.length, seconds, asks) }}</span>
    </div>

    <div class="vc-actions">
      <MiButton variant="primary" size="sm" icon="play" @click="$emit('play', video)">
        {{ VIDEO_UI.PLAY }}
      </MiButton>
      <MiButton
        v-if="showRegenerate && video.source !== 'builtin'"
        variant="ghost"
        size="sm"
        @click="$emit('regenerate', video)"
      >
        {{ VIDEO_UI.REGENERATE }}
      </MiButton>
      <MiButton
        v-if="showDelete && video.source !== 'builtin'"
        variant="ghost"
        size="sm"
        @click="$emit('delete', video)"
      >
        {{ VIDEO_UI.DELETE }}
      </MiButton>
    </div>
  </article>
</template>

<style scoped>
.video-card {
  display: flex;
  flex-direction: column;
  gap: var(--mi-sp-3);
  padding: var(--mi-sp-3);
  border: 1px solid var(--mi-border);
  border-radius: var(--mi-radius-lg);
  background: var(--mi-bg);
}
.vc-thumb-box {
  position: relative;
  width: 100%;
  height: 150px;
  padding: 12px;
  overflow: hidden;
  border: 0;
  border-radius: var(--mi-radius);
  background: var(--mi-canvas);
  cursor: var(--mi-cursor, pointer);
  display: flex;
  align-items: center;
  justify-content: center;
}
.vc-thumb-box:focus-visible {
  outline: 2px solid var(--mi-blue-deep);
  outline-offset: 2px;
}
.vc-thumb {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.vc-stage-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.vc-stage-wrap :deep(.output) {
  display: none;
}
.vc-tags {
  display: flex;
  align-items: center;
  gap: var(--mi-sp-2);
}
.vc-builtin-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--mi-blue-light);
  color: var(--mi-blue-deep);
  font-size: var(--mi-fs-caption);
  font-weight: var(--mi-fw-medium);
}
.vc-play-circle {
  position: absolute;
  right: 10px;
  bottom: 10px;
  z-index: 2;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid var(--mi-border);
  color: var(--mi-blue-deep);
  box-shadow: var(--mi-shadow-lg);
}
.vc-body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.vc-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--mi-sp-2);
}
.vc-title {
  font-size: var(--mi-fs-read);
  font-weight: var(--mi-fw-medium);
  color: var(--mi-text);
  overflow-wrap: anywhere;
}
.vc-badge {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: var(--mi-fs-caption);
  font-weight: var(--mi-fw-medium);
  white-space: nowrap;
}
.vc-badge.is-ok {
  background: var(--mi-success-fill);
  color: var(--mi-success-deep);
}
.vc-badge.is-warn {
  background: var(--mi-warn-fill, var(--mi-warn-light));
  color: var(--mi-warn-deep);
}
.vc-sub {
  font-size: var(--mi-fs-body);
  color: var(--mi-text-2);
}
.vc-meta {
  font-size: var(--mi-fs-caption);
  color: var(--mi-text-3);
}
.vc-actions {
  display: flex;
  align-items: center;
  gap: var(--mi-sp-2);
}
</style>
