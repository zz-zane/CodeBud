import { ref, type Ref } from 'vue'
import type { Router } from 'vue-router'

/**
 * 校验目标路径是否属于应用内已知路由。
 * 排除外部链接、空白页或无法匹配的非法路由。
 */
export function isAppRoutePath(target: unknown, router?: Router): boolean {
  if (typeof target !== 'string' || !target.trim()) return false
  // 兼容 hash 历史与标准路径格式：如 "#/learn" 或 "/learn"
  const clean = target.replace(/^#/, '')
  if (!clean.startsWith('/')) return false
  if (!router) return true
  try {
    const resolved = router.resolve(clean)
    return Boolean(resolved && resolved.matched && resolved.matched.length > 0)
  } catch {
    return false
  }
}

/**
 * 判断当前 history.state 是否允许安全后退。
 * 必须存在有效且可匹配的上一级应用路由；初次启动、深链且无前驱时 back 为 null，严禁后退到空白页或应用外。
 */
export function canNavigateBack(state: unknown, router?: Router): boolean {
  if (!state || typeof state !== 'object') return false
  const s = state as Record<string, unknown>
  return isAppRoutePath(s.back, router)
}

/**
 * 判断当前 history.state 是否允许安全前进。
 */
export function canNavigateForward(state: unknown, router?: Router): boolean {
  if (!state || typeof state !== 'object') return false
  const s = state as Record<string, unknown>
  return isAppRoutePath(s.forward, router)
}

export interface AppHistoryOptions {
  getState?: () => unknown
  windowTarget?: Window
}

export interface AppHistoryController {
  canGoBack: Ref<boolean>
  canGoForward: Ref<boolean>
  goBack: () => void
  goForward: () => void
  syncHistoryState: () => void
  destroy: () => void
}

/**
 * 应用页面历史导航组合式函数。
 * 绑定真实 Vue Router 与 Web 历史状态，统一响应式提供后退/前进能力与可用性状态。
 */
export function useAppHistory(
  router: Router,
  options?: AppHistoryOptions
): AppHistoryController {
  const win = options?.windowTarget ?? (typeof window !== 'undefined' ? window : undefined)
  const getState = options?.getState ?? (() => (win ? win.history?.state : null))

  const canGoBack = ref(false)
  const canGoForward = ref(false)

  function syncHistoryState(): void {
    const state = getState()
    canGoBack.value = canNavigateBack(state, router)
    canGoForward.value = canNavigateForward(state, router)
  }

  function goBack(): void {
    syncHistoryState()
    if (canGoBack.value) {
      router.back()
    }
  }

  function goForward(): void {
    syncHistoryState()
    if (canGoForward.value) {
      router.forward()
    }
  }

  const removeAfterEach = router.afterEach(() => {
    // 微任务与下一事件循环双重同步，确保 vue-router 及浏览器已写入最新的 history.state
    void Promise.resolve().then(syncHistoryState)
    setTimeout(syncHistoryState, 0)
  })

  const onPopState = () => {
    void Promise.resolve().then(syncHistoryState)
  }

  if (win && typeof win.addEventListener === 'function') {
    win.addEventListener('popstate', onPopState)
  }

  // 初次启动或 router 准备好时同步
  void router.isReady().then(syncHistoryState).catch(() => syncHistoryState())
  syncHistoryState()

  function destroy(): void {
    removeAfterEach()
    if (win && typeof win.removeEventListener === 'function') {
      win.removeEventListener('popstate', onPopState)
    }
  }

  return {
    canGoBack,
    canGoForward,
    goBack,
    goForward,
    syncHistoryState,
    destroy
  }
}
