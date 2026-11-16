<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { ExplainerVideo } from '../../../../../shared/video'
import { useVideoStore } from '../../../stores/video'
import { usePracticeStore } from '../../../stores/practice'
import { VIDEO_UI } from '../../../lib/copy'
import MiButton from '../../base/MiButton.vue'
import MiIcon from '../../base/MiIcon.vue'
import MiModal from '../../base/MiModal.vue'
const props = defineProps<{ lessonId?: string; lessonExcerpt?: string; demos?: ExplainerVideo[] }>()
const video = useVideoStore()
const practice = usePracticeStore()
const remote = window.miai.isRemote
const filter = ref('')
const loading = ref(false)
const error = ref('')
const deleting = ref<string | null>(null)
const lessons = computed(() => [...new Set(video.videos.map(v => v.lessonId).filter((id): id is string => !!id))])
const list = computed(() => [...(props.demos ?? []), ...video.videos.filter(v => props.lessonId ? v.lessonId === props.lessonId : !filter.value || v.lessonId === filter.value)])
onMounted(async () => { loading.value = true; try { await Promise.all([video.refresh(), practice.load()]) } catch (err) { error.value = err instanceof Error ? err.message : String(err) } finally { loading.value = false } })
function duration(item: ExplainerVideo): string {
  const text = item.scenes.flatMap(scene => scene.kind === 'card' ? [scene.say] : scene.steps.map(step => step.say)).join('')
  const seconds = Math.round(Array.from(text.replace(/[\u0000-\u001f\u007f-\u009f]/g, '')).length / 4.5)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}
function checkStatus(item: ExplainerVideo): string {
  if (!item.lessonId || !item.checks.length) return ''
  const prefix = `${item.lessonId}:video-${item.id}-`
  const session = [...practice.history].reverse().find(entry => entry.mode === 'video-check' && entry.items.some(answer => answer.key.startsWith(prefix)))
  const answers = session?.items.filter(answer => answer.key.startsWith(prefix)) ?? []
  if (answers.length < item.checks.length) return VIDEO_UI.CHECK_UNANSWERED
  return answers.every(answer => answer.ok) ? VIDEO_UI.CHECK_RIGHT : VIDEO_UI.CHECK_WRONG
}
async function remove(): Promise<void> { if (deleting.value) { await video.remove(deleting.value); deleting.value = null } }
</script>
<template>
  <section class="library">
    <div class="bar"><h2>{{ lessonId ? VIDEO_UI.THIS_LESSON : VIDEO_UI.LIBRARY }}</h2><select v-if="!lessonId" v-model="filter" :aria-label="VIDEO_UI.FILTER"><option value="">{{ VIDEO_UI.ALL_LESSONS }}</option><option v-for="id in lessons" :key="id" :value="id">{{ id }}</option></select><MiButton variant="primary" @click="video.open({ lessonId, excerpt: lessonExcerpt })">{{ remote ? VIDEO_UI.PHONE_GENERATE : VIDEO_UI.GENERATE }}</MiButton></div>
    <p v-if="loading">{{ VIDEO_UI.LOADING }}</p><p v-else-if="error" role="alert">{{ error }}</p><p v-else-if="!list.length" class="empty">{{ VIDEO_UI.EMPTY }}</p>
    <div v-else class="grid"><article v-for="item in list" :key="item.id" class="video-card"><button type="button" class="thumb" :aria-label="VIDEO_UI.PLAY" @click="video.play(item)"><MiIcon name="play" :size="24" /><span :title="VIDEO_UI.ESTIMATED_DURATION">{{ duration(item) }}</span></button><strong>{{ item.title }}</strong><span v-if="item.codeVerified === false" class="badge">{{ VIDEO_UI.UNVERIFIED }}</span><span class="meta">{{ item.lessonId }} <template v-if="checkStatus(item)"> · {{ checkStatus(item) }}</template></span><div class="actions"><MiButton variant="ghost" size="sm" @click="video.play(item)">{{ VIDEO_UI.PLAY }}</MiButton><MiButton v-if="item.source !== 'demo'" variant="ghost" size="sm" @click="deleting = item.id">{{ VIDEO_UI.DELETE }}</MiButton></div></article></div>
    <MiModal :visible="deleting !== null" :title="VIDEO_UI.DELETE" :width="440" @update:visible="v => { if (!v) deleting = null }"><p>{{ VIDEO_UI.REMOVE_CONFIRM }}</p><template #footer><MiButton variant="secondary" @click="deleting = null">{{ VIDEO_UI.CANCEL }}</MiButton><MiButton variant="primary" @click="remove">{{ VIDEO_UI.DELETE }}</MiButton></template></MiModal>
  </section>
</template>
<style scoped>
.library { display:flex; flex-direction:column; gap:var(--mi-sp-4); overflow:auto; }.bar { display:flex; align-items:center; gap:var(--mi-sp-3); flex-wrap:wrap; }.bar h2 { flex:1; font-size:var(--mi-fs-read); font-weight:var(--mi-fw-medium); }.bar select { border:1px solid var(--mi-border); border-radius:var(--mi-radius); padding:var(--mi-sp-2); color:var(--mi-text); background:var(--mi-bg); }.empty { color:var(--mi-text-3); padding:var(--mi-sp-6) 0; }.grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:var(--mi-sp-4); }.video-card { display:flex; flex-direction:column; gap:var(--mi-sp-2); padding:var(--mi-sp-3); border:1px solid var(--mi-border); border-radius:var(--mi-radius-lg); background:var(--mi-bg); }.thumb { position:relative; width:100%; height:112px; display:grid; place-items:center; border:0; border-radius:var(--mi-radius); background:var(--mi-blue-light); color:var(--mi-blue-deep); cursor:pointer; }.thumb span { position:absolute; right:var(--mi-sp-2); bottom:var(--mi-sp-2); color:var(--mi-text-2); font-size:var(--mi-fs-caption); }.video-card strong { font-weight:var(--mi-fw-medium); overflow-wrap:anywhere; }.meta,.badge { color:var(--mi-text-3); font-size:var(--mi-fs-caption); }.badge { color:var(--mi-warn-deep); }.actions { display:flex; justify-content:flex-end; }
</style>
