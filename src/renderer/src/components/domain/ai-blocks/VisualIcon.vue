<script setup lang="ts">
/** 图文积木用的线条小图标（自绘，24×24 描边，currentColor），名字由 ai-rich-blocks 的 VISUAL_ICONS 限定 */
import type { VisualIcon } from '../../../lib/ai-rich-blocks'

defineProps<{ name: VisualIcon; size?: number }>()

const PATHS: Record<VisualIcon, string> = {
  server: 'M4 4h16v6H4z M4 14h16v6H4z M8 7h.01 M8 17h.01',
  device: 'M8 2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z M11 18h2',
  globe: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18z M3 12h18 M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9z',
  network: 'M12 4a2 2 0 1 0 0 4a2 2 0 0 0 0-4z M5 16a2 2 0 1 0 0 4a2 2 0 0 0 0-4z M19 16a2 2 0 1 0 0 4a2 2 0 0 0 0-4z M12 8v4 M12 12l-6 4 M12 12l6 4',
  cable: 'M3 12c3-4 6 4 9 0s6-4 9 0 M3 17c3-4 6 4 9 0s6-4 9 0 M12 3v5',
  database: 'M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3s-8-1.3-8-3s3.6-3 8-3z M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6 M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
  cpu: 'M7 7h10v10H7z M10 10h4v4h-4z M9 3v4 M15 3v4 M9 17v4 M15 17v4 M3 9h4 M3 15h4 M17 9h4 M17 15h4',
  user: 'M12 4a4 4 0 1 0 0 8a4 4 0 0 0 0-8z M4 21c0-4 3.6-6 8-6s8 2 8 6',
  lock: 'M6 11h12v10H6z M8 11V8a4 4 0 0 1 8 0v3',
  file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5',
  image: 'M4 5h16v14H4z M4 16l5-5 4 4 3-3 4 4 M15 9h.01',
  code: 'M8 8l-4 4 4 4 M16 8l4 4-4 4 M13 5l-2 14',
  cloud: 'M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9.5A4.3 4.3 0 0 0 7 18z',
  router: 'M4 14h16v6H4z M8 17h.01 M12 17h.01 M9 10a4 4 0 0 1 6 0 M6.5 7.5a7.5 7.5 0 0 1 11 0',
  bolt: 'M13 3L5 14h6l-1 7 8-11h-6z',
  clock: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18z M12 7v5l3 2',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z M4 19V5 M8 7h7',
  check: 'M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18z M8 12l3 3 5-6'
}
</script>

<template>
  <svg :width="size ?? 18" :height="size ?? 18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path :d="PATHS[name]" />
  </svg>
</template>
