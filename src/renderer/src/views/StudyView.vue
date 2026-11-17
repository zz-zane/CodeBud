<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { STUDY_COPY } from '../lib/study-copy'
import { isRemote } from '../lib/asset-base'
import MiIcon, { type MiIconName } from '../components/base/MiIcon.vue'
import StudyMemoryTab from '../components/study/StudyMemoryTab.vue'
import StudyKnowledgeTab from '../components/study/StudyKnowledgeTab.vue'
import StudyMaterialsTab from '../components/study/StudyMaterialsTab.vue'
import StudyTasksTab from '../components/study/StudyTasksTab.vue'
import StudyConnectionsTab from '../components/study/StudyConnectionsTab.vue'
import StudyUsageTab from '../components/study/StudyUsageTab.vue'
import StudyMathTab from '../components/study/StudyMathTab.vue'
import VideoLibrary from '../components/domain/video/VideoLibrary.vue'
import { VIDEO_UI } from '../lib/copy'
import { useStudyStore } from '../stores/study'

const route = useRoute()
const router = useRouter()
const study = useStudyStore()

type TabKey = 'memory' | 'knowledge' | 'materials' | 'tasks' | 'connections' | 'usage' | 'math' | 'video'

const currentTab = computed<TabKey>(() => {
  const tab = String(route.query.tab || 'knowledge') as TabKey
  const validTabs: TabKey[] = ['memory', 'knowledge', 'materials', 'tasks', 'connections', 'usage', 'math', 'video']
  return validTabs.includes(tab) && !(isRemote() && REMOTE_HIDDEN_TABS.includes(tab)) ? tab : 'knowledge'
})

// 手机浏览器里没有外部连接（ACP）管理与数学计算（这两类通道不在远程白名单里）
const REMOTE_HIDDEN_TABS: TabKey[] = ['connections', 'math']

const allTabs: { key: TabKey; label: string; icon: MiIconName }[] = [
  { key: 'knowledge', label: STUDY_COPY.TABS.KNOWLEDGE, icon: 'note' },
  { key: 'materials', label: STUDY_COPY.TABS.MATERIALS, icon: 'book' },
  { key: 'tasks', label: STUDY_COPY.TABS.TASKS, icon: 'list-checks' },
  { key: 'memory', label: STUDY_COPY.TABS.MEMORY, icon: 'lightbulb' },
  { key: 'video', label: VIDEO_UI.LIBRARY, icon: 'play' },
  { key: 'connections', label: STUDY_COPY.TABS.CONNECTIONS, icon: 'plug' },
  { key: 'usage', label: STUDY_COPY.TABS.USAGE, icon: 'chart' },
  { key: 'math', label: STUDY_COPY.TABS.MATH, icon: 'curve' }
]
const tabsConfig = isRemote() ? allTabs.filter((t) => !REMOTE_HIDDEN_TABS.includes(t.key)) : allTabs

function switchTab(tab: TabKey): void {
  void router.push({ path: '/study', query: { tab } })
}

function onTabKey(event: KeyboardEvent): void {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const buttons = [...(event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('[role=tab]')]
  const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
  const index = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
    : (current + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length
  buttons[index]?.focus()
  switchTab(tabsConfig[index].key)
}
</script>

<template>
  <div class="study-view-container">
    <div class="study-tabs-group" role="tablist" :aria-label="STUDY_COPY.HUB_TITLE" @keydown="onTabKey">
      <button
        v-for="t in tabsConfig"
        :key="t.key"
        type="button"
        role="tab"
        :id="`study-tab-${t.key}`"
        :tabindex="currentTab === t.key ? 0 : -1"
        aria-controls="study-tab-panel"
        class="pg-chip study-tab-link"
        :class="{ active: currentTab === t.key }"
        :aria-selected="currentTab === t.key"
        @click="switchTab(t.key)"
      >
        <MiIcon :name="t.icon" />
        {{ t.label }}
      </button>
    </div>

    <p v-if="study.error" class="mi-alert-error" role="alert">
      <span>{{ study.error }}</span>
      <button type="button" class="mi-btn-secondary" @click="study.init()">{{ STUDY_COPY.STATUS.RETRY }}</button>
    </p>
    <div id="study-tab-panel" role="tabpanel" :aria-labelledby="`study-tab-${currentTab}`" class="study-tab-content-wrapper" :aria-busy="study.loading">
      <StudyKnowledgeTab v-if="currentTab === 'knowledge'" />
      <StudyMaterialsTab v-else-if="currentTab === 'materials'" />
      <StudyTasksTab v-else-if="currentTab === 'tasks'" />
      <StudyMemoryTab v-else-if="currentTab === 'memory'" />
      <VideoLibrary v-else-if="currentTab === 'video'" />
      <StudyConnectionsTab v-else-if="currentTab === 'connections'" />
      <StudyUsageTab v-else-if="currentTab === 'usage'" />
      <StudyMathTab v-else-if="currentTab === 'math'" />
    </div>
  </div>
</template>

<style scoped>
.study-view-container {
  display: flex;
  flex-direction: column;
  gap: var(--mi-sp-6);
  width: 100%;
  max-width: var(--mi-page-max);
  margin-inline: auto;
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
}
.study-view-container :deep(.pg) { margin-inline: 0; }
.study-tabs-group {
  display: flex;
  flex-shrink: 0;
  gap: 2px;
  overflow-x: auto;
  scrollbar-width: none;
}
.study-tab-content-wrapper {
  flex: 1;
  min-height: 0;
}
.study-view-container :deep(.mi-input),
.study-view-container :deep(.mi-textarea) {
  box-sizing: border-box;
  min-width: 0;
  padding: var(--mi-sp-2) var(--mi-sp-3);
  color: var(--mi-text);
  background: var(--mi-bg);
  border: 1px solid var(--mi-border);
  border-radius: var(--radius-lg, 8px);
  font: var(--mi-fs-label) var(--mi-font-family);
  outline: none;
}
.study-view-container :deep(.mi-input) { height: 32px; padding-block: 0; }
.study-view-container :deep(.mi-textarea) { width: 100%; line-height: 1.6; }
.study-view-container :deep(.mi-textarea:not(.math-code-area)) { resize: vertical; }
.study-view-container :deep(.mi-input:focus),
.study-view-container :deep(.mi-textarea:focus) { border-color: var(--mi-blue-deep); }
.study-view-container :deep(button:not(.ms-trigger):focus-visible) { outline: 2px solid var(--mi-blue-deep); outline-offset: 2px; }
/* 窄窗口只留图标，防止页签挤出横向滚动 */
@media (max-width: 860px) {
  .study-tab-link:not(.active) { font-size: 0; gap: 0; }
}
</style>
