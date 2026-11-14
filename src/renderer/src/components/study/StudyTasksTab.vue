<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useStudyStore, type StudyTask } from '../../stores/study'
import { STUDY_COPY } from '../../lib/study-copy'
import MiIcon from '../base/MiIcon.vue'

const study = useStudyStore()
const router = useRouter()

const currentFilter = ref<'all' | 'todo' | 'doing' | 'done'>('all')
const actionLoading = ref(false)
const actionError = ref<string | null>(null)

onMounted(() => {
  if (!study.isInitialized) {
    void study.loadSnapshot()
  }
})

const filters = [
  { key: 'all', label: STUDY_COPY.TASKS.FILTER_ALL, icon: 'list' },
  { key: 'doing', label: STUDY_COPY.TASKS.FILTER_DOING, icon: 'clock' },
  { key: 'todo', label: STUDY_COPY.TASKS.FILTER_TODO, icon: 'circle' },
  { key: 'done', label: STUDY_COPY.TASKS.FILTER_DONE, icon: 'circle-check' }
] as const
// 顺序被回归测试依赖：最后一个是「已完成」
const statuses = [
  { key: 'todo', label: STUDY_COPY.TASKS.STATUS_TODO, icon: 'circle' },
  { key: 'doing', label: STUDY_COPY.TASKS.STATUS_DOING, icon: 'clock' },
  { key: 'done', label: STUDY_COPY.TASKS.STATUS_DONE, icon: 'circle-check' }
] as const

const filteredTasks = computed(() => {
  const tasks = study.allTasks
  if (currentFilter.value === 'all') return tasks
  return tasks.filter((t) => t.status === currentFilter.value)
})

const counts = computed(() => {
  const all = study.allTasks
  return {
    all: all.length,
    todo: all.filter((t) => t.status === 'todo').length,
    doing: all.filter((t) => t.status === 'doing').length,
    done: all.filter((t) => t.status === 'done').length
  }
})

async function updateStatus(task: StudyTask & { planId: string }, nextStatus: 'todo' | 'doing' | 'done'): Promise<void> {
  if (task.status === nextStatus) return
  actionLoading.value = true
  actionError.value = null
  const res = await study.setTaskStatus(task.planId, task.id, nextStatus)
  actionLoading.value = false
  if (!res.ok) {
    actionError.value = res.error
  }
}

function navigateToLesson(lessonId: string): void {
  void router.push(`/lesson/${lessonId}`)
}
</script>

<template>
  <div class="study-tasks-pane pg">
    <div class="tasks-header pg-chips" role="group" :aria-label="STUDY_COPY.TABS.TASKS">
      <button
        v-for="f in filters"
        :key="f.key"
        type="button"
        class="pg-chip filter-btn"
        :class="{ active: currentFilter === f.key }"
        :aria-pressed="currentFilter === f.key"
        @click="currentFilter = f.key"
      >
        <MiIcon :name="f.icon" :size="14" />{{ f.label }}<span class="pg-count">{{ counts[f.key] }}</span>
      </button>
    </div>

    <div v-if="actionError" class="mi-alert-error" role="alert">
      <span>{{ actionError }}</span>
      <button type="button" class="alert-close-btn" :aria-label="STUDY_COPY.COMMON.CLOSE" @click="actionError = null"><MiIcon name="x" :size="14" /></button>
    </div>

    <div v-if="filteredTasks.length === 0" class="pg-empty">
      <MiIcon name="list-checks" :size="24" />
      <p>{{ STUDY_COPY.TASKS.EMPTY_HINT }}</p>
    </div>

    <div v-else class="pg-rows">
      <div v-for="task in filteredTasks" :key="task.id" class="task-row pg-row" :class="task.status">
        <div class="pg-row-main">
          <div class="task-title">{{ task.title }}</div>
          <div v-if="task.description" class="task-desc">{{ task.description }}</div>
          <div class="pg-meta">
            <span class="pg-meta-item" :title="STUDY_COPY.TASKS.PLAN_PREFIX + task.planTitle"><MiIcon name="layers" :size="12" />{{ task.planTitle }}</span>
            <span v-if="task.sourceRef" class="pg-meta-item source-ref-text" :title="STUDY_COPY.TASKS.SOURCE_REF_LABEL + ': ' + task.sourceRef"><MiIcon name="file" :size="12" />{{ task.sourceRef }}</span>
            <button v-if="task.lessonId" type="button" class="lesson-link-btn pg-meta-item" @click="navigateToLesson(task.lessonId)">
              <MiIcon name="book" :size="12" />{{ STUDY_COPY.TASKS.OPEN_LESSON }}
            </button>
          </div>
        </div>
        <div class="col-actions status-action-btns" role="group" :aria-label="STUDY_COPY.TASKS.COL_STATUS">
          <button
            v-for="s in statuses"
            :key="s.key"
            type="button"
            class="icon-btn action-pill-btn"
            :class="[s.key, { 'is-on': task.status === s.key }]"
            :title="s.label"
            :aria-label="s.label"
            :aria-pressed="task.status === s.key"
            :disabled="actionLoading"
            @click="updateStatus(task, s.key)"
          >
            <MiIcon :name="s.icon" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.study-tasks-pane { gap: var(--mi-sp-3); max-width: 820px; }
.task-title { font-size: var(--mi-fs-body); font-weight: 500; line-height: 1.45; color: var(--mi-text); }
.task-row.done .task-title { color: var(--mi-text-3); text-decoration: line-through; }
.task-desc { font-size: var(--mi-fs-label); line-height: 1.5; color: var(--mi-text-2); }
.source-ref-text { max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.lesson-link-btn { padding: 0; border: 0; background: transparent; color: var(--mi-blue-deep); font: inherit; cursor: pointer; }
.lesson-link-btn:hover { text-decoration: underline; }
.status-action-btns { display: flex; flex-shrink: 0; gap: 2px; }
.action-pill-btn { color: var(--mi-text-3); }
.action-pill-btn.is-on { background: var(--mi-blue-light); color: var(--mi-text); }
.action-pill-btn.is-on.doing { color: var(--mi-blue-deep); }
.action-pill-btn.is-on.done { color: var(--mi-success-deep); background: var(--mi-success-fill); }
</style>
