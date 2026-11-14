import { nextTick, onBeforeUnmount, watch, type Ref } from 'vue'
import type { Router } from 'vue-router'

/**
 * 手机上「系统返回先关浮层」（docs/29「手机操作体验」）。
 *
 * 浮层打开时压一条历史记录（沿用当前 history.state 的 vue-router 字段，只多一个标记）；
 * 系统返回手势 / 返回键 → 在 vue-router 之前截住 popstate，改为关浮层。
 * 浮层自己的关闭按钮关掉时，用 history.back() 把那条记录消费掉，历史里不留垃圾。
 * 浮层开着时发生路由跳转（抽屉里点导航、弹窗里点跳转）：守卫先退掉所有浮层记录，等 popstate 回来再补做跳转，
 * 不会让 vue-router 在浮层记录之后再 push。非手机宽度下完全不动 history。
 *
 * 多层浮层叠着时，下层先于上层被自带按钮关掉：它的记录标成 dead 留在栈里，等上层退出时一并回退，历史里不留空记录。
 */
interface Entry {
  close: () => void
  isOpen: () => boolean
  /** 浮层已经关了，但它的历史记录压在别的浮层下面，暂时退不掉 */
  dead?: boolean
}

const stack: Entry[] = []
/** 已发出、还没收到 popstate 的「我们自己的」回退次数 */
let consuming = 0
let pendingTarget: string | null = null
let routerRef: Router | null = null
let listening = false

export function isPhoneViewport(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(max-width: 768px)').matches
}

function flushPending(): void {
  if (consuming > 0 || !pendingTarget || !routerRef) return
  const t = pendingTarget
  pendingTarget = null
  const r = routerRef
  setTimeout(() => void r.push(t), 0)
}

function onPop(e: PopStateEvent): void {
  if (consuming > 0) {
    consuming--
    e.stopImmediatePropagation()
    flushPending()
    return
  }
  const top = stack.pop()
  if (!top) {
    // 前进键走到了一条已经没有浮层的空记录：吞掉，不让 vue-router 当成一次导航
    if ((e.state as { miaiOverlay?: unknown } | null)?.miaiOverlay) e.stopImmediatePropagation()
    return
  }
  e.stopImmediatePropagation()
  top.close()
  // 压在它下面、早已关掉的浮层记录一并退掉
  let dead = 0
  while (stack.length && stack[stack.length - 1].dead) {
    stack.pop()
    dead++
  }
  if (dead) {
    consuming++
    history.go(-dead)
  }
  // 浮层拒绝关闭（不可关闭的弹窗、答题要先确认退出）：补回那条记录，浮层仍然「有一条记录」
  void nextTick(() => {
    if (top.isOpen() && !stack.includes(top)) pushEntry(top)
  })
}

function pushEntry(e: Entry): void {
  if (!listening) {
    // 捕获阶段、先于 vue-router 挂在 window 上的冒泡监听
    window.addEventListener('popstate', onPop, true)
    listening = true
  }
  history.pushState({ ...(history.state ?? {}), miaiOverlay: stack.length + 1 }, '')
  stack.push(e)
}

/** 路由守卫：浮层开着时的跳转先退浮层再做（在 App 里装一次） */
export function installOverlayRouterGuard(router: Router): () => void {
  routerRef = router
  const off = router.beforeEach((to) => {
    if (!stack.length && consuming === 0) return true
    pendingTarget = to.fullPath
    if (stack.length) {
      const entries = stack.splice(0)
      consuming++
      history.go(-entries.length)
      entries.reverse().forEach((e) => { if (!e.dead) e.close() })
    }
    return false
  })
  return () => {
    off()
    routerRef = null
  }
}

/** 打开时压一条历史记录，系统返回关浮层；close 只管把 isOpen 变成 false */
export function usePhoneBackClose(isOpen: Ref<boolean> | (() => boolean), close: () => void): void {
  const read = typeof isOpen === 'function' ? isOpen : () => isOpen.value
  const entry: Entry = { close, isOpen: read }

  function release(): void {
    const i = stack.indexOf(entry)
    if (i < 0) return
    if (i < stack.length - 1) {
      entry.dead = true
      return
    }
    stack.pop()
    let n = 1
    while (stack.length && stack[stack.length - 1].dead) {
      stack.pop()
      n++
    }
    consuming++
    history.go(-n)
  }

  watch(
    read,
    (open) => {
      if (open) {
        if (stack.includes(entry)) entry.dead = false
        else if (isPhoneViewport()) pushEntry(entry)
      } else release()
    },
    { immediate: true }
  )
  onBeforeUnmount(release)
}
