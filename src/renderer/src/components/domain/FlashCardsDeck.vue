<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { FlashCardsBlock } from '../../lib/lesson-blocks'
import { FLASH_CARDS } from '../../lib/copy'
import MiButton from '../base/MiButton.vue'
import MiTag from '../base/MiTag.vue'

const props = defineProps<{
  block: FlashCardsBlock
}>()

const currentIndex = ref(0)
const isFlipped = ref(false)

const total = computed(() => props.block.cards.length)
const currentCard = computed(() => props.block.cards[currentIndex.value] ?? null)

watch(currentIndex, () => {
  isFlipped.value = false
})

function toggleFlip(): void {
  isFlipped.value = !isFlipped.value
}

function prevCard(): void {
  if (currentIndex.value > 0) {
    currentIndex.value--
  }
}

function nextCard(): void {
  if (currentIndex.value < total.value - 1) {
    currentIndex.value++
  }
}
</script>

<template>
  <div v-if="currentCard" class="flash-cards-deck">
    <div class="deck-header">
      <div class="deck-title-row">
        <MiTag color="blue">{{ FLASH_CARDS.BADGE }}</MiTag>
        <span class="deck-title">{{ block.title }}</span>
      </div>
      <span v-if="total > 1" class="deck-counter">
        {{ FLASH_CARDS.CARD_COUNTER(currentIndex + 1, total) }}
      </span>
    </div>

    <div class="card-scene">
      <div
        class="flip-card"
        :class="{ flipped: isFlipped }"
        role="button"
        tabindex="0"
        :title="FLASH_CARDS.FLIP_HINT"
        :aria-pressed="isFlipped"
        :aria-label="isFlipped ? FLASH_CARDS.BACK_LABEL : FLASH_CARDS.FRONT_LABEL"
        @click="toggleFlip"
        @keydown.space.prevent="toggleFlip"
        @keydown.enter.prevent="toggleFlip"
      >
        <div class="card-face card-front">
          <div class="face-badge-row">
            <span class="face-tag front-tag">{{ FLASH_CARDS.FRONT_LABEL }}</span>
          </div>
          <div class="card-content">
            <p class="card-text">{{ currentCard.front }}</p>
            <p v-if="currentCard.hint" class="card-hint">💡 {{ currentCard.hint }}</p>
          </div>
        </div>

        <div class="card-face card-back">
          <div class="face-badge-row">
            <span class="face-tag back-tag">{{ FLASH_CARDS.BACK_LABEL }}</span>
          </div>
          <div class="card-content">
            <p class="card-text back-text">{{ currentCard.back }}</p>
          </div>
        </div>
      </div>
    </div>

    <div v-if="total > 1" class="deck-controls">
      <MiButton
        size="sm"
        variant="ghost"
        :disabled="currentIndex === 0"
        @click="prevCard"
      >
        {{ FLASH_CARDS.PREV }}
      </MiButton>
      <MiButton
        size="sm"
        variant="secondary"
        :disabled="currentIndex === total - 1"
        @click="nextCard"
      >
        {{ FLASH_CARDS.NEXT }}
      </MiButton>
    </div>
  </div>
</template>

<style scoped>
.flash-cards-deck {
  margin: var(--mi-sp-4) 0;
  padding: var(--mi-sp-4);
  background: var(--mi-bg-card, #ffffff);
  border: 1px solid var(--mi-border, #e5e7eb);
  border-radius: 12px;
  box-sizing: border-box;
}

.deck-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--mi-sp-3);
}

.deck-title-row {
  display: flex;
  align-items: center;
  gap: var(--mi-sp-2);
}

.deck-title {
  font-weight: 500;
  font-size: var(--mi-fs-body);
  color: var(--mi-text-title, #1f2937);
}

.deck-counter {
  font-size: var(--mi-fs-caption);
  color: var(--mi-text-sub, #6b7280);
}

.card-scene {
  perspective: 1000px;
  min-height: 140px;
}

.flip-card {
  position: relative;
  width: 100%;
  min-height: 140px;
  transform-style: preserve-3d;
  transition: transform 0.4s ease;
  cursor: pointer;
  border-radius: 8px;
  outline: none;
}

.flip-card:focus-visible {
  box-shadow: 0 0 0 2px var(--mi-blue, #3b82f6);
}

.flip-card.flipped {
  transform: rotateY(180deg);
}

.card-face {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: var(--mi-sp-4);
  border-radius: 8px;
  border: 1px dashed var(--mi-border, #d1d5db);
  background: var(--mi-bg-page, #f9fafb);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.card-back {
  transform: rotateY(180deg);
  background: var(--mi-blue-light, #eff6ff);
  border-color: var(--mi-blue, #3b82f6);
}

.face-badge-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--mi-fs-caption);
}

.face-tag {
  font-weight: 500;
  padding: 2px var(--mi-sp-2);
  border-radius: 4px;
}

.front-tag {
  background: var(--mi-border, #e5e7eb);
  color: var(--mi-text-sub, #4b5563);
}

.back-tag {
  background: var(--mi-blue, #3b82f6);
  color: #ffffff;
}

.flip-hint {
  color: var(--mi-text-sub, #9ca3af);
}

.card-content {
  margin-top: var(--mi-sp-3);
  margin-bottom: var(--mi-sp-1);
}

.card-text {
  margin: 0;
  font-size: var(--mi-fs-body);
  line-height: 1.6;
  color: var(--mi-text-title, #111827);
  font-weight: 500;
}

.back-text {
  color: var(--mi-blue-dark, #1e40af);
}

.card-hint {
  margin: var(--mi-sp-2) 0 0;
  font-size: var(--mi-fs-caption);
  color: var(--mi-text-sub, #6b7280);
}

.deck-controls {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--mi-sp-2);
  margin-top: var(--mi-sp-3);
  padding-top: var(--mi-sp-2);
  border-top: 1px solid var(--mi-border, #f3f4f6);
}
</style>
