<script setup lang="ts">
import { computed } from 'vue'
import type { TraceScene } from '../../../../../shared/video'
import { VIDEO_UI } from '../../../lib/copy'
const props = defineProps<{ scene: TraceScene; stepIndex: number }>()
const step = computed(() => props.scene.steps[props.stepIndex])
</script>
<template>
  <div class="trace-layout">
    <div class="codebox" :aria-label="scene.title"><div v-for="(line, i) in scene.code" :key="i" :class="{ active: step?.at === i + 1 }"><span class="number">{{ i + 1 }}</span><code>{{ line || ' ' }}</code></div></div>
    <div class="values">
      <div class="value-card"><h4>{{ VIDEO_UI.VARS }}</h4><div v-for="(item, i) in step?.vars" :key="i" class="value-row"><code>{{ item.name }}</code><code>{{ item.value }}</code></div></div>
      <div v-if="step?.stack?.length" class="value-card"><h4>{{ VIDEO_UI.STACK }}</h4><div v-for="(item, i) in step.stack" :key="i" class="value-row"><code>{{ item }}</code></div></div>
      <div v-if="step?.out" class="value-card"><h4>{{ VIDEO_UI.OUTPUT }}</h4><pre>{{ step.out }}</pre></div>
    </div>
  </div>
</template>
<style scoped>
.trace-layout { display:flex; gap:var(--mi-sp-4); min-height:0; overflow:auto; }
.codebox,.value-card { background:var(--mi-bg); border:1px solid var(--mi-border); border-radius:var(--mi-radius-lg); }
.codebox { flex:1; min-width:0; padding:var(--mi-sp-3) 0; overflow:auto; font-family:'Consolas', 'Cascadia Code', var(--mi-font-family), ui-monospace, monospace; font-size:var(--mi-fs-label); line-height:1.7; }
.codebox code,.value-row code,.value-card pre { font-family:'Consolas', 'Cascadia Code', var(--mi-font-family), ui-monospace, monospace; font-size:var(--mi-fs-label); }
.codebox>div { display:flex; gap:var(--mi-sp-4); padding:0 var(--mi-sp-4); white-space:pre; }
.codebox .active { background:var(--mi-blue-light); box-shadow:inset 3px 0 var(--mi-blue-deep); }
.number { color:var(--mi-text-3); min-width:18px; text-align:right; }
.values { width:220px; display:flex; flex-direction:column; gap:var(--mi-sp-3); }
.value-card { overflow:hidden; } h4 { padding:var(--mi-sp-2) var(--mi-sp-3); font-weight:var(--mi-fw-medium); }
.value-row { display:flex; justify-content:space-between; gap:var(--mi-sp-2); padding:var(--mi-sp-2) var(--mi-sp-3); border-top:1px solid var(--mi-border); }
pre { padding:var(--mi-sp-3); white-space:pre-wrap; overflow-wrap:anywhere; }
@media(max-width:700px) { .trace-layout { flex-direction:column; } .values { width:auto; } }
</style>
