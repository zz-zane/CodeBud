<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useStudyStore, type StudyTask } from '../../stores/study'
import { usePracticeStore } from '../../stores/practice'
import { lessonMastery, MASTERY_PASS } from '../../../../shared/mastery'
import { STUDY_COPY } from '../../lib/study-copy'
import MiIcon from '../base/MiIcon.vue'
import MiButton from '../base/MiButton.vue'
import MiModal from '../base/MiModal.vue'

const study = useStudyStore()
const practice = usePracticeStore()
const router = useRouter()

const currentFilter = ref<'all' | 'todo' | 'doing' | 'done'>('all')
const actionLoading = ref(false)
const actionError = ref<string | null>(null)

interface DraftEditTask {
  id: string
  title: string
  description: string
  sourceRef?: string
}

interface DraftEditPlan {
  title: string
  tasks: DraftEditTask[]
}

const draftEdits = ref<Record<string, DraftEditPlan>>({})
const confirmDoneState = ref<{ task: StudyTask & { planId: string }; pct: number } | null>(null)

onMounted(() => {
  if (!study.isInitialized) {
    void study.loadSnapshot()
  }
  if (!practice.loaded) {
    void practice.load()
  }
})

const draftPlans = computed(() => study.plans.filter((p) => p.draft))

watch(
  draftPlans,
  (list) => {
    const next: Record<string, DraftEditPlan> = {}
    for (const plan of list) {
      next[plan.id] = draftEdits.value[plan.id] ?? {
        title: plan.title,
        tasks: plan.tasks.map((t) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          sourceRef: t.sourceRef
        }))
      }
    }
    draftEdits.value = next
  },
  { immediate: true }
)

function removeDraftTask(planId: string, taskId: string): void {
  const draft = draftEdits.value[planId]
  if (!draft || draft.tasks.length <= 1) return
  draft.tasks = draft.tasks.filter((t) => t.id !== taskId)
}

function canConfirmDraft(planId: string): boolean {
  const draft = draftEdits.value[planId]
  if (!draft || !draft.title.trim()) return false
  if (draft.tasks.length < 1 || draft.tasks.length > 30) return false
  return draft.tasks.every((t) => t.title.trim().length > 0)
}

async function confirmDraft(planId: string): Promise<void> {
  const draft = draftEdits.value[planId]
  if (!draft || !canConfirmDraft(planId)) return
  actionLoading.value = true
  actionError.value = null
  const res = await study.confirmPlan({
    planId,
    title: draft.title.trim(),
    tasks: draft.tasks.map((t) => ({
      id: t.id,
      title: t.title.trim(),
      description: t.description.trim()
    }))
  })
  actionLoading.value = false
  if (!res.ok) {
    actionError.value = res.error
  }
}

async function discardDraft(planId: string): Promise<void> {
  actionLoading.value = true
  actionError.value = null
  const res = await study.discardPlan(planId)
  actionLoading.value = false
  if (!res.ok) {
    actionError.value = res.error
  }
}

function taskMastery(lessonId?: string): { pct: number; pass: boolean; attempts: number } | null {
  if (!lessonId) return null
  const m = lessonMastery(practice.history, lessonId)
  return {
    pct: Math.round(m.score * 100),
    pass: m.score >= MASTERY_PASS,
    attempts: m.attempts
  }
}

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
  if (nextStatus === 'done' && task.lessonId) {
    const m = lessonMastery(practice.history, task.lessonId)
    if (m.score < MASTERY_PASS) {
      confirmDoneState.value = { task, pct: Math.round(m.score * 100) }
      return
    }
  }
  await commitStatus(task, nextStatus)
}

async function commitStatus(task: StudyTask & { planId: string }, nextStatus: 'todo' | 'doing' | 'done'): Promise<void> {
  actionLoading.value = true
  actionError.value = null
  const res = await study.setTaskStatus(task.planId, task.id, nextStatus)
  actionLoading.value = false
  if (!res.ok) {
    actionError.value = res.error
  }
}

async function forceCompleteTask(): Promise<void> {
  const pending = confirmDoneState.value
  confirmDoneState.value = null
  if (!pending) return
  await commitStatus(pending.task, 'done')
}

function goPracticeFromConfirm(): void {
  const lessonId = confirmDoneState.value?.task.lessonId
  confirmDoneState.value = null
  if (lessonId) navigateToLesson(lessonId)
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

    <section v-for="plan in draftPlans" :key="plan.id" class="draft-plan-card" data-testid="draft-plan-card">
      <div class="draft-plan-head">
        <span class="draft-badge">{{ STUDY_COPY.TASKS.DRAFT_BADGE }}</span>
        <input
          v-model="draftEdits[plan.id].title"
          type="text"
          class="mi-input draft-title-input"
          :placeholder="STUDY_COPY.TASKS.DRAFT_TITLE_PLACEHOLDER"
          :aria-label="STUDY_COPY.TASKS.DRAFT_TITLE_PLACEHOLDER"
          :disabled="actionLoading"
        />
      </div>

      <div class="draft-task-list">
        <div v-for="dt in draftEdits[plan.id].tasks" :key="dt.id" class="draft-task-item">
          <div class="draft-task-fields">
            <input
              v-model="dt.title"
              type="text"
              class="mi-input draft-task-title"
              :placeholder="STUDY_COPY.TASKS.DRAFT_TASK_TITLE_PLACEHOLDER"
              :aria-label="STUDY_COPY.TASKS.DRAFT_TASK_TITLE_PLACEHOLDER"
              :disabled="actionLoading"
            />
            <textarea
              v-model="dt.description"
              class="mi-textarea draft-task-desc"
              rows="2"
              :placeholder="STUDY_COPY.TASKS.DRAFT_TASK_DESC_PLACEHOLDER"
              :aria-label="STUDY_COPY.TASKS.DRAFT_TASK_DESC_PLACEHOLDER"
              :disabled="actionLoading"
            />
            <span v-if="dt.sourceRef" class="draft-source-ref">{{ STUDY_COPY.TASKS.DRAFT_SOURCE_PREFIX }}{{ dt.sourceRef }}</span>
          </div>
          <button
            type="button"
            class="icon-btn danger"
            :title="draftEdits[plan.id].tasks.length <= 1 ? STUDY_COPY.TASKS.DRAFT_KEEP_ONE : STUDY_COPY.COMMON.DELETE"
            :aria-label="STUDY_COPY.COMMON.DELETE"
            :disabled="actionLoading || draftEdits[plan.id].tasks.length <= 1"
            @click="removeDraftTask(plan.id, dt.id)"
          >
            <MiIcon name="trash" />
          </button>
        </div>
      </div>

      <div class="draft-plan-foot">
        <span class="draft-hint">{{ STUDY_COPY.TASKS.DRAFT_HINT }}</span>
        <div class="draft-actions">
          <MiButton variant="ghost" size="sm" :disabled="actionLoading" data-action="discard-plan" @click="discardDraft(plan.id)">
            {{ STUDY_COPY.TASKS.DRAFT_DISCARD }}
          </MiButton>
          <MiButton
            variant="primary"
            size="sm"
            :disabled="actionLoading || !canConfirmDraft(plan.id)"
            data-action="confirm-plan"
            @click="confirmDraft(plan.id)"
          >
            {{ STUDY_COPY.TASKS.DRAFT_CONFIRM }}
          </MiButton>
        </div>
      </div>
    </section>

    <div v-if="filteredTasks.length === 0 && draftPlans.length === 0" class="pg-empty">
      <MiIcon name="list-checks" :size="24" />
      <p>{{ STUDY_COPY.TASKS.EMPTY_HINT }}</p>
    </div>

    <div v-else-if="filteredTasks.length > 0" class="pg-rows">
      <div v-for="task in filteredTasks" :key="task.id" class="task-row pg-row" :class="task.status">
        <div class="pg-row-main">
          <div class="task-title">{{ task.title }}</div>
          <div v-if="task.description" class="task-desc">{{ task.description }}</div>
          <div v-if="taskMastery(task.lessonId)" class="task-mastery-row" data-testid="task-mastery">
            <div class="mastery-track">
              <div
                class="mastery-fill"
                :class="{ pass: taskMastery(task.lessonId)!.pass }"
                :style="{ width: `${taskMastery(task.lessonId)!.attempts > 0 ? taskMastery(task.lessonId)!.pct : 0}%` }"
              />
            </div>
            <span class="mastery-label">
              {{
                taskMastery(task.lessonId)!.attempts > 0
                  ? STUDY_COPY.TASKS.MASTERY_PERCENT(taskMastery(task.lessonId)!.pct)
                  : STUDY_COPY.TASKS.MASTERY_NONE
              }}
            </span>
          </div>
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

    <MiModal
      :visible="!!confirmDoneState"
      :title="STUDY_COPY.TASKS.CONFIRM_COMPLETE_TITLE"
      :width="420"
      @update:visible="(v) => { if (!v) confirmDoneState = null }"
    >
      <p v-if="confirmDoneState">{{ STUDY_COPY.TASKS.confirmCompleteBody(confirmDoneState.task.title, confirmDoneState.pct) }}</p>
      <template #footer>
        <MiButton variant="secondary" @click="forceCompleteTask">{{ STUDY_COPY.TASKS.CONFIRM_COMPLETE_FORCE }}</MiButton>
        <MiButton variant="primary" @click="goPracticeFromConfirm">{{ STUDY_COPY.TASKS.CONFIRM_COMPLETE_PRACTICE }}</MiButton>
      </template>
    </MiModal>
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
.draft-plan-card { display: flex; flex-direction: column; gap: var(--mi-sp-3); padding: var(--mi-sp-4); border: 1.5px solid var(--mi-blue-deep); border-radius: var(--mi-radius-box); background: var(--mi-card); }
.draft-plan-head { display: flex; align-items: center; gap: var(--mi-sp-2); }
.draft-badge { flex-shrink: 0; padding: 2px var(--mi-sp-2); border-radius: var(--mi-radius-ctl); background: var(--mi-blue-light); color: var(--mi-blue-ink); font-size: var(--mi-fs-caption); font-weight: 500; }
.draft-title-input { flex: 1; min-width: 0; font-weight: 500; }
.draft-task-list { display: flex; flex-direction: column; gap: var(--mi-sp-2); }
.draft-task-item { display: flex; align-items: flex-start; gap: var(--mi-sp-2); padding-top: var(--mi-sp-2); border-top: 1px solid var(--mi-border); }
.draft-task-fields { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--mi-sp-1); }
.draft-task-title, .draft-task-desc { width: 100%; }
.draft-source-ref { font-size: var(--mi-fs-caption); color: var(--mi-text-3); }
.draft-plan-foot { display: flex; align-items: center; justify-content: space-between; gap: var(--mi-sp-3); flex-wrap: wrap; padding-top: var(--mi-sp-2); border-top: 1px solid var(--mi-border); }
.draft-hint { font-size: var(--mi-fs-caption); color: var(--mi-text-3); flex: 1; min-width: 180px; }
.draft-actions { display: flex; align-items: center; gap: var(--mi-sp-2); flex-shrink: 0; }
.task-mastery-row { display: flex; align-items: center; gap: var(--mi-sp-2); margin-top: 2px; }
.mastery-track { width: 88px; height: 6px; border-radius: 999px; background: var(--mi-blue-light); overflow: hidden; }
.mastery-fill { height: 100%; background: var(--mi-blue-deep); border-radius: inherit; transition: width var(--mi-dur-fast) ease; }
.mastery-fill.pass { background: var(--mi-success-deep); }
.mastery-label { font-size: var(--mi-fs-caption); color: var(--mi-text-3); font-variant-numeric: tabular-nums; }
</style>
