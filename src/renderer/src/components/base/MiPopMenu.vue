<script setup lang="ts">
/**
 * 小弹出菜单（聊天框底栏的 Provider / 模型 / 强度选择）。
 * 键盘：触发键 Enter / 空格 / ↓ 打开（↑ 落在末项），菜单内 ↑↓ Home End 移动，Esc 关闭并把焦点还给触发键，Tab 直接关闭。
 * 向上展开（输入框在页面底部），点到菜单外关闭。
 */
import { nextTick, onBeforeUnmount, ref } from 'vue'

export interface PopMenuItem {
  key: string
  label: string
  checked?: boolean
  status?: 'ready' | 'disconnected' | 'connecting' | 'error'
  disabled?: boolean
}

const props = defineProps<{ items: PopMenuItem[]; label: string; title?: string; disabled?: boolean; triggerClass?: string; icon?: boolean }>()
const emit = defineEmits<{ select: [key: string] }>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const list = ref<HTMLElement | null>(null)

const enabledItems = (): HTMLButtonElement[] => [...(list.value?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]

function onOutside(event: Event): void {
  if (!root.value?.contains(event.target as Node)) close(false)
}

async function show(last = false): Promise<void> {
  if (props.disabled || open.value) return
  open.value = true
  document.addEventListener('pointerdown', onOutside, true)
  await nextTick()
  const els = enabledItems()
  ;(els.find(el => el.getAttribute('aria-checked') === 'true') ?? els[last ? els.length - 1 : 0])?.focus()
}

function close(refocus = true): void {
  if (!open.value) return
  open.value = false
  document.removeEventListener('pointerdown', onOutside, true)
  if (refocus) void nextTick(() => trigger.value?.focus())
}

function onTriggerKey(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); void show(event.key === 'ArrowUp') }
}

function onMenuKey(event: KeyboardEvent): void {
  const els = enabledItems()
  const index = els.indexOf(document.activeElement as HTMLButtonElement)
  if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() }
  else if (event.key === 'Tab') close(false)
  else if (event.key === 'ArrowDown') { event.preventDefault(); els[(index + 1) % els.length]?.focus() }
  else if (event.key === 'ArrowUp') { event.preventDefault(); els[(index - 1 + els.length) % els.length]?.focus() }
  else if (event.key === 'Home') { event.preventDefault(); els[0]?.focus() }
  else if (event.key === 'End') { event.preventDefault(); els[els.length - 1]?.focus() }
}

function pick(item: PopMenuItem): void {
  close()
  emit('select', item.key)
}

onBeforeUnmount(() => document.removeEventListener('pointerdown', onOutside, true))
</script>

<template>
  <div ref="root" class="pm">
    <button
      ref="trigger"
      type="button"
      class="pm-trigger"
      :class="[triggerClass, { 'pm-icon': icon }]"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-label="label"
      :title="title ?? label"
      :disabled="disabled"
      @click="open ? close() : show()"
      @keydown="onTriggerKey"
    >
      <slot />
      <svg v-if="!icon" class="pm-caret" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button>
    <ul v-if="open" ref="list" class="pm-list" role="menu" :aria-label="label" @keydown="onMenuKey">
      <li v-for="item in items" :key="item.key" role="none">
        <button type="button" role="menuitemradio" class="pm-item" :aria-checked="!!item.checked" tabindex="-1" :disabled="item.disabled" @click="pick(item)">
          <span v-if="item.status" class="pm-dot" :class="item.status" aria-hidden="true" />
          <span class="pm-text">{{ item.label }}</span>
          <svg v-if="item.checked" class="pm-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.pm { position: relative; display: inline-flex; min-width: 0; flex: 0 1 auto; }
.pm-trigger { display: inline-flex; align-items: center; gap: var(--mi-sp-1); min-width: 0; max-width: 14em; padding: var(--mi-sp-1) var(--mi-sp-2); border: 0; border-radius: 6px; background: transparent; color: var(--mi-text-3); font: inherit; font-size: var(--mi-fs-label); line-height: 1; cursor: pointer; white-space: nowrap; }
.pm-trigger:hover:not(:disabled), .pm-trigger[aria-expanded='true'] { background: var(--cds-fill-ghost-hover); color: var(--mi-text); }
.pm-trigger:disabled { color: var(--mi-text-3); cursor: default; }
.pm-trigger:focus-visible { outline: 2px solid var(--mi-text); outline-offset: 2px; }
.pm-trigger.pm-icon { width: 32px; height: 32px; padding: 0; justify-content: center; }
.pm-trigger :slotted(svg) { width: 16px; height: 16px; flex: 0 0 auto; }
.pm-trigger :slotted(.pm-label) { overflow: hidden; text-overflow: ellipsis; }
.pm-caret { width: 12px; height: 12px; flex: 0 0 auto; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.pm-list { position: absolute; right: 0; bottom: calc(100% + 6px); z-index: 30; min-width: 160px; max-width: 280px; margin: 0; padding: var(--mi-sp-1); list-style: none; background: var(--mi-card); border: 1px solid var(--mi-border); border-radius: 10px; box-shadow: var(--mi-shadow-lg); }
.pm-item { display: flex; align-items: center; gap: var(--mi-sp-2); width: 100%; padding: var(--mi-sp-2) var(--mi-sp-3); border: 0; border-radius: 6px; background: transparent; color: var(--mi-text); font: inherit; font-size: var(--mi-fs-label); text-align: left; cursor: pointer; }
.pm-item:hover:not(:disabled), .pm-item:focus-visible { background: var(--mi-blue-light); outline: none; }
.pm-item:disabled { color: var(--mi-text-3); cursor: default; }
.pm-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pm-check { width: 14px; height: 14px; flex: 0 0 auto; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.pm-dot { width: 6px; height: 6px; flex: 0 0 auto; border-radius: 50%; background: var(--mi-text-3); }
.pm-dot.ready { background: var(--mi-success-deep); }
.pm-dot.connecting { background: var(--mi-warn-deep); }
.pm-dot.error { background: var(--mi-error-deep); }
</style>
