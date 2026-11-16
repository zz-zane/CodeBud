export interface MemoryCellBox {
  id: string
  left: number
  right: number
  top: number
  bottom: number
  region?: 'stack' | 'heap'
}

export interface MemoryArrowRef {
  from: string
  to: string
}

const SAME_COL_BASE_BULGE = 32
const SAME_COL_STEP_BULGE = 16
const CROSS_COL_MIN_BEND = 24

function boxesOverlapX(a: MemoryCellBox, b: MemoryCellBox): boolean {
  return Math.min(a.right, b.right) > Math.max(a.left, b.left)
}

/**
 * Computes SVG cubic-Bezier path strings for `StageMemory` cell pointers.
 * Cross-column arrows connect nearest horizontal edges; same-column arrows
 * arc outward to the right with staggered depths so they never cross cell text.
 */
export function computeMemoryArrows(cells: readonly MemoryCellBox[], arrows: readonly MemoryArrowRef[]): string[] {
  const byId = new Map(cells.map((cell) => [cell.id, cell]))
  const laneCounts = new Map<string, number>()

  return arrows.flatMap((arrow) => {
    const from = byId.get(arrow.from)
    const to = byId.get(arrow.to)
    if (!from || !to) return []

    if (!boxesOverlapX(from, to)) {
      const toIsRight = to.left >= from.right
      const x1 = toIsRight ? from.right : from.left
      const x2 = toIsRight ? to.left : to.right
      const y1 = (from.top + from.bottom) / 2
      const y2 = (to.top + to.bottom) / 2
      const bend = Math.max(CROSS_COL_MIN_BEND, Math.abs(x2 - x1) / 2) * (toIsRight ? 1 : -1)
      return [`M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`]
    }

    const minTop = Math.min(from.top, to.top)
    const maxBottom = Math.max(from.bottom, to.bottom)
    const spannedRight = cells.reduce((max, cell) => {
      if (!boxesOverlapX(from, cell)) return max
      if (cell.bottom < minTop || cell.top > maxBottom) return max
      return Math.max(max, cell.right)
    }, Math.max(from.right, to.right))

    const columnKey = from.region ?? String(Math.round(spannedRight / 16))
    const lane = laneCounts.get(columnKey) ?? 0
    laneCounts.set(columnKey, lane + 1)

    const selfLoop = from.id === to.id
    const height = from.bottom - from.top
    const y1 = selfLoop ? from.top + height * 0.35 : (from.top + from.bottom) / 2
    const y2 = selfLoop ? to.top + height * 0.65 : (to.top + to.bottom) / 2
    const ctrlX = spannedRight + SAME_COL_BASE_BULGE + lane * SAME_COL_STEP_BULGE

    return [`M ${from.right} ${y1} C ${ctrlX} ${y1}, ${ctrlX} ${y2}, ${to.right} ${y2}`]
  })
}
