<script setup lang="ts">
import MiIcon, { type MiIconName } from './MiIcon.vue'

defineProps<{
  icon?: MiIconName
  iconFilled?: boolean
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  loading?: boolean
}>()

defineEmits<{ click: [e: MouseEvent] }>()
</script>

<template>
  <button
    class="mi-btn cds-btn-squish"
    data-cds="Button"
    type="button"
    :class="[variant ?? 'secondary', size ?? 'md']"
    :disabled="disabled || loading"
    :aria-busy="loading || undefined"
    @click="$emit('click', $event)"
  >
    <span class="button-paint" data-cds-part="paint" aria-hidden="true" />
    <!-- `mi-motion-keep` 是「减弱动效」总闸的放行条：转圈必须一直转下去，
         停住的转圈图标和「这个按钮卡死了」长得一模一样。见 styles/motion.css -->
    <span v-if="loading" class="spinner mi-motion-keep" />
    <MiIcon v-if="icon && !loading" :name="icon" :filled="iconFilled" :size="size === 'sm' ? 14 : 16" />
    <slot />
  </button>
</template>

<style scoped>
.mi-btn { position: relative; isolation: isolate; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; gap: var(--mi-sp-2); border: 0; background: transparent; color: var(--mi-text); border-radius: var(--radius-lg); cursor: pointer; font-family: var(--mi-font-family); font-size: var(--mi-fs-body); font-weight: 400; line-height: 1; user-select: none; white-space: nowrap; }
.button-paint { position: absolute; inset: 0; z-index: -1; border-radius: inherit; background: var(--cds-fill-secondary); transition: background-color var(--cds-dur-snap) var(--cds-ease-swift), box-shadow var(--cds-dur-fast) var(--cds-ease-swift); }
.mi-btn:focus-visible { outline: 2px solid var(--cds-clay); outline-offset: 2px; }
.mi-btn:disabled { opacity: .4; cursor: not-allowed; }
.sm { height: 28px; padding: 0 var(--mi-sp-3); font-size: var(--mi-fs-caption); }
.md { height: var(--mi-ctl); padding: 0 var(--mi-sp-4); }
.lg { height: var(--mi-ctl-lg); padding: 0 var(--mi-sp-4); border-radius: var(--radius-xl); font-size: var(--mi-fs-body); }
.primary { color: var(--mi-btn-primary-text); font-weight: 500; }
.primary .button-paint { background: var(--mi-blue-deep); }
.primary:hover:not(:disabled) .button-paint { background: var(--mi-blue-ink); }
.secondary:hover:not(:disabled) .button-paint { background: var(--cds-fill-secondary-hover); }
.ghost { color: var(--mi-text-2); }
.ghost .button-paint { background: transparent; }
.ghost:hover:not(:disabled) .button-paint { background: var(--cds-fill-ghost-hover); }
.danger { color: var(--mi-on-fill); }
.danger .button-paint { background: var(--mi-error); }
.spinner { width: 12px; height: 12px; border: 2px solid color-mix(in srgb,currentColor 30%,transparent); border-top-color: currentColor; border-radius: 50%; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
