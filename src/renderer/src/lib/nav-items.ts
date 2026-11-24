import { AI_ASSISTANT, APP_SIDEBAR } from './copy'
import { STUDY_COPY } from './study-copy'

/**
 * 主导航的唯一定义：侧栏（Sidebar.vue）与手机底部标签栏（PhoneTabBar.vue）共用，
 * 分组映射（哪个页面点亮哪个入口）也只在这里写一份。顺序与分组见 docs/31 §1.1。
 */
export interface NavItem {
  key: string
  path: string
  label: string
  icon: string
  /** daily = 每天做的；library = 查的、问的、看的。两组之间画分隔线 */
  group: 'daily' | 'library'
}

export const NAV_ITEMS: NavItem[] = [
  { key: 'today', path: '/today', label: APP_SIDEBAR.NAV_TODAY, icon: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z', group: 'daily' },
  { key: 'courses', path: '/courses', label: APP_SIDEBAR.NAV_COURSES, icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z', group: 'daily' },
  { key: 'practice', path: '/practice', label: APP_SIDEBAR.NAV_PRACTICE, icon: 'm16 18 6-6-6-6M8 6l-6 6 6 6', group: 'daily' },
  { key: 'review', path: '/review', label: APP_SIDEBAR.NAV_REVIEW, icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15', group: 'daily' },
  { key: 'cet6', path: '/cet6', label: APP_SIDEBAR.NAV_CET6, icon: 'M22 10 12 5 2 10l10 5z M6 12v5c3 2 9 2 12 0v-5', group: 'daily' },
  { key: 'vocab', path: '/cet6/vocab', label: APP_SIDEBAR.NAV_VOCAB, icon: 'M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z M9 8h6 M9 11.5h4', group: 'daily' },
  { key: 'study', path: '/study', label: STUDY_COPY.HUB_TITLE, icon: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', group: 'library' },
  { key: 'ai', path: '/ai', label: AI_ASSISTANT.TAB_ASSISTANT, icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z', group: 'library' },
  { key: 'overview', path: '/overview', label: APP_SIDEBAR.NAV_OVERVIEW, icon: 'M9 19v-6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2zm0 0V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v10m-6 0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2m0 0V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z', group: 'library' }
]

/** 按 group 顺序切成连续的几段（侧栏在段与段之间画分隔线） */
export function navSections(items: readonly NavItem[] = NAV_ITEMS): NavItem[][] {
  const out: NavItem[][] = []
  for (const item of items) {
    const last = out[out.length - 1]
    if (last && last[0].group === item.group) last.push(item)
    else out.push([item])
  }
  return out
}

/** 手机底部标签栏的五项（按此顺序）；其余（六级、资料库、进度、设置）留在抽屉里 */
export const PHONE_TAB_KEYS = ['today', 'courses', 'practice', 'review', 'ai'] as const

export function phoneTabItems(items: readonly NavItem[] = NAV_ITEMS): NavItem[] {
  return PHONE_TAB_KEYS.map((k) => items.find((i) => i.key === k)).filter((i): i is NavItem => !!i)
}

/** 当前路径属于哪个主导航入口；不属于任何入口返回 null */
export function navGroupOf(path: string): string | null {
  if (path === '/today') return 'today'
  if (path === '/courses' || path.startsWith('/lesson/')) return 'courses'
  if (path === '/practice' || path === '/playground') return 'practice'
  if (path === '/review') return 'review'
  if (path === '/cet6/vocab') return 'vocab'
  if (path.startsWith('/cet6')) return 'cet6'
  if (path === '/study') return 'study'
  if (path === '/ai') return 'ai'
  if (path === '/overview' || path === '/memo' || path === '/favorites') return 'overview'
  return null
}

export function isNavActive(item: { key: string }, path: string): boolean {
  return navGroupOf(path) === item.key
}
