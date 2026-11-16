<script setup lang="ts">
import { onMounted } from 'vue'
import { useVideoStore } from '../../../stores/video'
import { VIDEO_UI } from '../../../lib/copy'
import VideoGenerateDialog from './VideoGenerateDialog.vue'
import VideoPlayer from './VideoPlayer.vue'
const video = useVideoStore()
onMounted(() => video.init())
</script>
<template>
  <VideoGenerateDialog />
  <VideoPlayer v-if="video.current" :key="video.current.id" :video="video.current" />
  <Teleport to="body"><button v-if="video.current && video.minimized" type="button" class="return" @click="video.minimized = false">{{ VIDEO_UI.RETURN }}</button></Teleport>
</template>
<style scoped>
.return { position:fixed; right:var(--mi-sp-4); bottom:var(--mi-sp-4); z-index:2000; border:0; border-radius:var(--mi-radius); padding:var(--mi-sp-3) var(--mi-sp-4); background:var(--mi-blue-deep); color:var(--mi-btn-primary-text); font:inherit; cursor:pointer; }
</style>
