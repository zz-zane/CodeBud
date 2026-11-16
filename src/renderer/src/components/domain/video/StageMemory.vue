<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { MemoryScene } from '../../../../../shared/video'
import { VIDEO_UI } from '../../../lib/copy'
import { computeMemoryArrows } from '../../../lib/memory-arrows'
const props = defineProps<{ scene: MemoryScene; stepIndex: number }>()
const step = computed(() => props.scene.steps[props.stepIndex])
const root = ref<HTMLElement | null>(null)
const label = (id: string): string => step.value?.cells.find(cell => cell.id === id)?.label ?? id
const lines = ref<string[]>([])
let observer: ResizeObserver | undefined
function draw(): void {
  const host = root.value
  if (!host) return
  const bounds = host.getBoundingClientRect()
  const regionMap = new Map((step.value?.cells ?? []).map(cell => [cell.id, cell.region]))
  const boxes = [...host.querySelectorAll<HTMLElement>('[data-cell-id]')].flatMap(el => {
    const id = el.dataset.cellId
    if (!id) return []
    const r = el.getBoundingClientRect()
    return [{
      id,
      left: r.left - bounds.left + host.scrollLeft,
      right: r.right - bounds.left + host.scrollLeft,
      top: r.top - bounds.top + host.scrollTop,
      bottom: r.bottom - bounds.top + host.scrollTop,
      region: regionMap.get(id)
    }]
  })
  lines.value = computeMemoryArrows(boxes, step.value?.arrows ?? [])
}
watch(() => [props.scene, props.stepIndex], () => { void nextTick(draw) }, { deep: true })
onMounted(() => { observer = new ResizeObserver(draw); if (root.value) observer.observe(root.value); void nextTick(draw) })
onBeforeUnmount(() => observer?.disconnect())
</script>
<template>
  <div ref="root" class="memory" :class="{ many: (step?.cells.length ?? 0) > 6 }">
    <div v-for="region in (['stack', 'heap'] as const)" :key="region" class="region">
      <span class="region-label">{{ region === 'stack' ? VIDEO_UI.STACK : VIDEO_UI.HEAP }}</span>
      <div class="cells"><div v-for="cell in step?.cells.filter(c => c.region === region)" :key="cell.id" class="cell" :data-cell-id="cell.id" :class="{ focus: step?.focus?.includes(cell.id) }"><span>{{ cell.label }}</span><strong>{{ cell.value }}</strong></div></div>
    </div>
    <svg class="arrows" aria-hidden="true"><defs><marker id="video-arrow" markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="8" refX="9" refY="4" orient="auto"><path d="M0 1 L9 4 L0 7z" /></marker></defs><path v-for="(line, i) in lines" :key="i" :d="line" marker-end="url(#video-arrow)" /></svg>
    <ul class="sr-only"><li v-for="(arrow, i) in step?.arrows" :key="i">{{ label(arrow.from) }} → {{ label(arrow.to) }}</li></ul>
  </div>
</template>
<style scoped>
.memory { position:relative; display:flex; align-items:flex-start; gap:var(--mi-sp-8); min-height:0; overflow:auto; padding:0 var(--mi-sp-12) var(--mi-sp-2) 0; }
.region { position:relative; flex:none; min-width:200px; border:1px dashed var(--mi-border-control); border-radius:var(--mi-radius-lg); padding:28px var(--mi-sp-4) var(--mi-sp-4); }
.region-label { position:absolute; top:var(--mi-sp-1); left:var(--mi-sp-3); color:var(--mi-text-3); font-size:var(--mi-fs-caption); }
.cells { display:flex; flex-direction:column; gap:var(--mi-sp-3); min-height:60px; }
.cell { flex:none; min-width:132px; background:var(--mi-bg); border:1px solid var(--mi-border); border-radius:var(--mi-radius); padding:var(--mi-sp-2) var(--mi-sp-3); }
.cell.focus { border-color:var(--mi-blue-deep); box-shadow:0 0 0 3px var(--mi-blue-light); }
.cell span,.cell strong { display:block; font-family:'Consolas', 'Cascadia Code', var(--mi-font-family), ui-monospace, monospace; overflow-wrap:anywhere; }.cell span { color:var(--mi-text-3); font-size:var(--mi-fs-caption); }.cell strong { font-size:var(--mi-fs-read); font-weight:var(--mi-fw-medium); }
.arrows { position:absolute; inset:0; width:100%; height:100%; overflow:visible; pointer-events:none; }.arrows path { stroke:var(--mi-blue-deep); fill:none; stroke-width:2; }.arrows marker path { fill:var(--mi-blue-deep); stroke:none; }
.sr-only { position:absolute; width:1px; height:1px; overflow:hidden; clip-path:inset(50%); }
@media(max-width:700px) { .memory { gap:var(--mi-sp-3); }.region { min-width:132px; padding-inline:var(--mi-sp-2); }.cell { min-width:100px; }.memory.many .cells { flex-direction:row; } }
</style>
