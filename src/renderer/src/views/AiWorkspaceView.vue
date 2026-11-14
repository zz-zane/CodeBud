<script setup lang="ts">
import MiIcon from '../components/base/MiIcon.vue'
 





import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AiPanel from '../components/domain/AiPanel.vue'
import { usePhoneBackClose } from '../lib/phone-back-close'
import AiContextRail from '../components/domain/AiContextRail.vue'
import AiPixelMascot from '../components/domain/AiPixelMascot.vue'
import { useAiAssistantStore } from '../stores/ai-assistant'
import { useContentStore } from '../stores/content'
import { useLessonOpener } from '../lib/openLesson'
import { useStudyStore } from '../stores/study'
import { AI_ASSISTANT } from '../lib/copy'

const ai = useAiAssistantStore()
const content = useContentStore()
const study = useStudyStore()
const { openLesson } = useLessonOpener()

const panel = ref<InstanceType<typeof AiPanel> | null>(null)
const rail = ref<InstanceType<typeof AiContextRail> | null>(null)
const railBox = ref<HTMLElement | null>(null)
const mascotRef = ref<InstanceType<typeof AiPixelMascot> | null>(null)

function onTypingActivity(): void {
  mascotRef.value?.onTyping()
}

// ── 断点：≥1200 内嵌、<1200 浮层（§3.2） ──
const width = ref(window.innerWidth)
function onResize() { width.value = window.innerWidth }
const wide = computed(() => width.value >= 1200)
const railOpen = computed(() => (ai.railPref === null ? wide.value : ai.railPref === 'open'))
const floating = computed(() => !wide.value && railOpen.value)

// 手机上系统返回先关学习上下文全屏层
usePhoneBackClose(() => floating.value, () => closeFloating())

function closeFloating() {
  if (!floating.value) return
  ai.railPref = 'closed'
  void nextTick(() => {
    const btn = document.querySelector<HTMLButtonElement>('.right-rail-toggle')
    btn?.focus()
  })
}
function focusRail() {
  railBox.value?.querySelector<HTMLElement>('button, input, [tabindex]:not([tabindex="-1"])')?.focus()
}
function onDocPointer(e: PointerEvent) {
  if (!floating.value) return
  const t = e.target as Node
  const toggleBtn = document.querySelector('.right-rail-toggle')
  if (railBox.value?.contains(t) || toggleBtn?.contains(t)) return
  closeFloating()
}
watch(railOpen, (open) => {
  if (open && !wide.value) void nextTick(focusRail)
})

// ── 历史浮层（§6.5） ──
const currentLesson = computed(() => ai.lessonContextId ? content.lessonOf(ai.lessonContextId) : null)
const recentLesson = computed(() => content.recentLessonId ? content.lessonOf(content.recentLessonId) : null)
const firstLesson = computed(() => recentLesson.value || currentLesson.value ? null : content.bundle.lessons.find((l) => l.lang === 'common') ?? null)
function useLesson(id: string) {
  ai.setLessonContext(id)
  ai.isOpen = true
  ai.markReturnTarget()
  openLesson(id)
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && floating.value) { e.preventDefault(); closeFloating() }
}
function pickLesson() {
  if (!railOpen.value) ai.railPref = 'open'
  void nextTick(() => rail.value?.openPicker())
}

onMounted(() => {
  // 到了主界面，「回到 AI 对话」的来路就用完了（§5.1）
  ai.clearReturnTarget()
  window.addEventListener('miai-open-course-picker', pickLesson)
  window.addEventListener('resize', onResize)
  window.addEventListener('keydown', onKey)
  document.addEventListener('pointerdown', onDocPointer)
})
onBeforeUnmount(() => {
  window.removeEventListener('miai-open-course-picker', pickLesson)
  window.removeEventListener('resize', onResize)
  window.removeEventListener('keydown', onKey)
  document.removeEventListener('pointerdown', onDocPointer)
})
// 从宽缩到窄时，浮层不应自己弹出来：清掉手动态，回到按宽度默认
watch(wide, () => { ai.railPref = null })
watch(() => ai.currentSessionId, () => mascotRef.value?.stop())
</script>

<template>
  <div class="ai-workspace" :class="{ 'rail-inline': railOpen && wide }">
    <div class="ws-main">
      <AiPanel ref="panel" variant="main" class="ws-panel" @typing-activity="onTypingActivity">
        <template #empty>
          <div class="ws-empty">
            <h2 class="ws-empty-title">{{ AI_ASSISTANT.WS_EMPTY_TITLE }}</h2>
            <div class="ws-lesson-card">
              <AiPixelMascot ref="mascotRef" />
              <button v-if="firstLesson" type="button" class="ws-lesson-choice" @click="useLesson(firstLesson.id)"><MiIcon name="book" :size="14" /><span>{{ AI_ASSISTANT.startFirstLesson(firstLesson.title) }}</span></button>
              <button v-if="recentLesson" type="button" class="ws-lesson-choice" :title="recentLesson.title" @click="useLesson(recentLesson.id)"><MiIcon name="book" :size="14" /><span>{{ recentLesson.title }}</span><span v-if="currentLesson?.id === recentLesson.id" aria-hidden="true">&#10003;</span></button>
              <button v-if="currentLesson && currentLesson.id !== recentLesson?.id" type="button" class="ws-lesson-choice" :title="currentLesson.title" @click="useLesson(currentLesson.id)"><MiIcon name="book" :size="14" /><span>{{ currentLesson.title }}</span><MiIcon name="check" :size="14" /></button>
              <button v-if="study.nextTask" type="button" class="ws-task-choice" :title="study.nextTask.title" @click="$router.push('/study?tab=tasks')"><MiIcon name="list-checks" :size="14" /><span class="task-text">{{ study.nextTask.title }}</span></button>
              <button type="button" class="ws-lesson-picker" @click="pickLesson"><MiIcon name="search" :size="14" />{{ AI_ASSISTANT.PICK_LESSON }}</button>
              <button type="button" class="ws-lesson-picker" @click="$router.push('/courses')"><MiIcon name="list" :size="14" />{{ AI_ASSISTANT.BROWSE_COURSES }}</button>
            </div>
          </div>
        </template>
      </AiPanel>
    </div>

    <aside
      v-if="railOpen"
      ref="railBox"
      class="ws-rail"
      :class="{ floating }"
      :role="floating ? 'dialog' : undefined"
      :aria-label="AI_ASSISTANT.RAIL_LABEL"
    >
      <AiContextRail ref="rail" />
    </aside>
  </div>
</template>

<style scoped>
.ai-workspace { position:relative; display:flex; height:100%; min-height:0; min-width:0; background:var(--mi-shell-canvas); }
.ws-main { flex:1; min-width:0; min-height:0; display:flex; flex-direction:column; }
.ws-btn { display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; border:0; background:transparent; color:var(--mi-text-2); border-radius:8px; cursor:pointer; -webkit-app-region:no-drag; }
.ws-btn:hover { background:var(--mi-blue-light); color:var(--mi-text); }
.ws-btn svg { width:16px; height:16px; fill:none; stroke:currentColor; stroke-width:1.8; stroke-linecap:round; stroke-linejoin:round; }
.ws-btn:focus-visible { outline:2px solid var(--mi-text); outline-offset:-2px; }
.ws-btn:focus:not(:focus-visible) { outline:none; }
.ws-panel { flex:1; min-height:0; }

.ws-empty { display:flex; flex-direction:column; align-items:center; padding-top:60px; }
.ws-empty-title { margin:0 0 var(--mi-sp-12); font-family:var(--mi-font-serif); font-size:var(--mi-fs-hero); line-height:1.25; font-weight:var(--mi-fw-hero); color:var(--mi-text); }
/* 下边距给卡片右上角的像素角色留位，不压字 */
.ws-lesson-card { position:relative; width:min(100%, 380px); border:1px solid var(--mi-border); border-radius:14px; background:var(--mi-card); }
.ws-lesson-card > button:first-of-type { border-top-left-radius:14px; border-top-right-radius:14px; }
.ws-lesson-card > button:last-of-type { border-bottom-left-radius:14px; border-bottom-right-radius:14px; }
.ws-lesson-choice,.ws-task-choice,.ws-lesson-picker { width:100%; display:flex; align-items:center; gap:var(--mi-sp-3); text-align:left; padding:var(--mi-sp-3) var(--mi-sp-4); border:0; background:transparent; color:var(--mi-text); font:inherit; font-size:var(--mi-fs-body); cursor:pointer; }
.ws-lesson-choice span:nth-child(2),.ws-task-choice .task-text { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.ws-lesson-choice:hover,.ws-task-choice:hover,.ws-lesson-picker:hover { background:var(--mi-blue-light); }
.ws-task-choice { border-top:1px solid var(--mi-border); }
.task-star { color:var(--mi-blue); font-size:var(--mi-fs-body); }
.task-badge { font-size:var(--mi-fs-caption); padding:1px var(--mi-sp-2); border-radius:10px; background:var(--cds-surface-2); color:var(--mi-text-2); }
.ws-lesson-picker { border-top:1px solid var(--mi-border); color:var(--mi-text-2); }
/* 学习上下文栏：内嵌时是卡片，靠边框与画布区分（§3.1） */
.ws-rail { flex-shrink:0; width:var(--mi-rightpanel-w); padding-top:var(--mi-topbar-h); overflow:auto; background:var(--mi-shell-canvas); border-left:1px solid var(--mi-border); box-sizing:border-box; scrollbar-width:thin; scrollbar-color:var(--mi-border) transparent; }
.ws-rail.floating { position:absolute; right:12px; top:calc(var(--mi-topbar-h) + 12px); bottom:12px; padding-top:0; border:1px solid var(--mi-border); border-radius:14px; z-index:15; box-shadow:var(--mi-shadow-lg); }

.ai-workspace button:focus-visible { outline:2px solid var(--mi-text); outline-offset:2px; }
.ai-workspace button:focus:not(:focus-visible) { outline:none; }

</style>
