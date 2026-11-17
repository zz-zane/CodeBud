export interface ProgressSegmentRect {
  act: number
  step: number
  left: number
  right: number
}

/** Pick the segment containing `clientX`, or the nearest segment across act gaps. */
export function pickProgressSegment(rects: ProgressSegmentRect[], clientX: number): { act: number; step: number } | null {
  let best: ProgressSegmentRect | null = null
  let bestDist = Infinity
  for (const r of rects) {
    if (r.right <= r.left) continue
    if (clientX >= r.left && clientX <= r.right) return { act: r.act, step: r.step }
    const dist = Math.abs(clientX - (r.left + r.right) / 2)
    if (dist < bestDist) {
      bestDist = dist
      best = r
    }
  }
  return best ? { act: best.act, step: best.step } : null
}

export interface PlayerArrowKeyHandlers {
  state: 'idle' | 'playing' | 'paused' | 'asking' | 'ended'
  isEditableTarget: boolean
  preventDefault: () => void
  previous: () => void
  next: () => void
  skipAsk: () => void
}

/** Handle Left/Right arrow keys at the player root regardless of focused button. */
export function handlePlayerArrowKey(key: string, ctx: PlayerArrowKeyHandlers): boolean {
  if (ctx.isEditableTarget) return false
  if (key === 'ArrowLeft') {
    ctx.preventDefault()
    ctx.previous()
    return true
  }
  if (key === 'ArrowRight') {
    ctx.preventDefault()
    if (ctx.state === 'asking') ctx.skipAsk()
    else ctx.next()
    return true
  }
  return false
}
