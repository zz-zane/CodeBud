<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAiAssistantStore } from '../../stores/ai-assistant'
import { APP_SIDEBAR, AI_ASSISTANT } from '../../lib/copy'
import { NAV_ITEMS, isNavActive, navSections } from '../../lib/nav-items'
import { STUDY_MAIN_SESSION_ID } from '../../stores/study'
import { STUDY_COPY } from '../../lib/study-copy'

// rail 态由 App.vue 传入，侧栏只负责隐藏文字；顶栏按钮直接在展开与隐藏间切换。
const props = withDefaults(defineProps<{ isRail?: boolean }>(), { isRail: false })

const ai = useAiAssistantStore()
const route = useRoute()
const router = useRouter()

const isRail = computed(() => props.isRail)

// 2026-11-21 用户要求去掉侧栏右侧数字徽标（到期数在「今天」页与复习页仍可见）
const sections = navSections(NAV_ITEMS)

// 选中底块：一块绝对定位的底色在导航项之间滑动，而不是各按钮自己瞬切背景。
// 用 offsetTop（不受 transform 影响）量当前 .active；不在主导航里（如 /settings）就隐藏。
const navRef = ref<HTMLElement | null>(null)
const pill = ref<{ x: number; y: number; w: number; h: number } | null>(null)
function syncPill(): void {
  const el = navRef.value?.querySelector<HTMLElement>('.nav-tab-btn.active')
  pill.value = el ? { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight } : null
}
onMounted(syncPill)
watch(() => [route.path, isRail.value], () => void nextTick(syncPill))

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
    <nav ref="navRef" class="primary-nav">
      <span
        v-if="pill"
        class="nav-active-pill"
        aria-hidden="true"
        :style="{ transform: `translate(${pill.x}px, ${pill.y}px)`, width: `${pill.w}px`, height: `${pill.h}px` }"
      />
      <template v-for="(section, si) in sections" :key="si">
        <div v-if="si > 0" class="nav-divider" role="separator" />
        <div class="nav-section">
          <button
            v-for="item in section"
            :key="item.key"
            type="button"
            class="nav-tab-btn stream-safe"
            :class="{ active: isActive(item) }"
            :data-nav="item.key"
            :title="item.label"
            :aria-current="isActive(item) ? 'page' : undefined"
            @click="navigate(item.path)"
          >
            <span class="nav-icon">
              <svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path :d="item.icon" pathLength="1" />
              </svg>
            </span>
            <span v-if="!isRail" class="nav-label">{{ item.label }}</span>
          </button>
        </div>
      </template>
    </nav>

     



    <!-- AI 页会话区：主聊天 / 新建与主导航同一行规格；「最近对话」是靠左、小一号的次级清单 -->
    <div v-if="route.path === '/ai' && !isRail" class="ai-sidebar-lists">
      <div class="nav-divider" role="separator" />
      <!-- 固定主学习伙伴入口（不可删除，高保真主会话） -->
      <button
        type="button"
        class="ai-sidebar-main-entry"
        :class="{ active: isMainSession(ai.currentSessionId) }"
        :title="STUDY_COPY.NAV.MAIN_CHAT_PINNED"
        @click="selectMainSession"
      >
        <span class="nav-icon">
          <svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" pathLength="1" />
          </svg>
        </span>
        <span class="main-label">{{ STUDY_COPY.NAV.MAIN_CHAT_PINNED }}</span>
      </button>

      <button type="button" class="ai-sidebar-new" @click="ai.newSession()">
        <span class="nav-icon">
          <svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
        <span class="main-label">{{ STUDY_COPY.NAV.NEW_TOPIC }}</span>
      </button>

      <div class="ai-sidebar-history">
        <div class="ai-sidebar-heading"><span>{{ STUDY_COPY.NAV.TOPIC_CHATS }}</span></div>
        <div v-auto-animate class="ai-sidebar-scroll">
          <div
            v-for="s in ai.sessions.filter(item => !isMainSession(item.id))"
            :key="s.id"
            class="ai-session-row"
            :class="{ active: s.id === ai.currentSessionId }"
          >
            <button type="button" class="ai-sidebar-item" :title="s.title" @click="ai.selectSession(s.id)">{{ s.title || AI_ASSISTANT.DEFAULT_SESSION_TITLE }}</button>
            <button v-if="s.id !== ai.mainSession?.id" type="button" class="ai-sidebar-add" :title="AI_ASSISTANT.DELETE_SESSION" :aria-label="`${AI_ASSISTANT.DELETE_SESSION}: ${s.title}`" @click="ai.deleteSession(s.id)">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" /></svg>
            </button>
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
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 4px var(--mi-nav-pad-x) 8px;
  flex-shrink: 0;
}

/* 滑动选中底块：快速吸附曲线、不回弹（frontend-ui-polish：Tab/滑块吸附 ≈120ms 档，取 --mi-dur 180ms 让位移看得清）。
   v-if 首次出现时直接落在目标位，不会从 0 滑下来；减弱动效由 motion.css 总闸压成瞬切。 */
.nav-active-pill {
  position: absolute;
  top: 0;
  left: 0;
  border-radius: var(--mi-radius);
  background: var(--cds-fill-ghost-selected);
  pointer-events: none;
  transition:
    transform var(--mi-dur) cubic-bezier(0.32, 0.72, 0, 1),
    height var(--mi-dur) cubic-bezier(0.32, 0.72, 0, 1);
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

/* 选中底色由 .nav-active-pill 提供；按钮自身保持透明，否则两层叠色 */
.nav-tab-btn.active {
  background: transparent;
  color: var(--mi-text);
  font-weight: 500;
}

/* ── 图标动效（frontend-ui-polish：hover 微反馈、点击 60ms 轻压、轻回弹只给图标不给文字）──
 * 悬停：每个图标做一个「贴合含义」的小动作（房子上跳、书翻页、刷新转半圈、齿轮转 90° …），
 *       幅度 ≤ 2px / 180°，回弹曲线 cubic-bezier(.34,1.3,.64,1)。
 * 按下：统一缩到 0.86，60ms。
 * 选中：线条从头描一遍（pathLength=1 + dashoffset）再轻弹到位 —— 告诉用户「切到这里了」。
 * 减弱动效：motion.css 总闸把 transition / animation 压成 1ms，图标直接停在终态。 */
.nav-icon,
.footer-icon,
.icon-svg {
  transition: transform var(--mi-dur) cubic-bezier(0.34, 1.3, 0.64, 1);
}
:is(.nav-tab-btn, .ai-sidebar-main-entry):hover .nav-icon { transform: translateY(-1px) scale(1.08); }
.nav-tab-btn[data-nav='today']:hover .nav-icon { transform: translateY(-2px); }
.nav-tab-btn[data-nav='courses']:hover .nav-icon { transform: rotate(-8deg) scale(1.05); }
.nav-tab-btn[data-nav='practice']:hover .nav-icon { transform: scaleX(1.18); }
.nav-tab-btn[data-nav='review']:hover .nav-icon { transform: rotate(-180deg); transition-duration: var(--mi-dur-slow); }
.nav-tab-btn[data-nav='cet6']:hover .nav-icon { transform: translateY(-2px) rotate(-10deg); }
.nav-tab-btn[data-nav='ai']:hover .nav-icon { transform: none; animation: mi-icon-wiggle 420ms ease-in-out; }
.nav-tab-btn[data-nav='overview']:hover .nav-icon { transform: none; }
.nav-tab-btn[data-nav='overview']:hover .icon-svg { transform: scaleY(1.15); transform-origin: 50% 90%; }
.ai-sidebar-main-entry:hover .nav-icon { transform: rotate(72deg) scale(1.08); transition-duration: var(--mi-dur-slow); }
.ai-sidebar-new:hover .nav-icon { transform: rotate(90deg); }
.footer-settings-btn:hover .footer-icon { transform: rotate(90deg); transition-duration: var(--mi-dur-slow); }

/* 按下：特异性要压过上面的 [data-nav] 悬停规则，所以带上属性选择器 */
.nav-tab-btn[data-nav]:active .nav-icon,
:is(.ai-sidebar-main-entry, .ai-sidebar-new, .footer-settings-btn):active :is(.nav-icon, .footer-icon) {
  transform: scale(0.86);
  transition-duration: 60ms;
}

/* 选中：描线 + 轻弹。只在 .active 挂上的那一刻播一次 */
:is(.nav-tab-btn, .ai-sidebar-main-entry).active .icon-svg {
  animation: mi-icon-pop 360ms cubic-bezier(0.34, 1.3, 0.64, 1);
}
:is(.nav-tab-btn, .ai-sidebar-main-entry).active .icon-svg path {
  animation: mi-icon-draw 520ms var(--mi-ease-out);
}
@keyframes mi-icon-pop {
  from { transform: scale(0.8); }
}
@keyframes mi-icon-draw {
  from { stroke-dasharray: 1 1; stroke-dashoffset: 1; }
  to { stroke-dasharray: 1 1; stroke-dashoffset: 0; }
}
@keyframes mi-icon-wiggle {
  25% { transform: rotate(-10deg); }
  50% { transform: rotate(8deg); }
  75% { transform: rotate(-4deg); }
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

/* AI 会话区：主聊天 / 新建两行与主导航同一套行规格；下面的「最近对话」是次级清单，
   靠左对齐图标列、字号小一档 —— 缩进到文字列时左边没有图标撑着，看起来是悬空的（2026-11-21 用户反馈） */
.ai-sidebar-lists {
  /* 图标笔画左缘：图标在 leading 方框里居中，字从这里起笔，和上面图标是一条竖线 */
  --ai-glyph-inset: calc(var(--mi-nav-pad-x) + (var(--mi-nav-leading) - var(--mi-nav-icon)) / 2);
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0 var(--mi-nav-pad-x);
  gap: var(--mi-nav-row-gap);
}

.ai-sidebar-lists > .nav-divider {
  margin-top: 4px;
}

.ai-sidebar-main-entry,
.ai-sidebar-new {
  display: flex;
  flex-shrink: 0;
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
  font-size: var(--mi-fs-body);
  text-align: left;
  cursor: pointer;
  box-sizing: border-box;
  transition: background-color var(--mi-dur-fast) var(--mi-ease),
    color var(--mi-dur-fast) var(--mi-ease);
}

.ai-sidebar-main-entry:hover,
.ai-sidebar-new:hover {
  background: var(--cds-fill-ghost-hover);
  color: var(--mi-text);
}

.ai-sidebar-main-entry.active {
  background: var(--cds-fill-ghost-selected);
  color: var(--mi-text);
  font-weight: 500;
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

.ai-sidebar-history {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.ai-sidebar-heading {
  padding: var(--mi-sp-4) var(--mi-nav-pad-x) var(--mi-sp-1) var(--ai-glyph-inset);
  color: var(--mi-text-3);
  font-size: var(--mi-group-font);
}

.ai-sidebar-scroll {
  overflow: auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* 底色只挂在整行上：以前行和按钮各有一层 hover 底，悬停时叠成两块深浅不一的色 */
.ai-session-row {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  border-radius: var(--mi-radius);
  transition: background-color var(--mi-dur-fast) var(--mi-ease);
}

.ai-session-row:hover {
  background: var(--cds-fill-ghost-hover);
}

.ai-session-row.active {
  background: var(--cds-fill-ghost-selected);
}

.ai-sidebar-item {
  flex: 1;
  min-width: 0;
  height: 32px;
  padding: 0 var(--mi-sp-1) 0 var(--ai-glyph-inset);
  border: 0;
  background: transparent;
  color: var(--mi-text-2);
  font-family: inherit;
  font-size: var(--mi-fs-label);
  font-weight: 400;
  line-height: 32px;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  transition: color var(--mi-dur-fast) var(--mi-ease);
}

.ai-session-row:hover .ai-sidebar-item,
.ai-session-row.active .ai-sidebar-item {
  color: var(--mi-text);
}

/* 删除键：只在悬停 / 键盘进入这一行时缩放弹出（选中行不常驻，免得每次都盯着一个 ×）；
   收起时等缩完再隐藏（visibility 延迟） */
.ai-sidebar-add {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-right: var(--mi-sp-1);
  padding: 0;
  border: 0;
  border-radius: var(--mi-radius-sm);
  background: transparent;
  color: var(--mi-text-3);
  cursor: pointer;
  visibility: hidden;
  transform: scale(0.6);
  transition:
    transform var(--mi-dur-fast) var(--mi-ease-out),
    background-color var(--mi-dur-fast) var(--mi-ease),
    color var(--mi-dur-fast) var(--mi-ease),
    visibility 0s linear var(--mi-dur-fast);
}

.ai-sidebar-add svg {
  width: 14px;
  height: 14px;
}

.ai-sidebar-add:hover {
  background: var(--cds-fill-ghost-selected);
  color: var(--mi-text);
}

.ai-session-row:hover .ai-sidebar-add,
.ai-session-row:focus-within .ai-sidebar-add {
  visibility: visible;
  transform: scale(1);
  transition-delay: 0s;
}

/* 焦点环画在按钮内侧：外扩的环会被 .ai-sidebar-scroll 的 overflow 裁掉，只剩右边一条黑竖线 */
.ai-sidebar-lists button:focus-visible {
  outline: 1.5px solid var(--mi-border-control);
  outline-offset: -1.5px;
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
