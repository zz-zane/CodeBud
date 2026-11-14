<script setup lang="ts">
/** 交卷后每题的核对行 + 解析。只在 submitted 后才会被父组件渲染（答案和解析不进 DOM 的前提）。 */
import { computed } from 'vue'
import { CET6 } from '../../lib/copy'
import { isRight, isScored, normalizedAnswer, usableExplanation, type Cet6Question } from '../../../../shared/cet6'

const props = defineProps<{ q: Cet6Question; given?: string; open?: boolean }>()

const unofficial = computed(() => /非官方/.test(props.q.verificationNote || ''))
const scored = computed(() => isScored(props.q))
const right = computed(() => isRight(props.q, props.given))
const explanation = computed(() => usableExplanation(props.q))
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
</style>
