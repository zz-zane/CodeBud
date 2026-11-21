<script setup lang="ts">
/**
 * 手机底部标签栏：与侧栏主导航同源（lib/nav-items.ts 里 key 为 today / courses / practice / review / ai 的五项），只在手机宽度由 App.vue 渲染。
 * 样式全在 styles/phone.css（.phone-tabbar*），桌面不会命中。
 */
import { useRoute, useRouter } from 'vue-router'
import { useAiAssistantStore } from '../../stores/ai-assistant'
import { phoneTabItems, isNavActive } from '../../lib/nav-items'
import { PHONE } from '../../lib/copy'

// 2026-11-21 用户要求去掉复习标签上的到期数字（与桌面侧栏一致）
const ai = useAiAssistantStore()
const route = useRoute()
const router = useRouter()
const tabs = phoneTabItems()

function go(path: string): void {
  if (route.path !== path) {
    ai.isOpen = false
    ai.railPref = 'closed'
  }
  void router.push(path)
}
</script>

<template>
  <nav class="phone-tabbar" :aria-label="PHONE.TAB_NAV">
    <button
      v-for="t in tabs"
      :key="t.key"
      type="button"
      class="phone-tab"
      :class="{ active: isNavActive(t, route.path) }"
      :title="t.label"
      :aria-current="isNavActive(t, route.path) ? 'page' : undefined"
      @click="go(t.path)"
    >
      <svg class="phone-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path :d="t.icon" />
      </svg>
      <span class="phone-tab-label">{{ t.label }}</span>
    </button>
  </nav>
</template>
