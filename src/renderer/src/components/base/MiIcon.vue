<script lang="ts">
/** 全站线性图标。路径形状取自 Lucide（ISC），只收用到的，不引入依赖。 */
const CIRCLE = 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z'
const ICONS = {
  alert: 'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z M12 9v4 M12 17h.01',
  archive: 'M3 3h18v5H3z M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8 M10 12h4',
  'archive-restore': 'M3 3h18v5H3z M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8 M12 18v-6 M9 15l3-3 3 3',
  'arrow-down': 'M12 5v14 M19 12l-7 7-7-7',
  'arrow-left': 'M19 12H5 M12 19l-7-7 7-7',
  'arrow-right': 'M5 12h14 M12 5l7 7-7 7',
  'arrow-up': 'M12 19V5 M5 12l7-7 7 7',
  book: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z',
  chart: 'M3 3v18h18 M8 17v-4 M13 17V7 M18 17v-8',
  check: 'M20 6 9 17l-5-5',
  'chevron-right': 'M9 18l6-6-6-6',
  circle: CIRCLE,
  'circle-check': `${CIRCLE} M9 12l2 2 4-4`,
  clock: `${CIRCLE} M12 6v6l4 2`,
  code: 'M16 18l6-6-6-6 M8 6l-6 6 6 6',
  curve: 'M3 3v18h18 M7 15c2-6 4-8 6-4s4 2 6-5',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3',
  eraser: 'M20 20H9l-5-5a2 2 0 0 1 0-2.8l9-9a2 2 0 0 1 2.8 0l5 5a2 2 0 0 1 0 2.8L12 20 M9 8l7 7',
  external: 'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6 M15 3h6v6 M10 14 21 3',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M16 13H8 M16 17H8',
  flame: 'M12 3c1 3 4 4.5 4 8.5a4 4 0 0 1-8 0c0-1.5.5-2.5 1.5-3.5C9.5 10 11 9 12 3z',
  flag: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z M4 22v-7',
  folder: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
  'folder-plus': 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z M12 11v6 M9 14h6',
  graduation: 'M22 10 12 5 2 10l10 5z M6 12v5c3 2 9 2 12 0v-5',
  info: `${CIRCLE} M12 16v-4 M12 8h.01`,
  layers: 'M12 2 2 7l10 5 10-5z M2 17l10 5 10-5 M2 12l10 5 10-5',
  lightbulb: 'M9 18h6 M10 22h4 M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14',
  link: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71 M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  list: 'M8 6h13 M8 12h13 M8 18h13 M3 6h.01 M3 12h.01 M3 18h.01',
  'list-checks': 'M3 6l2 2 3-3 M3 16l2 2 3-3 M12 7h9 M12 17h9',
  message: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  minus: 'M5 12h14',
  note: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7 M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z',
  pencil: 'M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z',
  play: 'M6 3l14 9-14 9z',
  plug: 'M12 22v-5 M9 8V2 M15 8V2 M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8z',
  plus: 'M12 5v14 M5 12h14',
  refresh: 'M21 12a9 9 0 0 1-15 6.7L3 16 M3 21v-5h5 M3 12a9 9 0 0 1 15-6.7L21 8 M21 3v5h-5',
  repeat: 'M17 2l4 4-4 4 M3 11v-1a4 4 0 0 1 4-4h14 M7 22l-4-4 4-4 M21 13v1a4 4 0 0 1-4 4H3',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M21 21l-4.3-4.3',
  shuffle: 'M16 3h5v5 M4 20 21 3 M21 16v5h-5 M15 15l6 6 M4 4l5 5',
  sparkles: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z M19 3v4 M21 5h-4',
  star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z',
  stop: 'M6 6h12v12H6z',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z M12 1v2 M12 21v2 M4.22 4.22l1.42 1.42 M18.36 18.36l1.42 1.42 M1 12h2 M21 12h2 M4.22 19.78l1.42-1.42 M18.36 5.64l1.42-1.42',
  target: `${CIRCLE} M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z`,
  terminal: 'M4 17l6-6-6-6 M12 19h8',
  trash: 'M3 6h18 M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6 M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M17 8l-5-5-5 5 M12 3v12',
  wallet: 'M20 7H5a2 2 0 0 1 0-4h14v4 M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1 M17 14h.01',
  x: 'M18 6 6 18 M6 6l12 12',
  zap: 'M13 2 3 14h9l-1 8 10-12h-9z'
} as const

export type MiIconName = keyof typeof ICONS
</script>

<script setup lang="ts">
withDefaults(defineProps<{ name: MiIconName; size?: number; filled?: boolean }>(), { size: 16, filled: false })
</script>

<template>
  <svg
    class="mi-icon"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    :fill="filled ? 'currentColor' : 'none'"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="ICONS[name]" />
  </svg>
</template>

<style scoped>
.mi-icon { flex-shrink: 0; display: block; }
</style>
