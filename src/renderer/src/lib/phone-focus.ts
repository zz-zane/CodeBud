import { computeKbInset } from './keyboard-inset'

/** 手机输入区的两条通用行为：聚焦后在自己的滚动容器里露出来；点非交互区域收起键盘 */
export const FIELD_SELECTOR =
  'input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=range]),textarea,select,[contenteditable=""],[contenteditable="true"]'
const INTERACTIVE_SELECTOR = `${FIELD_SELECTOR},button,a,summary,label,[role=button],[role=tab],[role=option],[tabindex]`
/** 自己管键盘避让的区域（AI 输入框、六级作答区）：通用逻辑不碰 */
export const KB_MANAGED_SELECTOR = '[data-kb-managed]'

/** 最近的、真正能纵向滚动的祖先；没有返回 null（不会去动 body / 外壳） */
export function scrollerOf(el: HTMLElement): HTMLElement | null {
  let p = el.parentElement
  while (p && p !== document.body && p !== document.documentElement) {
    const oy = getComputedStyle(p).overflowY
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) return p
    p = p.parentElement
  }
  return null
}

/** 只滚输入框自己的那个容器，让它落在键盘上方的可见区内；不用 scrollIntoView，避免带动外壳 */
export function revealField(el: HTMLElement, inset: number): void {
  const box = scrollerOf(el)
  if (!box) return
  const b = box.getBoundingClientRect()
  const r = el.getBoundingClientRect()
  const bottom = Math.min(b.bottom, window.innerHeight - inset)
  if (r.bottom > bottom) box.scrollTop += r.bottom - bottom + 8
  else if (r.top < b.top) box.scrollTop -= b.top - r.top + 8
}

export function installPhoneFocus(): () => void {
  const timers = new Set<number>()
  const onFocusIn = (e: FocusEvent): void => {
    const t = e.target
    if (!(t instanceof HTMLElement) || !t.matches(FIELD_SELECTOR) || t.closest(KB_MANAGED_SELECTOR)) return
    // 键盘动画约 300ms：先后各量一次，第二次兜住慢键盘
    for (const ms of [150, 450]) {
      const id = window.setTimeout(() => {
        timers.delete(id)
        const vv = window.visualViewport
        if (document.activeElement !== t) return
        revealField(t, vv ? computeKbInset(window.innerHeight, vv.height, vv.offsetTop, vv.scale) : 0)
      }, ms)
      timers.add(id)
    }
  }
  const onClick = (e: MouseEvent): void => {
    const a = document.activeElement
    const t = e.target
    if (!(a instanceof HTMLElement) || !a.matches(FIELD_SELECTOR) || !(t instanceof Element)) return
    if (t.closest(INTERACTIVE_SELECTOR) || t.closest(KB_MANAGED_SELECTOR)) return
    a.blur()
  }
  document.addEventListener('focusin', onFocusIn)
  document.addEventListener('click', onClick)
  return () => {
    document.removeEventListener('focusin', onFocusIn)
    document.removeEventListener('click', onClick)
    timers.forEach((id) => clearTimeout(id))
  }
}
