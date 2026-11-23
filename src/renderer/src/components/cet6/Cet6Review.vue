<script setup lang="ts">
/** 交卷后每题的核对行 + 解析。只在 submitted 后才会被父组件渲染（答案和解析不进 DOM 的前提）。 */
import { computed } from 'vue'
import { CET6 } from '../../lib/copy'
import { isRight, isScored, normalizedAnswer, usableExplanation, type Cet6Question } from '../../../../shared/cet6'
import { CET6_LOCATE_EVENT } from '../../lib/use-cet6-evidence'

const props = defineProps<{ q: Cet6Question; given?: string; open?: boolean }>()

const unofficial = computed(() => /非官方/.test(props.q.verificationNote || ''))
const scored = computed(() => isScored(props.q))
const right = computed(() => isRight(props.q, props.given))
const explanation = computed(() => usableExplanation(props.q))
const canLocate = computed(() => (props.q.evidence?.length ?? 0) > 0)
function locate(): void {
  window.dispatchEvent(new CustomEvent(CET6_LOCATE_EVENT, { detail: props.q }))
}
</script>

<template>
  <div class="cet6-review">
    <div class="cet6-review-line">
      <template v-if="scored">
        <span :class="{ 'is-wrong': !right }">{{ CET6.yourAnswer(given ?? '') }}</span>
        <span class="cet6-answer">{{ CET6.rightAnswer(normalizedAnswer(q), unofficial) }}</span>
      </template>
      <template v-else-if="q.unanswerable === true">{{ CET6.UNANSWERABLE_TIP }}</template>
      <template v-else-if="q.answer">
        <span class="cet6-answer">{{ CET6.refAnswer(q.answer) }}</span>
        <span class="cet6-note">{{ CET6.PENDING }}</span>
      </template>
      <template v-else>{{ CET6.NO_VERIFIED }}</template>
    </div>
    <details v-if="explanation || unofficial" :open="open">
      <summary>{{ CET6.EXPLANATION }}</summary>
      <button v-if="canLocate" type="button" class="cet6-locate" @click="locate">{{ CET6.LOCATE_EVIDENCE }}</button>
      <div v-if="explanation" class="cet6-review-text">{{ explanation }}</div>
      <div v-if="unofficial" class="cet6-note">{{ q.verificationNote }}</div>
    </details>
  </div>
</template>

<style scoped>
.cet6-review { margin-top: var(--mi-sp-2); font-family: var(--mi-font-family); font-size: var(--mi-fs-label); color: var(--mi-text-2); }
.cet6-review-line { display: flex; flex-wrap: wrap; gap: var(--mi-sp-1) var(--mi-sp-4); }
.cet6-answer { color: var(--mi-success-deep); font-weight: 500; }
.is-wrong { color: var(--mi-error-deep); }
.cet6-note { color: var(--mi-text-3); font-size: var(--mi-fs-caption); }
.cet6-review-text { margin-top: var(--mi-sp-1); white-space: pre-wrap; line-height: 1.6; }
summary { cursor: pointer; margin-top: var(--mi-sp-1); color: var(--mi-text-2); }
.cet6-locate { margin-top: var(--mi-sp-1); padding: 2px var(--mi-sp-2); border: 1px solid var(--mi-success-deep); border-radius: 999px; background: transparent; color: var(--mi-success-deep); font: inherit; font-size: var(--mi-fs-caption); cursor: pointer; transition: background-color var(--mi-dur-fast) var(--mi-ease); }
.cet6-locate:hover { background: var(--mi-success-fill); }
.cet6-locate:focus-visible { outline: 2px solid var(--mi-success-deep); outline-offset: 1px; }
</style>

