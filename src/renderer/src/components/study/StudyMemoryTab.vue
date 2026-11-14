<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useStudyStore, type StudyMemory } from '../../stores/study'
import { STUDY_COPY } from '../../lib/study-copy'
import MiIcon from '../base/MiIcon.vue'

const study = useStudyStore()

const newText = ref('')
const newSource = ref(STUDY_COPY.MEMORY.DEFAULT_SOURCE_MANUAL)
const isAdding = ref(false)
const editingId = ref<string | null>(null)
const editText = ref('')
const editSource = ref('')
const actionLoading = ref(false)
const actionError = ref<string | null>(null)

const memories = computed(() => study.memory)

onMounted(() => {
  if (!study.isInitialized) {
    void study.loadSnapshot()
  }
})

function startAdd(): void {
  isAdding.value = true
  newText.value = ''
  newSource.value = STUDY_COPY.MEMORY.DEFAULT_SOURCE_MANUAL
}

function cancelAdd(): void {
  isAdding.value = false
  newText.value = ''
  actionError.value = null
}

async function submitAdd(): Promise<void> {
  const t = newText.value.trim()
  if (!t) return
  actionLoading.value = true
  actionError.value = null
  const res = await study.saveMemory({
    text: t,
    source: newSource.value.trim() || STUDY_COPY.MEMORY.DEFAULT_SOURCE_MANUAL
  })
  actionLoading.value = false
  if (res.ok) {
    isAdding.value = false
    newText.value = ''
  } else {
    actionError.value = res.error
  }
}

function startEdit(item: StudyMemory): void {
  editingId.value = item.id
  editText.value = item.text
  editSource.value = item.source
}

function cancelEdit(): void {
  editingId.value = null
  editText.value = ''
  actionError.value = null
}

async function submitEdit(id: string): Promise<void> {
  const t = editText.value.trim()
  if (!t) return
  actionLoading.value = true
  actionError.value = null
  const res = await study.saveMemory({
    id,
    text: t,
    source: editSource.value.trim() || STUDY_COPY.MEMORY.DEFAULT_SOURCE_EDIT
  })
  actionLoading.value = false
  if (res.ok) {
    editingId.value = null
  } else {
    actionError.value = res.error
  }
}

async function removeMemory(id: string): Promise<void> {
  if (!window.confirm(STUDY_COPY.MEMORY.DELETE_CONFIRM)) return
  actionLoading.value = true
  actionError.value = null
  const res = await study.forgetMemory(id)
  actionLoading.value = false
  if (!res.ok) {
    actionError.value = res.error
  }
}

function formatTime(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<template>
  <div class="study-tab-pane pg">
    <div class="tab-header pg-toolbar">
      <span />
      <button v-if="!isAdding" type="button" class="mi-btn-primary" @click="startAdd">
        <MiIcon name="plus" />{{ STUDY_COPY.MEMORY.ADD_BTN }}
      </button>
    </div>

    <div v-if="actionError" class="mi-alert-error" role="alert">
      <span>{{ actionError }}</span>
      <button type="button" class="alert-close-btn" :aria-label="STUDY_COPY.COMMON.CLOSE" @click="actionError = null"><MiIcon name="x" :size="14" /></button>
    </div>

    <div v-if="isAdding" class="memory-form-card">
      <textarea v-model="newText" class="mi-textarea" rows="3" :aria-label="STUDY_COPY.TABS.MEMORY" :placeholder="STUDY_COPY.MEMORY.TEXT_PLACEHOLDER" :disabled="actionLoading" />
      <div class="form-row">
        <input v-model="newSource" type="text" class="mi-input source-input" :aria-label="STUDY_COPY.MEMORY.SOURCE_LABEL" :placeholder="STUDY_COPY.MEMORY.SOURCE_LABEL" :disabled="actionLoading" />
        <div class="pg-actions form-actions">
          <button type="button" class="mi-btn-secondary" :disabled="actionLoading" @click="cancelAdd">{{ STUDY_COPY.COMMON.CANCEL }}</button>
          <button type="button" class="mi-btn-primary" :disabled="!newText.trim() || actionLoading" @click="submitAdd">
            <MiIcon name="check" />{{ STUDY_COPY.COMMON.SAVE }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="memories.length === 0 && !isAdding && !study.loading" class="pg-empty">
      <MiIcon name="lightbulb" :size="24" />
      <p>{{ STUDY_COPY.MEMORY.EMPTY_HINT }}</p>
    </div>

    <div v-else class="memory-list pg-rows">
      <div v-for="item in memories" :key="item.id" class="memory-item-card pg-row" :class="{ 'is-editing': editingId === item.id }">
        <div v-if="editingId === item.id" class="pg-row-main edit-col">
          <textarea v-model="editText" class="mi-textarea" rows="3" :aria-label="STUDY_COPY.TABS.MEMORY" :disabled="actionLoading" />
          <div class="form-row">
            <input v-model="editSource" type="text" class="mi-input source-input" :aria-label="STUDY_COPY.MEMORY.SOURCE_LABEL" :placeholder="STUDY_COPY.MEMORY.SOURCE_LABEL" :disabled="actionLoading" />
            <div class="pg-actions form-actions">
              <button type="button" class="mi-btn-secondary" :disabled="actionLoading" @click="cancelEdit">{{ STUDY_COPY.COMMON.CANCEL }}</button>
              <button type="button" class="mi-btn-primary" :disabled="!editText.trim() || actionLoading" @click="submitEdit(item.id)">
                <MiIcon name="check" />{{ STUDY_COPY.COMMON.SAVE }}
              </button>
            </div>
          </div>
        </div>
        <template v-else>
          <div class="pg-row-main">
            <div class="memory-content">{{ item.text }}</div>
            <div class="pg-meta">
              <span class="meta-source" :title="STUDY_COPY.MEMORY.SOURCE_LABEL + ': ' + item.source">{{ item.source }}</span>
              <span>{{ formatTime(item.updatedAt) }}</span>
            </div>
          </div>
          <div class="pg-row-actions reveal">
            <button type="button" class="icon-btn" :title="STUDY_COPY.COMMON.EDIT" :aria-label="STUDY_COPY.COMMON.EDIT" @click="startEdit(item)"><MiIcon name="pencil" /></button>
            <button type="button" class="icon-btn danger" :title="STUDY_COPY.MEMORY.FORGET_BTN" :aria-label="STUDY_COPY.MEMORY.FORGET_BTN" @click="removeMemory(item.id)"><MiIcon name="trash" /></button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.study-tab-pane { gap: var(--mi-sp-3); max-width: 760px; }
.memory-form-card { display: flex; flex-direction: column; gap: var(--mi-sp-2); }
.edit-col { gap: var(--mi-sp-2); }
.form-row { display: flex; align-items: center; justify-content: space-between; gap: var(--mi-sp-3); flex-wrap: wrap; }
.source-input { flex: 1; max-width: 220px; }
.memory-content { font-size: var(--mi-fs-body); line-height: 1.6; color: var(--mi-text); white-space: pre-wrap; word-break: break-word; }
.meta-source { max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
