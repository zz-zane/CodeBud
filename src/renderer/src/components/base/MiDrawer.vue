<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { usePhoneBackClose } from '../../lib/phone-back-close'

const props = withDefaults(
  defineProps<{
    visible: boolean
    title?: string
    width?: number
    closable?: boolean
  }>(),
  { width: 380, closable: true }
)

const emit = defineEmits<{ 'update:visible': [v: boolean]; close: [] }>()
const panel = ref<HTMLElement | null>(null)
let background: HTMLElement | null = null
let wasInert = false

function restoreBackground() {
  if (background) background.inert = wasInert
  background = null
}

function close() {
  if (!props.closable) return
  emit('update:visible', false)
  emit('close')
}

// 手机上系统返回先关抽屉
usePhoneBackClose(() => props.visible, close)

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
  if (e.key !== 'Tab') return
  const elements = Array.from(panel.value?.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  ) ?? []).filter(el => !el.hasAttribute('disabled') && el.getClientRects().length > 0)
  const first = elements[0]
  const last = elements[elements.length - 1]
  const inside = elements.includes(document.activeElement as HTMLElement)
  if (!first) {
    e.preventDefault()
    panel.value?.focus()
  } else if (e.shiftKey && (!inside || document.activeElement === first)) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
    e.preventDefault()
    first.focus()
  }
}

watch(
  () => props.visible,
  (v) => {
    if (v) {
      background = document.getElementById('app')
      wasInert = background?.inert ?? false
      if (background) background.inert = true
      window.addEventListener('keydown', onKey)
    } else {
      restoreBackground()
      window.removeEventListener('keydown', onKey)
    }
  },
  { immediate: true }
)
onBeforeUnmount(() => {
  restoreBackground()
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer">
      <div v-if="visible" class="mi-drawer-mask" @click.self="close">
        <div ref="panel" class="mi-drawer" role="dialog" aria-modal="true" :aria-label="title" tabindex="-1" :style="{ width: width + 'px' }">
          <slot name="header" :close="close">
            <div class="mi-drawer-head">
              <div class="mi-drawer-title">{{ title }}</div>
              <button v-if="closable" class="mi-drawer-close" @click="close">✕</button>
            </div>
          </slot>
          <div class="mi-drawer-body"><slot /></div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.mi-drawer-mask {
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: color-mix(in srgb, var(--mi-overlay) 25%, transparent);
}
.mi-drawer {
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--mi-bg);
  box-shadow: -6px 0 24px color-mix(in srgb, var(--mi-overlay) 15%, transparent);
}
.mi-drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--mi-sp-4) var(--mi-sp-4) var(--mi-sp-3);
  border-bottom: 1px solid var(--mi-border);
}
.mi-drawer-title {
  font-size: var(--mi-fs-read);
  font-weight: 500;
}
.mi-drawer-close {
  border: none;
  background: none;
  font-size: var(--mi-fs-body);
  color: var(--mi-text-3);
  cursor: var(--mi-cursor, pointer);
  padding: var(--mi-sp-1) var(--mi-sp-2);
  border-radius: 6px;
}
.mi-drawer-close:hover {
  background: var(--mi-blue-light);
}
.mi-drawer-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--mi-sp-4) var(--mi-sp-4);
  line-height: 1.8;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}
.drawer-enter-active,
.drawer-leave-active {
  transition: opacity var(--mi-dur) var(--mi-ease-out);
}
/* 退场期间不吞点击：遮罩还在淡出时用户已经可以点下面的内容 */
.drawer-leave-active {
  pointer-events: none;
}
.drawer-enter-active .mi-drawer,
.drawer-leave-active .mi-drawer {
  transition: transform var(--mi-dur) var(--mi-ease-out);
}
.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
}
.drawer-enter-from .mi-drawer,
.drawer-leave-to .mi-drawer {
  transform: translateX(40px);
}
</style>
