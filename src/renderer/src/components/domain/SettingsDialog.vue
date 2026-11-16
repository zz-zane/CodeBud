<script setup lang="ts">
import MiIcon, { type MiIconName } from '../base/MiIcon.vue'
import UpdateBanner from './UpdateBanner.vue'
/**
 * 设置面板（2026-10-28 主人要求：点设置开一个覆盖当前页面的大面板）。
 *
 * 【为什么是面板而不是页面】它盖在当前页上，底下的课文 / 练习代码 / AI 会话
 * 一律不卸载 —— 关掉后仍在原课文、原滚动位置、原会话。开关状态在
 * stores/settings-dialog.ts，`/settings` 地址由 lib/settings-dialog-route.ts
 * 的守卫翻译成「记下背景 + 开面板」，所以侧栏、RunnerPanel、桌宠菜单
 * （/settings?card=…）、旧 /login 重定向全走同一条路。
 *
 * 【布局】照 T3 Code 设置页的骨架：顶部一行「设置 / 当前分类」+ 右上关闭，
 * 下面左右两栏（左：搜索 + 五个分类；右：该类设置，独立滚动）。
 * 颜色一律用本项目的 --mi-* 令牌，不搬 T3 的配色。
 *
 * 【焦点】复用 MiModal：遮罩、Esc、焦点陷阱、关闭后还原焦点都由它负责。
 * 背景的 inert 由 App.vue 设（面板 Teleport 到 body，不在背景树里）。
 */
import { computed, ref } from 'vue'
import SettingsView from '../../views/SettingsView.vue'
import SettingsRemote from './SettingsRemote.vue'
import { isRemote } from '../../lib/asset-base'
import MiModal from '../base/MiModal.vue'
import { SETTINGS, TITLE } from '../../lib/copy'
import { useSettingsDialogStore, type SettingsCard } from '../../stores/settings-dialog'

const dialog = useSettingsDialogStore()

const cards: { key: SettingsCard; label: string; icon: MiIconName }[] = [
  { key: 'appearance', label: SETTINGS.TAB_APPEARANCE, icon: 'sun' },
  { key: 'editor', label: SETTINGS.TAB_EDITOR, icon: 'code' },
  { key: 'study', label: SETTINGS.TAB_STUDY, icon: 'repeat' },
  { key: 'env', label: SETTINGS.TAB_ENV, icon: 'terminal' },
  { key: 'ai', label: SETTINGS.TAB_AI, icon: 'sparkles' },
  { key: 'remote', label: SETTINGS.TAB_REMOTE, icon: 'plug' },
  { key: 'about', label: SETTINGS.TAB_ABOUT, icon: 'info' }
]

/**
 * 手机浏览器里只留不依赖本机能力的分类（docs/29 §3.5）：环境检测、AI Key、手机连接
 * 都走白名单外的通道，在手机上直接不显示。
 */
const REMOTE_HIDDEN: SettingsCard[] = ['env', 'ai', 'remote', 'about']

const query = ref('')

/** 只按分类名过滤 —— 没有「按关键词搜到某一行设置」的假能力 */
const visibleCards = computed(() => {
  const q = query.value.trim().toLowerCase()
  const shown = isRemote() ? cards.filter((c) => !REMOTE_HIDDEN.includes(c.key)) : cards
  if (!q) return shown
  return shown.filter((c) => c.label.toLowerCase().includes(q))
})

const currentLabel = computed(() => cards.find((c) => c.key === dialog.card)?.label ?? '')

/** 顶部那行面包屑；同时当 MiModal 的 aria-label（读屏念出来是谁） */
const heading = computed(() => `${TITLE.SETTINGS} / ${currentLabel.value}`)

function close(): void {
  dialog.close()
}
</script>

<template>
  <MiModal
    :visible="dialog.open"
    :title="heading"
    :width="1120"
    class="settings-dialog-host"
    @update:visible="(v: boolean) => { if (!v) close() }"
  >
    <div class="settings-dialog">
      <aside class="settings-nav">
        <div class="settings-search-wrap">
          <svg class="settings-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" />
          </svg>
          <input
            v-model="query"
            type="search"
            class="settings-search"
            :aria-label="SETTINGS.SEARCH_PLACEHOLDER"
            :placeholder="SETTINGS.SEARCH_PLACEHOLDER"
          />
        </div>
        <nav class="settings-cards" :aria-label="TITLE.SETTINGS">
          <button
            v-for="c in visibleCards"
            :key="c.key"
            type="button"
            class="settings-nav-item"
            :class="{ active: dialog.card === c.key }"
            :aria-current="dialog.card === c.key ? 'page' : undefined"
            @click="dialog.card = c.key"
          >
            <MiIcon :name="c.icon" :size="15" />
            {{ c.label }}
          </button>
          <p v-if="visibleCards.length === 0" class="settings-nav-empty">{{ SETTINGS.SEARCH_EMPTY }}</p>
        </nav>
      </aside>

      <div class="settings-content" data-settings-scroll>
        <UpdateBanner class="settings-update-banner" />
        <SettingsRemote v-if="dialog.card === 'remote'" />
        <SettingsView v-else :card="dialog.card" />
      </div>
    </div>
  </MiModal>
</template>

<style scoped>
/*
 * 配色与主页同源（2026-10-28 主人要求）：
 *   右侧内容 = 主页正文底色 --mi-shell-canvas（浅色 #fbfbf9）
 *   左侧导航 = 主页侧栏底色 --mi-shell-sidebar（浅色 #f8f8f6）
 * 面板 Teleport 到 body，cds-adapter 里那些规则都挂在 `#app .claude-app-container`
 * 之下、命中不到这里，所以必须在本组件自己声明 —— 只依赖 :root 上的令牌变量。
 */
:global(.mi-modal:has(.settings-dialog)) {
  background: var(--mi-shell-canvas);
  overflow: hidden;
}
:global(.mi-modal:has(.settings-dialog) .mi-modal-head) {
  background: var(--mi-shell-canvas);
}
:global(.mi-modal:has(.settings-dialog) .mi-modal-body) {
  display: flex;
  flex: 1;
  min-height: 0;
  padding: 0;
  overflow: hidden;
}

.settings-dialog {
  display: flex;
  height: min(660px, calc(100vh - 180px));
  min-height: 0;
  width: 100%;
  /* 面板本体：与主画布同色，圆角来自 MiModal 自己的 --mi-radius-lg */
  background: var(--mi-shell-canvas);
}

.settings-nav {
  width: 228px;
  box-sizing: border-box;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: var(--mi-sp-4);
  padding: var(--mi-sp-4) var(--mi-sp-4) var(--mi-sp-4) var(--mi-sp-4);
  /* 侧栏一块与主页侧栏同色；分隔线保留，保证层级还在 */
  background: var(--mi-shell-sidebar);
  border-right: 1px solid var(--mi-border);
  overflow-y: auto;
}

.settings-search-wrap {
  position: relative;
  display: flex;
  align-items: center;
}

.settings-search-icon {
  position: absolute;
  left: 10px;
  width: 15px;
  height: 15px;
  color: var(--mi-text-3);
  pointer-events: none;
}

.settings-search {
  width: 100%;
  box-sizing: border-box;
  padding: var(--mi-sp-2) var(--mi-sp-3) var(--mi-sp-2) 31px;
  border: 1px solid var(--mi-border);
  border-radius: var(--mi-radius-sm);
  background: var(--mi-bg);
  color: var(--mi-text);
  font-size: var(--mi-fs-body);
}

/* 鼠标点进来不画黑/橙框；键盘焦点用中性令牌色描边（见 :focus-visible） */
.settings-search:focus {
  outline: none;
  border-color: var(--mi-border-control);
}

.settings-cards {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.settings-nav-item {
  text-align: left;
  padding: var(--mi-sp-2) var(--mi-sp-3);
  border: 0;
  border-radius: var(--mi-radius-sm);
  background: transparent;
  color: var(--mi-text-2);
  font-size: var(--mi-fs-body);
  cursor: pointer;
  transition: background var(--mi-dur-fast) ease;
}

.settings-nav-item:hover {
  background: var(--mi-blue-light);
  color: var(--mi-text);
}

.settings-nav-item.active {
  background: var(--cds-fill-ghost-selected);
  color: var(--mi-text);
  font-weight: 500;
}

.settings-nav-empty {
  font-size: var(--mi-fs-label);
  color: var(--mi-text-3);
  padding: var(--mi-sp-1) var(--mi-sp-3);
}

.settings-content {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  padding: var(--mi-sp-4) var(--mi-sp-4) var(--mi-sp-4) var(--mi-sp-6);
  /* 主内容区与主页正文同色（浅色 #fbfbf9，暗色跟 --cds-surface-1 走） */
  background: var(--mi-shell-canvas);
}
.settings-content::-webkit-scrollbar { width: 5px; }
.settings-content::-webkit-scrollbar-track { background: transparent; }
.settings-content::-webkit-scrollbar-thumb { background: color-mix(in srgb, var(--mi-text-3) 40%, transparent); border-radius: 999px; }
.settings-content::-webkit-scrollbar-thumb:hover { background: color-mix(in srgb, var(--mi-text-3) 65%, transparent); }
.settings-nav-item { display: flex; align-items: center; gap: var(--mi-sp-2); }
.settings-update-banner { margin-bottom: var(--mi-sp-4); }
</style>
