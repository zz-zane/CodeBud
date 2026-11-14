<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useStudyStore, type StudyMaterial } from '../../stores/study'
import { STUDY_COPY } from '../../lib/study-copy'
import { REMOTE_GATE } from '../../lib/copy'
import { isRemote } from '../../lib/asset-base'

const remote = isRemote()
import MiIcon from '../base/MiIcon.vue'

const study = useStudyStore()

const selectedMaterialId = ref<string | null>(null)
const goalText = ref('')
const readingText = ref<string | null>(null)
const isGenerating = ref(false)
const isReading = ref(false)
const actionError = ref<string | null>(null)

onMounted(() => {
  if (!study.isInitialized) {
    void study.loadSnapshot()
  }
})

const materials = computed(() => study.materials)

const selectedMaterial = computed(() => {
  return materials.value.find((m) => m.id === selectedMaterialId.value) ?? null
})

// 与选中的教材相关的计划
const materialPlans = computed(() => {
  if (!selectedMaterialId.value) return []
  return study.plans.filter((p) => p.materialId === selectedMaterialId.value)
})

async function handleImport(): Promise<void> {
  actionError.value = null
  const res = await study.importMaterials()
  if (!res.ok) {
    actionError.value = res.error
  } else if (res.data.length > 0) {
    selectedMaterialId.value = res.data[0].id
  }
}

function selectMaterial(m: StudyMaterial): void {
  selectedMaterialId.value = m.id
  readingText.value = null
  actionError.value = null
}

async function viewMaterialText(id: string): Promise<void> {
  isReading.value = true
  actionError.value = null
  const res = await study.readMaterial(id)
  isReading.value = false
  if (res.ok) {
    readingText.value = res.data.text
  } else {
    actionError.value = res.error
  }
}

async function triggerGeneratePlan(): Promise<void> {
  if (!selectedMaterialId.value) return
  const goal = goalText.value.trim()
  if (!goal) {
    actionError.value = STUDY_COPY.MATERIALS.GOAL_REQUIRED
    return
  }

  isGenerating.value = true
  actionError.value = null
  const res = await study.generatePlan({
    materialId: selectedMaterialId.value,
    goal
  })
  isGenerating.value = false

  if (res.ok) {
    goalText.value = ''
  } else {
    actionError.value = res.error
  }
}

function formatStatus(status: StudyMaterial['status']): string {
  if (status === 'ready') return STUDY_COPY.MATERIALS.STATUS_READY
  if (status === 'unsupported') return STUDY_COPY.MATERIALS.STATUS_UNSUPPORTED
  return STUDY_COPY.MATERIALS.STATUS_ERROR
}

function formatTime(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
</script>

<template>
  <div class="study-materials-pane">
    <div v-if="actionError" class="mi-alert-error" role="alert">
      <span>{{ actionError }}</span>
      <button type="button" class="alert-close-btn" :aria-label="STUDY_COPY.COMMON.CLOSE" @click="actionError = null"><MiIcon name="x" :size="14" /></button>
    </div>

    <div v-if="materials.length === 0" class="pg-empty">
      <MiIcon name="book" :size="24" />
      <p>{{ STUDY_COPY.MATERIALS.EMPTY_HINT }}</p>
      <div class="materials-header">
        <button v-if="!remote" type="button" class="mi-btn-primary" @click="handleImport"><MiIcon name="upload" />{{ STUDY_COPY.MATERIALS.IMPORT_BTN }}</button>
        <span v-else class="remote-note">{{ REMOTE_GATE.DESKTOP_ONLY }}</span>
      </div>
    </div>

    <div v-else class="materials-split-layout">
      <aside class="materials-list-col">
        <div class="materials-header">
          <button v-if="!remote" type="button" class="mi-btn-primary" @click="handleImport"><MiIcon name="upload" />{{ STUDY_COPY.MATERIALS.IMPORT_BTN }}</button>
        </div>
        <div class="material-items-box">
          <button
            v-for="m in materials"
            :key="m.id"
            type="button"
            class="material-item-btn"
            :class="{ active: selectedMaterialId === m.id }"
            :title="m.name"
            @click="selectMaterial(m)"
          >
            <MiIcon name="file" :class="`state-${m.status}`" />
            <span class="material-name">{{ m.name }}</span>
          </button>
        </div>
      </aside>

      <div class="materials-detail-col">
        <div v-if="selectedMaterial" class="material-detail-card">
          <div class="detail-header">
            <div class="pg-row-main">
              <h3 class="detail-title">{{ selectedMaterial.name }}</h3>
              <div class="pg-meta">
                <span>{{ selectedMaterial.kind.toUpperCase() }}</span>
                <span>{{ selectedMaterial.charCount.toLocaleString() }} {{ STUDY_COPY.MATERIALS.CHAR_COUNT }}</span>
                <span>{{ formatTime(selectedMaterial.createdAt) }}</span>
              </div>
            </div>
            <button
              v-if="selectedMaterial.status === 'ready'"
              type="button"
              class="icon-btn"
              :class="{ active: readingText !== null }"
              :title="STUDY_COPY.MATERIALS.READ_ORIGINAL"
              :aria-label="STUDY_COPY.MATERIALS.READ_ORIGINAL"
              :aria-pressed="readingText !== null"
              :disabled="isReading"
              @click="readingText !== null ? (readingText = null) : viewMaterialText(selectedMaterial.id)"
            >
              <MiIcon name="book" />
            </button>
          </div>

          <div v-if="selectedMaterial.status === 'unsupported'" class="material-note warn">
            <MiIcon name="alert" />{{ STUDY_COPY.MATERIALS.UNSUPPORTED_NOTE }}
          </div>
          <div v-else-if="selectedMaterial.status === 'error'" class="material-note error">
            <MiIcon name="alert" />{{ selectedMaterial.error || STUDY_COPY.MATERIALS.EXTRACT_FAILED }}
          </div>

          <pre v-if="readingText !== null" class="raw-text-box" :aria-label="STUDY_COPY.MATERIALS.TEXT_EXTRACT_TITLE">{{ readingText }}</pre>

          <div v-if="selectedMaterial.status === 'ready'" class="generator-input-row">
            <input
              v-model="goalText"
              type="text"
              class="mi-input goal-input"
              :aria-label="STUDY_COPY.MATERIALS.GOAL_LABEL"
              :placeholder="STUDY_COPY.MATERIALS.GOAL_PLACEHOLDER"
              :disabled="isGenerating"
              @keydown.enter="triggerGeneratePlan"
            />
            <button type="button" class="mi-btn-primary" :disabled="!goalText.trim() || isGenerating" @click="triggerGeneratePlan">
              <MiIcon name="sparkles" />{{ isGenerating ? STUDY_COPY.MATERIALS.GENERATING : STUDY_COPY.MATERIALS.GENERATE_ACTION }}
            </button>
          </div>

          <section v-for="plan in materialPlans" :key="plan.id" class="pg-section plan-card">
            <h4 class="pg-section-title"><MiIcon name="layers" :size="14" />{{ plan.title }}<span class="pg-count">{{ formatTime(plan.createdAt) }}</span></h4>
            <div v-for="task in plan.tasks" :key="task.id" class="task-badge-row" :class="task.status">
              <MiIcon :name="task.status === 'done' ? 'circle-check' : task.status === 'doing' ? 'clock' : 'circle'" :size="14" />
              <span class="task-name">{{ task.title }}</span>
            </div>
          </section>
        </div>

        <div v-else class="pg-empty">
          <MiIcon name="file" :size="24" />
          <p>{{ STUDY_COPY.MATERIALS.SELECT_HINT }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.study-materials-pane { display: flex; flex-direction: column; gap: var(--mi-sp-3); }
.materials-split-layout { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: var(--mi-sp-8); }
.materials-list-col { display: flex; flex-direction: column; gap: var(--mi-sp-3); min-width: 0; }
.material-items-box { display: flex; flex-direction: column; gap: 1px; overflow-y: auto; max-height: calc(100vh - 210px); }
.material-item-btn { display: flex; align-items: center; gap: var(--mi-sp-2); width: 100%; padding: var(--mi-sp-2) var(--mi-sp-3); border: 0; border-radius: var(--radius-lg, 8px); background: transparent; color: var(--mi-text-2); text-align: left; font: var(--mi-fs-label) var(--mi-font-family); cursor: pointer; }
.material-item-btn:hover { background: var(--cds-fill-ghost-hover); }
.material-item-btn.active { background: var(--mi-blue-light); color: var(--mi-text); font-weight: 500; }
.material-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.state-unsupported { color: var(--mi-warn-deep); }
.state-error { color: var(--mi-error-deep); }
.materials-detail-col { min-width: 0; }
.material-detail-card { display: flex; flex-direction: column; gap: var(--mi-sp-4); max-width: 680px; }
.detail-header { display: flex; align-items: flex-start; gap: var(--mi-sp-3); }
.detail-title { margin: 0; font-size: var(--mi-fs-read); font-weight: 500; line-height: 1.35; color: var(--mi-text); word-break: break-word; }
.material-note { display: flex; align-items: flex-start; gap: var(--mi-sp-2); font-size: var(--mi-fs-label); line-height: 1.5; }
.material-note.warn { color: var(--mi-warn-deep); }
.material-note.error { color: var(--mi-error-deep); }
.raw-text-box { margin: 0; padding: var(--mi-sp-3); max-height: 280px; overflow-y: auto; border-radius: var(--radius-lg, 8px); background: var(--mi-code-bg); color: var(--mi-text); font: 12px/1.6 var(--mi-font-family); white-space: pre-wrap; word-break: break-word; }
.generator-input-row { display: flex; gap: var(--mi-sp-2); }
.goal-input { flex: 1; }
.plan-card { padding-top: var(--mi-sp-3); border-top: 1px solid var(--mi-border); }
.task-badge-row { display: flex; align-items: center; gap: var(--mi-sp-2); padding: 3px 0; font-size: var(--mi-fs-label); color: var(--mi-text-3); }
.task-badge-row.doing { color: var(--mi-blue-deep); }
.task-badge-row.done { color: var(--mi-success-deep); }
.task-name { flex: 1; min-width: 0; color: var(--mi-text); }
.task-badge-row.done .task-name { color: var(--mi-text-3); }
@media (max-width: 860px) { .materials-split-layout { grid-template-columns: 1fr; } .material-items-box { max-height: 180px; } }
</style>
