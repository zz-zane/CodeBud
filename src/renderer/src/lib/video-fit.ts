import type { VideoStep } from '../../../shared/video'

export interface Size { width: number; height: number }
export function fitScale(content: Size, stage: Size, minScale = 0.6): number {
  if (![content.width, content.height, stage.width, stage.height].every(n => Number.isFinite(n) && n > 0)) return 1
  const minimum = Number.isFinite(minScale) ? Math.max(0.2, Math.min(2.2, minScale)) : 0.6
  return Math.max(minimum, Math.min(2.2, stage.width * 0.86 / content.width, stage.height * 0.80 / content.height))
}

/** Preserve the act scale where possible; enlarge sparse steps without cropping their layout. */
export function fitStepScale(maxContent: Size, currentContent: Size, cells: Size, stage: Size, minScale = 0.6): number {
  if (![maxContent.width, maxContent.height, currentContent.width, currentContent.height, cells.width, cells.height, stage.width, stage.height].every(n => Number.isFinite(n) && n > 0)) return 1
  const maxFit = fitScale(currentContent, stage, 0.2)
  const base = Math.min(fitScale(maxContent, stage, minScale), maxFit)
  const target = Math.min(stage.width * 0.47 / cells.width, stage.height * 0.47 / cells.height)
  return Math.min(maxFit, Math.max(base, target))
}

export function fitReadableScale(maxContent: Size, currentContent: Size, cells: Size, stage: Size, _hasCode: boolean): number {
  const minimum = 0.85
  return Math.max(minimum, Math.min(1.4, fitStepScale(maxContent, currentContent, cells, stage, minimum)))
}

export function flipKeyframes(old: { left: number; top: number }, target: { left: number; top: number }, scale: number, container?: Size & { left: number; top: number }, bounds?: Size & { left: number; top: number }): { x: [number, number]; y: [number, number] } {
  const k = Number.isFinite(scale) && scale > 0 ? scale : 1
  let x = old.left - target.left, y = old.top - target.top
  if (container && bounds) {
    const minX = bounds.left - container.left, maxX = bounds.left + bounds.width - container.left - container.width
    const minY = bounds.top - container.top, maxY = bounds.top + bounds.height - container.top - container.height
    x = minX <= maxX ? Math.max(minX, Math.min(maxX, x)) : 0
    y = minY <= maxY ? Math.max(minY, Math.min(maxY, y)) : 0
  }
  return { x: [x / k, 0], y: [y / k, 0] }
}

export function resetStageElements(scene: ParentNode): void {
  scene.querySelectorAll<HTMLElement>('[data-cell], [data-group], .frames, .value, .note, .door').forEach(el => {
    el.style.opacity = ''; el.style.transform = ''; el.style.boxShadow = ''; el.style.visibility = ''
  })
  scene.querySelectorAll<SVGPathElement>('.arrow').forEach(el => {
    el.style.strokeDasharray = ''; el.style.strokeDashoffset = ''; el.style.strokeWidth = ''
  })
}

export function orderGroups(groups: VideoStep['groups'], cells: VideoStep['cells'], arrows: VideoStep['arrows']): VideoStep['groups'] {
  const ordered = [...groups], byCell = new Map(cells.map(c => [c.id, c.group]))
  for (let i = 0; i < ordered.length; i++) for (let j = i + 1; j < ordered.length; j++) {
    const left = ordered[i].id, right = ordered[j].id
    const between = arrows.filter(a => (byCell.get(a.from) === left && byCell.get(a.to) === right) || (byCell.get(a.from) === right && byCell.get(a.to) === left))
    if (between.length && between.every(a => byCell.get(a.from) === right)) [ordered[i], ordered[j]] = [ordered[j], ordered[i]]
  }
  return ordered
}
