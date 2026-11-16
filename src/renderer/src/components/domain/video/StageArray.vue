<script setup lang="ts">
import { computed } from 'vue'
import type { ArrayScene } from '../../../../../shared/video'
const props = defineProps<{ scene: ArrayScene; stepIndex: number }>()
const step = computed(() => props.scene.steps[props.stepIndex])
</script>
<template>
  <div class="array-stage"><div class="items"><div v-for="(item, i) in step?.items" :key="i" class="item" :class="{ active: step?.highlights?.includes(i) }"><span>{{ i }}</span><strong>{{ item }}</strong><small v-if="step?.pointers?.[String(i)]">{{ step.pointers[String(i)] }}</small></div></div><p v-if="step?.note">{{ step.note }}</p></div>
</template>
<style scoped>
.array-stage { margin:auto; max-width:100%; overflow:auto; }.items { display:flex; gap:var(--mi-sp-2); padding:var(--mi-sp-4); }
.item { min-width:64px; text-align:center; border:1px solid var(--mi-border); border-radius:var(--mi-radius); background:var(--mi-bg); padding:var(--mi-sp-2); }
.item.active { border-color:var(--mi-blue-deep); background:var(--mi-blue-light); }.item span,.item strong,.item small { display:block; font-family:'Consolas', 'Cascadia Code', var(--mi-font-family), ui-monospace, monospace; }.item span { color:var(--mi-text-3); }.item strong { font-weight:var(--mi-fw-medium); }
</style>
