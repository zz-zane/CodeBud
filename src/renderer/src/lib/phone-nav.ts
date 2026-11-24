/** 手机页面切换的纯逻辑：历史位置 → 方向、路由层级、父级路由（docs/29 手机操作体验） */
export type SlideDir = 'fwd' | 'back' | 'none'

/** vue-router 在 history.state.position 里维护的位置：变大 = 前进，变小 = 后退，相等或未知 = 无方向 */
export function directionOf(prev: unknown, next: unknown): SlideDir {
  if (typeof prev !== 'number' || typeof next !== 'number') return 'none'
  if (next > prev) return 'fwd'
  if (next < prev) return 'back'
  return 'none'
}

const DEPTH1 = new Set(['/memo', '/favorites', '/playground'])

/** 0 = 顶层页面（标签栏 / 抽屉可直达）；1 = 列表页；2 = 详情页（课文、六级试卷） */
export function routeDepth(path: string): 0 | 1 | 2 {
  if (path.startsWith('/lesson/')) return 2
  if (path === '/cet6/vocab') return 0 // 生词本进了侧栏 / 抽屉，是顶层页（2026-11-24）
  if (path.startsWith('/cet6/')) return 2
  if (DEPTH1.has(path)) return 1
  return 0
}

/** 顶栏返回键的兜底去处（没有应用内历史，例如从书签直接打开） */
export function parentRouteOf(path: string): string {
  if (path.startsWith('/lesson/')) return '/courses'
  if (path.startsWith('/cet6/')) return '/cet6'
  if (path === '/memo' || path === '/favorites') return '/overview'
  if (path === '/playground') return '/practice'
  return '/today'
}

/** 顶栏用返回键代替抽屉键的页面 */
export function isDetailRoute(path: string): boolean {
  return routeDepth(path) > 0
}

/** 实际采用的切换方式：两端都是顶层页面（标签 ↔ 标签）一律即时；其余按历史方向滑动 */
export function slideKind(dir: SlideDir, fromPath: string, toPath: string): SlideDir {
  if (dir === 'none') return 'none'
  if (routeDepth(fromPath) === 0 && routeDepth(toPath) === 0) return 'none'
  return dir
}
