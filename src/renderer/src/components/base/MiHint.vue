<script setup lang="ts">
import MiIcon from './MiIcon.vue'
/** ⓘ 悬停说明：把「不影响操作的说明段」收成一枚图标（docs/30 §2.3）。 */
defineProps<{ text: string }>()
</script>

<template>
  <span class="mi-hint" role="img" tabindex="0" :title="text" :aria-label="text"><MiIcon name="info" :size="14" /></span>
</template>

<style scoped>
.mi-hint { display: inline-flex; align-items: center; margin-inline-start: var(--mi-sp-2); color: var(--mi-text-3); vertical-align: middle; border-radius: var(--mi-radius-ctl); cursor: help; }
.mi-hint:hover, .mi-hint:focus-visible { color: var(--mi-text-2); }
</style>
