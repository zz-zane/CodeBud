<script setup lang="ts">
import { onMounted } from 'vue'
import { useVideoStore } from '../../../stores/video'
import VideoPlayer from './VideoPlayer.vue'
const video = useVideoStore()
onMounted(() => video.init())
</script>
<template>
  <VideoPlayer v-if="video.current" :key="video.current.id" :video="video.current" />
</template>
