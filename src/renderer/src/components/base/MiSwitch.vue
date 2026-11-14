<script setup lang="ts">
defineOptions({
  inheritAttrs: false
})

defineProps<{
  modelValue: boolean
  label?: string
  disabled?: boolean
  ariaLabel?: string
}>()

defineEmits<{ 'update:modelValue': [v: boolean] }>()
</script>

<template>
  <label class="mi-switch" :class="{ on: modelValue, disabled }">
    <input
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      :aria-label="ariaLabel || ($attrs['aria-label'] as string | undefined) || label"
      v-bind="$attrs"
      @change="$emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span class="track"><span class="thumb" /></span>
    <span v-if="label" class="label">{{ label }}</span>
  </label>
</template>

<style scoped>
.mi-switch { position: relative; display: inline-flex; flex-shrink: 0; align-items: center; gap: var(--mi-sp-2); cursor: pointer; font: var(--mi-fs-label) var(--mi-font-family); }
.mi-switch input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: inherit; z-index: 1; }
.track { box-sizing: border-box; width: 32px; height: 20px; border-radius: var(--cds-radius-pill); padding: 2px; background: var(--mi-border-control); display: flex; align-items: center; transition: background-color var(--cds-dur-snap) var(--cds-ease-snap); }
.thumb { width: 16px; height: 16px; border-radius: 50%; background: var(--cds-gray-0); box-shadow: var(--cds-shadow-sm); transition: transform var(--cds-dur-snap) var(--cds-ease-snap); }
.mi-switch.on .track { background: var(--mi-blue-deep); }
.mi-switch.on .thumb { transform: translateX(12px); }
.mi-switch input:focus-visible ~ .track { box-shadow: var(--cds-focus-shadow); outline: 2px solid var(--cds-clay); outline-offset: 2px; }
.mi-switch.disabled { opacity: .4; cursor: not-allowed; }
.label { color: var(--mi-text); }
</style>
