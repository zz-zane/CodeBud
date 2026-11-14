/**
 * 软键盘不改布局（docs/29「手机操作体验」）：这里只测量键盘盖住了多少，
 * 写成 --mi-kb-inset，并在超过阈值时给根元素加 kb-open。哪个输入区要避让，自己读这个变量。
 */
export const KB_OPEN_THRESHOLD = 120

/** 键盘高度 = 布局视口高 − 可视视口高 − 可视视口顶部偏移；双指放大时可视视口也会变小，那不是键盘 */
export function computeKbInset(innerHeight: number, vvHeight: number, vvOffsetTop: number, scale = 1): number {
  if (scale > 1.05) return 0
  const v = innerHeight - vvHeight - vvOffsetTop
  return Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0
}

export function isKbOpen(inset: number): boolean {
  return inset > KB_OPEN_THRESHOLD
}

interface VV extends EventTarget {
  height: number
  offsetTop: number
  scale?: number
}
export interface KbWindow {
  innerHeight: number
  visualViewport?: VV | null
  requestAnimationFrame(cb: () => void): number
  cancelAnimationFrame(id: number): void
  scrollTo?(x: number, y: number): void
}
export interface KbRoot {
  style: { setProperty(k: string, v: string): void; removeProperty(k: string): void }
  classList: { toggle(c: string, force?: boolean): boolean; remove(c: string): void }
}

/** 订阅 visualViewport 的 resize / scroll（rAF 节流）；返回卸载函数。iOS Safari 不认 interactive-widget，同样靠这里 */
export function installKeyboardInset(win: KbWindow, root: KbRoot): () => void {
  const vv = win.visualViewport
  if (!vv) return () => {}
  let raf = 0
  const apply = (): void => {
    raf = 0
    const inset = computeKbInset(win.innerHeight, vv.height, vv.offsetTop, vv.scale ?? 1)
    root.style.setProperty('--mi-kb-inset', `${inset}px`)
    root.classList.toggle('kb-open', isKbOpen(inset))
    if (vv.offsetTop > 0) win.scrollTo?.(0, 0)
  }
  const schedule = (): void => {
    if (!raf) raf = win.requestAnimationFrame(apply)
  }
  vv.addEventListener('resize', schedule)
  vv.addEventListener('scroll', schedule)
  apply()
  return () => {
    vv.removeEventListener('resize', schedule)
    vv.removeEventListener('scroll', schedule)
    if (raf) win.cancelAnimationFrame(raf)
    root.style.removeProperty('--mi-kb-inset')
    root.classList.remove('kb-open')
  }
}
