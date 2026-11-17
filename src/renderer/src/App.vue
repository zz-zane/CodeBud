<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Sidebar from './components/domain/Sidebar.vue'
import RightPanel from './components/domain/RightPanel.vue'
import QuizOverlay from './components/domain/quiz/QuizOverlay.vue'
import NativeRunConfirm from './components/domain/NativeRunConfirm.vue'
import VideoHost from './components/domain/video/VideoHost.vue'
import TopBar from './components/domain/TopBar.vue'
import PhoneTabBar from './components/domain/PhoneTabBar.vue'
import MiToast from './components/base/MiToast.vue'
import AiContextMenu from './components/domain/AiContextMenu.vue'
import SettingsDialog from './components/domain/SettingsDialog.vue'
import { useAiAssistantStore } from './stores/ai-assistant'
import { useCet6Store } from './stores/cet6'
import { useContentStore } from './stores/content'
import { useSettingsStore } from './stores/settings'
import { useSettingsDialogStore } from './stores/settings-dialog'
import { useQuizStore } from './stores/quiz'
import { useStudyStore } from './stores/study'
import { useProgressStore } from './stores/progress'
import { usePracticeStore } from './stores/practice'
import { isStudyRoute } from '../../shared/study-companion'
import { weakLessonsByMastery } from '../../shared/mastery'
import { useAppHistory } from './lib/app-history'
import { sidebarModeOf } from '../../shared/layout'
import { AI_ASSISTANT, APP_SIDEBAR, LAYOUT, PAGE_NAV, PHONE, TODAY } from './lib/copy'
import { STUDY_COPY } from './lib/study-copy'
import { installKeyboardInset, type KbWindow } from './lib/keyboard-inset'
import { installPhoneFocus } from './lib/phone-focus'
import { installOverlayRouterGuard, usePhoneBackClose } from './lib/phone-back-close'
import { directionOf, isDetailRoute, parentRouteOf, slideKind, type SlideDir } from './lib/phone-nav'
import { createScrollMemory } from './lib/scroll-memory'

const content = useContentStore()
const settings = useSettingsStore()
const route = useRoute()
const router = useRouter()
const aiAssistant = useAiAssistantStore()
const cet6 = useCet6Store()
const settingsDialog = useSettingsDialogStore()
const quizStore = useQuizStore()
const appHistory = useAppHistory(router)
const aiBallRef = ref<HTMLButtonElement | null>(null)

const isBare = computed(() => route.meta.bare === true)
const isLessonPage = computed(() => route.name === 'lesson' && !!route.params.id)
const hasCurrentLesson = computed(() => isLessonPage.value && !!content.lessonOf(String(route.params.id)))
const isAiWorkspace = computed(() => route.name === 'ai')
const aiTitle = computed(() => aiAssistant.currentSession?.title || AI_ASSISTANT.DEFAULT_SESSION_TITLE)
// 六级考试模式（docs/27 §8.1）：做题期间收起侧栏、右栏、顶条入口，并停掉全局快捷键；App 是这个标志的唯一消费方
const examLock = computed(() => cet6.examLock)
const isFullBleed = computed(() => route.meta.fullBleed === true)
// /ai 自己就是聊天视图：同一时刻最多一个输入框，右栏 AI 在这里不渲染（DESIGN §6.1）
// 课文页右侧只可能是 AI 面板；收起 AI 后应完全收栏、恢复阅读宽度（ROOT-PLAN-v1 §6）
const shouldShowRightPanel = computed(
  () => !isAiWorkspace.value && aiAssistant.isOpen
)

// 手机宽度（≤768px，与 styles/phone.css 同一断点）：侧栏变抽屉、右栏变全屏层，版面规则全在 phone.css
const phoneMq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(max-width: 768px)') : null
const isPhone = ref(phoneMq?.matches ?? false)
const phoneNavOpen = ref(false)
// 软键盘不改布局：壳层高度恒为 100dvh（phone.css），键盘高度只写进 --mi-kb-inset，
// 由各输入区自己避让（lib/keyboard-inset.ts）。选中输入框后的露出 / 点空白收键盘在 lib/phone-focus.ts。
let disposeKb: (() => void) | null = null
let disposeFocus: (() => void) | null = null
function syncPhoneRuntime(): void {
  if (isPhone.value && !disposeKb) {
    disposeKb = installKeyboardInset(window as unknown as KbWindow, document.documentElement)
    disposeFocus = installPhoneFocus()
  } else if (!isPhone.value && disposeKb) {
    disposeKb()
    disposeFocus?.()
    disposeKb = disposeFocus = null
  }
}
function onPhoneMq(e: MediaQueryListEvent): void {
  isPhone.value = e.matches
  if (!e.matches) phoneNavOpen.value = false
  syncPhoneRuntime()
}

const sidebarMode = computed(() => sidebarModeOf(settings.config.layout))
const isRail = computed(() => !isPhone.value && sidebarMode.value === 'rail')
// 手机上抽屉的开合独立于桌面的 layout 配置（不写盘）
const sidebarHidden = computed(() => (isPhone.value ? !phoneNavOpen.value : sidebarMode.value === 'hidden'))

/**
 * 左上角面板按钮：只做两态 open ↔ hidden。
 * 2026-10-28 主人要求「点一下直接全部收缩」—— 不再走 rail 中间态，
 * 所以要打开时把 sidebarRail 一并复位，否则会停在图标栏。
 */
const toggleSidebarTip = computed(() =>
  sidebarHidden.value ? LAYOUT.EXPAND_SIDEBAR : LAYOUT.HIDE_SIDEBAR
)

function closePhoneNav(): void {
  phoneNavOpen.value = false
}

// 系统返回先关浮层：抽屉 / 手机上的全屏 AI 面板（设置、弹窗、答题层各自在自己的组件里挂）
const disposeGuard = installOverlayRouterGuard(router)
usePhoneBackClose(phoneNavOpen, closePhoneNav)
usePhoneBackClose(() => isPhone.value && shouldShowRightPanel.value, () => { aiAssistant.isOpen = false })

function toggleSidebar(): void {
  if (isPhone.value) {
    phoneNavOpen.value = !phoneNavOpen.value
    return
  }
  void settings.setLayout(
    sidebarHidden.value
      ? { sidebarOpen: true, sidebarRail: false }
      : { sidebarOpen: false, sidebarRail: false }
  )
}

const PHONE_TITLES: Record<string, string> = {
  today: TODAY.TITLE,
  ai: AI_ASSISTANT.TAB_ASSISTANT,
  study: STUDY_COPY.HUB_TITLE,
  courses: PHONE.TITLE_COURSES,
  practice: APP_SIDEBAR.NAV_PRACTICE,
  cet6: APP_SIDEBAR.NAV_CET6,
  'cet6-vocab': PHONE.TITLE_CET6_VOCAB,
  'cet6-exam': APP_SIDEBAR.NAV_CET6,
  favorites: PHONE.TITLE_FAVORITES,
  memo: PHONE.TITLE_MEMO,
  review: APP_SIDEBAR.NAV_REVIEW,
  overview: APP_SIDEBAR.NAV_OVERVIEW,
  settings: APP_SIDEBAR.NAV_SETTINGS
}
// 手机顶栏的当前页标题：课文页用课名，AI 页用会话名，其余用导航名
const phoneTitle = computed(() => {
  if (isLessonPage.value) return content.lessonOf(String(route.params.id))?.title ?? PHONE.TITLE_LESSON
  if (isAiWorkspace.value) return aiTitle.value
  return PHONE_TITLES[String(route.name ?? '')] ?? ''
})

const isQuizActive = computed(() => Boolean(quizStore.session))

// 手机底部标签栏：考试页 / 考试锁 / 全屏浮层（答题、AI 面板、设置）里不显示；键盘打开时由 phone.css 隐藏
const showTabBar = computed(
  () =>
    isPhone.value &&
    !isBare.value &&
    !examLock.value &&
    route.name !== 'cet6-exam' &&
    !isQuizActive.value &&
    !settingsDialog.open &&
    !shouldShowRightPanel.value
)
// 详情页：顶栏用返回键代替抽屉键
const isPhoneDetail = computed(() => isPhone.value && isDetailRoute(route.path))
function phoneGoBack(): void {
  appHistory.syncHistoryState()
  if (appHistory.canGoBack.value) router.back()
  else void router.replace(parentRouteOf(route.path))
}

// ── 手机页面切换：标签 ↔ 标签即时；进入详情 / 返回按历史方向滑动；返回时恢复滚动位置 ──
// 方向取自 vue-router 维护的 history.state.position：变大 = 前进，变小 = 后退
const slideName = ref<'' | 'mi-slide-fwd' | 'mi-slide-back'>('')
const navDir = ref<SlideDir>('none')
const scrollMemory = createScrollMemory()
let prevPos: unknown = typeof window !== 'undefined' ? window.history.state?.position : null
const reducedMotionMq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
function pageScroller(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.claude-app-container .content')
}
const disposeAfterEach = router.afterEach((to, from) => {
  const pos = window.history.state?.position
  const dir = directionOf(prevPos, pos)
  prevPos = pos
  navDir.value = dir
  if (!isPhone.value) return
  // 此刻 DOM 还没换页（渲染在下一个 flush），scrollTop 仍是离开页的
  if (from.fullPath !== to.fullPath) scrollMemory.save(from.fullPath, pageScroller()?.scrollTop ?? 0)
  const kind = slideKind(dir, from.path, to.path)
  slideName.value = reducedMotionMq?.matches ? '' : kind === 'fwd' ? 'mi-slide-fwd' : kind === 'back' ? 'mi-slide-back' : ''
})
// 离开的页面脱离文档流（固定在原位），新页面在流里滑入：两页同屏，布局不跳
function onRouteBeforeLeave(el: Element): void {
  if (!isPhone.value || !slideName.value || !(el instanceof HTMLElement)) return
  const r = el.getBoundingClientRect()
  el.style.cssText += `;position:fixed;top:${r.top}px;left:${r.left}px;width:${r.width}px;height:${r.height}px;margin:0;box-sizing:border-box;overflow:hidden;`
}
function restoreScroll(): void {
  const box = pageScroller()
  if (!isPhone.value || !box) return
  box.scrollTop = navDir.value === 'back' ? scrollMemory.get(route.fullPath) : 0
}
function onRouteEnter(): void {
  if (!isPhone.value) return
  restoreScroll()
  requestAnimationFrame(restoreScroll)
}
const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1200)
function onWindowResize(): void {
  windowWidth.value = window.innerWidth
}

const isAiRailOpen = computed(() => {
  if (aiAssistant.railPref === null) return windowWidth.value >= 1200
  return aiAssistant.railPref === 'open'
})

const isRightRailOpen = computed(() => {
  if (isAiWorkspace.value) {
    return isAiRailOpen.value
  }
  return aiAssistant.isOpen
})

const rightRailTip = computed(() => {
  if (isAiWorkspace.value) {
    return isAiRailOpen.value ? AI_ASSISTANT.RAIL_TOGGLE_HIDE : AI_ASSISTANT.RAIL_TOGGLE_SHOW
  }
  return aiAssistant.isOpen ? AI_ASSISTANT.COLLAPSE_PANEL : AI_ASSISTANT.OPEN_ASSISTANT
})

function toggleRightRail(): void {
  if (isAiWorkspace.value) {
    aiAssistant.railPref = isAiRailOpen.value ? 'closed' : 'open'
  } else {
    if (aiAssistant.isOpen) {
      aiAssistant.isOpen = false
    } else {
      openAiAssistantFromBall()
    }
  }
}
const shouldShowAiBall = computed(() => {
  if (isBare.value) return false
  if (isAiWorkspace.value) return false
  if (aiAssistant.isOpen) return false
  if (isQuizActive.value) return false
  if (settingsDialog.open) return false
  const p = route.path
  if (p === '/learn' || p === '/courses') return true
  if (isLessonPage.value && hasCurrentLesson.value) return true
  return false
})

function openAiAssistantFromBall(): void {
  // 首页/目录没有当前课文：不能把刚读过的旧课强当“当前正在学”
  if (!isLessonPage.value) {
    aiAssistant.setLessonContext(null)
  } else if (route.params.id) {
    const lessonId = String(route.params.id)
    const lesson = content.lessonOf(lessonId)
    if (lesson && content.statusOf(lessonId) !== 'draft') {
      aiAssistant.setLessonContext(lessonId)
    } else {
      aiAssistant.setLessonContext(null)
    }
  }
  aiAssistant.isOpen = true
  aiAssistant.activeTab = 'chat'
  nextTick(() => {
    const input = document.querySelector<HTMLTextAreaElement>('.ai-textarea')
    input?.focus()
  })
}

// 焦点回退：关闭 AI 助教后焦点回到悬浮小球
watch(
  () => aiAssistant.isOpen,
  (open, prev) => {
    if (!open && prev) {
      nextTick(() => {
        aiBallRef.value?.focus()
      })
    }
  }
)

// 课文页切换同步 context，检查数据就绪时序，学习/目录首页自动清除旧课文标签
watch(
  [
    () => route.path,
    () => route.params.id,
    () => (route.params.id ? content.lessonOf(String(route.params.id)) : null)
  ],
  ([path, id, lesson]) => {
    if (isLessonPage.value && id) {
      const lessonId = String(id)
      if (lesson && content.statusOf(lessonId) !== 'draft') {
        aiAssistant.setLessonContext(lessonId)
      } else {
        // 无效/草稿课程不沿用旧课
        aiAssistant.setLessonContext(null)
      }
    } else if (path === '/learn' || path === '/courses') {
      aiAssistant.setLessonContext(null)
    }
  },
  { immediate: true }
)

function onGlobalKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && phoneNavOpen.value) {
    closePhoneNav()
    return
  }
  if (isBare.value || e.isComposing || examLock.value) return
  // 设置面板开着时背景整块 inert，全局 Ctrl+K 不能再把焦点抢到背景搜索框。
  if (settingsDialog.open) return
  if (e.ctrlKey && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    const input = document.querySelector<HTMLInputElement>('[data-search=home]') ?? document.querySelector<HTMLInputElement>('[data-search=sidebar]')
    input?.dispatchEvent(new Event('search-keyboard-focus'))
    input?.focus()
  }
}

// 导航到别的页 / 选了别的会话后收起抽屉
watch(() => route.fullPath, closePhoneNav)
watch(() => aiAssistant.currentSessionId, closePhoneNav)

onMounted(() => {
  phoneMq?.addEventListener('change', onPhoneMq)
  syncPhoneRuntime()
  window.addEventListener('keydown', onGlobalKey)
  window.addEventListener('resize', onWindowResize)
  // AI store 只在这里初始化一次；init 本身幂等，视图挂载不再调用（DESIGN §6.1）
  void aiAssistant.init()

  // 监听主进程/AI发出的导航指令，校验后安全跳转
  window.addEventListener('miai-study-navigate', onStudyNavigate as EventListener)
  window.addEventListener('miai-study-refresh', refreshStudy)
  refreshStudy()
  if (!quizStore.wrongbookLoaded) void quizStore.loadWrongbook()
  if (!practice.loaded) void practice.load()
})

const studyStore = useStudyStore()
const progress = useProgressStore()
const practice = usePracticeStore()
function refreshStudy(): void { void studyStore.init() }

function onStudyNavigate(e: CustomEvent<{ route: string; lessonId?: string }>): void {
  if (examLock.value || !e.detail || typeof e.detail.route !== 'string') return
  const targetRoute = e.detail.route
  if (!isStudyRoute(targetRoute)) return
  if (targetRoute.startsWith('/lesson/')) {
    const id = targetRoute.split('?')[0].slice('/lesson/'.length)
    if (!content.lessonOf(id) || content.statusOf(id) === 'draft') return
    aiAssistant.setLessonContext(id)
    aiAssistant.isOpen = true
  }
  void router.push(targetRoute)
}

// 自动向主进程同步当前位置（debounce 500ms，初始化待 content 就绪）
watch(
  () => ({ path: route.path, id: isLessonPage.value ? String(route.params.id) : undefined,
    learned: [...progress.learnedSet], loaded: progress.loaded,
    practiceHistory: practice.history, practiceLoaded: practice.loaded,
    lessons: [...content.bundle.lessons, ...content.algoBundle.lessons].filter(l => content.statusOf(l.id) !== 'draft') }),
  ({ path, id, lessons, learned, loaded, practiceHistory, practiceLoaded }) => {
    if (!loaded || !lessons.length || !isStudyRoute(path)) return
    const lessonId = id
    const lesson = lessonId ? content.lessonOf(lessonId) : undefined
    if (lessonId && (!lesson || content.statusOf(lessonId) === 'draft')) return
    const known = new Set(lessons.map(l => l.id))
    const learnedIds = learned.filter(id => known.has(id))
    const weakLessons = practiceLoaded ? weakLessonsByMastery(practiceHistory, known) : []

    studyStore.syncPosition({
      route: path,
      lessonId,
      lessonTitle: lesson?.title,
      learnedCount: learnedIds.length,
      totalLessons: lessons.length,
      weakLessons,
      updatedAt: Date.now()
    }, 500)
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  phoneMq?.removeEventListener('change', onPhoneMq)
  disposeKb?.()
  disposeFocus?.()
  disposeGuard()
  disposeAfterEach()
  window.removeEventListener('miai-study-navigate', onStudyNavigate as EventListener)
  window.removeEventListener('miai-study-refresh', refreshStudy)
  appHistory.destroy()
  window.removeEventListener('keydown', onGlobalKey)
  window.removeEventListener('resize', onWindowResize)
  // 应用卸载：把所有会话里挂着的附件预览（object URL）释放掉。
  // 不释放的话，这些 blob 会一直挂在进程里直到窗口关闭 —— 换十次图就占十份内存。
  aiAssistant.disposeAllAttachments()
})
</script>

<template>
  <!-- 设置面板开着时整块背景 inert：键盘 Tab / 读屏都进不去，也不会被误点。
       面板本身 Teleport 到 body（MiModal），不在这棵树里，所以不受影响。 -->
  <div class="claude-app-container" :class="{ 'exam-locked': examLock, 'phone-panel-open': isPhone && shouldShowRightPanel, 'has-tabbar': showTabBar }" :inert="settingsDialog.open">
    <!-- 桌面顶栏（含窗口拖拽与系统控制按钮） -->
    <TopBar />
    <div v-if="isAiWorkspace && !isBare && !isPhone" class="ai-topbar" :class="{ 'is-rail': isRail, 'is-hidden': sidebarHidden }">
      <span class="ai-topbar-title" :title="aiTitle">{{ aiTitle }}</span>
    </div>

    <!-- 手机顶栏的当前页标题（桌面不渲染） -->
    <div v-if="isPhone && !isBare && !examLock" class="phone-title" :title="phoneTitle">{{ phoneTitle }}</div>

    <!-- 顶栏右侧全局操作组：右栏开关（避让原生窗口控制按钮） -->
    <div v-if="!isBare && !examLock" class="topbar-right-actions">
      <button
        type="button"
        class="topbar-right-btn right-rail-toggle"
        :title="rightRailTip"
        :aria-label="rightRailTip"
        :aria-expanded="isRightRailOpen"
        @click="toggleRightRail"
      >
        <svg v-if="isPhone && isAiWorkspace && isRightRailOpen" class="topbar-right-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
        <svg v-else class="topbar-right-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="M15 3v18" />
        </svg>
      </button>
    </div>

    <!-- 顶部左侧导航操作组：侧栏开关 / 后退 / 前进同一行 -->
    <nav v-if="!isBare && !examLock" class="topbar-nav-cluster" :aria-label="PAGE_NAV.NAV_CLUSTER">
      <button
        v-if="!isPhoneDetail"
        type="button"
        class="nav-cluster-btn sidebar-toggle"
        :title="toggleSidebarTip"
        :aria-label="toggleSidebarTip"
        :aria-expanded="!sidebarHidden"
        :aria-controls="isPhone ? 'app-sidebar-drawer' : undefined"
        @click="toggleSidebar"
      >
        <svg class="nav-cluster-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="M9 3v18" />
          <path class="sidebar-toggle-arrow" :class="{ flipped: sidebarHidden }" d="m16 15-3-3 3-3" />
        </svg>
      </button>

      <button
        v-if="isPhoneDetail"
        type="button"
        class="nav-cluster-btn phone-back-btn"
        :title="PHONE.BACK"
        :aria-label="PHONE.BACK"
        @click="phoneGoBack"
      >
        <svg class="nav-cluster-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>

      <button
        v-if="!isPhone"
        type="button"
        class="nav-cluster-btn nav-back-btn"
        :disabled="!appHistory.canGoBack.value"
        :title="PAGE_NAV.BACK"
        :aria-label="PAGE_NAV.BACK"
        @click="appHistory.goBack"
      >
        <svg class="nav-cluster-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>

      <button
        v-if="!isPhone"
        type="button"
        class="nav-cluster-btn nav-forward-btn"
        :disabled="!appHistory.canGoForward.value"
        :title="PAGE_NAV.FORWARD"
        :aria-label="PAGE_NAV.FORWARD"
        @click="appHistory.goForward"
      >
        <svg class="nav-cluster-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
    </nav>


    <!-- 核心应用骨架 -->
    <div v-if="!isBare" class="claude-body-layout">
      <!-- 左侧极简导航栏：收起走 width 过渡，不是 v-if 直接消失（要有动效） -->
      <div
        v-if="isPhone && phoneNavOpen && !examLock"
        class="phone-backdrop"
        aria-hidden="true"
        @click="closePhoneNav"
      />
      <div
        v-if="!examLock"
        id="app-sidebar-drawer"
        class="sidebar-wrapper"
        :class="{ 'is-rail': isRail, 'is-hidden': sidebarHidden && !isPhone, 'is-phone': isPhone, 'phone-open': isPhone && phoneNavOpen }"
        :inert="sidebarHidden"
      >
        <Sidebar :is-rail="isRail" />
      </div>

      <!-- 中间宽幅正文区域 -->
      <div class="main-pane">
        <main class="content" :class="{ 'is-full-bleed': isFullBleed }">
          <router-view v-slot="{ Component, route: currentRoute }">
            <Transition
              :name="isPhone ? slideName || 'mi-instant' : 'mi-route'"
              :mode="isPhone ? 'default' : 'out-in'"
              :css="!isPhone || !!slideName"
              @before-leave="onRouteBeforeLeave"
              @enter="onRouteEnter"
              @after-enter="onRouteEnter"
            >
              <component :is="Component" :key="currentRoute.path" />
            </Transition>
          </router-view>
        </main>

        <!-- 学习主界面 AI 悬浮小球入口 -->
        <button
          v-if="shouldShowAiBall"
          ref="aiBallRef"
          type="button"
          class="ai-floating-ball"
          :class="{ 'is-lesson': isLessonPage }"
          :title="AI_ASSISTANT.OPEN_ASSISTANT"
          :aria-label="AI_ASSISTANT.OPEN_ASSISTANT"
          @click="openAiAssistantFromBall"
        >
          <svg class="ai-ball-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </div>

      <!-- 右侧上下文工具面板（仅在课文页面按需展开） -->
      <aside v-if="shouldShowRightPanel && !examLock" class="right-tool-column" :class="{ 'ai-expanded': aiAssistant.isOpen }">
        <RightPanel />
      </aside>
    </div>

    <!-- 裸壳视图（如专注登录/独立页） -->
    <div v-else class="bare-viewport">
      <router-view v-slot="{ Component, route: r }">
        <Transition name="mi-route" mode="out-in">
          <component :is="Component" :key="r.path" />
        </Transition>
      </router-view>
    </div>

    <!-- 紧跟在 v-if/v-else 链之后：夹在 body-layout 与 bare-viewport 之间会把 v-else 接到它身上，桌面端壳层被挤成半高 -->
    <PhoneTabBar v-if="showTabBar" />

    <!-- 设置面板（覆盖当前页，背景不卸载；开关见 stores/settings-dialog.ts） -->
    <SettingsDialog />

    <!-- 全局弹窗与交互图层 -->
    <MiToast />
    <QuizOverlay />
    <VideoHost />
    <NativeRunConfirm />
    <AiContextMenu />
  </div>
</template>

<style scoped>
.claude-app-container {
  /* 顶栏左边界：展开时让出侧栏，收起时归零（TopBar 消费这个变量） */
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  padding-top: var(--mi-topbar-h);
  background: var(--mi-canvas);
  color: var(--mi-text);
  overflow: hidden;
  box-sizing: border-box;
  --mi-topbar-inset: var(--mi-sidebar-w);
}
.claude-app-container.exam-locked { --mi-topbar-inset: 0px; }
.claude-app-container:has(.sidebar-wrapper.is-hidden) { --mi-topbar-inset: 0px; }
.claude-app-container:has(.sidebar-wrapper.is-rail) { --mi-topbar-inset: var(--mi-sidebar-rail-w); }

/*
 * AI 主界面的标题条。left 必须始终让开左上角那颗 44px 的侧栏开关 ——
 * 侧栏收起时原先写成 left:0，标题就直接压在了开关图标上（叠字）。
 * 收起的形态与展开一致：从侧栏让出的位置开始，只是少了侧栏本身。
 */
/* The shared TopBar supplies the backdrop beneath this title and its controls. */
.ai-topbar {
  position:fixed; top:0; left:calc(var(--mi-sidebar-w) + var(--mi-content-gutter)); right:188px;
  height:var(--mi-topbar-h); z-index:62; display:flex; align-items:center; gap:var(--mi-sp-2); padding:0 var(--mi-sp-4);
  box-sizing:border-box; min-width:0; -webkit-app-region:drag;
  transition:left var(--mi-dur-slow) var(--mi-ease);
  background: transparent;
}
.ai-topbar.is-rail { left:calc(96px + var(--mi-content-gutter)); }
/* 收起时从导航组右侧起排（96px 导航组 + 8px 间距） */
.ai-topbar.is-hidden { left:calc(96px + var(--mi-content-gutter)); }
/* 会话名不加粗：600 让它看着像标题栏，而这里只是「当前在哪个会话」的指示。
   和侧栏会话行（已钉成 400）保持一致，整站只有一处用字重作强调。 */
.ai-topbar-title { flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:var(--mi-fs-body); font-weight:400; color:var(--mi-text-2); }
/* 顶栏右侧全局操作组：右栏开关，避开原生控制按钮 */
.topbar-right-actions {
  position: fixed;
  top: 0;
  right: 148px;
  height: var(--mi-topbar-h);
  display: flex;
  align-items: center;
  z-index: 65;
  -webkit-app-region: no-drag;
}

.topbar-right-btn {
  width: 32px;
  height: var(--mi-topbar-h);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--mi-text-2);
  cursor: pointer;
  -webkit-app-region: no-drag;
  transition: color var(--mi-dur-fast) ease, background var(--mi-dur-fast) ease;
}

.topbar-right-btn:hover {
  color: var(--mi-text);
  background: var(--cds-fill-ghost-hover);
}

.topbar-right-btn:focus-visible {
  color: var(--mi-text);
  outline: 2px solid var(--mi-text);
  outline-offset: -2px;
}

.topbar-right-btn:focus:not(:focus-visible) {
  outline: none;
}

.topbar-right-icon {
  width: 18px;
  height: 18px;
}
/*
 * 主体区往上顶掉容器那层 padding-top，让侧栏的右缘竖线能从窗口最上沿
 * 一直画到最下沿。顶栏是 position:fixed + z-index:60，仍然盖在最上面；
 * 侧栏内部再自己让出顶栏高度（见 Sidebar 的 padding-top）。
 */
.claude-body-layout {
  display: flex;
  flex: 1;
  min-height: 0;
  width: 100%;
  margin-top: calc(-1 * var(--mi-topbar-h));
  overflow: hidden;
  position: relative;
  z-index: 1;
}

/*
 * 侧栏是贴边的整列，不是浮起的卡片 —— 与顶栏同宽同高，右缘一条 1px 竖线
 * 从窗口最上沿一直拉到最下沿（那条线由 Sidebar 自己的 border-inline-end 画，
 * 这里不再另起一个 fixed 元素）。
 */
.sidebar-wrapper {
  width: var(--mi-sidebar-w);
  flex-shrink: 0;
  height: 100%;
  overflow: hidden; /* 收起时把定宽内容裁掉，而不是让它挤进正文 */
  box-sizing: border-box;
  transition: width var(--mi-dur-slow) var(--mi-ease);
}

/* 收起本轮不接受键盘焦点（宽度动画结束后仍留在 DOM 里，避免无动画地消失） */
.sidebar-wrapper.is-hidden {
  width: 0;
}

/* 内层定宽：收合时被外层裁掉，而不是跟着挤压重排（文字不会一路抖动） */
.sidebar-wrapper :deep(.claude-sidebar) {
  width: var(--mi-sidebar-w);
  height: 100%;
  overflow: hidden;
}

.sidebar-wrapper.is-rail :deep(.claude-sidebar) {
  width: var(--mi-sidebar-rail-w);
}

/* 顶部左侧导航按钮组：侧栏开关 / 后退 / 前进同一行，18px 线性图标，单按钮视觉宽 32px */
.topbar-nav-cluster {
  position: fixed;
  top: 0;
  left: 0;
  height: var(--mi-topbar-h);
  width: 96px;
  display: flex;
  align-items: center;
  padding: 0;
  margin: 0;
  z-index: 62; /* 高于侧栏线(61)与顶栏(60) */
  -webkit-app-region: no-drag;
  box-sizing: border-box;
}

.nav-cluster-btn {
  width: 32px;
  height: var(--mi-topbar-h);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: transparent;
  color: var(--mi-text-2);
  cursor: pointer;
  -webkit-app-region: no-drag;
  transition: color var(--mi-dur-fast) ease, background var(--mi-dur-fast) ease;
}

.nav-cluster-btn:not(:disabled):hover {
  color: var(--mi-text);
  background: var(--cds-fill-ghost-hover);
}

.nav-cluster-btn:disabled {
  color: color-mix(in srgb, var(--mi-text-2) 35%, transparent);
  cursor: not-allowed;
}

.nav-cluster-btn:focus-visible {
  color: var(--mi-text);
  outline: 2px solid var(--mi-text);
  outline-offset: -2px;
}

.nav-cluster-icon {
  width: 18px;
  height: 18px;
}

/* 箭头绕自身中心翻转（< > 互换），与侧栏宽度同步 */
.sidebar-toggle-arrow {
  transform-origin: 13.5px 12px;
  transform: scaleX(1);
  transition: transform var(--mi-dur-slow) var(--mi-ease);
}

.sidebar-toggle-arrow.flipped {
  transform: scaleX(-1);
}

.sidebar-wrapper.is-rail {
  width: var(--mi-sidebar-rail-w);
}

.main-pane {
  display: flex;
  flex-direction: column;
  position: relative;
  flex: 1;
  min-width: 0;
  height: 100%;
}

/* 学习主界面 AI 悬浮小球入口：44px 直径、中性底色、细边轻阴影、线性图标 */
.ai-floating-ball {
  position: absolute;
  right: 24px;
  bottom: 24px;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid var(--mi-border);
  background: var(--mi-card);
  color: var(--mi-text);
  box-shadow: var(--mi-shadow-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 52;
  transition: background var(--mi-dur-fast) var(--mi-ease),
              transform var(--mi-dur-fast) var(--mi-ease),
              box-shadow var(--mi-dur-fast) var(--mi-ease);
}

.ai-floating-ball:hover {
  background: var(--mi-blue-light);
  transform: translateY(-1px);
  box-shadow: var(--mi-shadow-lg);
}

.ai-floating-ball:focus-visible {
  outline: 2px solid var(--mi-text);
  outline-offset: 2px;
}

/* 课文页避让底部的 sticky 操作栏（高约 96px + 16px 间距），完全不遮挡「下一课」等关键按钮 */
.ai-floating-ball.is-lesson {
  bottom: 128px;
}

.ai-ball-icon {
  width: 20px;
  height: 20px;
}

.content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable; /* 有无滚动条时页面左缘不跳 */
  /* 上边要让出顶栏（主体区已顶到窗口最上沿），左右各 32 gutter */
  padding: calc(var(--mi-topbar-h) + var(--mi-page-pad-top)) var(--mi-page-pad-x) var(--mi-sp-8);
  background: var(--mi-canvas);
  box-sizing: border-box;
}

/* /ai 这类页面自己管理滚动：主区不加 padding、不出外层滚动条 */
.content.is-full-bleed {
  /* The inner scroll viewport extends behind the shared topbar. */
  padding: 0;
  overflow: hidden;
}

/*
 * 右工具栏和主体区在同一个 flex 行里，而主体行被整体上移了一个顶栏高度
 * （为了让侧栏竖线贯通到窗口最上沿）。右栏没有跟着让，顶部就被 position:fixed
 * 的顶栏盖住 —— 课文页右栏那两个标签实际点不到，elementFromPoint 命中的是
 * .topbar（独立审查 F2）。
 * 所以这里补一条与顶栏等高的上内距，和 .content 的处理一致；
 * 高度仍由父级 100% 决定，滚动容器、min-height 约束都不动。
 */
.right-tool-column {
  width: 232px;
  padding-top: var(--mi-topbar-h);
  box-sizing: border-box;
  transition: width var(--mi-dur-slow) var(--mi-ease);
}
.right-tool-column.ai-expanded {
  position: relative;
  width: 380px;
  flex-shrink: 0;
  height: 100%;
  padding: calc(var(--mi-topbar-h) + 12px) 12px 12px 0;
  box-sizing: border-box;
  background: transparent;
  border-left: none;
  animation: slideInRight var(--mi-dur) var(--mi-ease-out);
}

@keyframes slideInRight {
  from {
    opacity: 0;
    transform: translateX(12px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.bare-viewport {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: var(--mi-sp-6);
}
@media (max-width: 1199px) {
  /* 窄窗下采用覆盖式右侧面板（非模态，不占挤正文宽度，不产生横向滚动，背景可交互） */
  .right-tool-column.ai-expanded {
    position: absolute;
    right: 12px;
    top: calc(var(--mi-topbar-h) + 12px);
    bottom: 12px;
    width: 380px;
    max-width: calc(100vw - 32px);
    height: auto;
    padding: 0;
    z-index: 55;
    box-shadow: var(--mi-shadow-lg);
  }
}
@media (max-width: 1279px) {
  .right-tool-column:not(.ai-expanded) {
    display: none !important;
  }
}
@media (max-width: 1100px) {
  .sidebar-wrapper { width: var(--mi-sidebar-w); }
  .content { padding-inline: var(--mi-sp-6); }
}
</style>
