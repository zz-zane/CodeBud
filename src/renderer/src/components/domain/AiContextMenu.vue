<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAiAssistantStore } from '../../stores/ai-assistant'
import { useCet6Store } from '../../stores/cet6'
import { AI_ASSISTANT, VIDEO_UI } from '../../lib/copy'
import { useVideoStore } from '../../stores/video'

const aiStore = useAiAssistantStore()
const video = useVideoStore()
const cet6 = useCet6Store()
const route = useRoute()
const router = useRouter()
const visible = ref(false)
const menuX = ref(0)
const menuY = ref(0)
const capturedText = ref('')
const capturedTitle = ref<string>(AI_ASSISTANT.REF_SELECTION)
const capturedType = ref<'code' | 'selection'>('selection')

function onGlobalContextMenu(e: MouseEvent) {
  // 六级考试模式不弹「问 AI」菜单（docs/27 §8.1）
  if (cet6.examLock) return
  const target = e.target as HTMLElement
  if (!target) return

   
  if (target.closest('.ai-panel, .ai-workspace')) return

  let text = ''
  let type: 'code' | 'selection' = 'selection'
  let title: string = AI_ASSISTANT.REF_SELECTION

  // 1. 检查 CodeEditor 选区
  const cmContent = target.closest('.cm-editor')
  if (cmContent) {
    type = 'code'
    title = AI_ASSISTANT.REF_CODE
    const sel = window.getSelection()?.toString().trim()
    if (sel) {
      text = sel
    }
  }

  // 2. 检查代码块
  const codeBlock = target.closest('.code-block')
  if (codeBlock) {
    type = 'code'
    const sel = window.getSelection()?.toString().trim()
    if (sel) {
      text = sel
      title = AI_ASSISTANT.REF_CODE
    } else {
      const codeEl = codeBlock.querySelector('code')
      if (codeEl?.textContent?.trim()) {
        text = codeEl.textContent.trim()
        title = AI_ASSISTANT.MENU_CODE_BLOCK
      }
    }
  }

  // 3. 通用 DOM 选区
  if (!text) {
    const sel = window.getSelection()?.toString().trim()
    if (sel) {
      text = sel
      title = AI_ASSISTANT.MENU_TEXT_SELECTION
    }
  }

  if (!text) {
    visible.value = false
    return
  }

  e.preventDefault()

  // 快照冻结
  capturedText.value = text
  capturedTitle.value = title
  capturedType.value = type

  const menuWidth = 140
  const menuHeight = 120
  menuX.value = Math.min(e.clientX, window.innerWidth - menuWidth - 8)
  menuY.value = Math.min(e.clientY, window.innerHeight - menuHeight - 8)
  visible.value = true
}

// 触屏没有右键：课文页的选词浮条发 miai-ask-selection，这里复用同一个菜单（解释 / 举例 / 提问）
function onAskSelection(e: Event) {
  if (cet6.examLock) return
  const d = (e as CustomEvent<{ text: string; inCodeBlock: boolean; x: number; y: number }>).detail
  if (!d?.text) return
  capturedText.value = d.text
  capturedType.value = d.inCodeBlock ? 'code' : 'selection'
  capturedTitle.value = d.inCodeBlock ? AI_ASSISTANT.REF_CODE : AI_ASSISTANT.MENU_TEXT_SELECTION
  menuX.value = Math.max(8, Math.min(d.x - 70, window.innerWidth - 148))
  menuY.value = Math.max(8, Math.min(d.y + 8, window.innerHeight - 150))
  // 等触发它的那次 click 冒泡到 window（会 closeMenu）之后再显示
  setTimeout(() => { visible.value = true }, 0)
}

function closeMenu() {
  visible.value = false
}

 






function handleAction(action: 'explain' | 'example' | 'ask') {
  const lessonId = route.name === 'lesson' && route.params.id ? String(route.params.id) : undefined
  const params = { text: capturedText.value, title: capturedTitle.value, type: capturedType.value, action, lessonId }
  closeMenu()
  if (route.name === 'ai') {
    aiStore.openWithSelection({ ...params, openRail: false })
  } else if (aiStore.returnTarget) {
    const tags = aiStore.openWithSelection({ ...params, openRail: false, deferSend: true })
    void router.push('/ai').then((failure) => {
      if (failure || action === 'ask') return
      void aiStore.sendMessage(action === 'explain' ? AI_ASSISTANT.PROMPT_EXPLAIN_REF : AI_ASSISTANT.PROMPT_EXAMPLE_REF, tags)
    })
  } else {
    aiStore.openWithSelection(params)
  }
}

onMounted(() => {
  window.addEventListener('contextmenu', onGlobalContextMenu)
  window.addEventListener('miai-ask-selection', onAskSelection)
  window.addEventListener('click', closeMenu)
  window.addEventListener('scroll', closeMenu, true)
})

onBeforeUnmount(() => {
  window.removeEventListener('contextmenu', onGlobalContextMenu)
  window.removeEventListener('miai-ask-selection', onAskSelection)
  window.removeEventListener('click', closeMenu)
  window.removeEventListener('scroll', closeMenu, true)
})
</script>

<template>
  <div
    v-if="visible"
    class="ai-context-menu"
    :style="{ left: menuX + 'px', top: menuY + 'px' }"
    @click.stop
  >
    <button type="button" class="menu-item" @click="handleAction('explain')">
      <span class="item-icon">💡</span>
      <span class="item-text">{{ AI_ASSISTANT.MENU_EXPLAIN }}</span>
    </button>
    <button type="button" class="menu-item" @click="handleAction('example')">
      <span class="item-icon">📝</span>
      <span class="item-text">{{ AI_ASSISTANT.MENU_EXAMPLES }}</span>
    </button>
    <div class="menu-divider" />
    <button type="button" class="menu-item" @click="handleAction('ask')">
      <span class="item-icon">💬</span>
      <span class="item-text">{{ AI_ASSISTANT.MENU_ASK }}</span>
    </button>
    <button v-if="route.name === 'lesson'" type="button" class="menu-item" @click="video.open({ excerpt: capturedText, lessonId: String(route.params.id) }); closeMenu()">
      <span class="item-icon">▶</span><span class="item-text">{{ VIDEO_UI.SELECTION }}</span>
    </button>
  </div>
</template>

<style scoped>
.ai-context-menu {
  position: fixed;
  z-index: 10000;
  min-width: 130px;
  background: var(--mi-card);
  border: 1px solid var(--mi-border);
  border-radius: 6px;
  box-shadow: var(--mi-shadow-lg);
  padding: var(--mi-sp-1);
  display: flex;
  flex-direction: column;
  user-select: none;
  animation: menuFadeIn 0.1s ease-out;
}

@keyframes menuFadeIn {
  from {
    transform: scale(0.96);
  }
  to {
    transform: scale(1);
  }
}

.menu-item {
  display: flex;
  align-items: center;
  gap: var(--mi-sp-2);
  padding: var(--mi-sp-2) var(--mi-sp-3);
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  text-align: left;
  font-size: var(--mi-fs-label);
  color: var(--mi-text);
  transition: background-color 0.1s ease;
}

.menu-item:hover {
  background-color: var(--mi-blue-light);
}

.item-icon {
  font-size: var(--mi-fs-body);
  line-height: 1;
}

.item-text {
  font-weight: 500;
}

.menu-divider {
  height: 1px;
  background: var(--mi-border);
  margin: 3px 0;
}
</style>
