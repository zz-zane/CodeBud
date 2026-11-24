<script setup lang="ts">
/** 图文积木：要点列表（```points）。图标块 + 标题 + 说明，离线不拉网络图片，用自绘图标代替配图 */
import type { PointsBlockData } from '../../../lib/ai-rich-blocks'
import VisualIcon from './VisualIcon.vue'

defineProps<{ data: PointsBlockData }>()
</script>

<template>
  <section class="vp" :aria-label="data.title">
    <h4 v-if="data.title" class="vp-title">{{ data.title }}</h4>
    <ul class="vp-list">
      <li v-for="(it, i) in data.items" :key="i" class="vp-item">
        <span class="vp-tile" aria-hidden="true"><VisualIcon :name="it.icon ?? 'check'" :size="26" /></span>
        <div class="vp-body">
          <div v-if="it.title" class="vp-head">{{ it.title }}</div>
          <p v-if="it.text" class="vp-text">{{ it.text }}</p>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.vp { margin: var(--mi-sp-3) 0; font-family: var(--mi-font-family); }
.vp-title { margin: 0 0 var(--mi-sp-2); font-size: var(--mi-fs-label); font-weight: 500; color: var(--mi-text-2); }
.vp-list { display: flex; flex-direction: column; gap: var(--mi-sp-3); margin: 0; padding: 0; list-style: none; }
.vp-item { display: flex; align-items: flex-start; gap: var(--mi-sp-4); }
.vp-tile { display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 64px; height: 64px; border: 1px solid var(--mi-border); border-radius: 12px; background: var(--mi-blue-light); color: var(--mi-blue-deep); }
.vp-body { min-width: 0; padding-top: 4px; }
.vp-head { font-size: var(--mi-fs-body); font-weight: 500; color: var(--mi-text); }
.vp-text { margin: 4px 0 0; font-size: var(--mi-fs-body); line-height: 1.7; color: var(--mi-text-2); overflow-wrap: anywhere; }
@media (max-width: 560px) {
  .vp-tile { width: 48px; height: 48px; border-radius: 10px; }
}
</style>
