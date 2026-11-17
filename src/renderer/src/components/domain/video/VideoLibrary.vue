<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { ExplainerVideo } from '../../../../../shared/video'
import { useContentStore } from '../../../stores/content'
import { useVideoStore } from '../../../stores/video'
import { usePracticeStore } from '../../../stores/practice'
import { VIDEO_UI } from '../../../lib/copy'
import MiButton from '../../base/MiButton.vue'
import MiModal from '../../base/MiModal.vue'
import MiSelect from '../../base/MiSelect.vue'
import VideoCard from './VideoCard.vue'

const content = useContentStore()
const video = useVideoStore()
const practice = usePracticeStore()
const filter = ref('')
const loading = ref(false)
const error = ref('')
const deleting = ref<string | null>(null)

const builtinList = computed(() => content.bundle.animations ?? [])
const lessons = computed(() => [...new Set(video.videos.map(v => v.lessonId).filter((id): id is string => !!id))])
const filterOptions = computed(() => [
  { value: '', label: VIDEO_UI.ALL_LESSONS },
  ...lessons.value.map(id => ({ value: id, label: content.titleOf(id) || id }))
])
const generatedList = computed(() =>
  video.videos.filter(v => v.source === 'ai' && (!filter.value || v.lessonId === filter.value))
)

onMounted(async () => {
  loading.value = true
  try {
    await Promise.all([video.refresh(), practice.load()])
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err)
    error.value = raw.replace(/^Error invoking remote method '[^']+': (?:Error:\s*)?/, '')
  } finally {
    loading.value = false
  }
})

function askCount(item: ExplainerVideo): number {
  return (item.acts ?? []).reduce((sum, act) => sum + act.steps.filter(s => s.ask).length, 0)
}

function checkStatus(item: ExplainerVideo): string {
  const total = askCount(item)
  if (!item.lessonId || !total) return ''
  const prefix = `${item.lessonId}:video-${item.id}-`
  const session = [...practice.history].reverse().find(entry => entry.mode === 'video-check' && entry.items.some(answer => answer.key.startsWith(prefix)))
  const answers = session?.items.filter(answer => answer.key.startsWith(prefix)) ?? []
  if (answers.length < total) return VIDEO_UI.CHECK_UNANSWERED
  return answers.every(answer => answer.ok) ? VIDEO_UI.CHECK_RIGHT : VIDEO_UI.CHECK_WRONG
}

function itemSubtitle(item: ExplainerVideo): string {
  const lessonLabel = item.lessonId ? (content.titleOf(item.lessonId) || item.lessonId) : item.concept
  const status = checkStatus(item)
  return status ? `${lessonLabel} · ${status}` : lessonLabel
}

async function remove(): Promise<void> {
  if (deleting.value) {
    await video.remove(deleting.value)
    deleting.value = null
  }
}
</script>

<template>
  <section class="library">
    <div class="section-head">
      <h2>{{ VIDEO_UI.BUILTIN_TITLE }}</h2>
      <span class="sub">{{ VIDEO_UI.BUILTIN_SUB(builtinList.length) }}</span>
    </div>
    <div v-if="builtinList.length" class="grid">
      <VideoCard
        v-for="item in builtinList"
        :key="item.id"
        :video="item"
        :subtitle="itemSubtitle(item)"
        @play="video.play($event)"
      />
    </div>

    <div class="section-head generated-head">
      <h2>{{ VIDEO_UI.MY_GENERATED }}</h2>
      <MiSelect v-model="filter" :options="filterOptions" :aria-label="VIDEO_UI.FILTER" />
      <span class="sub">{{ VIDEO_UI.GENERATED_COUNT(generatedList.length) }}</span>
    </div>

    <p v-if="loading">{{ VIDEO_UI.LOADING }}</p>
    <p v-else-if="error" role="alert">{{ error }}</p>
    <p v-else-if="!generatedList.length" class="empty">{{ VIDEO_UI.EMPTY }}</p>
    <div v-else class="grid">
      <VideoCard
        v-for="item in generatedList"
        :key="item.id"
        :video="item"
        :subtitle="itemSubtitle(item)"
        :show-delete="true"
        @play="video.play($event)"
        @delete="deleting = $event.id"
      />
    </div>

    <MiModal :visible="deleting !== null" :title="VIDEO_UI.DELETE" :width="440" @update:visible="v => { if (!v) deleting = null }">
      <p>{{ VIDEO_UI.REMOVE_CONFIRM }}</p>
      <template #footer>
        <MiButton variant="secondary" @click="deleting = null">{{ VIDEO_UI.CANCEL }}</MiButton>
        <MiButton variant="primary" @click="remove">{{ VIDEO_UI.DELETE }}</MiButton>
      </template>
    </MiModal>
  </section>
</template>

<style scoped>
.library { display: flex; flex-direction: column; gap: var(--mi-sp-4); overflow: auto; }
.section-head { display: flex; align-items: center; gap: var(--mi-sp-3); flex-wrap: wrap; }
.section-head h2 { font-size: var(--mi-fs-read); font-weight: var(--mi-fw-hero); color: var(--mi-text); }
.generated-head { margin-top: var(--mi-sp-4); }
.generated-head h2 { flex: 1; }
.sub { color: var(--mi-text-3); font-size: var(--mi-fs-caption); }
.empty { color: var(--mi-text-3); padding: var(--mi-sp-4) 0; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: var(--mi-sp-3); }
</style>
