<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAiAssistantStore } from '../../stores/ai-assistant'
import { APP_SIDEBAR, AI_ASSISTANT } from '../../lib/copy'
import { NAV_ITEMS, isNavActive, navSections, type NavItem } from '../../lib/nav-items'
import { useTodayCounts } from '../../lib/use-today-counts'
import { STUDY_MAIN_SESSION_ID } from '../../stores/study'
import MiIcon from '../base/MiIcon.vue'
import { STUDY_COPY } from '../../lib/study-copy'

// rail 态由 App.vue 传入，侧栏只负责隐藏文字；顶栏按钮直接在展开与隐藏间切换。
const props = withDefaults(defineProps<{ isRail?: boolean }>(), { isRail: false })

const ai = useAiAssistantStore()
const route = useRoute()
const router = useRouter()

const isRail = computed(() => props.isRail)

const sections = navSections(NAV_ITEMS)

// 徽标：练习 = 未消除错题数（静色），复习 = 今日到期数（强调色）；0 不渲染，> 99 显示 99+
const counts = useTodayCounts()
onMounted(() => counts.ensureLoaded())

interface Badge { text: string; accent: boolean; aria: string }
function badgeOf(item: NavItem): Badge | null {
  const n = item.key === 'practice' ? counts.wrongCount.value : item.key === 'review' ? counts.reviewDue.value : 0
  if (n <= 0) return null
  const accent = item.key === 'review'
  return { text: n > 99 ? '99+' : String(n), accent, aria: accent ? APP_SIDEBAR.badgeDue(n) : APP_SIDEBAR.badgeWrong(n) }
}

function isActive(item: { key: string }): boolean {
  return isNavActive(item, route.path)
}

function navigate(path: string): void {
  if (route.path !== path) {
    ai.isOpen = false
    ai.railPref = 'closed'
  }
  void router.push(path)
}

function isMainSession(id: string): boolean {
  return id === STUDY_MAIN_SESSION_ID
}

function selectMainSession(): void {
  const main = ai.sessions.find((s) => s.id === STUDY_MAIN_SESSION_ID)
  if (main) {
    ai.selectSession(main.id)
  }
}
</script>

<template>
  <aside class="claude-sidebar">
    <!-- 顶部品牌区：收起成窄轨时整块让位（那一格只有图标，放不下字） -->
    <div v-if="!isRail" class="sidebar-brand">
      <span class="brand-name">{{ APP_SIDEBAR.TITLE }}</span>
    </div>

    <!-- 主导航区域 -->
    <nav class="primary-nav">
      <template v-for="(section, si) in sections" :key="si">
        <div v-if="si > 0" class="nav-divider" role="separator" />
        <div class="nav-section">
          <button
            v-for="item in section"
            :key="item.key"
            type="button"
            class="nav-tab-btn stream-safe"
            :class="{ active: isActive(item) }"
            :title="item.label"
            :aria-label="badgeOf(item)?.aria"
            :aria-current="isActive(item) ? 'page' : undefined"
            @click="navigate(item.path)"
          >
            <span class="nav-icon">
              <svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path :d="item.icon" />
              </svg>
            </span>
            <span v-if="!isRail" class="nav-label">{{ item.label }}</span>
            <span v-if="badgeOf(item)" class="nav-badge" :class="{ accent: badgeOf(item)?.accent, dot: isRail }" aria-hidden="true">{{ isRail ? '' : badgeOf(item)?.text }}</span>
          </button>
        </div>
      </template>
    </nav>

     



    <div v-if="route.path === '/ai' && !isRail" class="ai-sidebar-lists">
      <!-- 固定主学习伙伴入口（不可删除，高保真主会话） -->
      <button
        type="button"
        class="ai-sidebar-main-entry"
        :class="{ active: isMainSession(ai.currentSessionId) }"
        :title="STUDY_COPY.NAV.MAIN_CHAT_PINNED"
        @click="selectMainSession"
      >
        <MiIcon class="main-pin-icon" name="star" :size="14" filled />
        <span class="main-label">{{ STUDY_COPY.NAV.MAIN_CHAT_PINNED }}</span>
      </button>

      <button type="button" class="ai-sidebar-new" @click="ai.newSession()">
        <span class="ai-new-plus" aria-hidden="true">+</span>
        <span>{{ STUDY_COPY.NAV.NEW_TOPIC }}</span>
      </button>

      <div class="ai-sidebar-history">
        <div class="ai-sidebar-heading"><span>{{ STUDY_COPY.NAV.TOPIC_CHATS }}</span></div>
        <div class="ai-sidebar-scroll">
          <div
            v-for="s in ai.sessions.filter(item => !isMainSession(item.id))"
            :key="s.id"
            class="ai-session-row"
            :class="{ active: s.id === ai.currentSessionId }"
          >
            <button type="button" class="ai-sidebar-item" :title="s.title" @click="ai.selectSession(s.id)">{{ s.title || AI_ASSISTANT.DEFAULT_SESSION_TITLE }}</button>
            <button v-if="s.id !== ai.mainSession?.id" type="button" class="ai-sidebar-add" :title="AI_ASSISTANT.DELETE_SESSION" :aria-label="`${AI_ASSISTANT.DELETE_SESSION}: ${s.title}`" @click="ai.deleteSession(s.id)">&times;</button>
          </div>
        </div>
      </div>
    </div>

    <div class="sidebar-footer">
      <button
        type="button"
        class="footer-settings-btn"
        :class="{ active: route.path === '/settings' }"
        :title="APP_SIDEBAR.NAV_SETTINGS"
        @click="navigate('/settings')"
      >
        <span class="footer-icon">
          <svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </span>
        <span v-if="!isRail" class="footer-label">{{ APP_SIDEBAR.NAV_SETTINGS }}</span>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.claude-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding-top: var(--mi-topbar-h);
  background: var(--mi-shell-sidebar, var(--mi-card));
  border-inline-end: 1px solid var(--mi-border);
  box-sizing: border-box;
  user-select: none;
}

.sidebar-brand {
  padding: var(--mi-sp-3) var(--mi-sp-4) var(--mi-sp-2);
  flex-shrink: 0;
}

.brand-name {
  font-family: var(--mi-font-title);
  font-size: var(--mi-fs-body);
  font-weight: 500;
  color: var(--mi-text);
  letter-spacing: -0.01em;
}

.primary-nav {
  display: flex;
  flex-direction: column;
  padding: 4px var(--mi-nav-pad-x) 8px;
  flex-shrink: 0;
}

.nav-section {
  display: flex;
  flex-direction: column;
  gap: var(--mi-nav-row-gap);
}

/* 分组分隔线：1px，上下 12，左右缩进 12（docs/31 §1.1） */
.nav-divider {
  height: 1px;
  margin: var(--mi-sp-3);
  background: var(--mi-border);
}

.nav-tab-btn {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--mi-nav-icon-gap);
  width: 100%;
  height: var(--mi-nav-row-h);
  padding: 0 var(--mi-nav-pad-x);
  border-radius: var(--mi-radius);
  background: transparent;
  border: none;
  font-size: var(--mi-fs-body);
  font-weight: 400;
  color: var(--mi-text-2);
  cursor: pointer;
  transition: background-color var(--mi-dur-fast) var(--mi-ease),
    color var(--mi-dur-fast) var(--mi-ease);
  text-align: left;
}

.nav-tab-btn:hover {
  background: var(--cds-fill-ghost-hover);
  color: var(--mi-text);
}

.nav-tab-btn.active {
  background: var(--cds-fill-ghost-selected);
  color: var(--mi-text);
  font-weight: 500;
}

.nav-icon,
.footer-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--mi-nav-leading);
  height: var(--mi-nav-leading);
  flex-shrink: 0;
}

.icon-svg {
  width: var(--mi-nav-icon);
  height: var(--mi-nav-icon);
  stroke-linecap: round;
  stroke-linejoin: round;
}

.nav-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.nav-badge {
  flex-shrink: 0;
  min-width: 20px;
  height: 18px;
  padding: 0 6px;
  box-sizing: border-box;
  border-radius: 9px;
  background: var(--mi-blue);
  color: var(--mi-text-2);
  font-size: var(--mi-fs-caption);
  font-weight: 500;
  line-height: 18px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.nav-badge.accent {
  background: var(--mi-blue-deep);
  color: var(--mi-btn-primary-text);
}
/* 图标窄栏：徽标收成图标右上角 6px 圆点 */
.nav-badge.dot {
  position: absolute;
  top: 8px;
  left: calc(50% + 6px);
  min-width: 0;
  width: 6px;
  height: 6px;
  padding: 0;
  border-radius: 50%;
}

.ai-sidebar-lists {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: var(--mi-group-gap-top) var(--mi-nav-pad-x) 0;
  gap: var(--mi-sp-1);
}

.ai-sidebar-main-entry {
  display: flex;
  align-items: center;
  gap: var(--mi-nav-icon-gap);
  width: 100%;
  height: var(--mi-nav-row-h);
  padding: 0 var(--mi-nav-pad-x);
  border: 0;
  border-radius: var(--mi-radius);
  background: transparent;
  color: var(--mi-text-2);
  font: inherit;
  font-size: var(--mi-fs-label);
  text-align: left;
  cursor: pointer;
  box-sizing: border-box;
  transition: all var(--mi-dur-fast) var(--mi-ease);
}

.ai-sidebar-main-entry:hover {
  background: var(--cds-fill-ghost-hover);
}

.ai-sidebar-main-entry.active {
  background: var(--cds-fill-ghost-selected);
  color: var(--mi-text);
  font-weight: 500;
}

.main-pin-icon {
  color: var(--mi-text-3);
}

/* 键盘焦点环：切回窗口时也会出现，保持可见但不抢眼（--mi-border-control 对比度 ≥3:1） */
.nav-tab-btn:focus-visible,
.ai-sidebar-main-entry:focus-visible {
  outline: 1.5px solid var(--mi-border-control);
  outline-offset: -1.5px;
}

.main-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-sidebar-new {
  display: flex;
  align-items: center;
  gap: var(--mi-nav-icon-gap);
  width: 100%;
  height: var(--mi-nav-row-h);
  padding: 0 var(--mi-nav-pad-x);
  border: 0;
  border-radius: var(--mi-radius);
  background: transparent;
  color: var(--mi-text);
  font: inherit;
  font-size: var(--mi-fs-body);
  text-align: left;
  cursor: pointer;
  transition: background-color var(--mi-dur-fast) var(--mi-ease);
}

.ai-sidebar-new:hover {
  background: var(--cds-fill-ghost-hover);
}

.ai-new-plus {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--mi-nav-leading);
  font-size: var(--mi-fs-read);
  color: var(--mi-text-2);
}

.ai-sidebar-history {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.ai-sidebar-heading {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px var(--mi-nav-pad-x);
  margin-top: var(--mi-sp-2);
  border: 0;
  background: transparent;
  color: var(--mi-text-3);
  font: inherit;
  font-size: var(--mi-group-font);
  text-align: left;
}

.ai-sidebar-scroll {
  overflow: auto;
  min-height: 0;
}

.ai-session-row {
  display: flex;
  align-items: center;
  border-radius: var(--mi-radius);
}

.ai-session-row:hover,
.ai-session-row.active {
  background: var(--cds-fill-ghost-hover);
}

.ai-sidebar-item {
  flex: 1;
  display: block;
  width: 100%;
  min-width: 0;
  height: var(--mi-nav-row-h);
  padding: 0 var(--mi-nav-pad-x);
  border: 0;
  background: transparent;
  color: var(--mi-text-2);
  font-family: inherit;
  font-size: var(--mi-fs-body);
  font-weight: 400;
  line-height: var(--mi-nav-row-h);
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
}

.ai-sidebar-item:hover {
  background: var(--cds-fill-ghost-hover);
  color: var(--mi-text);
}

.ai-session-row.active .ai-sidebar-item {
  background: transparent;
  color: var(--mi-text);
  font-weight: 400;
}

.ai-sidebar-add {
  border: 0;
  background: transparent;
  color: var(--mi-text-3);
  cursor: pointer;
  font-size: var(--mi-fs-read);
  padding: 2px var(--mi-sp-2);
  border-radius: 6px;
  visibility: hidden;
}

.ai-session-row:hover .ai-sidebar-add,
.ai-session-row.active .ai-sidebar-add,
.ai-session-row:focus-within .ai-sidebar-add {
  visibility: visible;
}

.ai-sidebar-lists button:focus-visible {
  outline: 2px solid var(--mi-text);
  outline-offset: 1px;
}

.ai-sidebar-lists button:focus:not(:focus-visible) {
  outline: none;
}

.sidebar-footer {
  margin-top: auto;
  padding: 8px var(--mi-nav-pad-x);
  background: transparent;
}

.footer-settings-btn {
  display: flex;
  align-items: center;
  gap: var(--mi-nav-icon-gap);
  width: 100%;
  height: var(--mi-nav-row-h);
  padding: 0 var(--mi-nav-pad-x);
  border-radius: var(--mi-radius);
  background: transparent;
  border: none;
  font-size: var(--mi-fs-body);
  color: var(--mi-text-2);
  cursor: pointer;
  transition: background-color var(--mi-dur-fast) var(--mi-ease),
    color var(--mi-dur-fast) var(--mi-ease);
}

.footer-settings-btn:hover {
  background: var(--cds-fill-ghost-hover);
  color: var(--mi-text);
}

.footer-settings-btn.active {
  background: var(--cds-fill-ghost-selected);
  color: var(--mi-text);
  font-weight: 500;
}
</style>
