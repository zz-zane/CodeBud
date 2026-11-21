<script setup lang="ts">
/**
 * 任务页（2026-11-21 重做）：任务按「任务组」分区，不再把所有教材 / 对话的任务混成一条长列表。
 * - 顶部：总进度（完成 / 进行中 / 待开始 的分段条）+ 状态筛选 + 新建任务组
 * - 待确认草稿：照旧在最上面（教材生成的计划要先确认）
 * - 每个任务组一张卡：进度环、来源（教材 / AI 对话 / 自定义）、可折叠、改名、删除；组内任务可改状态、删除、底部直接添加
 * 增删改都走 study.editTasks（主进程 editStudyTasks，与 AI 助教的任务指令同一个入口）。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useStudyStore, type StudyTask } from '../../stores/study'
import { usePracticeStore } from '../../stores/practice'
import { lessonMastery, MASTERY_PASS } from '../../../../shared/mastery'
import { CUSTOM_PLAN_MATERIAL, type StudyPlan } from '../../../../shared/study-companion'
import { STUDY_COPY } from '../../lib/study-copy'
import MiIcon from '../base/MiIcon.vue'
import MiButton from '../base/MiButton.vue'
import MiModal from '../base/MiModal.vue'

type Status = StudyTask['status']
type FilterKey = 'all' | Status
const T = STUDY_COPY.TASKS

const study = useStudyStore()
const practice = usePracticeStore()
const router = useRouter()

const currentFilter = ref<FilterKey>('all')
const actionLoading = ref(false)
const actionError = ref<string | null>(null)

onMounted(() => {
  if (!study.isInitialized) void study.loadSnapshot()
  if (!practice.loaded) void practice.load()
})

async function run<R>(job: () => Promise<{ ok: true; data?: R } | { ok: false; error: string }>): Promise<boolean> {
  actionLoading.value = true
  actionError.value = null
  const res = await job()
  actionLoading.value = false
  if (!res.ok) actionError.value = res.error
  return res.ok
}

// ── 待确认草稿（教材生成的计划，确认后才生效） ─────────────────────────────
interface DraftEditTask { id: string; title: string; description: string; sourceRef?: string }
interface DraftEditPlan { title: string; tasks: DraftEditTask[] }

const draftEdits = ref<Record<string, DraftEditPlan>>({})
const draftPlans = computed(() => study.plans.filter((p) => p.draft))

watch(
  draftPlans,
  (list) => {
    const next: Record<string, DraftEditPlan> = {}
    for (const plan of list) {
      next[plan.id] = draftEdits.value[plan.id] ?? {
        title: plan.title,
        tasks: plan.tasks.map((t) => ({ id: t.id, title: t.title, description: t.description, sourceRef: t.sourceRef }))
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
  await run(() => study.confirmPlan({
    planId,
    title: draft.title.trim(),
    tasks: draft.tasks.map((t) => ({ id: t.id, title: t.title.trim(), description: t.description.trim() }))
  }))
}

async function discardDraft(planId: string): Promise<void> {
  await run(() => study.discardPlan(planId))
}

// ── 状态与筛选 ────────────────────────────────────────────────────────────
const statusMeta: Record<Status, { label: string; icon: 'circle' | 'clock' | 'circle-check'; next: Status }> = {
  todo: { label: T.STATUS_TODO, icon: 'circle', next: 'doing' },
  doing: { label: T.STATUS_DOING, icon: 'clock', next: 'done' },
  done: { label: T.STATUS_DONE, icon: 'circle-check', next: 'todo' }
}
const filters = [
  { key: 'all', label: T.FILTER_ALL, icon: 'list' },
  { key: 'doing', label: T.FILTER_DOING, icon: 'clock' },
  { key: 'todo', label: T.FILTER_TODO, icon: 'circle' },
  { key: 'done', label: T.FILTER_DONE, icon: 'circle-check' }
] as const

const counts = computed(() => {
  const all = study.allTasks
  return {
    all: all.length,
    todo: all.filter((t) => t.status === 'todo').length,
    doing: all.filter((t) => t.status === 'doing').length,
    done: all.filter((t) => t.status === 'done').length
  }
})
const pct = (n: number, total: number): number => (total ? Math.round((n / total) * 100) : 0)

// ── 任务组 ────────────────────────────────────────────────────────────────
const materialName = computed(() => new Map(study.materials.map((m) => [m.id, m.name])))

function sourceLabel(plan: StudyPlan): string {
  if (plan.materialId === CUSTOM_PLAN_MATERIAL) return plan.source === 'ai' ? T.SOURCE_AI : T.SOURCE_CUSTOM
  const name = materialName.value.get(plan.materialId)
  return name ? T.sourceMaterial(name) : T.SOURCE_MATERIAL_MISSING
}

const groups = computed(() =>
  study.plans
    .filter((p) => !p.draft)
    .map((plan) => {
      const done = plan.tasks.filter((t) => t.status === 'done').length
      const visible = currentFilter.value === 'all' ? plan.tasks : plan.tasks.filter((t) => t.status === currentFilter.value)
      return { plan, done, total: plan.tasks.length, finished: plan.tasks.length > 0 && done === plan.tasks.length, visible }
    })
    // 没做完的组在前，同类里新建的在前
    .sort((a, b) => Number(a.finished) - Number(b.finished) || b.plan.createdAt - a.plan.createdAt)
)

// 折叠：默认全部做完的组收起；用户手动点过的以用户为准
const collapsedManual = ref<Record<string, boolean>>({})
function isCollapsed(g: { plan: StudyPlan; finished: boolean }): boolean {
  return collapsedManual.value[g.plan.id] ?? g.finished
}
function toggleGroup(g: { plan: StudyPlan; finished: boolean }): void {
  collapsedManual.value[g.plan.id] = !isCollapsed(g)
}

// 新建任务组
const creating = ref(false)
const newGroupTitle = ref('')
async function createGroup(): Promise<void> {
  const title = newGroupTitle.value.trim()
  if (!title) return
  if (await run(() => study.editTasks({ op: 'create_plan', title }))) {
    newGroupTitle.value = ''
    creating.value = false
  }
}

// 改名
const renamingId = ref<string | null>(null)
const renameText = ref('')
function startRename(plan: StudyPlan): void {
  renamingId.value = plan.id
  renameText.value = plan.title
}
async function commitRename(plan: StudyPlan): Promise<void> {
  const title = renameText.value.trim()
  renamingId.value = null
  if (!title || title === plan.title) return
  await run(() => study.editTasks({ op: 'rename_plan', planId: plan.id, title }))
}

// 删组（二次确认）
const deletingGroup = ref<StudyPlan | null>(null)
async function confirmDeleteGroup(): Promise<void> {
  const plan = deletingGroup.value
  deletingGroup.value = null
  if (plan) await run(() => study.editTasks({ op: 'delete_plan', planId: plan.id }))
}

// 组内添加 / 删除任务
const addText = ref<Record<string, string>>({})
async function addTask(plan: StudyPlan): Promise<void> {
  const title = (addText.value[plan.id] ?? '').trim()
  if (!title) return
  if (await run(() => study.editTasks({ op: 'add_task', planId: plan.id, title }))) addText.value[plan.id] = ''
}
async function deleteTask(plan: StudyPlan, task: StudyTask): Promise<void> {
  await run(() => study.editTasks({ op: 'delete_task', planId: plan.id, taskId: task.id }))
}

// 长说明默认收成两行
const expanded = ref<Record<string, boolean>>({})

// ── 状态切换（含「掌握度不到 80% 先确认」） ───────────────────────────────
const confirmDoneState = ref<{ task: StudyTask & { planId: string }; pct: number } | null>(null)

function taskMastery(lessonId?: string): { pct: number; pass: boolean; attempts: number } | null {
  if (!lessonId) return null
  const m = lessonMastery(practice.history, lessonId)
  return { pct: Math.round(m.score * 100), pass: m.score >= MASTERY_PASS, attempts: m.attempts }
}

async function cycleStatus(plan: StudyPlan, task: StudyTask): Promise<void> {
  const next = statusMeta[task.status].next
  const withPlan = { ...task, planId: plan.id }
  if (next === 'done' && task.lessonId) {
    const m = lessonMastery(practice.history, task.lessonId)
    if (m.score < MASTERY_PASS) {
      confirmDoneState.value = { task: withPlan, pct: Math.round(m.score * 100) }
      return
    }
  }
  await commitStatus(withPlan, next)
}

async function commitStatus(task: StudyTask & { planId: string }, nextStatus: Status): Promise<void> {
  await run(() => study.setTaskStatus(task.planId, task.id, nextStatus))
}

async function forceCompleteTask(): Promise<void> {
  const pending = confirmDoneState.value
  confirmDoneState.value = null
  if (pending) await commitStatus(pending.task, 'done')
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
    <!-- 总进度：一条分段条 + 三个数，一眼看清全局 -->
    <section class="tk-summary" :aria-label="T.SUMMARY_TITLE">
      <div class="tk-summary-top">
        <div class="tk-summary-figure">
          <span class="tk-summary-pct">{{ pct(counts.done, counts.all) }}<small>%</small></span>
          <span class="tk-summary-sub">{{ T.SUMMARY_TITLE }} · {{ T.progress(counts.done, counts.all) }} · {{ T.summaryGroups(groups.length) }}</span>
        </div>
        <MiButton variant="secondary" size="sm" icon="folder-plus" :disabled="actionLoading" @click="creating = !creating">{{ T.NEW_GROUP }}</MiButton>
      </div>
      <div class="tk-stack" role="img" :aria-label="`${T.STATUS_DONE} ${counts.done}，${T.STATUS_DOING} ${counts.doing}，${T.STATUS_TODO} ${counts.todo}`">
        <span class="seg done" :style="{ width: pct(counts.done, counts.all) + '%' }" />
        <span class="seg doing" :style="{ width: pct(counts.doing, counts.all) + '%' }" />
      </div>
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
    </section>

    <div v-if="actionError" class="mi-alert-error" role="alert">
      <span>{{ actionError }}</span>
      <button type="button" class="alert-close-btn" :aria-label="STUDY_COPY.COMMON.CLOSE" @click="actionError = null"><MiIcon name="x" :size="14" /></button>
    </div>

    <form v-if="creating" class="tk-new-group" @submit.prevent="createGroup">
      <MiIcon name="folder-plus" :size="16" />
      <input v-model="newGroupTitle" class="mi-input" :placeholder="T.NEW_GROUP_PLACEHOLDER" :aria-label="T.NEW_GROUP_PLACEHOLDER" maxlength="300" autofocus />
      <MiButton variant="ghost" size="sm" @click="creating = false">{{ T.CANCEL }}</MiButton>
      <MiButton variant="primary" size="sm" :disabled="actionLoading || !newGroupTitle.trim()" @click="createGroup">{{ T.CREATE }}</MiButton>
    </form>

    <section v-for="plan in draftPlans" :key="plan.id" class="draft-plan-card" data-testid="draft-plan-card">
      <div class="draft-plan-head">
        <span class="draft-badge">{{ STUDY_COPY.TASKS.DRAFT_BADGE }}</span>
        <input
          v-model="draftEdits[plan.id].title"
          type="text"
          class="mi-input draft-title-input"
          :placeholder="T.DRAFT_TITLE_PLACEHOLDER"
          :aria-label="T.DRAFT_TITLE_PLACEHOLDER"
          :disabled="actionLoading"
        />
      </div>
      <div class="draft-task-list">
        <div v-for="dt in draftEdits[plan.id].tasks" :key="dt.id" class="draft-task-item">
          <div class="draft-task-fields">
            <input v-model="dt.title" type="text" class="mi-input draft-task-title" :placeholder="T.DRAFT_TASK_TITLE_PLACEHOLDER" :aria-label="T.DRAFT_TASK_TITLE_PLACEHOLDER" :disabled="actionLoading" />
            <textarea v-model="dt.description" class="mi-textarea draft-task-desc" rows="2" :placeholder="T.DRAFT_TASK_DESC_PLACEHOLDER" :aria-label="T.DRAFT_TASK_DESC_PLACEHOLDER" :disabled="actionLoading" />
            <span v-if="dt.sourceRef" class="draft-source-ref">{{ T.DRAFT_SOURCE_PREFIX }}{{ dt.sourceRef }}</span>
          </div>
          <button
            type="button"
            class="icon-btn danger"
            :title="draftEdits[plan.id].tasks.length <= 1 ? T.DRAFT_KEEP_ONE : STUDY_COPY.COMMON.DELETE"
            :aria-label="STUDY_COPY.COMMON.DELETE"
            :disabled="actionLoading || draftEdits[plan.id].tasks.length <= 1"
            @click="removeDraftTask(plan.id, dt.id)"
          >
            <MiIcon name="trash" />
          </button>
        </div>
      </div>
      <div class="draft-plan-foot">
        <span class="draft-hint">{{ T.DRAFT_HINT }}</span>
        <div class="draft-actions">
          <MiButton variant="ghost" size="sm" :disabled="actionLoading" data-action="discard-plan" @click="discardDraft(plan.id)">{{ T.DRAFT_DISCARD }}</MiButton>
          <MiButton variant="primary" size="sm" :disabled="actionLoading || !canConfirmDraft(plan.id)" data-action="confirm-plan" @click="confirmDraft(plan.id)">{{ T.DRAFT_CONFIRM }}</MiButton>
        </div>
      </div>
    </section>

    <div v-if="groups.length === 0 && draftPlans.length === 0 && !creating" class="pg-empty">
      <MiIcon name="list-checks" :size="24" />
      <p>{{ T.EMPTY_HINT }}</p>
      <p class="tk-empty-guide">{{ T.EMPTY_GUIDE }}</p>
    </div>

    <div v-auto-animate class="tk-groups mi-stagger">
      <section v-for="g in groups" :key="g.plan.id" class="tk-group" :class="{ finished: g.finished, collapsed: isCollapsed(g) }">
        <header class="tk-group-head">
          <button
            type="button"
            class="tk-fold"
            :aria-expanded="!isCollapsed(g)"
            :aria-label="isCollapsed(g) ? T.EXPAND_GROUP : T.COLLAPSE_GROUP"
            @click="toggleGroup(g)"
          >
            <MiIcon name="chevron-right" :size="16" class="tk-fold-icon" />
          </button>
          <!-- 进度环：周长 100 的圆，dasharray 直接写百分比 -->
          <svg class="tk-ring" viewBox="0 0 36 36" role="img" :aria-label="T.progress(g.done, g.total)">
            <circle class="tk-ring-track" cx="18" cy="18" r="15.9155" />
            <circle class="tk-ring-fill" cx="18" cy="18" r="15.9155" :stroke-dasharray="`${pct(g.done, g.total)} 100`" />
          </svg>
          <div class="tk-group-titles">
            <input
              v-if="renamingId === g.plan.id"
              v-model="renameText"
              class="mi-input tk-rename"
              :aria-label="T.RENAME_GROUP"
              maxlength="300"
              autofocus
              @keydown.enter.prevent="commitRename(g.plan)"
              @keydown.esc="renamingId = null"
              @blur="commitRename(g.plan)"
            />
            <button v-else type="button" class="tk-group-title" :title="g.plan.title" @click="toggleGroup(g)">{{ g.plan.title }}</button>
            <span class="tk-group-meta">
              <span class="tk-source" :class="g.plan.materialId === CUSTOM_PLAN_MATERIAL ? g.plan.source : 'material'">{{ sourceLabel(g.plan) }}</span>
              <span class="tk-count">{{ T.progress(g.done, g.total) }}</span>
            </span>
          </div>
          <div class="tk-group-actions">
            <button type="button" class="icon-btn" :title="T.RENAME_GROUP" :aria-label="T.RENAME_GROUP" @click="startRename(g.plan)"><MiIcon name="pencil" :size="15" /></button>
            <button type="button" class="icon-btn danger" :title="T.DELETE_GROUP" :aria-label="T.DELETE_GROUP" @click="deletingGroup = g.plan"><MiIcon name="trash" :size="15" /></button>
          </div>
        </header>

        <div v-if="!isCollapsed(g)" class="tk-group-body">
          <ul v-auto-animate class="tk-list">
            <li v-for="task in g.visible" :key="task.id" class="tk-row" :class="task.status">
              <button
                type="button"
                class="tk-status"
                :class="task.status"
                :title="T.cycleStatus(statusMeta[task.status].label, statusMeta[statusMeta[task.status].next].label)"
                :aria-label="T.cycleStatus(statusMeta[task.status].label, statusMeta[statusMeta[task.status].next].label)"
                :disabled="actionLoading"
                @click="cycleStatus(g.plan, task)"
              >
                <MiIcon :name="statusMeta[task.status].icon" :size="18" />
              </button>
              <div class="tk-body">
                <div class="tk-title">{{ task.title }}</div>
                <p v-if="task.description" class="tk-desc" :class="{ open: expanded[task.id] }">{{ task.description }}</p>
                <div class="tk-meta">
                  <span class="tk-chip" :class="task.status">{{ statusMeta[task.status].label }}</span>
                  <button v-if="task.description && task.description.length > 80" type="button" class="tk-link" @click="expanded[task.id] = !expanded[task.id]">{{ expanded[task.id] ? T.LESS : T.MORE }}</button>
                  <span v-if="task.sourceRef" class="tk-ref" :title="T.SOURCE_REF_LABEL + ': ' + task.sourceRef"><MiIcon name="file" :size="12" />{{ task.sourceRef }}</span>
                  <template v-if="taskMastery(task.lessonId)">
                    <span class="tk-mastery" data-testid="task-mastery">
                      <span class="mastery-track"><span class="mastery-fill" :class="{ pass: taskMastery(task.lessonId)!.pass }" :style="{ width: `${taskMastery(task.lessonId)!.attempts > 0 ? taskMastery(task.lessonId)!.pct : 0}%` }" /></span>
                      {{ taskMastery(task.lessonId)!.attempts > 0 ? T.MASTERY_PERCENT(taskMastery(task.lessonId)!.pct) : T.MASTERY_NONE }}
                    </span>
                  </template>
                  <button v-if="task.lessonId" type="button" class="tk-link" @click="navigateToLesson(task.lessonId)"><MiIcon name="book" :size="12" />{{ T.OPEN_LESSON }}</button>
                </div>
              </div>
              <button type="button" class="icon-btn danger tk-del" :title="T.DELETE_TASK" :aria-label="T.DELETE_TASK" :disabled="actionLoading" @click="deleteTask(g.plan, task)"><MiIcon name="x" :size="14" /></button>
            </li>
          </ul>
          <p v-if="g.total === 0" class="tk-group-empty">{{ T.GROUP_EMPTY }}</p>
          <p v-else-if="g.visible.length === 0" class="tk-group-empty">{{ T.groupFilterEmpty(filters.find((f) => f.key === currentFilter)!.label) }}</p>
          <form class="tk-add" @submit.prevent="addTask(g.plan)">
            <MiIcon name="plus" :size="15" />
            <input v-model="addText[g.plan.id]" class="tk-add-input" :placeholder="T.ADD_TASK_PLACEHOLDER" :aria-label="T.ADD_TASK_PLACEHOLDER" maxlength="300" />
            <MiButton v-if="(addText[g.plan.id] ?? '').trim()" variant="primary" size="sm" :disabled="actionLoading" @click="addTask(g.plan)">{{ T.ADD_TASK }}</MiButton>
          </form>
        </div>
      </section>
    </div>

    <MiModal :visible="!!confirmDoneState" :title="STUDY_COPY.TASKS.CONFIRM_COMPLETE_TITLE" :width="420" @update:visible="(v) => { if (!v) confirmDoneState = null }">
      <p v-if="confirmDoneState">{{ T.confirmCompleteBody(confirmDoneState.task.title, confirmDoneState.pct) }}</p>
      <template #footer>
        <MiButton variant="secondary" @click="forceCompleteTask">{{ T.CONFIRM_COMPLETE_FORCE }}</MiButton>
        <MiButton variant="primary" @click="goPracticeFromConfirm">{{ T.CONFIRM_COMPLETE_PRACTICE }}</MiButton>
      </template>
    </MiModal>

    <MiModal :visible="!!deletingGroup" :title="T.DELETE_GROUP_TITLE" :width="420" @update:visible="(v) => { if (!v) deletingGroup = null }">
      <p v-if="deletingGroup">{{ T.deleteGroupBody(deletingGroup.title, deletingGroup.tasks.length) }}</p>
      <template #footer>
        <MiButton variant="ghost" @click="deletingGroup = null">{{ T.CANCEL }}</MiButton>
        <MiButton variant="primary" @click="confirmDeleteGroup">{{ T.DELETE_GROUP }}</MiButton>
      </template>
    </MiModal>
  </div>
</template>

<style scoped>
.study-tasks-pane { gap: var(--mi-sp-4); max-width: 860px; }

/* ── 总进度 ── */
.tk-summary { display: flex; flex-direction: column; gap: var(--mi-sp-3); padding: var(--mi-sp-4); border: 1px solid var(--mi-border); border-radius: var(--mi-radius-box); background: var(--mi-card); }
.tk-summary-top { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--mi-sp-3); }
.tk-summary-figure { display: flex; align-items: baseline; gap: var(--mi-sp-3); flex-wrap: wrap; }
.tk-summary-pct { font-size: var(--mi-fs-hero); font-weight: 500; line-height: 1; color: var(--mi-text); font-variant-numeric: tabular-nums; }
.tk-summary-pct small { font-size: var(--mi-fs-body); color: var(--mi-text-2); margin-left: 2px; }
.tk-summary-sub { font-size: var(--mi-fs-label); color: var(--mi-text-2); font-variant-numeric: tabular-nums; }
.tk-stack { display: flex; height: 8px; border-radius: 999px; overflow: hidden; background: var(--mi-blue-light); }
.tk-stack .seg { height: 100%; transition: width var(--mi-dur-slow) var(--mi-ease-out); }
.tk-stack .seg.done { background: var(--mi-success-deep); }
.tk-stack .seg.doing { background: var(--mi-blue-deep); }

.tk-new-group { display: flex; align-items: center; gap: var(--mi-sp-2); padding: var(--mi-sp-3); border: 1.5px dashed var(--mi-border-control); border-radius: var(--mi-radius-box); color: var(--mi-text-2); }
.tk-new-group .mi-input { flex: 1; min-width: 0; }
.tk-empty-guide { max-width: 46ch; font-size: var(--mi-fs-label); color: var(--mi-text-3); }

/* ── 任务组卡 ── */
.tk-groups { display: flex; flex-direction: column; gap: var(--mi-sp-3); }
.tk-group { border: 1px solid var(--mi-border); border-radius: var(--mi-radius-box); background: var(--mi-card); transition: border-color var(--mi-dur-fast) var(--mi-ease); }
.tk-group:hover { border-color: var(--mi-border-control); }
.tk-group-head { display: flex; align-items: center; gap: var(--mi-sp-2); padding: var(--mi-sp-3) var(--mi-sp-3) var(--mi-sp-3) var(--mi-sp-2); }
.tk-group:not(.collapsed) .tk-group-head { border-bottom: 1px solid var(--mi-border); }
.tk-fold { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border: 0; border-radius: var(--mi-radius-sm); background: transparent; color: var(--mi-text-2); cursor: pointer; }
.tk-fold:hover { background: var(--cds-fill-ghost-hover); color: var(--mi-text); }
.tk-fold-icon { transition: transform var(--mi-dur) var(--mi-ease-out); }
.tk-group:not(.collapsed) .tk-fold-icon { transform: rotate(90deg); }
.tk-ring { width: 34px; height: 34px; flex-shrink: 0; transform: rotate(-90deg); }
.tk-ring circle { fill: none; stroke-width: 3.5; }
.tk-ring-track { stroke: var(--mi-blue-light); }
.tk-ring-fill { stroke: var(--mi-blue-deep); stroke-linecap: round; transition: stroke-dasharray var(--mi-dur-slow) var(--mi-ease-out); }
.tk-group.finished .tk-ring-fill { stroke: var(--mi-success-deep); }
.tk-group-titles { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.tk-group-title { padding: 0; border: 0; background: transparent; color: var(--mi-text); font: inherit; font-size: var(--mi-fs-body); font-weight: 500; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
.tk-rename { font-weight: 500; }
.tk-group-meta { display: flex; align-items: center; gap: var(--mi-sp-2); font-size: var(--mi-fs-caption); color: var(--mi-text-3); min-width: 0; }
.tk-source { padding: 1px var(--mi-sp-2); border-radius: var(--mi-radius-ctl); background: var(--cds-fill-ghost-hover); color: var(--mi-text-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 360px; }
.tk-source.ai { background: var(--mi-blue-light); color: var(--mi-blue-ink); }
.tk-count { font-variant-numeric: tabular-nums; }
.tk-group-actions { display: flex; gap: 2px; }
.tk-group-actions .icon-btn { color: var(--mi-text-3); transition: color var(--mi-dur-fast) var(--mi-ease); }
.tk-group:hover .tk-group-actions .icon-btn, .tk-group-actions:focus-within .icon-btn { color: var(--mi-text-2); }

/* ── 组内任务 ── */
.tk-group-body { padding: var(--mi-sp-1) var(--mi-sp-3) var(--mi-sp-2); }
.tk-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
.tk-row { display: flex; align-items: flex-start; gap: var(--mi-sp-2); padding: var(--mi-sp-2) var(--mi-sp-1); border-radius: var(--mi-radius); transition: background-color var(--mi-dur-fast) var(--mi-ease); }
.tk-row + .tk-row { border-top: 1px solid var(--mi-border); }
.tk-row:hover { background: var(--cds-fill-ghost-hover); }
.tk-status { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; margin-top: -3px; border: 0; border-radius: 50%; background: transparent; color: var(--mi-text-3); cursor: pointer; transition: transform var(--mi-dur) cubic-bezier(0.34, 1.3, 0.64, 1), color var(--mi-dur-fast) var(--mi-ease), background-color var(--mi-dur-fast) var(--mi-ease); }
.tk-status:hover { background: var(--cds-fill-ghost-selected); transform: scale(1.08); }
.tk-status:active { transform: scale(0.86); transition-duration: 60ms; }
.tk-status.doing { color: var(--mi-blue-deep); }
.tk-status.done { color: var(--mi-success-deep); }
.tk-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.tk-title { font-size: var(--mi-fs-body); font-weight: 500; line-height: 1.45; color: var(--mi-text); transition: color var(--mi-dur-fast) var(--mi-ease); }
.tk-row.done .tk-title { color: var(--mi-text-3); text-decoration: line-through; }
.tk-desc { margin: 0; font-size: var(--mi-fs-label); line-height: 1.55; color: var(--mi-text-2); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.tk-desc.open { display: block; }
.tk-meta { display: flex; align-items: center; flex-wrap: wrap; gap: var(--mi-sp-1) var(--mi-sp-3); font-size: var(--mi-fs-caption); color: var(--mi-text-3); }
.tk-chip { padding: 0 var(--mi-sp-2); border-radius: var(--mi-radius-ctl); background: var(--cds-fill-ghost-hover); color: var(--mi-text-2); }
.tk-chip.doing { background: var(--mi-blue-light); color: var(--mi-blue-ink); }
.tk-chip.done { background: var(--mi-success-fill); color: var(--mi-success-deep); }
.tk-ref { display: inline-flex; align-items: center; gap: 3px; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tk-link { display: inline-flex; align-items: center; gap: 3px; padding: 0; border: 0; background: transparent; color: var(--mi-blue-deep); font: inherit; cursor: pointer; }
.tk-link:hover { text-decoration: underline; }
.tk-mastery { display: inline-flex; align-items: center; gap: var(--mi-sp-2); font-variant-numeric: tabular-nums; }
.mastery-track { width: 72px; height: 5px; border-radius: 999px; background: var(--mi-blue-light); overflow: hidden; }
.mastery-fill { display: block; height: 100%; background: var(--mi-blue-deep); border-radius: inherit; transition: width var(--mi-dur-fast) ease; }
.mastery-fill.pass { background: var(--mi-success-deep); }
.tk-del { visibility: hidden; flex-shrink: 0; }
.tk-row:hover .tk-del, .tk-row:focus-within .tk-del { visibility: visible; }
.tk-group-empty { margin: var(--mi-sp-2) var(--mi-sp-1); font-size: var(--mi-fs-label); color: var(--mi-text-3); }
.tk-add { display: flex; align-items: center; gap: var(--mi-sp-2); margin-top: var(--mi-sp-1); padding: var(--mi-sp-1) var(--mi-sp-2); border-radius: var(--mi-radius); color: var(--mi-text-3); transition: background-color var(--mi-dur-fast) var(--mi-ease); }
.tk-add:focus-within { background: var(--cds-fill-ghost-hover); color: var(--mi-text-2); }
.tk-add-input { flex: 1; min-width: 0; height: 32px; border: 0; background: transparent; color: var(--mi-text); font: inherit; font-size: var(--mi-fs-label); outline: none; }

/* ── 草稿（沿用） ── */
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
</style>
