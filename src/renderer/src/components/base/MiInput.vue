<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
    type?: string
    disabled?: boolean
    width?: string
    /** 多行：渲染成 `<textarea>`，换行变成**内容**，Enter 不再当提交 */
    multiline?: boolean
    /** 多行时的可见行数（超出会滚动） */
    rows?: number
  }>(),
  { rows: 4 }
)

const emit = defineEmits<{ 'update:modelValue': [v: string]; enter: [] }>()

/**
 * 单行 `/` 多行共用**同一个根槽位**。
 *
 * 【为什么不是 `v-if` 两个根】
 * 两个根节点会让 Vue 关掉属性透传，而调用方（`QuizCode.vue`）正是靠透传把
 * `readonly` 和红绿描边的 `class` 挂上来的 —— 拆成两个根，提交后输入框**锁不上**，
 * 学员能接着改一个已经判过的答案。
 */
const tag = computed(() => (props.multiline ? 'textarea' : 'input'))

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement | HTMLTextAreaElement).value)
}

/**
 * 组字刚结束的那一下 Enter 要单独吃掉。
 *
 * 【为什么 `isComposing` / `229` 不够】
 * 中文输入法用 Enter 确认候选词时，Chrome 会在 `compositionend` **之后**再补一个
 * 已经不算组字的 Enter（`isComposing: false`、`keyCode: 13`）。只判组字状态的话，
 * 这一下会被当成提交 —— 学员只想把「循」上屏接着打「环」，答案却被锁成半截，
 * 还记进了错题本。这里只吃掉紧跟着的那一个，并且松手就复位，不会一直卡住。
 */
let imeEnterPending = false

function onCompositionEnd() {
  imeEnterPending = true
}

function onKeyup() {
  imeEnterPending = false
}

/**
 * Enter 的两种含义。
 *
 * 单行：Enter = 提交（原有行为，一字未改）。
 * 多行：Enter = **换行** —— 学员要打的就是一段好几行的输出，把换行吞掉这题就没法答了。
 *       提交改走 Ctrl+Enter（下面的按钮一直在，不依赖这条捷径）。
 */
function onKeydown(e: KeyboardEvent) {
  if (e.isComposing || e.keyCode === 229) return
  if (e.key !== 'Enter') return
  if (imeEnterPending) {
    imeEnterPending = false
    return
  }
  if (props.multiline && !e.ctrlKey) return
  emit('enter')
}
</script>

<template>
  <component
    :is="tag"
    class="mi-input"
    :class="{ disabled }"
    :type="multiline ? undefined : (type ?? 'text')"
    :rows="multiline ? rows : undefined"
    :value="modelValue"
    :placeholder="placeholder"
    :aria-label="($attrs['aria-label'] as string | undefined) || placeholder"
    :disabled="disabled"
    :style="width ? { width } : undefined"
    @input="onInput"
    @keydown="onKeydown"
    @keyup="onKeyup"
    @compositionend="onCompositionEnd"
  />
</template>

<style scoped>
.mi-input { box-sizing: border-box; min-width: 0; height: 32px; padding: var(--mi-sp-1) var(--mi-sp-3); font: var(--mi-fs-body) var(--mi-font-family); color: var(--mi-text); background: var(--cds-bg-input); border: 1px solid var(--cds-border-strong); border-radius: var(--radius-lg); outline: none; transition: box-shadow var(--cds-dur-snap) var(--cds-ease-swift); }
.mi-input:focus { border-color: transparent; box-shadow: var(--cds-focus-shadow); }
.mi-input::placeholder { color: var(--mi-text-3); }
.mi-input.disabled { opacity: .4; cursor: not-allowed; }
textarea.mi-input { display: block; height: auto; box-sizing: border-box; font-family: var(--mi-code); line-height: 1.6; resize: vertical; min-height: 96px; white-space: pre; }
</style>
