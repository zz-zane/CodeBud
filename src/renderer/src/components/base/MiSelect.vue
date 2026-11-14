<script setup lang="ts">
defineProps<{
  options: { label: string; value: string }[]
  modelValue: string
  placeholder?: string
  disabled?: boolean
}>()

defineEmits<{ 'update:modelValue': [v: string] }>()
</script>

<template>
  <select
    class="mi-select"
    :class="{ disabled }"
    :value="modelValue"
    :disabled="disabled"
    :aria-label="($attrs['aria-label'] as string | undefined) || placeholder || options.find(o => o.value === modelValue)?.label"
    @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
  >
    <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
    <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
  </select>
</template>

<style scoped>
.mi-select { box-sizing: border-box; min-width: 0; max-width: 100%; height: 32px; padding: var(--mi-sp-1) var(--mi-sp-6) var(--mi-sp-1) var(--mi-sp-3); font: var(--mi-fs-body) var(--mi-font-family); color: var(--mi-text); background: var(--cds-bg-input); border: 1px solid var(--cds-border-strong); border-radius: var(--radius-lg); outline: none; cursor: pointer; transition: box-shadow var(--cds-dur-snap) var(--cds-ease-swift); }
.mi-select:focus-visible { border-color: transparent; box-shadow: var(--cds-focus-shadow); }
.mi-select.disabled { opacity: .4; cursor: not-allowed; }
</style>
