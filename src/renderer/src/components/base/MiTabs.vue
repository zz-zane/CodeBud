<script setup lang="ts">
import { computed, ref } from 'vue'
import { tabNavTarget } from '../../lib/tab-nav'
import MiIcon, { type MiIconName } from './MiIcon.vue'

const props = defineProps<{
  tabs: { key: string; label: string; icon?: MiIconName }[]
  modelValue: string
  /** 整组禁用（壁纸关着时面板里的分段控件一并灰掉；默认 false 向后兼容） */
  disabled?: boolean
  ariaLabel?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [v: string] }>()
const activeIndex = computed(() => Math.max(0, props.tabs.findIndex((t) => t.key === props.modelValue)))

/**
 * ←/→（还带 Home/End）在页签之间**巡回**（⑤ 给排行榜三页签加的键盘路径，
 * 判定逻辑在 lib/tab-nav.ts、单测在那儿）。两件事必须一起做：
 * 换选中态（emit）+ 真把焦点挪过去 —— 只换选中态的话，键盘党按第二下
 * 方向键时焦点还在原来那格，走动的是别人看不见的东西。
 */
const btns = ref<HTMLButtonElement[]>([])

// ref 挂在原生 <button> 上，vue 传进来的就是元素本身，不是组件实例 ——
// 收 unknown 是让 vue-tsc 的 VNodeRef 联合类型（Element | 组件实例）能直接对得上，
// 真正的资格判定只认 instanceof。
function setBtn(el: unknown, i: number): void {
  if (el instanceof HTMLButtonElement) btns.value[i] = el
}

function onKeydown(e: KeyboardEvent, i: number): void {
  const target = tabNavTarget(e.key, i, props.tabs.length)
  if (target === null) return
  // 只有真接管的键才 preventDefault（Tab/Escape 等照常走自己的路）
  e.preventDefault()
  emit('update:modelValue', props.tabs[target].key)
  btns.value[target]?.focus()
}
</script>

<template>
  <div class="mi-tabs" data-cds="SegmentedControl" role="tablist" :aria-label="ariaLabel"
    :class="{ 'is-disabled': disabled }"
    :style="{ '--active-index': activeIndex, '--total-tabs': tabs.length }">
    <span class="tab-indicator" aria-hidden="true" />
    <button
      v-for="(t, i) in tabs"
      :key="t.key"
      :ref="(el) => setBtn(el, i)"
      class="mi-tab"
      type="button"
      role="tab"
      :aria-selected="modelValue === t.key"
      :tabindex="modelValue === t.key ? 0 : -1"
      :class="{ active: modelValue === t.key }"
      :disabled="disabled"
      @click="$emit('update:modelValue', t.key)"
      @keydown="onKeydown($event, i)"
    >
      <MiIcon v-if="t.icon" :name="t.icon" :size="14" />
      <span class="mi-tab-label">{{ t.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.mi-tabs { position: relative; isolation: isolate; display: inline-grid; grid-auto-flow: column; grid-auto-columns: minmax(0, 1fr); width: max-content; max-width: 100%; min-width: 0; height: 32px; padding: 1px; gap: 0; border-radius: var(--cds-radius-pill); background: var(--cds-segmented-track); box-sizing: border-box; overflow: hidden; }
.tab-indicator { position: absolute; top: 1px; bottom: 1px; left: calc(1px + var(--active-index) * (100% - 2px) / var(--total-tabs)); width: calc((100% - 2px) / var(--total-tabs)); border-radius: inherit; background: var(--cds-segmented-thumb); box-shadow: inset 0 0 0 .5px var(--cds-border), var(--cds-shadow-sm); transition: left var(--cds-dur-snap) var(--cds-ease-snap), background-color var(--cds-dur-snap) var(--cds-ease-snap); pointer-events: none; }
/* overflow:hidden + 省略号是兜底：容器被压窄时宁可把字截掉，也不许溢出到邻居页签上面去 */
.mi-tab { position: relative; z-index: 1; min-width: 0; display: inline-flex; align-items: center; justify-content: center; gap: var(--mi-sp-2); padding: 0 var(--mi-sp-4); border: 0; border-radius: inherit; background: transparent; font: var(--mi-fs-label) var(--mi-font-family); line-height: 1.25; color: var(--mi-text-2); cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.mi-tab:hover { color: var(--mi-text); }
.mi-tab.active { color: var(--mi-text); font-weight: 500; }
.mi-tab:focus-visible { outline: 2px solid var(--cds-clay); outline-offset: 2px; }
.mi-tab:disabled { cursor: default; opacity: .4; }
.mi-tab-label { overflow: hidden; text-overflow: ellipsis; }
@media (max-width: 1100px) { .mi-tab { padding-inline: var(--mi-sp-3); } }
</style>
