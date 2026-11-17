<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useAttrs, type CSSProperties, type StyleValue } from 'vue'

defineOptions({ inheritAttrs: false })

const props = defineProps<{
  options: { label: string; value: string }[]
  modelValue: string
  placeholder?: string
  disabled?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [v: string] }>()
const attrs = useAttrs()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const list = ref<HTMLElement | null>(null)
const menuStyle = ref<CSSProperties>({})

const selected = computed(() => props.options.find((o) => o.value === props.modelValue))
const displayLabel = computed(() => selected.value?.label ?? props.placeholder ?? '')
const isPlaceholder = computed(() => !selected.value && !!props.placeholder)
const ariaLabel = computed(() => (attrs['aria-label'] as string | undefined) || props.placeholder || selected.value?.label)

const enabledItems = (): HTMLButtonElement[] => [...(list.value?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])]

function onOutside(event: Event): void {
  const target = event.target as Node
  if (!root.value?.contains(target) && !list.value?.contains(target)) close(false)
}

function onViewportChange(): void {
  close(false)
}

function onScroll(event: Event): void {
  if (!list.value?.contains(event.target as Node)) close(false)
}

function updatePosition(): void {
  const btn = trigger.value
  if (!btn) return
  const menuEl = list.value
  const rect = btn.getBoundingClientRect()
  const estH = props.options.length * 32 + 8
  const menuH = Math.min(280, menuEl?.scrollHeight || estH)
  const spaceBelow = window.innerHeight - rect.bottom - 8
  const spaceAbove = rect.top - 8
  const up = spaceBelow < menuH && spaceAbove > spaceBelow
  const menuW = Math.max(rect.width, menuEl?.offsetWidth ?? rect.width)
  let left = rect.left
  if (left + menuW > window.innerWidth - 8) left = Math.max(8, rect.right - menuW)
  menuStyle.value = {
    position: 'fixed',
    left: `${Math.round(left)}px`,
    minWidth: `${Math.round(rect.width)}px`,
    ...(up
      ? { bottom: `${Math.round(window.innerHeight - rect.top + 6)}px`, top: 'auto' }
      : { top: `${Math.round(rect.bottom + 6)}px`, bottom: 'auto' })
  }
}

function bindListeners(on: boolean): void {
  const fn = on ? 'addEventListener' : 'removeEventListener'
  document[fn]('pointerdown', onOutside, true)
  window[fn]('resize', onViewportChange)
  if (!on) window.removeEventListener('scroll', onScroll, true)
}

function scrollOptionIntoView(el: HTMLButtonElement): void {
  const box = list.value
  if (!box) return
  if (el.offsetTop < box.scrollTop) box.scrollTop = el.offsetTop
  else if (el.offsetTop + el.offsetHeight > box.scrollTop + box.clientHeight) {
    box.scrollTop = el.offsetTop + el.offsetHeight - box.clientHeight
  }
}

async function show(last = false): Promise<void> {
  if (props.disabled || open.value) return
  updatePosition()
  open.value = true
  bindListeners(true)
  await nextTick()
  if (!open.value) return
  updatePosition()
  const els = enabledItems()
  const target = els.find((el) => el.getAttribute('aria-selected') === 'true') ?? els[last ? els.length - 1 : 0]
  if (target) {
    scrollOptionIntoView(target)
    target.focus({ preventScroll: true })
  }
  requestAnimationFrame(() => {
    if (open.value) window.addEventListener('scroll', onScroll, true)
  })
}

function close(refocus = true): void {
  if (!open.value) return
  open.value = false
  bindListeners(false)
  if (refocus) void nextTick(() => trigger.value?.focus())
}

function onTriggerKey(event: KeyboardEvent): void {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    void show(event.key === 'ArrowUp')
  }
}

function focusItem(els: HTMLButtonElement[], idx: number): void {
  const el = els[idx]
  if (!el) return
  scrollOptionIntoView(el)
  el.focus({ preventScroll: true })
}

function onMenuKey(event: KeyboardEvent): void {
  const els = enabledItems()
  const index = els.indexOf(document.activeElement as HTMLButtonElement)
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    close()
  } else if (event.key === 'Tab') {
    close(false)
    trigger.value?.focus()
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    focusItem(els, (index + 1) % els.length)
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    focusItem(els, (index - 1 + els.length) % els.length)
  } else if (event.key === 'Home') {
    event.preventDefault()
    focusItem(els, 0)
  } else if (event.key === 'End') {
    event.preventDefault()
    focusItem(els, els.length - 1)
  }
}

function pick(value: string): void {
  close()
  emit('update:modelValue', value)
}

onBeforeUnmount(() => bindListeners(false))
</script>

<template>
  <div ref="root" class="mi-select" :class="[attrs.class, { disabled }]" :style="(attrs.style as StyleValue)">
    <button
      ref="trigger"
      type="button"
      class="ms-trigger"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-label="ariaLabel"
      :disabled="disabled"
      @click="open ? close() : show()"
      @keydown="onTriggerKey"
    >
      <span class="ms-value" :class="{ 'is-placeholder': isPlaceholder }">{{ displayLabel }}</span>
      <svg class="ms-caret" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
    </button>
    <Teleport to="body">
      <ul v-if="open" ref="list" class="ms-list" role="listbox" :aria-label="ariaLabel" :style="menuStyle" @keydown="onMenuKey">
        <li v-for="o in options" :key="o.value" role="none">
          <button
            type="button"
            role="option"
            class="ms-item"
            :class="{ selected: o.value === modelValue }"
            :aria-selected="o.value === modelValue"
            tabindex="-1"
            @click="pick(o.value)"
          >
            <span class="ms-text">{{ o.label }}</span>
            <svg v-if="o.value === modelValue" class="ms-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
          </button>
        </li>
      </ul>
    </Teleport>
  </div>
</template>

<style scoped>
.mi-select {
  position: relative;
  display: inline-flex;
  min-width: 0;
  max-width: 100%;
  height: var(--mi-ctl);
  font: var(--mi-fs-body) var(--mi-font-family);
}
.ms-trigger {
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--mi-sp-2);
  width: 100%;
  height: 100%;
  min-width: 0;
  padding: 0 var(--mi-sp-2) 0 var(--mi-sp-3);
  font: inherit;
  color: var(--mi-text);
  background: var(--cds-bg-input);
  border: 1px solid var(--cds-border-strong);
  border-radius: var(--radius-lg);
  outline: none;
  cursor: var(--mi-cursor, pointer);
  transition: border-color var(--cds-dur-snap) var(--cds-ease-swift), box-shadow var(--cds-dur-snap) var(--cds-ease-swift);
}
.ms-trigger:focus-visible,
.ms-trigger[aria-expanded='true'] {
  border-color: transparent;
  box-shadow: var(--cds-focus-shadow);
}
.mi-select.disabled .ms-trigger {
  opacity: .4;
  cursor: not-allowed;
}
.ms-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}
.ms-value.is-placeholder { color: var(--mi-text-3); }
.ms-caret {
  width: 12px;
  height: 12px;
  flex: 0 0 auto;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
  color: var(--mi-text-2);
}
.ms-list {
  z-index: 9500;
  box-sizing: border-box;
  max-width: min(360px, calc(100vw - 16px));
  max-height: 280px;
  overflow-y: auto;
  margin: 0;
  padding: var(--mi-sp-1);
  list-style: none;
  background: var(--mi-bg);
  border: 1px solid var(--mi-border);
  border-radius: var(--mi-radius-box);
  box-shadow: var(--mi-shadow-lg);
}
.ms-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--mi-sp-2);
  width: 100%;
  height: var(--mi-ctl);
  padding: 0 var(--mi-sp-2) 0 var(--mi-sp-3);
  border: 0;
  border-radius: var(--mi-radius-sm);
  background: transparent;
  color: var(--mi-text);
  font: var(--mi-fs-label) var(--mi-font-family);
  text-align: left;
  cursor: var(--mi-cursor, pointer);
}
.ms-item.selected { background: var(--mi-blue); }
.ms-item:hover:not(:disabled),
.ms-item:focus-visible {
  background: var(--mi-blue-light);
  outline: none;
}
.ms-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ms-check {
  width: 14px;
  height: 14px;
  flex: 0 0 auto;
  fill: none;
  stroke: var(--mi-blue-deep);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
