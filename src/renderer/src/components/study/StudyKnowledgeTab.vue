<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useStudyStore, type StudyNote } from '../../stores/study'
import { STUDY_COPY } from '../../lib/study-copy'
import { isRemote } from '../../lib/asset-base'

const remote = isRemote()
import MiIcon from '../base/MiIcon.vue'
import { renderMarkdown } from '../../lib/md'
import InteractiveHtmlSandbox from './InteractiveHtmlSandbox.vue'

const study = useStudyStore()

const searchQuery = ref('')
const selectedTag = ref('')
const showArchived = ref(false)

const activeNoteId = ref<string | null>(null)
const isEditing = ref(false)
const editTitle = ref('')
const editBody = ref('')
const editTags = ref('')
const activePreviewTab = ref<'edit' | 'preview'>('edit')

const actionLoading = ref(false)
const actionError = ref<string | null>(null)
const exportSuccessPath = ref<string | null>(null)

onMounted(() => {
  if (!study.isInitialized) {
    void study.loadSnapshot()
  }
})

const filteredNotes = computed(() => {
  const base = showArchived.value ? study.notes : study.activeNotes
  const q = searchQuery.value.trim().toLowerCase()
  const tag = selectedTag.value.trim().toLowerCase()

  return base.filter((n) => {
    if (tag && !n.tags.some((t) => t.toLowerCase() === tag)) return false
    if (!q) return true
    return (
      n.title.toLowerCase().includes(q) ||
      n.body.toLowerCase().includes(q) ||
      n.tags.some((t) => t.toLowerCase().includes(q))
    )
  })
})

const currentNote = computed(() => {
  if (!activeNoteId.value) return null
  return study.notes.find((n) => n.id === activeNoteId.value) ?? null
})

// 计算当前笔记的反向链接（被其他哪些笔记引用）
const backlinks = computed(() => currentNote.value ? study.backlinksMap.get(currentNote.value.id) ?? [] : [])

// Wiki 链接预处理，将 [[笔记标题]] 渲染为可点击标签
function renderNoteMarkdown(raw: string): string {
  if (!raw) return ''
  return renderMarkdown(raw, false, true).html
}

function onPreviewClick(e: MouseEvent): void {
  const target = (e.target as HTMLElement).closest('.wiki-link')
  if (target) {
    e.preventDefault()
    const encoded = target.getAttribute('data-wiki-note')
    if (encoded) {
      const title = decodeURIComponent(encoded).toLowerCase()
      const found = study.notes.find((n) => n.id.toLowerCase() === title || n.title.trim().toLowerCase() === title)
      if (found) {
        selectNote(found)
      } else {
        // 若引用了尚不存在的笔记，自动创建草稿
        startNewNote(decodeURIComponent(encoded))
      }
    }
  }
}

function selectNote(note: StudyNote): void {
  activeNoteId.value = note.id
  isEditing.value = false
  editTitle.value = note.title
  editBody.value = note.body
  editTags.value = note.tags.join(', ')
  activePreviewTab.value = 'preview'
  actionError.value = null
}

function startNewNote(presetTitle = ''): void {
  activeNoteId.value = null
  isEditing.value = true
  editTitle.value = presetTitle
  editBody.value = ''
  editTags.value = selectedTag.value ? selectedTag.value : ''
  activePreviewTab.value = 'edit'
  actionError.value = null
}

function enterEditMode(): void {
  if (!currentNote.value) return
  isEditing.value = true
  editTitle.value = currentNote.value.title
  editBody.value = currentNote.value.body
  editTags.value = currentNote.value.tags.join(', ')
  activePreviewTab.value = 'edit'
}

function cancelEdit(): void {
  if (currentNote.value) {
    isEditing.value = false
    activePreviewTab.value = 'preview'
  } else {
    isEditing.value = false
    activeNoteId.value = filteredNotes.value[0]?.id ?? null
  }
}

async function saveCurrentNote(): Promise<void> {
  const title = editTitle.value.trim()
  if (!title) {
    actionError.value = STUDY_COPY.KNOWLEDGE.TITLE_REQUIRED
    return
  }
  actionLoading.value = true
  actionError.value = null

  const tagsArr = editTags.value
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)

  const res = await study.saveNote({
    id: activeNoteId.value || undefined,
    title,
    body: editBody.value,
    tags: tagsArr,
    format: currentNote.value?.format ?? 'markdown'
  })

  actionLoading.value = false
  if (res.ok) {
    activeNoteId.value = res.data.id
    isEditing.value = false
    activePreviewTab.value = 'preview'
  } else {
    actionError.value = res.error
  }
}

async function toggleArchive(note: StudyNote): Promise<void> {
  actionLoading.value = true
  actionError.value = null
  if (note.archived) {
    const res = await study.unarchiveNote(note.id)
    if (!res.ok) actionError.value = res.error
  } else {
    const res = await study.archiveNote(note.id)
    if (!res.ok) actionError.value = res.error
  }
  actionLoading.value = false
}

async function handleExport(): Promise<void> {
  actionLoading.value = true
  actionError.value = null
  exportSuccessPath.value = null
  const res = await study.exportVault()
  actionLoading.value = false
  if (res.ok && res.data) {
    exportSuccessPath.value = res.data.path
  } else if (!res.ok) {
    actionError.value = res.error
  }
}

function formatTime(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
</script>

<template>
  <div class="study-knowledge-pane">
    <div v-if="exportSuccessPath" class="mi-alert-success">
      <span>{{ STUDY_COPY.KNOWLEDGE.EXPORT_SUCCESS }} {{ exportSuccessPath }}</span>
      <button type="button" class="alert-close-btn" :aria-label="STUDY_COPY.COMMON.CLOSE" @click="exportSuccessPath = null"><MiIcon name="x" :size="14" /></button>
    </div>
    <div v-if="actionError" class="mi-alert-error" role="alert">
      <span>{{ actionError }}</span>
      <button type="button" class="alert-close-btn" :aria-label="STUDY_COPY.COMMON.CLOSE" @click="actionError = null"><MiIcon name="x" :size="14" /></button>
    </div>

    <div class="knowledge-split-layout">
      <aside class="note-list-col">
        <div class="toolbar-actions">
          <label class="pg-search">
            <MiIcon name="search" :size="14" />
            <input v-model="searchQuery" type="search" class="search-input" :aria-label="STUDY_COPY.KNOWLEDGE.SEARCH_PLACEHOLDER" :placeholder="STUDY_COPY.KNOWLEDGE.SEARCH_PLACEHOLDER" />
          </label>
          <button
            type="button"
            class="icon-btn toggle-archived-btn"
            :class="{ active: showArchived }"
            :title="showArchived ? STUDY_COPY.KNOWLEDGE.HIDE_ARCHIVED : STUDY_COPY.KNOWLEDGE.SHOW_ARCHIVED"
            :aria-label="showArchived ? STUDY_COPY.KNOWLEDGE.HIDE_ARCHIVED : STUDY_COPY.KNOWLEDGE.SHOW_ARCHIVED"
            :aria-pressed="showArchived"
            @click="showArchived = !showArchived"
          ><MiIcon name="archive" /></button>
          <button v-if="!remote" type="button" class="icon-btn" :title="STUDY_COPY.KNOWLEDGE.EXPORT_BTN" :aria-label="STUDY_COPY.KNOWLEDGE.EXPORT_BTN" :disabled="actionLoading" @click="handleExport"><MiIcon name="download" /></button>
          <button type="button" class="mi-btn-primary new-note-btn" :title="STUDY_COPY.KNOWLEDGE.NEW_NOTE" :aria-label="STUDY_COPY.KNOWLEDGE.NEW_NOTE" @click="startNewNote()"><MiIcon name="plus" /></button>
        </div>
        <select v-if="study.tags.length > 0" v-model="selectedTag" class="mi-select tag-select" :aria-label="STUDY_COPY.KNOWLEDGE.TAG_FILTER_ALL">
          <option value="">{{ STUDY_COPY.KNOWLEDGE.TAG_FILTER_ALL }}</option>
          <option v-for="tag in study.tags" :key="tag" :value="tag">#{{ tag }}</option>
        </select>

        <div class="note-items-container">
          <button
            v-for="note in filteredNotes"
            :key="note.id"
            type="button"
            class="note-list-item"
            :class="{ active: activeNoteId === note.id && !isEditing, archived: note.archived }"
            @click="selectNote(note)"
          >
            <span class="item-title-row">
              <span class="item-title">{{ note.title || STUDY_COPY.KNOWLEDGE.UNTITLED_NOTE }}</span>
              <MiIcon v-if="note.archived" name="archive" :size="12" />
            </span>
            <span class="item-snippet">{{ note.body.slice(0, 60).trim() || STUDY_COPY.KNOWLEDGE.EMPTY_CONTENT }}</span>
          </button>
        </div>
      </aside>

      <div class="note-detail-col">
        <div v-if="isEditing" class="note-editor-card">
          <div class="editor-header">
            <input v-model="editTitle" type="text" class="editor-title-input" :aria-label="STUDY_COPY.KNOWLEDGE.NOTE_TITLE_PLACEHOLDER" :placeholder="STUDY_COPY.KNOWLEDGE.NOTE_TITLE_PLACEHOLDER" />
            <div class="editor-actions pg-actions">
              <button
                type="button"
                class="icon-btn"
                :class="{ active: activePreviewTab === 'preview' }"
                :title="STUDY_COPY.KNOWLEDGE.PREVIEW_TAB"
                :aria-label="STUDY_COPY.KNOWLEDGE.PREVIEW_TAB"
                :aria-pressed="activePreviewTab === 'preview'"
                @click="activePreviewTab = activePreviewTab === 'preview' ? 'edit' : 'preview'"
              ><MiIcon name="book" /></button>
              <button type="button" class="icon-btn" :title="STUDY_COPY.COMMON.CANCEL" :aria-label="STUDY_COPY.COMMON.CANCEL" :disabled="actionLoading" @click="cancelEdit"><MiIcon name="x" /></button>
              <button type="button" class="mi-btn-primary" :disabled="!editTitle.trim() || actionLoading" @click="saveCurrentNote">
                <MiIcon name="check" />{{ STUDY_COPY.COMMON.SAVE }}
              </button>
            </div>
          </div>

          <div class="editor-body-area">
            <textarea v-if="activePreviewTab === 'edit'" v-model="editBody" class="mi-textarea editor-textarea" :aria-label="STUDY_COPY.KNOWLEDGE.NOTE_BODY_PLACEHOLDER" :placeholder="STUDY_COPY.KNOWLEDGE.NOTE_BODY_PLACEHOLDER" />
            <InteractiveHtmlSandbox v-else-if="currentNote?.format === 'html'" :html="editBody" :title="editTitle" />
            <div v-else class="note-rendered-view markdown-body" @click="onPreviewClick" v-html="renderNoteMarkdown(editBody)" />
          </div>

          <input v-model="editTags" type="text" class="mi-input editor-tags-input" :aria-label="STUDY_COPY.KNOWLEDGE.TAGS_PLACEHOLDER" :placeholder="STUDY_COPY.KNOWLEDGE.TAGS_PLACEHOLDER" />
        </div>

        <div v-else-if="currentNote" class="note-view-card">
          <div class="view-header">
            <div class="pg-row-main">
              <h1 class="view-title">{{ currentNote.title }}</h1>
              <div class="pg-meta">
                <span>{{ formatTime(currentNote.updatedAt) }}</span>
                <span v-for="t in currentNote.tags" :key="t">#{{ t }}</span>
              </div>
            </div>
            <div class="view-actions pg-actions">
              <button type="button" class="icon-btn" :title="STUDY_COPY.COMMON.EDIT" :aria-label="STUDY_COPY.COMMON.EDIT" @click="enterEditMode"><MiIcon name="pencil" /></button>
              <button
                type="button"
                class="icon-btn"
                :title="currentNote.archived ? STUDY_COPY.COMMON.UNARCHIVE : STUDY_COPY.COMMON.ARCHIVE"
                :aria-label="currentNote.archived ? STUDY_COPY.COMMON.UNARCHIVE : STUDY_COPY.COMMON.ARCHIVE"
                @click="toggleArchive(currentNote)"
              ><MiIcon :name="currentNote.archived ? 'archive-restore' : 'archive'" /></button>
            </div>
          </div>

          <InteractiveHtmlSandbox v-if="currentNote.format === 'html'" :html="currentNote.body" :title="currentNote.title" />
          <div v-else class="note-rendered-view markdown-body" @click="onPreviewClick" v-html="renderNoteMarkdown(currentNote.body)" />

          <section v-if="backlinks.length > 0" class="pg-section backlinks-section">
            <h3 class="pg-section-title"><MiIcon name="link" :size="14" />{{ STUDY_COPY.KNOWLEDGE.BACKLINKS_TITLE }}<span class="pg-count">{{ backlinks.length }}</span></h3>
            <div class="pg-chips">
              <button v-for="b in backlinks" :key="b.id" type="button" class="pg-chip backlink-item-btn" @click="selectNote(b)">{{ b.title }}</button>
            </div>
          </section>
        </div>

        <div v-else class="pg-empty note-empty-state">
          <MiIcon name="note" :size="24" />
          <p>{{ filteredNotes.length ? STUDY_COPY.KNOWLEDGE.DETAIL_HINT : STUDY_COPY.KNOWLEDGE.EMPTY_HINT }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.study-knowledge-pane { display: flex; flex-direction: column; gap: var(--mi-sp-3); height: 100%; min-height: 0; }
.knowledge-split-layout { display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: var(--mi-sp-8); flex: 1; min-height: 0; }
.note-list-col { display: flex; flex-direction: column; gap: var(--mi-sp-2); min-width: 0; }
.toolbar-actions { display: flex; align-items: center; gap: 2px; }
.toolbar-actions .pg-search { min-width: 0; margin-right: 2px; }
button.new-note-btn { width: 32px; padding: 0; }
.tag-select { width: 100%; }
.note-items-container { display: flex; flex-direction: column; gap: 1px; overflow-y: auto; max-height: calc(100vh - 240px); }
.note-list-item { display: flex; flex-direction: column; gap: 2px; width: 100%; padding: var(--mi-sp-2) var(--mi-sp-3); border: 0; border-radius: var(--radius-lg, 8px); background: transparent; text-align: left; cursor: pointer; box-sizing: border-box; font-family: var(--mi-font-family); }
.note-list-item:hover { background: var(--cds-fill-ghost-hover); }
.note-list-item.active { background: var(--mi-blue-light); }
.note-list-item.archived .item-title { color: var(--mi-text-3); }
.item-title-row { display: flex; align-items: center; gap: var(--mi-sp-2); color: var(--mi-text-3); }
.item-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--mi-fs-label); font-weight: 500; color: var(--mi-text); }
.item-snippet { font-size: var(--mi-fs-caption); line-height: 1.4; color: var(--mi-text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.note-detail-col { display: flex; flex-direction: column; min-width: 0; overflow-y: auto; max-height: calc(100vh - 160px); }
.note-view-card, .note-editor-card { display: flex; flex-direction: column; gap: var(--mi-sp-4); flex: 1; min-height: 0; max-width: 720px; }
.view-header, .editor-header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--mi-sp-3); }
.view-title { margin: 0; font-size: var(--mi-fs-title); font-weight: 500; line-height: 1.35; color: var(--mi-text); }
.editor-title-input { flex: 1; min-width: 0; height: 32px; padding: 0; border: 0; border-bottom: 1px solid var(--mi-border); background: transparent; color: var(--mi-text); font: 500 18px var(--mi-font-family); outline: none; }
.editor-title-input:focus { border-bottom-color: var(--mi-blue-deep); }
.editor-body-area { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.editor-textarea { flex: 1; min-height: 300px; }
.note-rendered-view { font-size: var(--mi-fs-body); line-height: 1.7; color: var(--mi-text); min-height: 120px; }
.backlinks-section { padding-top: var(--mi-sp-4); border-top: 1px solid var(--mi-border); }
.note-empty-state { flex: 1; }
:deep(.wiki-link) { color: var(--mi-blue-deep); text-decoration: none; }
:deep(.wiki-link:hover) { text-decoration: underline; }
@media (max-width: 860px) { .knowledge-split-layout { grid-template-columns: 1fr; } .note-items-container { max-height: 200px; } .note-detail-col { max-height: none; } }
</style>
