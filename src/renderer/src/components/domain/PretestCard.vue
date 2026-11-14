<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PretestBlock } from '../../lib/lesson-blocks'
import { PRETEST } from '../../lib/copy'
import MiButton from '../base/MiButton.vue'
import MiTag from '../base/MiTag.vue'

const props = defineProps<{
  block: PretestBlock
}>()

const selectedIndex = ref<number | null>(null)
const submitted = ref(false)

const isCorrect = computed(() => {
  return submitted.value && selectedIndex.value === props.block.answer
})

function selectOption(index: number): void {
  if (submitted.value) return
  selectedIndex.value = index
}

function submit(): void {
  if (selectedIndex.value === null) return
  submitted.value = true
}

function retry(): void {
  selectedIndex.value = null
  submitted.value = false
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']
</script>

<template>
  <div class="pretest-card">
    <div class="pretest-header">
      <div class="pretest-title-row">
        <MiTag color="green">{{ PRETEST.BADGE }}</MiTag>
        <span class="pretest-title">{{ block.title }}</span>
      </div>
    </div>

    <div class="pretest-question">
      {{ block.question }}
    </div>

    <div class="pretest-options">
      <button
        v-for="(opt, idx) in block.options"
        :key="idx"
        type="button"
        class="option-item"
        :class="{
          selected: selectedIndex === idx && !submitted,
          'is-correct': submitted && idx === block.answer,
          'is-wrong': submitted && selectedIndex === idx && idx !== block.answer
        }"
        :disabled="submitted"
        @click="selectOption(idx)"
      >
        <span class="option-letter">{{ LETTERS[idx] ?? idx + 1 }}.</span>
        <span class="option-text">{{ opt }}</span>
      </button>
    </div>

    <div v-if="!submitted" class="pretest-actions">
      <MiButton
        size="sm"
        variant="primary"
        :disabled="selectedIndex === null"
        @click="submit"
      >
        {{ PRETEST.SUBMIT }}
      </MiButton>
    </div>

    <div v-else class="pretest-feedback">
      <div
        class="feedback-banner"
        :class="isCorrect ? 'banner-correct' : 'banner-wrong'"
      >
        <span class="feedback-icon">{{ isCorrect ? '🎉' : '🐱' }}</span>
        <span class="feedback-text">{{ isCorrect ? PRETEST.CORRECT : PRETEST.WRONG }}</span>
      </div>

      <div v-if="block.explanation" class="explanation-box">
        <div class="explanation-label">{{ PRETEST.EXPLANATION_TITLE }}</div>
        <div class="explanation-content">{{ block.explanation }}</div>
      </div>

      <div class="feedback-actions">
        <MiButton size="sm" variant="secondary" @click="retry">
          {{ PRETEST.RETRY }}
        </MiButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pretest-card {
  margin: var(--mi-sp-4) 0;
  padding: var(--mi-sp-4);
  background: var(--mi-bg-card, #ffffff);
  border: 1px solid var(--mi-border, #e5e7eb);
  border-radius: 12px;
  box-sizing: border-box;
}

.pretest-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--mi-sp-3);
}

.pretest-title-row {
  display: flex;
  align-items: center;
  gap: var(--mi-sp-2);
}

.pretest-title {
  font-weight: 500;
  font-size: var(--mi-fs-body);
  color: var(--mi-text-title, #1f2937);
}

.pretest-question {
  font-size: var(--mi-fs-body);
  line-height: 1.6;
  font-weight: 500;
  color: var(--mi-text-title, #111827);
  margin-bottom: var(--mi-sp-4);
}

.pretest-options {
  display: flex;
  flex-direction: column;
  gap: var(--mi-sp-2);
  margin-bottom: var(--mi-sp-4);
}

.option-item {
  display: flex;
  align-items: flex-start;
  gap: var(--mi-sp-3);
  padding: var(--mi-sp-3) var(--mi-sp-4);
  text-align: left;
  background: var(--mi-bg-page, #f9fafb);
  border: 1px solid var(--mi-border, #e5e7eb);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
  outline: none;
}

.option-item:focus-visible {
  box-shadow: 0 0 0 2px var(--mi-blue, #3b82f6);
}

.option-item:hover:not(:disabled) {
  border-color: var(--mi-blue, #3b82f6);
  background: var(--mi-bg-card, #ffffff);
}

.option-item.selected {
  border-color: var(--mi-blue, #3b82f6);
  background: var(--mi-blue-light, #eff6ff);
}

.option-item.is-correct {
  border-color: var(--mi-green, #10b981);
  background: var(--mi-green-light, #ecfdf5);
}

.option-item.is-wrong {
  border-color: var(--mi-red, #ef4444);
  background: var(--mi-red-light, #fef2f2);
}

.option-letter {
  font-weight: 500;
  font-size: var(--mi-fs-body);
  color: var(--mi-text-sub, #4b5563);
}

.option-text {
  font-size: var(--mi-fs-body);
  color: var(--mi-text-main, #374151);
  line-height: 1.5;
}

.pretest-actions {
  display: flex;
  justify-content: flex-end;
}

.pretest-feedback {
  margin-top: var(--mi-sp-3);
  padding-top: var(--mi-sp-3);
  border-top: 1px solid var(--mi-border, #f3f4f6);
}

.feedback-banner {
  display: flex;
  align-items: center;
  gap: var(--mi-sp-2);
  padding: var(--mi-sp-3) var(--mi-sp-4);
  border-radius: 8px;
  font-size: var(--mi-fs-body);
  font-weight: 500;
  margin-bottom: var(--mi-sp-3);
}

.banner-correct {
  background: var(--mi-green-light, #ecfdf5);
  color: var(--mi-green-dark, #065f46);
  border: 1px solid var(--mi-green, #10b981);
}

.banner-wrong {
  background: var(--mi-red-light, #fef2f2);
  color: var(--mi-red-dark, #991b1b);
  border: 1px solid var(--mi-red, #ef4444);
}

.explanation-box {
  background: var(--mi-bg-sub, #f8fafc);
  border-left: 3px solid var(--mi-blue, #3b82f6);
  padding: var(--mi-sp-3) var(--mi-sp-4);
  border-radius: 4px;
  margin-bottom: var(--mi-sp-3);
}

.explanation-label {
  font-size: var(--mi-fs-caption);
  font-weight: 500;
  color: var(--mi-blue-dark, #1e40af);
  margin-bottom: var(--mi-sp-1);
}

.explanation-content {
  font-size: var(--mi-fs-label);
  color: var(--mi-text-main, #374151);
  line-height: 1.6;
}

.feedback-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
