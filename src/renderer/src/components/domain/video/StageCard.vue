<script setup lang="ts">
import type { CardScene } from '../../../../../shared/video'
defineProps<{ scene: CardScene }>()
</script>
<template>
  <div class="stage-card"><h2>{{ scene.heading }}</h2><p>{{ scene.body }}</p></div>
</template>
<style scoped>
.stage-card { margin:auto; width:min(100%, 620px); padding:var(--mi-sp-8); background:var(--mi-bg); border:1px solid var(--mi-border); border-radius:var(--mi-radius-lg); text-align:center; }
h2 { font-size:var(--mi-fs-title); font-weight:var(--mi-fw-medium); margin-bottom:var(--mi-sp-4); }
p { font-size:var(--mi-fs-read); line-height:var(--mi-lh-read); white-space:pre-wrap; overflow-wrap:anywhere; }
</style>
