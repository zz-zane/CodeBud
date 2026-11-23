/**
 * 在一段文字上画「覆盖层」：一层 position:fixed、不接收点击的图层，按 Range 的每一行画一个矩形。
 * 不用 CSS Highlight API —— 旧版 iPadOS Safari 不支持，用户在 iPad 上长按看不到选中了哪个词（2026-11-23）。
 * 覆盖层挂在 document.body 下（不碰 Vue 管的 DOM），随滚动 / 尺寸变化重算，并裁到文字所在滚动区域内。
 *
 * kind：
 *   pick     手机长按选中的词：半透明底色
 *   evidence 交卷后解析依据：每行底部一条波浪线（常驻）；flash() 时整行先加深黄底再淡出（照用户给的录屏）
 */
export type OverlayKind = 'pick' | 'evidence'

export interface RangeOverlay {
  set(ranges: Range[]): void
  flash(): void
  clear(): void
  destroy(): void
}

/** 同一行（top 相差不到半行高）的矩形并成一个，减少碎片 */
export function mergeLineRects(rects: Array<{ left: number; top: number; right: number; bottom: number }>): Array<{ left: number; top: number; right: number; bottom: number }> {
  const out: Array<{ left: number; top: number; right: number; bottom: number }> = []
  for (const r of [...rects].filter((x) => x.right - x.left > 0.5).sort((a, b) => a.top - b.top || a.left - b.left)) {
    const last = out[out.length - 1]
    if (last && Math.abs(r.top - last.top) < (last.bottom - last.top) / 2) {
      last.left = Math.min(last.left, r.left)
      last.right = Math.max(last.right, r.right)
      last.bottom = Math.max(last.bottom, r.bottom)
    } else out.push({ ...r })
  }
  return out
}

export function scrollParent(node: Node | null): Element | null {
  let el = node instanceof Element ? node : node?.parentElement ?? null
  while (el && el !== document.body) {
    const s = getComputedStyle(el)
    if (/(auto|scroll)/.test(s.overflowY + s.overflowX)) return el
    el = el.parentElement
  }
  return null
}

export function createRangeOverlay(kind: OverlayKind): RangeOverlay {
  const layer = document.createElement('div')
  layer.className = `range-ov range-ov--${kind}`
  layer.setAttribute('aria-hidden', 'true')
  let ranges: Range[] = []
  let clip: Element | null = null
  let raf = 0
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => schedule()) : null

  function draw(): void {
    raf = 0
    if (!ranges.length) { layer.replaceChildren(); return }
    const box = clip?.getBoundingClientRect() ?? { top: 0, left: 0, bottom: innerHeight, right: innerWidth }
    // DOMRect 的 left/top 是原型上的 getter，{ ...rect } 会得到空对象（2026-11-23 实测全是 NaN、0×0 看不见），所以逐个取值
    const rows = mergeLineRects(ranges.flatMap((r) => [...r.getClientRects()].map((c) => ({ left: c.left, top: c.top, right: c.right, bottom: c.bottom }))))
    // 重用已有的行元素：滚动时每帧重画，若每次新建节点，闪烁动画会被不停重启、根本看不到
    const old = [...layer.children] as HTMLElement[]
    const nodes: HTMLElement[] = []
    for (const r of rows) {
      const top = Math.max(r.top, box.top)
      const bottom = Math.min(r.bottom, box.bottom)
      if (bottom <= top || r.right <= box.left || r.left >= box.right) continue
      const el = old[nodes.length] ?? document.createElement('div')
      el.className = 'range-ov-row'
      el.style.left = `${Math.max(r.left, box.left) - 2}px`
      el.style.width = `${Math.min(r.right, box.right) - Math.max(r.left, box.left) + 4}px`
      el.style.top = `${top}px`
      el.style.height = `${bottom - top}px`
      // 行底被滚动区域裁掉时，波浪线也不画（否则会浮在区域边缘外）
      if (bottom < r.bottom - 1) el.classList.add('clipped')
      nodes.push(el)
    }
    for (const el of old.slice(nodes.length)) el.remove()
    for (const el of nodes) if (el.parentNode !== layer) layer.appendChild(el)
  }
  function schedule(): void {
    if (!raf) raf = requestAnimationFrame(draw)
  }

  function set(next: Range[]): void {
    ranges = next
    layer.classList.remove('flash')
    if (!next.length) { clear(); return }
    clip = scrollParent(next[0].commonAncestorContainer)
    if (!layer.isConnected) {
      document.body.appendChild(layer)
      window.addEventListener('scroll', schedule, true)
      window.addEventListener('resize', schedule)
    }
    ro?.disconnect()
    if (clip) { ro?.observe(clip); if (clip.firstElementChild) ro?.observe(clip.firstElementChild) }
    draw()
  }

  function flash(): void {
    layer.classList.remove('flash')
    void layer.offsetWidth // 重新触发动画
    layer.classList.add('flash')
  }

  function clear(): void {
    ranges = []
    if (raf) cancelAnimationFrame(raf)
    raf = 0
    ro?.disconnect()
    window.removeEventListener('scroll', schedule, true)
    window.removeEventListener('resize', schedule)
    layer.replaceChildren()
    layer.remove()
  }

  return { set, flash, clear, destroy: clear }
}
