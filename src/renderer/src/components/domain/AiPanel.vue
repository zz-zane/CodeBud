<script setup lang="ts">
import { isPhoneViewport } from '../../lib/phone-back-close'
 








import MiIcon from '../base/MiIcon.vue'
import MiButton from '../base/MiButton.vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAiAssistantStore } from '../../stores/ai-assistant'
import { useSettingsDialogStore } from '../../stores/settings-dialog'
import { useSettingsStore } from '../../stores/settings'
import { isPinnedToBottom, shouldSendAiMessage } from '../../lib/ai-input'
import { renderMarkdown } from '../../lib/md'
import { AI_ASSISTANT, TOAST, VIDEO_UI } from '../../lib/copy'
import { useVideoStore } from '../../stores/video'
import { VIDEO_GENERATION_TEXT as VT } from '../../../../shared/video-copy'
import { toast } from '../base/toast'
import { AI_APP } from '../../../../shared/copy'
import type { TutoringAction } from '../../../../shared/types'
import AiRichMessage from './AiRichMessage.vue'
import MiPopMenu from '../base/MiPopMenu.vue'
import AiThinkingDraft from './AiThinkingDraft.vue'
import ComposerProviderBar from './ComposerProviderBar.vue'
import { formatBytes, prepareDraftAttachment, type AiDraftAttachment } from '../../lib/composer-types'
import { STUDY_MAIN_SESSION_ID, useStudyStore } from '../../stores/study'
import { useContentStore } from '../../stores/content'

const props = withDefaults(defineProps<{ variant?: 'rail' | 'main' }>(), { variant: 'rail' })
const isMain = computed(() => props.variant === 'main')

const aiStore = useAiAssistantStore()
const video = useVideoStore()
const videoMode = ref(false)
const videoElapsed = ref(0)
let videoTimer: number | undefined
watch(() => video.loading, (loading) => {
  if (videoTimer !== undefined) { window.clearInterval(videoTimer); videoTimer = undefined }
  if (loading) {
    videoElapsed.value = 0
    videoTimer = window.setInterval(() => { videoElapsed.value++ }, 1000)
  }
}, { immediate: true })
onBeforeUnmount(() => { if (videoTimer !== undefined) window.clearInterval(videoTimer) })
const videoStages = [VIDEO_UI.STAGE_JUDGE, VIDEO_UI.STAGE_SCRIPT, VIDEO_UI.STAGE_CHECK] as const
const videoStageIdx = computed(() => {
  const s = video.progress?.stage ?? 'judging'
  if (s === 'done') return 3
  if (s === 'verifying') return 2
  if (s === 'scripting') return 1
  return 0
})
watch(() => video.modeRequested, requested => { if (requested) { videoMode.value = true; video.modeRequested = false } }, { immediate: true })
const tutoringMode = computed<string>({
  get: () => videoMode.value ? 'video' : aiStore.tutoringAction,
  set: (value: string) => {
    videoMode.value = value === 'video'
    if (!videoMode.value) aiStore.tutoringAction = value as TutoringAction
  }
})
const tutorOptions = computed(() => [
  ['direct', AI_ASSISTANT.TUTOR_DIRECT], ['hint', AI_ASSISTANT.TUTOR_HINT], ['approach', AI_ASSISTANT.TUTOR_APPROACH],
  ['explain', AI_ASSISTANT.TUTOR_EXPLAIN], ['diagnose', AI_ASSISTANT.TUTOR_DIAGNOSE], ['feynman', AI_ASSISTANT.TUTOR_FEYNMAN],
  ['visualize', AI_ASSISTANT.TUTOR_VISUALIZE], ['solve', AI_ASSISTANT.TUTOR_SOLVE], ['video', VIDEO_UI.TITLE]
].map(([key, label]) => ({ key, label, checked: tutoringMode.value === key })))
const settingsDialog = useSettingsDialogStore()
const settings = useSettingsStore()
const study = useStudyStore()
const content = useContentStore()
const emit = defineEmits<{
  'typing-activity': []
}>()
const router = useRouter()
const composing = ref(false)
const messageContainer = ref<HTMLElement | null>(null)
const inputArea = ref<HTMLTextAreaElement | null>(null)
const messages = computed(() => aiStore.currentMessages)
/*
 * 「正在生成」= 请求在途，判据只看 store 的 isStreaming。
 *
 * 【不看有没有文字】请求发出后到首字返回前，
 * 上游已经收到请求、用户也确实需要能取消 —— 模型排队或网络慢时这段可能长达
 * 数十秒。早先要求 streamingText 非空才显示停止键，那段窗口里只有一颗禁用的
 * 发送键，无法取消（独立审查 F1）。
 * 残留在 true 的状态由 store 的 loadOnce 在进程启动时复位，不需要这里再兜。
 */
const isStreaming = computed(() => aiStore.isStreaming)
const hasApiKey = computed(() => Boolean(settings.config.ai?.hasKey) || Boolean(study.activeConnectionId))
 





const canSend = computed(() => (videoMode.value || hasApiKey.value) && (!!aiStore.draft.trim() || (!videoMode.value && aiStore.pendingAttachments.length > 0)) && !composing.value)
const streamingText = computed(() => aiStore.streamingText)
const sessionTitle = computed(() => aiStore.currentSession?.title || AI_ASSISTANT.DEFAULT_SESSION_TITLE)

// ── 滚动：只在贴底时跟随；往上翻就不打扰，并给「回到最新」（§6.3） ──
const pinned = ref(true)
function el() { return messageContainer.value }
function toBottom() {
  const box = el()
  if (box) box.scrollTop = box.scrollHeight
  pinned.value = true
}
function onScroll() {
  const box = el()
  if (box) pinned.value = isPinnedToBottom(box.scrollHeight, box.scrollTop, box.clientHeight)
}
function remember(sessionId: string) {
  const box = el()
  if (box && sessionId) aiStore.scrollMemory.set(sessionId, { top: box.scrollTop, pinned: pinned.value })
}
function restore() {
  void nextTick(() => {
    const saved = aiStore.scrollMemory.get(aiStore.currentSessionId)
    const box = el()
    if (!box) return
    if (!saved || saved.pinned) toBottom()
    else { box.scrollTop = saved.top; pinned.value = false }
  })
}
onMounted(restore)
// 手机键盘开合时输入区自己抬起（phone.css），贴底的对话保持贴底；不贴底的不动
function onKbViewport(): void {
  if (isPhoneViewport() && pinned.value) requestAnimationFrame(toBottom)
}
onMounted(() => window.visualViewport?.addEventListener('resize', onKbViewport))
onBeforeUnmount(() => window.visualViewport?.removeEventListener('resize', onKbViewport))
onBeforeUnmount(() => remember(aiStore.currentSessionId))
watch(() => aiStore.currentSessionId, (_next, prev) => { if (prev) remember(prev); restore() })
watch([() => messages.value.length, streamingText, isStreaming], () => {
  if (pinned.value) void nextTick(toBottom)
})

// 手机：点发送 / 停止不能让输入框失焦（键盘会收起）；桌面保持原行为
function keepComposerFocus(e: PointerEvent): void {
  if (isPhoneViewport()) e.preventDefault()
}
function onSend() {
  if (videoMode.value) {
    if (!aiStore.draft.trim() || composing.value) return
    video.open({ question: Array.from(aiStore.draft.trim()).slice(0, 500).join(''), lessonId: aiStore.lessonContextId ?? undefined, excerpt: aiStore.contextTags.filter(t => t.type === 'selection' || t.type === 'code').map(t => t.content).join('\n') })
    aiStore.draft = ''
    return
  }
  if (!hasApiKey.value || composing.value) return
  if (aiStore.sendDraft()) void nextTick(toBottom)
}
function onKeyDown(e: KeyboardEvent) {
  if (!shouldSendAiMessage(e, composing.value)) return
  e.preventDefault()
  // 串流中可以先打下一句，但 Enter 不送（防双发由 store 的 isStreaming 把关）
  if (!isStreaming.value) onSend()
}
function onInput(): void {
  emit('typing-activity')
}
function renderContent(raw: string) {
  try { return renderMarkdown(raw).html } catch { return raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }
}
async function copyCode(text: string, btn?: HTMLElement | null) {
  let ok = false
  try {
    await navigator.clipboard.writeText(text)
    ok = true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      ok = document.execCommand('copy')
      document.body.removeChild(ta)
    } catch {
      ok = false
    }
  }
  if (ok) {
    toast(TOAST.CODE_COPIED, 'success')
    if (btn) {
      btn.classList.add('copied')
      setTimeout(() => {
        btn.classList.remove('copied')
      }, 1500)
    }
  } else {
    toast(TOAST.COPY_FAILED, 'error')
  }
}
function promptSuggestion(text: string, action?: TutoringAction) {
  if (action) aiStore.tutoringAction = action
  aiStore.draft = text
  inputArea.value?.focus()
}

function onSelectOption(option: string) {
  if (option && !aiStore.isStreaming) {
    void aiStore.sendMessage(option)
  }
}
function handleCardAction(action: { type: 'feynman' | 'visualize' | 'prompt' | 'select-option'; text?: string; concept?: string; topic?: string; option?: string }) {
  if (action.type === 'select-option' && action.option) {
    onSelectOption(action.option)
    return
  }
  if (action.type === 'feynman') {
    aiStore.tutoringAction = 'feynman'
    if (action.concept) {
      aiStore.draft = `${AI_ASSISTANT.GUIDE_FEYNMAN_PROMPT}${action.concept}`
    }
    inputArea.value?.focus()
  } else if (action.type === 'visualize') {
    aiStore.tutoringAction = 'visualize'
    if (action.topic) {
      aiStore.draft = `${AI_ASSISTANT.GUIDE_VISUALIZE_PROMPT}${action.topic}`
    }
    inputArea.value?.focus()
  } else if (action.type === 'prompt' && action.text) {
    aiStore.draft = action.text
    inputArea.value?.focus()
  }
}
function tagKind(type: string) {
  return type === 'lesson' ? AI_ASSISTANT.TAG_LESSON : type === 'code' ? AI_ASSISTANT.TAG_CODE : type === 'error' ? AI_ASSISTANT.TAG_ERROR : type === 'memory' ? AI_ASSISTANT.TAG_MEMORY : AI_ASSISTANT.TAG_SELECTION
}
function onMsgContentClick(event: MouseEvent) {
  const target = event.target as Element | null
  if (!target) return
  if (target.closest('a')) {
    event.preventDefault()
    event.stopPropagation()
    const lessonId = target.closest('a')?.getAttribute('data-lesson')
    if (lessonId && content.lessonOf(lessonId) && content.statusOf(lessonId) !== 'draft') {
      aiStore.setLessonContext(lessonId)
      aiStore.isOpen = true
      void router.push(`/lesson/${lessonId}`)
    }
    return
  }
  const copyBtn = target.closest<HTMLElement>('[data-copy]')
  if (copyBtn) {
    event.preventDefault()
    const blockEl = copyBtn.closest('.code-block')
    const codeEl = blockEl?.querySelector('code')
    if (codeEl) {
      void copyCode(codeEl.textContent ?? '', copyBtn)
    }
  }
}
/** 只有「没配 API Key」这一种错误给设置入口；精确比对主进程发出的同一常量，不解析文字 */
function needsKey(error?: string | null) { return error === AI_APP.ERR_KEY_REQUIRED }
function openAiSettings() { settingsDialog.openSettings('ai') }
function openInMain() { void router.push('/ai') }


const fileInput = ref<HTMLInputElement | null>(null)
const attachmentNotice = ref('')
const isDragOver = ref(false)
const ATTACH_LABEL = AI_ASSISTANT.ATTACH

function openFilePicker() {
  fileInput.value?.click()
}

function onPreviewError(attachment: AiDraftAttachment) {
  if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl)
  attachment.previewUrl = undefined
}

async function addDraftFiles(files: File[]) {
  if (!files.length || aiStore.isReadingAttachments) return
  const sessionId = aiStore.currentSessionId
  attachmentNotice.value = ''
  aiStore.isReadingAttachments = true
  try {
    for (const rawFile of files) {
      if (aiStore.currentSessionId !== sessionId) break
      if (aiStore.pendingAttachments.length >= 6) {
        attachmentNotice.value = AI_ASSISTANT.ATTACH_LIMIT
        break
      }
      let file = rawFile
      if (!file.name || file.name === 'blob' || file.name === 'image.png') {
        const ext = file.type.split('/')[1] || 'png'
        file = new File([file], `paste-${Date.now()}.${ext}`, { type: file.type })
      }
      const attachment = await prepareDraftAttachment(file)
      if (aiStore.currentSessionId !== sessionId || !aiStore.currentSession) {
        if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl)
        break
      }
      aiStore.addAttachment(attachment)
    }
  } catch {
    attachmentNotice.value = AI_ASSISTANT.ATTACH_FAILED
  } finally {
    aiStore.isReadingAttachments = false
  }
}

async function onFilesPicked(e: Event) {
  const input = e.target as HTMLInputElement
  const picked = Array.from(input.files ?? [])
  input.value = ''
  await addDraftFiles(picked)
}

function onPaste(e: ClipboardEvent) {
  const items = Array.from(e.clipboardData?.items ?? [])
  const files: File[] = []
  for (const item of items) {
    if (item.kind === 'file') {
      const f = item.getAsFile()
      if (f) files.push(f)
    }
  }
  if (files.length === 0 && e.clipboardData?.files?.length) {
    files.push(...Array.from(e.clipboardData.files))
  }
  if (files.length > 0) {
    const hasText = !!e.clipboardData?.getData('text/plain')
    if (!hasText) {
      e.preventDefault()
    }
    void addDraftFiles(files)
  }
}

function onDragEnter(e: DragEvent) {
  if (e.dataTransfer?.types?.includes('Files')) {
    isDragOver.value = true
  }
}

function onDragOver(e: DragEvent) {
  if (e.dataTransfer?.types?.includes('Files')) {
    isDragOver.value = true
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
  }
}

function onDragLeave(e: DragEvent) {
  const current = e.currentTarget as HTMLElement | null
  const related = e.relatedTarget as Node | null
  if (!current || !related || !current.contains(related)) {
    isDragOver.value = false
  }
}

function onDrop(e: DragEvent) {
  isDragOver.value = false
  const dropped = Array.from(e.dataTransfer?.files ?? [])
  if (dropped.length > 0) {
    void addDraftFiles(dropped)
  }
}

defineExpose({ focusInput: () => inputArea.value?.focus() })
</script>

<template>
  <section class="ai-panel" :class="`is-${variant}`" :aria-label="AI_ASSISTANT.PANEL_TITLE">
    <header v-if="!isMain" class="ai-header">
      <!--
        「收起面板」放在标题行最左，不是最右。
        原来它在最右，正好叠在 Electron 原生窗口的 ✕ 下面 —— 两个叉上下相隔
        几十像素、横坐标还对齐，用户想收起右栏会点成退出程序，反之亦然。
        语义也换了：这里是「把这一栏收起来」，不是「关闭/退出」，
        所以图标用左箭头而不是 ✕，文案与 title 一并用 COLLAPSE_PANEL。
      -->
      <button type="button" class="icon-btn collapse" :title="AI_ASSISTANT.COLLAPSE_PANEL" :aria-label="AI_ASSISTANT.COLLAPSE_PANEL" @click="aiStore.isOpen = false">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
      </button>
      <div class="session-controls">
        <div class="session-title" :title="sessionTitle">{{ sessionTitle }}</div>
      </div>
      <div class="ai-actions">
        <button type="button" class="icon-btn open-main" :title="AI_ASSISTANT.OPEN_IN_MAIN" :aria-label="AI_ASSISTANT.OPEN_IN_MAIN" @click="openInMain">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
        </button>
        <button type="button" class="icon-btn" :class="{ active: aiStore.activeTab === 'history' }" :title="AI_ASSISTANT.HISTORY" :aria-label="AI_ASSISTANT.HISTORY" @click="aiStore.activeTab = aiStore.activeTab === 'history' ? 'chat' : 'history'">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" /></svg>
        </button>
      </div>
    </header>

    <div v-if="!isMain && aiStore.activeTab === 'history'" class="ai-history-view">
      <div class="history-head"><strong>{{ AI_ASSISTANT.historyCount(aiStore.sessions.length) }}</strong><button type="button" class="text-btn" @click="aiStore.activeTab = 'chat'">{{ AI_ASSISTANT.BACK_TO_CHAT }}</button></div>
      <div class="history-list">
        <div v-for="s in aiStore.sessions" :key="s.id" class="history-item" :class="{ active: s.id === aiStore.currentSessionId }">
          <button type="button" class="history-select" :title="s.title" @click="aiStore.selectSession(s.id)">
            <span class="history-item-title">{{ s.title || AI_ASSISTANT.DEFAULT_SESSION_TITLE }}</span><span class="history-item-meta">{{ AI_ASSISTANT.messageCount(s.messages.length) }}</span>
          </button>
          <button v-if="s.id !== STUDY_MAIN_SESSION_ID" type="button" class="icon-btn history-item-del" :title="AI_ASSISTANT.DELETE_SESSION" :aria-label="`${AI_ASSISTANT.DELETE_SESSION}：${s.title}`" @click="aiStore.deleteSession(s.id)">×</button>
        </div>
      </div>
    </div>

    <div v-else class="ai-chat-view">
      <div ref="messageContainer" class="ai-messages" aria-live="polite" :aria-busy="isStreaming" @scroll="onScroll" @click="onMsgContentClick">
        <div class="ai-column">
          <div v-if="messages.length === 0 && !isStreaming" class="ai-empty-guide">
            <div v-if="!hasApiKey && !isMain" class="ai-no-key-guide">
              <h2>{{ AI_ASSISTANT.NO_KEY_WELCOME_TITLE }}</h2>
              <button type="button" class="key-config-btn-main" @click="openAiSettings">
                {{ AI_ASSISTANT.KEY_REQUIRED_BTN }}
              </button>
            </div>
            <div v-else-if="!isMain" class="ai-empty-compact">
              <p>{{ AI_ASSISTANT.PANEL_EMPTY_HINT }}</p>
            </div>
            <slot v-else name="empty">
              <h2>{{ AI_ASSISTANT.WELCOME_TITLE }}</h2><p>{{ AI_ASSISTANT.WELCOME_SUB }}</p>
              <div class="guide-prompts">
                <button type="button" class="guide-btn" @click="promptSuggestion(AI_ASSISTANT.SUGGESTION_EXPLAIN_PROMPT)">{{ AI_ASSISTANT.SUGGESTION_EXPLAIN_LABEL }}</button>
                <button type="button" class="guide-btn" @click="promptSuggestion(AI_ASSISTANT.SUGGESTION_EXAMPLE_PROMPT)">{{ AI_ASSISTANT.SUGGESTION_EXAMPLE_LABEL }}</button>
                <button type="button" class="guide-btn" @click="promptSuggestion(AI_ASSISTANT.SUGGESTION_PITFALLS_PROMPT)">{{ AI_ASSISTANT.SUGGESTION_PITFALLS_LABEL }}</button>
                <button type="button" class="guide-btn" @click="promptSuggestion(AI_ASSISTANT.GUIDE_DIAGNOSE_PROMPT, 'diagnose')">{{ AI_ASSISTANT.GUIDE_DIAGNOSE_LABEL }}</button>
                <button type="button" class="guide-btn" @click="promptSuggestion(AI_ASSISTANT.GUIDE_FEYNMAN_PROMPT, 'feynman')">{{ AI_ASSISTANT.GUIDE_FEYNMAN_LABEL }}</button>
                <button type="button" class="guide-btn" @click="promptSuggestion(AI_ASSISTANT.GUIDE_VISUALIZE_PROMPT, 'visualize')">{{ AI_ASSISTANT.GUIDE_VISUALIZE_LABEL }}</button>
              </div>
            </slot>
          </div>
          <div v-for="msg in messages" :key="msg.id" class="ai-message" :class="msg.role">
            <div v-if="msg.contextTags?.length" class="msg-tags">
              <span v-for="tag in msg.contextTags" :key="tag.id" class="msg-tag-chip" :title="tag.content">{{ tagKind(tag.type) }} · {{ tag.title }}</span>
            </div>
            <div v-if="msg.content" class="msg-content" @click="onMsgContentClick">
              <AiRichMessage v-if="msg.role === 'assistant'" :content="msg.content" @action="handleCardAction" @select-option="onSelectOption" />
              <div v-else class="markdown-body" v-html="renderContent(msg.content)" />
            </div>
            <div v-if="msg.error" class="msg-error-box" role="alert">
              <span>{{ msg.error === 'canceled' ? AI_ASSISTANT.STOPPED : msg.error }}</span>
              <button v-if="needsKey(msg.error)" type="button" class="text-btn settings-link" @click="openAiSettings">{{ AI_ASSISTANT.OPEN_AI_SETTINGS }}</button>
              <button type="button" class="icon-btn retry-btn" :title="AI_ASSISTANT.RETRY" :aria-label="AI_ASSISTANT.RETRY" @click="aiStore.retryLastMessage"><MiIcon name="refresh" /></button>
            </div>
          </div>
          <div v-if="isStreaming" class="ai-message assistant streaming">
            <div class="msg-content" @click="onMsgContentClick">
              <AiRichMessage v-if="streamingText" :content="streamingText" @action="handleCardAction" @select-option="onSelectOption" />
              <AiThinkingDraft v-else />
            </div>
          </div>
          <div v-if="video.generationSession === aiStore.currentSessionId && (video.loading || video.error)" class="ai-message assistant video-progress" role="status">
            <div class="vp-card-head">
              <div class="vp-card-title">
                <MiIcon name="film" :size="16" class="vp-card-icon" />
                <span>{{ VIDEO_UI.GENERATING }}</span>
              </div>
              <MiButton v-if="video.loading" variant="ghost" size="sm" @click="video.cancel()">{{ VIDEO_UI.CANCEL }}</MiButton>
            </div>
            <div class="vp-stage-list">
              <div v-for="(label, i) in videoStages" :key="label" class="vp-stage-row" :class="{ 'is-pending': videoStageIdx < i, 'is-active': videoStageIdx === i && video.loading }">
                <div class="vp-stage-main">
                  <MiIcon v-if="videoStageIdx > i" name="check" :size="14" class="vp-stage-ok" />
                  <span v-else-if="videoStageIdx === i && video.loading" class="vp-spinner" aria-hidden="true" />
                  <span v-else class="vp-dot" aria-hidden="true" />
                  <span class="vp-stage-label">{{ label }}</span>
                  <span v-if="i === 0 && videoStageIdx > 0 && video.progress?.detail" class="vp-stage-detail">{{ video.progress.detail }}</span>
                  <span v-else-if="videoStageIdx === i && video.loading" class="vp-stage-elapsed">{{ VIDEO_UI.ELAPSED_SEC(videoElapsed) }}</span>
                </div>
                <div v-if="i === 2 && video.verification" class="vp-verify-box">
                  <pre class="vp-code-preview">{{ video.verification.code.slice(0, 3).join('\n') }}<template v-if="video.verification.code.length > 3">
{{ VIDEO_UI.CODE_LINES(video.verification.code.length) }}</template></pre>
                  <div class="vp-verify-actions">
                    <MiButton variant="primary" size="sm" @click="video.answerVerification(true)">{{ VIDEO_UI.VERIFY_RUN }}</MiButton>
                    <MiButton variant="secondary" size="sm" @click="video.answerVerification(false)">{{ VIDEO_UI.VERIFY_SKIP_SHORT }}</MiButton>
                  </div>
                </div>
              </div>
            </div>
            <div v-if="!video.loading && video.error" class="vp-err-box">
              <p class="vp-err-msg">{{ video.error }}</p>
              <div class="vp-err-actions">
                <MiButton variant="secondary" size="sm" @click="video.lastInput && aiStore.sendMessage(video.lastInput.question)">{{ VT.explainText }}</MiButton>
                <MiButton variant="primary" size="sm" @click="video.lastInput && video.generate(video.lastInput)">{{ VT.retry }}</MiButton>
              </div>
            </div>
          </div>
        </div>
      </div>
      <footer class="ai-footer" data-kb-managed>
        <button v-if="!pinned" type="button" class="jump-latest" :title="AI_ASSISTANT.JUMP_LATEST" :aria-label="AI_ASSISTANT.JUMP_LATEST" @click="toBottom">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14m-6-6 6 6 6-6" /></svg>
        </button>
        <div class="ai-column footer-column">
          <div v-if="aiStore.errorMessage && !messages.at(-1)?.error" class="inline-error" role="alert">
            {{ aiStore.errorMessage }}
            <button v-if="needsKey(aiStore.errorMessage)" type="button" class="text-btn settings-link" @click="openAiSettings">{{ AI_ASSISTANT.OPEN_AI_SETTINGS }}</button>
            <button type="button" class="text-btn" @click="aiStore.retryLastMessage">{{ AI_ASSISTANT.RETRY }}</button>
          </div>
          <div v-if="video.current && video.minimized" class="resume-bar">
            <button type="button" class="resume-main" @click="video.minimized = false">
              <span class="resume-play-circle" aria-hidden="true"><MiIcon name="play" :size="12" /></span>
              <span class="resume-text">{{ VIDEO_UI.RESUME_LABEL(video.current.title, video.currentStep, video.totalSteps) }}</span>
            </button>
            <MiButton variant="ghost" icon="x" size="sm" class="resume-close" :aria-label="VIDEO_UI.CLOSE" @click="video.current = null" />
          </div>
          <div v-if="!isMain && aiStore.contextTags.length" class="context-tags-bar">
            <div class="tags-scroller"><span v-for="t in aiStore.contextTags" :key="t.id" class="context-tag" :class="t.type" :title="t.content"><span>{{ tagKind(t.type) }} · {{ t.title }}</span><button v-if="t.removable !== false" type="button" class="tag-close-btn" :aria-label="AI_ASSISTANT.removeContextLabel(t.title)" :title="AI_ASSISTANT.removeContextLabel(t.title)" @click="aiStore.removeContextTag(t.id)">×</button></span></div>
          </div>
          <div v-if="!hasApiKey" class="ai-key-banner" role="alert">
            <span class="ai-key-banner-text">{{ AI_ASSISTANT.KEY_REQUIRED_BANNER }}</span>
            <button type="button" class="key-config-btn-sm" @click="openAiSettings">
              {{ AI_ASSISTANT.KEY_REQUIRED_BTN }}
            </button>
          </div>
          <div
            class="input-row"
            :class="{ 'is-dragover': isDragOver }"
            @dragenter.prevent="onDragEnter"
            @dragover.prevent="onDragOver"
            @dragleave="onDragLeave"
            @drop.prevent="onDrop"
          >
            <div v-if="isMain && aiStore.contextTags.length" class="context-tags-bar">
              <div class="tags-scroller"><span v-for="t in aiStore.contextTags" :key="t.id" class="context-tag" :class="t.type" :title="t.content"><span>{{ tagKind(t.type) }} · {{ t.title }}</span><button v-if="t.removable !== false" type="button" class="tag-close-btn" :aria-label="AI_ASSISTANT.removeContextLabel(t.title)" :title="AI_ASSISTANT.removeContextLabel(t.title)" @click="aiStore.removeContextTag(t.id)">×</button></span></div>
            </div>
            <textarea
              ref="inputArea"
              v-model="aiStore.draft"
              class="ai-textarea"
              :disabled="!hasApiKey"
              :placeholder="AI_ASSISTANT.INPUT_PLACEHOLDER"
              :aria-label="AI_ASSISTANT.INPUT_LABEL"
              :rows="isMain ? 1 : 2"
              @input="onInput"
              @keydown="onKeyDown"
              @paste="onPaste"
              @compositionstart="composing = true"
              @compositionend="composing = false"
            />
            <div v-if="aiStore.pendingAttachments.length" class="attach-strip">
              <div v-for="a in aiStore.pendingAttachments" :key="a.id" class="attach-chip" :title="a.kind === 'file' && a.textContent !== undefined ? AI_ASSISTANT.ATTACH_TEXT : AI_ASSISTANT.ATTACH_METADATA">
                <img v-if="a.kind === 'image' && a.previewUrl" :src="a.previewUrl" alt="" class="attach-thumb" @error="onPreviewError(a)" />
                <span v-else class="attach-file-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M14 3v5h5M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /></svg>
                </span>
                <span class="attach-meta"><span class="attach-name">{{ a.name }}</span><span class="attach-size">{{ formatBytes(a.size) }} · {{ a.kind === 'file' && a.textContent !== undefined ? AI_ASSISTANT.ATTACH_TEXT : AI_ASSISTANT.ATTACH_METADATA }}</span></span>
                <button type="button" class="attach-remove" :aria-label="AI_ASSISTANT.ATTACH_REMOVE(a.name)" :title="AI_ASSISTANT.ATTACH_REMOVE(a.name)" @click="aiStore.removeAttachment(a.id)">&times;</button>
              </div>
            </div>
            <div v-if="attachmentNotice" class="inline-error" role="status">{{ attachmentNotice }}</div>
            <div class="input-bottom">
              <div class="input-lead">
                <button type="button" class="lead-chip icon-lead" :disabled="aiStore.isReadingAttachments" :title="AI_ASSISTANT.ATTACH_INFO" :aria-label="ATTACH_LABEL" @click="openFilePicker">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21.4 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                </button>
                <input ref="fileInput" type="file" multiple class="attach-input" accept="image/*,.txt,.md,.c,.h,.cpp,.java,.py,.json" @change="onFilesPicked" />
                <MiPopMenu :items="tutorOptions" :label="AI_ASSISTANT.TUTOR_MODE" :disabled="isStreaming || video.loading" @select="tutoringMode = $event"><span class="pm-label">{{ tutorOptions.find(option => option.checked)?.label }}</span></MiPopMenu>
              </div>
              <div class="input-trail">
                <ComposerProviderBar />
                <!--
                  发送键常驻（T3 那颗就在那儿，空着时是淡灰、可点但无动作）。
                  之前做成「空内容不渲染」，整排右侧会空掉一块，视觉上缺一角。
                -->
                <button v-if="isStreaming" type="button" class="send-btn stop-btn" @pointerdown="keepComposerFocus" :aria-label="AI_ASSISTANT.STOP_GENERATING" :title="AI_ASSISTANT.STOP_GENERATING" @click="aiStore.cancelStream"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="8" height="8" rx="1.5" /></svg></button>
                <button v-else type="button" class="send-btn enter-btn" @pointerdown="keepComposerFocus" :disabled="!canSend" :aria-label="AI_ASSISTANT.SEND" :title="AI_ASSISTANT.SEND" @click="onSend"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6" /></svg></button>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  </section>
</template>

<style scoped>
.video-progress {
  display: flex;
  flex-direction: column;
  background: var(--mi-bg);
  border: 1px solid var(--mi-border);
  border-radius: var(--mi-radius-lg);
  overflow: hidden;
  width: 100%;
  max-width: 520px;
}
.vp-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--mi-sp-2) var(--mi-sp-3);
  border-bottom: 1px solid var(--mi-border);
}
.vp-card-title { display: flex; align-items: center; gap: var(--mi-sp-2); font-weight: var(--mi-fw-medium); color: var(--mi-text); }
.vp-card-icon { color: var(--mi-blue-deep); }
.vp-stage-list { display: flex; flex-direction: column; }
.vp-stage-row { padding: var(--mi-sp-2) var(--mi-sp-3); border-top: 1px solid var(--mi-border); }
.vp-stage-row:first-child { border-top: 0; }
.vp-stage-row.is-pending { color: var(--mi-text-3); }
.vp-stage-main { display: flex; align-items: center; gap: var(--mi-sp-2); min-height: 24px; }
.vp-stage-ok { color: var(--mi-success-deep); flex: none; }
.vp-spinner {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid var(--mi-blue-light);
  border-top-color: var(--mi-blue-deep);
  animation: vp-spin 0.9s linear infinite;
  flex: none;
}
@keyframes vp-spin { to { transform: rotate(360deg); } }
.vp-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1.5px solid var(--mi-border);
  flex: none;
}
.vp-stage-label { font-size: var(--mi-fs-label); flex: 1; min-width: 0; }
.vp-stage-detail, .vp-stage-elapsed { font-size: var(--mi-fs-caption); color: var(--mi-text-3); white-space: nowrap; }
.vp-verify-box { margin-top: var(--mi-sp-2); display: flex; flex-direction: column; gap: var(--mi-sp-2); }
.vp-code-preview {
  margin: 0;
  padding: var(--mi-sp-2) var(--mi-sp-3);
  border-radius: var(--mi-radius);
  background: var(--mi-canvas);
  font: 12px/1.5 var(--mi-code);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.vp-verify-actions, .vp-err-actions { display: flex; align-items: center; gap: var(--mi-sp-2); justify-content: flex-end; }
.vp-err-box { padding: var(--mi-sp-3); display: flex; flex-direction: column; gap: var(--mi-sp-2); border-top: 1px solid var(--mi-border); }
.vp-err-msg { margin: 0; padding: var(--mi-sp-2) var(--mi-sp-3); border-radius: var(--mi-radius); background: var(--mi-error-fill); color: var(--mi-error-deep); font-size: var(--mi-fs-label); }
.resume-bar {
  display: flex;
  align-items: center;
  gap: var(--mi-sp-2);
  padding: 5px 8px;
  margin-bottom: var(--mi-sp-2);
  border-radius: 10px;
  background: var(--mi-blue-light);
}
.resume-main {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: var(--mi-sp-2);
  border: 0;
  background: transparent;
  padding: 2px 4px;
  color: var(--mi-blue-deep);
  font: inherit;
  font-size: var(--mi-fs-label);
  font-weight: var(--mi-fw-medium);
  cursor: var(--mi-cursor, pointer);
  text-align: left;
  border-radius: 6px;
}
.resume-main:focus-visible { outline: 2px solid var(--mi-blue-deep); outline-offset: 1px; }
.resume-play-circle {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--mi-blue-deep);
  color: var(--mi-bg);
  display: grid;
  place-items: center;
  flex: none;
}
.resume-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.resume-close { width: 26px; height: 26px; min-width: 26px; min-height: 26px; padding: 0; color: var(--mi-text-2); }
.ai-panel { position:relative; display:flex; flex-direction:column; height:100%; min-height:0; min-width:0; color:var(--mi-text); background:var(--cds-surface-1); border:1px solid var(--mi-border); border-radius:14px; overflow:hidden; box-sizing:border-box; font-size:var(--mi-fs-body); }
.ai-panel.is-rail { border:0; border-radius:0; background:transparent; }
.ai-empty-compact { display:flex; align-items:center; justify-content:center; padding:var(--mi-sp-8) var(--mi-sp-4); text-align:center; color:var(--mi-text-2); font-size:var(--mi-fs-label); line-height:1.6; }
.is-rail .model-chip { max-width:8em; }
.is-rail .lead-chip { max-width:7em; }
.send-btn { flex:0 0 auto; flex-shrink:0; }
.ai-header { position:absolute; top:0; left:0; right:0; z-index:3; display:flex; justify-content:space-between; gap:var(--mi-sp-2); align-items:center; padding:var(--mi-sp-2); background:color-mix(in srgb, var(--cds-surface-1) 78%, transparent); -webkit-backdrop-filter:blur(12px) saturate(1.2); backdrop-filter:blur(12px) saturate(1.2); }
.ai-header::after { content:''; position:absolute; left:0; right:0; top:100%; height:24px; pointer-events:none; background:linear-gradient(to bottom, color-mix(in srgb, var(--cds-surface-1) 78%, transparent), transparent); }
/* 收起键留在最左，且和标题之间留一点呼吸，免得看起来像标题的装饰 */
.ai-header > .icon-btn.collapse { margin-right:2px; }
.session-controls,.ai-actions { display:flex; align-items:center; gap:var(--mi-sp-1); min-width:0; }
.session-controls { flex:1; }
.session-title { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:100%; min-width:0; padding:var(--mi-sp-2) var(--mi-sp-2); background:transparent; font-size:var(--mi-fs-body); font-weight:400; color:var(--mi-text); }
.icon-btn,.send-btn { display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; width:var(--mi-icon-btn); height:var(--mi-icon-btn); border:0; border-radius:8px; color:var(--mi-text-2); background:transparent; cursor:pointer; }
.icon-btn svg,.send-btn svg,.jump-latest svg { width:18px; height:18px; fill:none; stroke:currentColor; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
.icon-btn:hover,.icon-btn.active { background:var(--mi-blue-light); color:var(--mi-text); }
.ai-chat-view,.ai-history-view { position:relative; display:flex; flex-direction:column; flex:1; min-height:0; min-width:0; }
.ai-messages { flex:1; min-height:0; overflow:auto; padding:calc(48px + var(--mi-sp-4)) var(--mi-sp-4) var(--mi-sp-4); }
/* 消息列：rail 下就是全宽；main 下限宽 760 居中（§3.1） */
.ai-column { display:flex; flex-direction:column; gap:var(--mi-sp-6); min-height:100%; min-width:0; }
.ai-empty-guide { margin:auto 0; padding:var(--mi-sp-3) var(--mi-sp-1); }
.ai-empty-guide h2 { margin:0 0 var(--mi-sp-2); font-size:var(--mi-fs-read); line-height:1.4; }
.ai-empty-guide p { color:var(--mi-text-2); font-size:var(--mi-fs-body); line-height:1.6; margin:0 0 var(--mi-sp-4); }
.guide-prompts { display:flex; flex-direction:column; align-items:flex-start; gap:var(--mi-sp-1); }
.guide-btn,.text-btn { border:0; background:transparent; color:var(--mi-text-2); cursor:pointer; font:inherit; }
.guide-btn { text-align:left; padding:var(--mi-sp-2) var(--mi-sp-1); font-size:var(--mi-fs-body); }
.guide-btn:hover,.text-btn:hover { color:var(--mi-text); text-decoration:underline; }
.ai-message { display:flex; flex-direction:column; gap:var(--mi-sp-2); min-width:0; max-width:100%; }
.ai-message.user { align-items:flex-end; }
.ai-message.user .msg-content { background:var(--mi-blue-light); border-radius:14px; padding:var(--mi-sp-3) var(--mi-sp-4); max-width:90%; }
.msg-content { min-width:0; max-width:100%; font-size:var(--mi-fs-read); line-height:var(--mi-lh-read); overflow-wrap:anywhere; user-select:text; }
/* 覆盖共用正文的字号，仅作用于聊天消息，不影响课文。 */
#app .ai-panel .msg-content :deep(.markdown-body) { font-size:var(--mi-fs-read); }
.msg-content :deep(p) { margin:0 0 .7em; }
.msg-content :deep(p:last-child) { margin-bottom:0; }
.msg-content :deep(pre) { max-width:100%; overflow:auto; font-size:var(--mi-fs-label); }
.msg-tags { display:flex; flex-wrap:wrap; gap:var(--mi-sp-1); justify-content:flex-end; max-width:100%; }
.msg-tag-chip,.context-tag { background:var(--mi-blue-light); border-radius:var(--mi-radius); padding:var(--mi-sp-1) var(--mi-sp-2); font-size:var(--mi-fs-caption); color:var(--mi-text-2); overflow:hidden; text-overflow:ellipsis; }
.msg-error-box,.inline-error { font-size:var(--mi-fs-label); color:var(--mi-error-deep); display:flex; flex-wrap:wrap; align-items:center; gap:var(--mi-sp-2); }
.ai-footer { position:relative; flex-shrink:0; padding:var(--mi-sp-3); }
.footer-column { gap:var(--mi-sp-2); min-height:0; }

.context-tags-bar { display:flex; gap:var(--mi-sp-2); align-items:center; min-width:0; }
.is-main .context-tags-bar { margin-bottom:var(--mi-sp-2); }
.tags-scroller { display:flex; flex:1; min-width:0; gap:var(--mi-sp-1); overflow:auto; }
.context-tag { display:inline-flex; align-items:center; gap:var(--mi-sp-1); white-space:nowrap; max-width:180px; }
.context-tag span { overflow:hidden; text-overflow:ellipsis; }
.tag-close-btn { border:0; background:transparent; color:inherit; cursor:pointer; font-size:var(--mi-fs-read); padding:0; }
.input-row { display:flex; flex-direction:column; border:1px solid var(--mi-border-control); border-radius:14px; background:var(--mi-card); padding:var(--mi-sp-2) var(--mi-sp-3) var(--mi-sp-2); }

.input-row.is-dragover { border-color:var(--mi-blue-deep) !important; box-shadow:0 0 0 2px var(--mi-blue-light) !important; }
.icon-lead { display:inline-flex; align-items:center; justify-content:center; padding:var(--mi-sp-1) var(--mi-sp-2); }
.icon-lead svg { width:14px; height:14px; fill:none; stroke:currentColor; stroke-width:1.7; stroke-linecap:round; stroke-linejoin:round; }
.attach-input { display:none; }
.attach-strip { display:flex; flex-wrap:wrap; align-items:center; gap:var(--mi-sp-2); padding:0 2px var(--mi-sp-2); }
.attach-chip { display:inline-flex; align-items:center; gap:var(--mi-sp-2); flex:0 0 auto; max-width:240px; min-height:36px; padding:3px var(--mi-sp-2) 3px 3px; border:1px solid var(--mi-border-control); border-radius:10px; background:var(--mi-card); box-sizing:border-box; }
.attach-thumb { width:32px; height:32px; border-radius:8px; object-fit:cover; flex:0 0 auto; display:block; }
.attach-file-icon { display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; flex:0 0 auto; color:var(--mi-text-3); }
.attach-file-icon svg { width:16px; height:16px; fill:none; stroke:currentColor; stroke-width:1.7; stroke-linecap:round; stroke-linejoin:round; }
.attach-meta { display:flex; flex-direction:column; min-width:0; line-height:1.25; }
.attach-name { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:var(--mi-fs-caption); color:var(--mi-text); }
.attach-size { font-size:var(--mi-fs-caption); color:var(--mi-text-3); }
.attach-remove { flex:0 0 auto; width:18px; height:18px; padding:0; border:0; border-radius:50%; background:transparent; color:var(--mi-text-3); font-size:var(--mi-fs-body); line-height:1; cursor:pointer; }
.attach-remove:hover { background:var(--cds-fill-ghost-hover); color:var(--mi-text); }

.ai-textarea { display:block; box-sizing:border-box; width:100%; min-height:48px; max-height:140px; resize:vertical; border:0; outline:0; color:var(--mi-text); background:transparent; font:inherit; line-height:1.5; }
.input-bottom { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:var(--mi-sp-1) var(--mi-sp-2); }
.send-btn { color:var(--mi-text); background:var(--mi-blue-light); width:var(--mi-icon-btn); height:var(--mi-icon-btn); }
.send-btn:disabled { opacity:.45; cursor:default; }
.jump-latest { position:absolute; left:50%; top:-40px; transform:translateX(-50%); width:32px; height:32px; display:inline-flex; align-items:center; justify-content:center; border:1px solid var(--mi-border); border-radius:50%; background:var(--mi-card); color:var(--mi-text-2); cursor:pointer; box-shadow:var(--mi-shadow-lg); z-index:2; }
.jump-latest:hover { color:var(--mi-text); }
.ai-history-view { overflow:auto; padding:calc(48px + var(--mi-sp-4)) var(--mi-sp-3) var(--mi-sp-4); gap:var(--mi-sp-3); }
.history-head { display:flex; justify-content:space-between; align-items:center; gap:var(--mi-sp-2); font-size:var(--mi-fs-body); }
.history-list { display:flex; flex-direction:column; gap:var(--mi-sp-1); }
.history-item { display:flex; align-items:center; min-width:0; border-radius:8px; }
.history-item:hover,.history-item.active { background:var(--mi-blue-light); }
.history-select { flex:1; min-width:0; text-align:left; display:flex; flex-direction:column; gap:3px; border:0; background:transparent; color:var(--mi-text); cursor:pointer; padding:var(--mi-sp-2); font:inherit; }
.history-item-title { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; width:100%; }
.history-item-meta { color:var(--mi-text-2); font-size:var(--mi-fs-caption); }
.history-item-del { font-size:var(--mi-fs-title); }
.ai-panel button:focus-visible { outline:2px solid var(--mi-text); outline-offset:2px; }
:global(#app) .ai-textarea:is(:focus,:focus-visible) { outline:none; box-shadow:none; }
.ai-panel:not(.is-main) .input-row:has(.ai-textarea:focus-visible) { background:var(--mi-blue-light); }
.ai-panel button:focus:not(:focus-visible) { outline:none; }

/* ── main 变体：/ai 主界面（§3.1）。无外框无底色，坐在 canvas 上 ── */
.ai-panel.is-main { border:0; border-radius:0; background:transparent; }
.is-main .ai-chat-view::before {
  content:'';
  position:absolute;
  top:0;
  left:0;
  right:0;
  height:calc(var(--mi-topbar-h) + 24px);
  z-index:3;
  pointer-events:none;
  background:linear-gradient(
    to bottom,
    color-mix(in srgb, var(--mi-canvas) 82%, transparent) 0%,
    color-mix(in srgb, var(--mi-canvas) 72%, transparent) var(--mi-topbar-h),
    transparent 100%
  );
  -webkit-backdrop-filter:blur(12px) saturate(1.2);
  backdrop-filter:blur(12px) saturate(1.2);
  -webkit-mask-image:linear-gradient(to bottom, var(--mi-text) 0%, var(--mi-text) var(--mi-topbar-h), transparent 100%);
  mask-image:linear-gradient(to bottom, var(--mi-text) 0%, var(--mi-text) var(--mi-topbar-h), transparent 100%);
}
.is-main .ai-messages { padding:calc(var(--mi-topbar-h) + var(--mi-sp-6)) var(--mi-sp-6) var(--mi-sp-4); }
.is-main .ai-column { max-width:760px; margin-inline:auto; gap:var(--mi-sp-6); }
.is-main .ai-message.user .msg-content { border-radius:16px; max-width:80%; }
.is-main .ai-message.assistant .msg-content { background:none; }
.is-main .ai-footer { padding:0 var(--mi-sp-6) var(--mi-sp-4); }
 




 





 






.is-main .input-row { border:1px solid var(--mi-border); border-radius:var(--mi-radius-input); padding:var(--mi-sp-4) var(--mi-sp-4) var(--mi-sp-3); min-height:56px; background:var(--mi-card); box-shadow:0 1px 2px rgba(0,0,0,.05); gap:var(--mi-sp-2); }
/*
 * 左右各 7px 内距，和底排那几颗胶囊按钮（padding 5px 7px）的文字起点对齐 ——
 * 输入的文字与「选择课程」是同一列，不是各偏各的。
 */
.is-main .ai-textarea { field-sizing:content; min-height:22px; max-height:160px; padding:0 var(--mi-sp-2); font-size:var(--mi-fs-body); line-height:22px; resize:none; box-sizing:border-box; }
/* 底排：左动作、右模型与发送，与 T3 Code 的 composer 一致 */
.is-main .input-bottom { justify-content:space-between; gap:var(--mi-sp-2); margin-top:var(--mi-sp-2); }
/*
 * 底排两段：左段（课程/解答方式）可以被压缩并把文字省略，
 * 右段（模型名 + 发送键）也必须允许收缩 —— 早先它写死 flex-shrink:0，
 * 模型名的 max-width:100% 因此失去参照，长模型名会把整行撑到窗口外，
 * 发送键被推到看不见的地方（独立审查 F3）。
 * 现在两端都可收缩，但发送键自身 flex-shrink:0，永远留在框内。
 */
.input-lead { display:flex; align-items:center; gap:var(--mi-sp-2); min-width:0; flex:1 1 auto; overflow:visible; }
.input-trail { display:flex; align-items:center; gap:var(--mi-sp-2); min-width:0; flex:0 1 auto; margin-left:auto; }
/* 底排的胶囊按钮：无边框、悬停才出底色，字号比正文小一档（微调加 1px 至 13px） */
.lead-chip, .model-chip, .lead-select { border:0; background:transparent; color:var(--mi-text-3); font:inherit; font-size:var(--mi-fs-label); line-height:1; padding:var(--mi-sp-1) var(--mi-sp-2); border-radius:8px; cursor:pointer; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.lead-chip:hover, .model-chip:hover, .lead-select:hover { background:var(--cds-fill-ghost-hover); color:var(--mi-text); }
.lead-select { appearance:none; }
/* 课程名与模型名各自可省略：宽度上限交给 min-width:0 + flex-basis */
.lead-chip { flex:0 1 auto; min-width:0; }
.model-chip { flex:0 1 auto; min-width:0; max-width:14em; }
/* 圆形实心发送键（T3 那颗是 32×32 的圆） */
.is-main .send-btn { flex:0 0 auto; width:32px; height:32px; border-radius:50%; }

.is-main .send-btn.enter-btn { color:var(--mi-btn-primary-text); background:var(--mi-blue-deep); }
/*
 * 空内容时禁用（T3 的样子）：淡灰底 + 灰字。
 *
 * 【为什么不用 opacity 表达「淡」】通用禁用态 `.send-btn:disabled` 用的是
 * 半透明，那是把整颗按钮（连同底色）一起压淡；这里要的是「底色在、字变浅」，
 * 用两个实色（底 --cds-fill-ghost-hover、字 --mi-text-3）直接画出来，
 * 不新增透明度声明，也不受通用规则影响。
 */
.is-main .send-btn.enter-btn:disabled { cursor:default; color:var(--mi-text-3); background:var(--cds-fill-ghost-hover); }
.is-main .send-btn.enter-btn:hover { background:var(--mi-blue); }
.is-main .enter-btn svg { width:16px; height:16px; }
.is-main .send-btn svg { width:16px; height:16px; }
.is-main .context-tag { max-width:220px; }
.is-main .ai-empty-guide { margin:auto 0; padding:0; }

@media (max-width:1000px) { .ai-messages { padding:calc(48px + var(--mi-sp-4)) var(--mi-sp-3) var(--mi-sp-4); } .is-main .ai-messages { padding:calc(var(--mi-topbar-h) + var(--mi-sp-4)) var(--mi-sp-4) var(--mi-sp-4); } .is-main .ai-footer { padding:0 var(--mi-sp-4) var(--mi-sp-4); } }
@media (max-height:640px) { .is-main .ai-footer { padding-bottom:var(--mi-sp-3); } }

.ai-key-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--mi-sp-3);
  padding: var(--mi-sp-2) var(--mi-sp-3);
  background: var(--mi-zebra, #f4f8fd);
  border: 1px solid var(--mi-border, #E5E3DD);
  border-left: 3px solid var(--mi-blue-deep, #b34b28);
  border-radius: var(--mi-radius-sm, 6px);
  margin-bottom: var(--mi-sp-2);
}
.ai-key-banner-text {
  font-size: var(--mi-fs-label);
  color: var(--mi-text, #151515);
  line-height: 1.5;
}
.key-config-btn-sm {
  padding: var(--mi-sp-1) var(--mi-sp-3);
  background: var(--mi-blue-deep, #b34b28);
  color: var(--mi-btn-primary-text, #ffffff);
  border: none;
  border-radius: var(--mi-radius-sm, 6px);
  font-size: var(--mi-fs-caption);
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: filter var(--mi-dur-fast) ease;
}
.key-config-btn-sm:hover {
  filter: brightness(1.1);
}
.ai-no-key-guide {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--mi-sp-2);
}
.key-config-btn-main {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--mi-sp-2) var(--mi-sp-4);
  background: var(--mi-blue-deep, #b34b28);
  color: var(--mi-btn-primary-text, #ffffff);
  border: none;
  border-radius: var(--mi-radius-sm, 6px);
  font-size: var(--mi-fs-body);
  font-weight: 500;
  cursor: pointer;
  margin-top: var(--mi-sp-2);
  transition: filter var(--mi-dur-fast) ease;
}
.key-config-btn-main:hover {
  filter: brightness(1.1);
}
</style>
