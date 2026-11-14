<script setup lang="ts">
defineProps<{
  title?: string
  padding?: string
}>()
</script>

<template>
  <div class="mi-card" :style="padding ? { padding } : undefined">
    <div v-if="title || $slots.extra" class="mi-card-head">
      <div class="mi-card-title">{{ title }}</div>
      <div class="mi-card-extra"><slot name="extra" /></div>
    </div>
    <slot />
  </div>
</template>

<style scoped>
.mi-card { background: var(--mi-card-glass); border: 1px solid var(--cds-border); border-radius: var(--cds-panel-radius); box-shadow: none; padding: var(--mi-sp-4); min-width: 0; }
.mi-card-head { display: flex; align-items: center; justify-content: space-between; gap: var(--mi-sp-3); margin-bottom: var(--mi-sp-3); }
.mi-card-title { font-size: var(--mi-fs-body); font-weight: 500; }
.mi-card-extra { display: flex; align-items: center; gap: var(--mi-sp-2); }
</style>
