<script setup lang="ts">
/**
 * 极简空状态：轻量细线 SVG 图标 + 主文案 + 补充说明
 */
import { EMPTY } from '../../lib/copy'

withDefaults(
  defineProps<{
    pose?: string
    size?: string
    text?: string
    subText?: string
  }>(),
  { ...EMPTY.DEFAULT, size: 'm' }
)
</script>

<template>
  <div class="mi-empty">
    <div class="empty-icon-wrap" aria-hidden="true">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M3 9h18" />
        <path d="m9 16 3-3 3 3" />
      </svg>
    </div>
    <div class="text">{{ text }}</div>
    <div v-if="subText" class="sub">{{ subText }}</div>
    <slot />
  </div>
</template>

<style scoped>
.mi-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--mi-sp-2);
  padding: var(--mi-sp-12) var(--mi-sp-4);
  text-align: center;
}
.empty-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--mi-text-3);
  margin-bottom: 2px;
}
.text {
  font-size: var(--mi-fs-body);
  color: var(--mi-text-2);
  text-wrap: balance;
}
.sub {
  font-size: var(--mi-fs-caption);
  color: var(--mi-text-3);
  line-height: 1.8;
  text-wrap: pretty;
}
</style>
