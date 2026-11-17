<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, toRaw, watch } from 'vue'
import { animate, svg } from 'animejs'
import type { VideoAct, VideoStep } from '../../../../../shared/video'
import { VIDEO_PLAYER_TEXT } from '../../../../../shared/video-copy'
import { fitScale, fitReadableScale, flipKeyframes, orderGroups, resetStageElements } from '../../../lib/video-fit'
import { resolveStepActions } from '../../../lib/video-engine'

const props = withDefaults(defineProps<{ act: VideoAct; step: VideoStep; reduced: boolean; static?: boolean }>(), { static: false })
const root = ref<HTMLElement | null>(null), scene = ref<HTMLElement | null>(null), probes = ref<HTMLElement | null>(null)
const scale = ref(1), size = ref({ width: 1, height: 1 })
const scroll = ref({ x: 0, y: 0 })
const breathing = ref(false), stacked = ref(false)
const paths = ref<{ key: string; d: string }[]>([])
const marker = `video-arrow-${Math.random().toString(36).slice(2)}`
const stackLabel = '\u8c03\u7528\u6808'
const pointerIds = computed(() => new Set(props.act.steps.flatMap(s => s.arrows.map(a => a.from))))
const groupsOf = (step: VideoStep) => orderGroups(step.groups, step.cells, step.arrows)
const framesOf = (step: VideoStep) => groupsOf(step).filter(g => g.kind === 'frame')
const othersOf = (step: VideoStep) => groupsOf(step).filter(g => g.kind !== 'frame')
const layoutOrder = (step: VideoStep, group?: string) => groupsOf(step).findIndex(g => group ? g.id === group : g.kind === 'frame')
const trainChain = (step: VideoStep, group: string): boolean => props.act.skin === 'train' && step.arrows.some(a => step.cells.some(c => c.id === a.from && c.group === group) && step.cells.some(c => c.id === a.to && c.group === group))
let previous: VideoStep | undefined, previousAct: VideoAct | undefined, revision = 0
let runningTarget: { step: VideoStep; act: VideoAct } | undefined
let previousPositions = new Map<string, DOMRect>()
let oldValues = new Map<string, string>(), oldCells = new Set<string>(), oldGroups = new Set<string>(), oldArrows = new Set<string>()
let leaving: HTMLElement[] = []
let oldSkinCells: HTMLElement[] = []
let observer: ResizeObserver | undefined
const animations = new Set<ReturnType<typeof animate>>()
function stop(): void {
  revision++; for (const a of animations) a.complete(); animations.clear()
  root.value?.querySelectorAll('.transient').forEach(el => el.remove())
  if (scene.value) resetStageElements(scene.value)
  const output = root.value?.querySelector<HTMLElement>('.output'); if (output) output.style.visibility = ''
}
function run(el: HTMLElement | SVGElement, options: Parameters<typeof animate>[1]): Promise<void> {
  const a = animate(el, options); animations.add(a)
  return Promise.resolve(a).then(() => {}).finally(() => animations.delete(a))
}
function cell(id: string): HTMLElement | null { return scene.value?.querySelector(`[data-cell="${CSS.escape(id)}"]`) ?? null }
function onScroll(): void { if (root.value) scroll.value = { x: root.value.scrollLeft, y: root.value.scrollTop } }
function measure(): void {
  const stage = root.value, samples = probes.value
  if (!stage || !samples) return
  const nodes = [...samples.querySelectorAll<HTMLElement>('.sample-layout')]
  const width = Math.max(1, ...nodes.map(el => el.offsetWidth)), height = Math.max(1, ...nodes.map(el => el.offsetHeight))
  const index = props.act.steps.findIndex(step => toRaw(step) === toRaw(props.step))
  const sample = nodes[index < 0 ? 0 : index]
  if (!sample) return
  sample.classList.remove('stacked')
  stacked.value = !props.static && !!props.act.code && sample.offsetWidth > stage.clientWidth
  sample.classList.toggle('stacked', stacked.value)
  const current = { width: sample.offsetWidth, height: sample.offsetHeight }
  const sampleRect = sample.getBoundingClientRect(), factor = sampleRect.width / sample.offsetWidth || 1
  const rects = [...sample.querySelectorAll<HTMLElement>('.cell')].map(el => el.getBoundingClientRect())
  const cells = rects.length ? { width: (Math.max(...rects.map(r => r.right)) - Math.min(...rects.map(r => r.left))) / factor, height: (Math.max(...rects.map(r => r.bottom)) - Math.min(...rects.map(r => r.top))) / factor } : current
  const card = props.static ? stage.closest('.vc-thumb')?.getBoundingClientRect() : undefined
  const visualScale = stage.getBoundingClientRect().width / stage.clientWidth || 1
  const bounds = card ? { width: card.width / visualScale, height: card.height / visualScale } : { width: stage.clientWidth, height: stage.clientHeight }
  size.value = current
  scale.value = props.static ? fitScale(current, bounds, 0.2) : fitReadableScale(stacked.value ? current : { width, height }, current, cells, bounds, !!props.act.code)
  void nextTick(() => requestAnimationFrame(() => requestAnimationFrame(() => {
    draw()
    const focused = !props.static && props.step.focus?.length ? cell(props.step.focus[props.step.focus.length - 1]) : null
    if (!focused) return
    const bounds = stage.getBoundingClientRect(), target = focused.getBoundingClientRect()
    if (props.act.code) stage.scrollLeft = 0
    else if (target.right > bounds.right) stage.scrollLeft += target.right - bounds.right + 12
    else if (target.left < bounds.left) stage.scrollLeft -= bounds.left - target.left + 12
    if (target.bottom > bounds.bottom) stage.scrollTop += target.bottom - bounds.bottom + 12
    else if (target.top < bounds.top) stage.scrollTop -= bounds.top - target.top + 12
  })))
}
function draw(): void {
  const box = scene.value?.getBoundingClientRect()
  if (!box || !scale.value) return
  const k = box.width / size.value.width || scale.value
  paths.value = props.step.arrows.flatMap((a, arrowIndex) => {
    const fromEl = cell(a.from), toEl = cell(a.to), from = fromEl?.getBoundingClientRect(), to = toEl?.getBoundingClientRect()
    if (!from || !to) return []
    const relative = (x: number, y: number) => [(x - box.left) / k, (y - box.top) / k]
    const sameGroup = fromEl!.closest('[data-group]') === toEl!.closest('[data-group]')
    if (stacked.value && !sameGroup && from.bottom <= to.top) {
      const [sx, sy] = relative(from.left + from.width / 2, from.bottom), [tx, ty] = relative(to.left + to.width / 2, to.top)
      return [{ key: `${a.from}:${a.to}`, d: `M ${sx} ${sy} C ${sx} ${sy + 20}, ${tx} ${ty - 20}, ${tx} ${ty}` }]
    }
    const targetGroup = toEl!.closest('[data-group]')
    const crosses = !sameGroup && from.left < to.left && props.step.arrows.some(other => {
      if (other.from === a.from && other.to === a.to) return false
      const otherFrom = cell(other.from)?.getBoundingClientRect(), otherTarget = cell(other.to)
      const otherTo = otherTarget?.getBoundingClientRect()
      return !!otherFrom && !!otherTo && otherTarget?.closest('[data-group]') === targetGroup && otherFrom.left < otherTo.left && from.top < otherFrom.top && to.top > otherTo.top
    })
    if (crosses && targetGroup) {
      const targetBox = targetGroup.getBoundingClientRect(), sourceBox = fromEl!.closest('.frames')?.getBoundingClientRect() ?? fromEl!.closest('[data-group]')?.getBoundingClientRect() ?? from
      const [sx,sy] = relative(from.right, from.top + from.height / 2), [tx,ty] = relative(to.right, to.top + to.height / 2)
      const top = (Math.min(sourceBox.top, targetBox.top) - box.top) / k - 12, outer = (targetBox.right - box.left) / k + 25
      return [{ key: `${a.from}:${a.to}`, d: `M ${sx} ${sy} C ${sx + 20} ${sy}, ${sx + 20} ${top}, ${sx + 40} ${top} L ${outer - 12} ${top} Q ${outer} ${top} ${outer} ${top + 12} L ${outer} ${ty} L ${tx} ${ty}` }]
    }
    if (sameGroup && from.left < to.right && to.left < from.right) {
      const [x1,y1] = relative(from.right, from.top + from.height / 2), [x2,y2] = relative(to.right, to.top + to.height / 2)
      return [{ key: `${a.from}:${a.to}`, d: `M ${x1} ${y1} C ${x1 + 50} ${y1}, ${x2 + 50} ${y2}, ${x2} ${y2}` }]
    }
    const direction = from.left <= to.left ? 1 : -1
    const [x1,y1] = relative(direction > 0 ? from.right : from.left, from.top + from.height / 2)
    const [x2,y2] = relative(direction > 0 ? to.left : to.right, to.top + to.height / 2)
    const blockers = [...scene.value!.querySelectorAll<HTMLElement>('[data-cell]')].filter(el => el !== fromEl && el !== toEl).filter(el => { const r = el.getBoundingClientRect(); return r.left < Math.max(from.left, to.left) && r.right > Math.min(from.right, to.right) && r.top < Math.max(from.bottom, to.bottom) && r.bottom > Math.min(from.top, to.top) })
    if (props.act.skin === 'train' && sameGroup && !blockers.length) return [{ key: `${a.from}:${a.to}`, d: `M ${x1} ${y1} L ${x2} ${y2}` }]
    if (blockers.length) {
      const [sx,sy] = relative(direction > 0 ? from.right : from.left, from.top + from.height / 2), [tx,ty] = relative(to.left + to.width / 2, to.top)
      const groups = [fromEl, toEl, ...blockers].map(el => el?.closest('[data-group]')?.getBoundingClientRect().top).filter((n): n is number => n !== undefined)
      const top = (Math.min(from.top, to.top, ...groups) - box.top) / k - 12 - (props.step.arrows.length - arrowIndex - 1) * 10, bend = direction * 22
      if (props.act.skin === 'train' && sameGroup && direction > 0) {
        const [targetX, targetY] = relative(to.left, to.top + to.height * 0.35), approach = targetX - 10
        return [{ key: `${a.from}:${a.to}`, d: `M ${sx} ${sy} C ${sx + bend} ${sy}, ${sx + bend} ${top}, ${sx + bend * 2} ${top} L ${approach - 10} ${top} Q ${approach} ${top} ${approach} ${top + 10} L ${approach} ${targetY - 10} Q ${approach} ${targetY} ${targetX} ${targetY}` }]
      }
      return [{ key: `${a.from}:${a.to}`, d: `M ${sx} ${sy} C ${sx + bend} ${sy}, ${sx + bend} ${top}, ${sx + bend * 2} ${top} L ${tx - bend} ${top} C ${tx} ${top}, ${tx} ${top + 12}, ${tx} ${ty}` }]
    }
    return [{ key: `${a.from}:${a.to}`, d: `M ${x1} ${y1} C ${x1 + 45 * direction} ${y1}, ${x2 - 45 * direction} ${y2}, ${x2} ${y2}` }]
  })
}
function position(el: HTMLElement, rect: DOMRect): void {
  const box = scene.value!.getBoundingClientRect(), k = box.width / size.value.width || scale.value
  Object.assign(el.style, { position: 'absolute', left: `${(rect.left - box.left) / k}px`, top: `${(rect.top - box.top) / k}px`, zIndex: '8' })
}
async function transition(): Promise<void> {
  const token = ++revision
  await nextTick(); if (revision !== token) return; draw(); await nextTick()
  if (!scene.value || revision !== token) return
  const flips: Promise<void>[] = []
  if (!props.reduced && !props.static && previousAct && previousAct !== props.act) {
    const sceneBox = scene.value.getBoundingClientRect(), stageBox = root.value!.getBoundingClientRect()
    const actualScale = sceneBox.width / size.value.width || scale.value
    const targetLeft = stageBox.left + (stageBox.width - size.value.width * scale.value) / 2
    const targetTop = stageBox.top + (stageBox.height - size.value.height * scale.value) / 2
    const moved = new Set<HTMLElement>()
    scene.value.querySelectorAll<HTMLElement>('[data-group]').forEach(group => {
      const container = group.classList.contains('frame') ? group.parentElement! : group
      if (moved.has(container)) return
      const shared = [...group.querySelectorAll<HTMLElement>('[data-cell]')].find(el => previousPositions.has(el.dataset.cell!))
      const old = shared && previousPositions.get(shared.dataset.cell!)
      if (!shared || !old) return
      container.style.transform = ''
      const now = shared.getBoundingClientRect()
      const targetX = targetLeft + (now.left - sceneBox.left) / actualScale * scale.value
      const targetY = targetTop + (now.top - sceneBox.top) / actualScale * scale.value
      const rect = container.getBoundingClientRect()
      const targetRect = { left: targetLeft + (rect.left - sceneBox.left) / actualScale * scale.value, top: targetTop + (rect.top - sceneBox.top) / actualScale * scale.value, width: rect.width / actualScale * scale.value, height: rect.height / actualScale * scale.value }
      const flip = flipKeyframes(old, { left: targetX, top: targetY }, scale.value, targetRect, stageBox)
      flips.push(run(container, { translateX: flip.x, translateY: flip.y, duration: 400, ease: 'outQuad', onUpdate: draw }).then(() => { if (revision === token) { container.style.transform = ''; draw() } }))
      moved.add(container)
    })
    draw(); await nextTick()
    if (revision !== token) return
    setTimeout(() => { if (revision === token) draw() }, 420)
  }
  const step = props.step, actions = resolveStepActions(props.act, step)
  const output = root.value?.querySelector<HTMLElement>('.output')
  runningTarget = { step: structuredClone(toRaw(step)), act: props.act }
  const update = () => {
    previous = runningTarget?.step; previousAct = runningTarget?.act; runningTarget = undefined; breathing.value = !props.reduced && !props.static
    previousPositions = new Map([...scene.value!.querySelectorAll<HTMLElement>('[data-cell]')].map(el => [el.dataset.cell!, el.getBoundingClientRect()]))
  }
  if (props.static) { update(); return }
  if (props.reduced) {
    update()
    const path = actions.follow && scene.value.querySelector<SVGPathElement>(`.arrow[data-from="${CSS.escape(actions.follow)}"]`)
    if (path) await run(path, { strokeWidth: [4, 2], duration: 600 })
    return
  }
  if (step.fly?.to === 'out' && output) output.style.visibility = 'hidden'
  const newCells = [...scene.value.querySelectorAll<HTMLElement>('[data-cell]')].filter(el => !oldCells.has(el.dataset.cell!))
  const incomingCars = props.act.skin === 'train' && previousAct === props.act && previous
    ? step.cells.filter(item => trainChain(step, item.group) && previous!.cells.filter(c => c.group === item.group).findIndex(c => c.id === item.id) > step.cells.filter(c => c.group === item.group).findIndex(c => c.id === item.id)).map(item => cell(item.id)).filter((el): el is HTMLElement => !!el)
    : []
  const rootBox = root.value!.getBoundingClientRect()
  oldSkinCells = oldSkinCells.filter(el => { const old = previousPositions.get(el.dataset.origin!); return !!old && old.width <= rootBox.width && old.height <= rootBox.height })
  const skinCells = previousAct && previousAct.skin !== props.act.skin ? [...scene.value.querySelectorAll<HTMLElement>('[data-cell]')].filter(el => oldSkinCells.some(old => old.dataset.origin === el.dataset.cell)) : []
  const newGroups = [...scene.value.querySelectorAll<HTMLElement>('[data-group]')].filter(el => !oldGroups.has(el.dataset.group!) && ![...el.querySelectorAll<HTMLElement>('[data-cell]')].some(c => previousPositions.has(c.dataset.cell!)))
  const newPaths = [...scene.value.querySelectorAll<SVGPathElement>('.arrow')].filter(el => !oldArrows.has(el.dataset.arrow!))
  for (const el of [...newCells, ...newGroups, ...skinCells]) el.style.opacity = '0'
  oldSkinCells.forEach(el => {
    const old = previousPositions.get(el.dataset.origin!)
    if (old && root.value) {
      const box = root.value.getBoundingClientRect(), k = Number(el.dataset.oldScale) || 1
      Object.assign(el.style, { position: 'absolute', left: `${Math.max(0, Math.min(box.width - old.width, old.left - box.left))}px`, top: `${Math.max(0, Math.min(box.height - old.height, old.top - box.top))}px`, transform: `scale(${k})`, transformOrigin: 'top left', zIndex: '8' })
      const copy = el.firstElementChild as HTMLElement; copy.style.width = `${old.width / k}px`; copy.style.height = `${old.height / k}px`
    }
    root.value!.appendChild(el)
  })
  for (const path of newPaths) { const length = path.getTotalLength(); path.style.strokeDasharray = `${length}`; path.style.strokeDashoffset = `${length}` }
  const changed = [...scene.value.querySelectorAll<HTMLElement>('[data-cell]')].filter(el => oldValues.has(el.dataset.cell!) && oldValues.get(el.dataset.cell!) !== step.cells.find(c => c.id === el.dataset.cell)?.value)
  const oldLabels = new Map<HTMLElement, HTMLElement>()
  for (const el of changed) {
    const value = el.querySelector<HTMLElement>('.value'); if (!value) continue
    const old = value.cloneNode() as HTMLElement; old.className = 'value transient old-value'; old.textContent = oldValues.get(el.dataset.cell!) ?? ''; position(old, value.getBoundingClientRect()); scene.value.appendChild(old); oldLabels.set(el, old); value.style.opacity = '0'
  }
  const note = scene.value.querySelector<HTMLElement>('.note'); if (note) note.style.opacity = '0'
  await new Promise<void>(resolve => setTimeout(resolve, 250)); if (revision !== token) return
  const leavingNow = leaving, oldSkinNow = oldSkinCells
  const fadeOut = { opacity: [1,0], duration: 500 }
  leaving = []; oldSkinCells = []
  leavingNow.forEach(el => scene.value!.appendChild(el))
  await Promise.all([
    ...flips,
    ...[...leavingNow, ...oldSkinNow].map(el => run(el, oldSkinNow.includes(el) ? fadeOut : { ...fadeOut, translateY: [0,-24], duration: previousAct?.skin === 'sheet' && el.classList.contains('frame') ? 250 : 450 }).then(() => el.remove())),
    ...newGroups.map(el => run(el, props.act.skin === 'sheet' && el.classList.contains('frame') ? { opacity: [0,1], translateY: [-24,0], duration: 300 } : { opacity: [0,1], scale: [.9,1], duration: 450 })),
    ...[...newCells, ...skinCells].map(el => run(el, { opacity: [0,1], scale: [skinCells.includes(el) ? 1 : .9,1], duration: skinCells.includes(el) ? 500 : 450 })),
    ...incomingCars.map(el => run(el, { translateY: [-36,0], duration: 450, onUpdate: draw }).then(() => { if (revision === token) { el.style.transform = ''; draw() } })),
    ...newPaths.map(path => run(path, { strokeDashoffset: [path.getTotalLength(),0], duration: 450 }).then(() => { if (revision === token) { path.style.strokeDasharray = ''; path.style.strokeDashoffset = '' } }))
  ])
  if (revision !== token) return
  const path = actions.follow && scene.value.querySelector<SVGPathElement>(`.arrow[data-from="${CSS.escape(actions.follow)}"]`)
  if (path) {
    const dots = [0,1,2].map(i => { const dot = document.createElement('span'); dot.className = 'follow-dot transient'; dot.style.opacity = String(1 - i * .3); scene.value!.appendChild(dot); return dot })
    const target = step.arrows.find(a => a.from === actions.follow), el = target && cell(target.to)
    await Promise.all([...dots.map((dot, i) => run(dot, { ...svg.createMotionPath(path), duration: 900 - i * 50, delay: i * 50, ease: 'linear' })),
      (async () => { await new Promise<void>(resolve => setTimeout(resolve, 700)); if (revision === token && el) await run(el, { boxShadow: ['0 0 0 0 #b34b2880','0 0 0 8px #b34b2800'], duration: 200 }) })()])
    dots.forEach(dot => dot.remove())
  }
  if (revision !== token) return
  const doors = actions.open.map(id => cell(id)?.querySelector<HTMLElement>('.door')).filter((el): el is HTMLElement => !!el)
  doors.forEach(door => { door.style.visibility = 'visible' })
  await Promise.all(doors.map(door => run(door, { scaleX: [1,0.08], duration: 350 })))
  if (revision !== token) return
  if (step.fly) {
    const source = cell(step.fly.from), from = (source?.querySelector<HTMLElement>('.value') ?? source)?.getBoundingClientRect(), target = step.fly.to === 'out' ? root.value?.querySelector<HTMLElement>('.output') : cell(step.fly.to), to = target?.getBoundingClientRect()
    if (from && to) {
      const label = document.createElement('span'); label.className = 'fly-label transient'; label.textContent = step.fly.text; position(label, from); scene.value.appendChild(label); label.style.left = `${parseFloat(label.style.left) + (from.width / scale.value - label.offsetWidth) / 2}px`; label.style.top = `${parseFloat(label.style.top) + (from.height / scale.value - label.offsetHeight) / 2}px`
      const startX = from.left + from.width / 2, startY = from.top + from.height / 2
      const dx = (to.left + to.width / 2 - startX) / scale.value, dy = (to.top + to.height / 2 - startY) / scale.value
      const groups = [...scene.value.querySelectorAll<HTMLElement>('[data-group]')].map(el => el.getBoundingClientRect().top)
      const ceiling = Math.max(root.value!.getBoundingClientRect().top + label.offsetHeight * scale.value, Math.min(from.top, ...groups) - 16 * scale.value)
      const lift = (ceiling - startY) / scale.value
      await Promise.all([run(label, { translateX: [0,0,dx,dx], translateY: [0,lift,lift,dy], scale: [.8,1], duration: 900, ease: 'inOutQuad' }),
        (async () => { await new Promise<void>(resolve => setTimeout(resolve, 720)); if (revision === token && target) await run(target, { scale: [1,1.04,1], duration: 180 }) })()]); if (revision === token) { await new Promise<void>(resolve => setTimeout(resolve, 300)); if (revision === token) await run(label, { ...fadeOut, duration: 150 }) } label.remove()
      if (revision === token && step.fly.to === 'out' && output) output.style.visibility = ''
    }
  }
  if (revision !== token) return
  if (output) output.style.visibility = ''
  await Promise.all(changed.flatMap(el => {
    const value = el.querySelector<HTMLElement>('.value'), old = oldLabels.get(el)
    old?.classList.add('struck')
    return [old ? run(old, { translateY: [0,-14], opacity: [1,0], duration: 450 }).then(() => old.remove()) : Promise.resolve(), value ? run(value, { translateY: [14,0], opacity: [0,1], duration: 450 }) : Promise.resolve()]
  }))
  if (revision !== token) return
  await Promise.all([...doors.map(door => run(door, { scaleX: [0.08,1], duration: 300 }).then(() => { door.style.visibility = '' })), ...(note ? [run(note, { opacity: [0,1], duration: 300 })] : [])])
  if (revision === token) update()
}
watch(() => [props.act, props.step], () => {
  if (runningTarget) { previous = runningTarget.step; previousAct = runningTarget.act; runningTarget = undefined }
  stop(); breathing.value = false; oldValues = new Map(previous?.cells.map(c => [c.id,c.value]) ?? []); oldCells = new Set(previous?.cells.map(c => c.id) ?? []); oldGroups = new Set(previous?.groups.map(g => g.id) ?? []); oldArrows = new Set(previous?.arrows.map(a => `${a.from}:${a.to}`) ?? [])
  leaving = []; oldSkinCells = []
  if (scene.value && !props.reduced && !props.static) {
    if (previousAct && previousAct.skin !== props.act.skin && root.value) {
      scene.value.querySelectorAll<HTMLElement>('[data-cell]').forEach(el => {
        const id = el.dataset.cell!, old = previousPositions.get(id)
        if (!old || !props.step.cells.some(c => c.id === id)) return
        const wrapper = root.value!.cloneNode(false) as HTMLElement
        wrapper.className = `skin-${previousAct!.skin} transient`
        wrapper.dataset.origin = id
        wrapper.dataset.oldScale = String(old.width / el.offsetWidth)
        const copy = el.cloneNode(true) as HTMLElement; copy.removeAttribute('data-cell')
        wrapper.appendChild(copy); oldSkinCells.push(wrapper)
      })
    }
    scene.value.querySelectorAll<HTMLElement>('[data-group], [data-cell]').forEach(el => {
      const group = el.dataset.group, id = el.dataset.cell
      if (group && props.step.groups.some(g => g.id === group)) return
      if (id && (props.step.cells.some(c => c.id === id) || !props.step.groups.some(g => g.id === el.closest<HTMLElement>('[data-group]')?.dataset.group))) return
      const clone = el.cloneNode(true) as HTMLElement; clone.classList.add('transient'); clone.removeAttribute('data-group'); clone.removeAttribute('data-cell'); clone.querySelectorAll('[data-cell],[data-group]').forEach(child => { child.removeAttribute('data-cell'); child.removeAttribute('data-group') })
      position(clone, el.getBoundingClientRect()); leaving.push(clone)
    })
  }
  void nextTick(measure)
  void nextTick(draw)
}, { flush: 'sync', immediate: true })
watch(() => [props.reduced, props.static], ([reduced, isStatic]) => {
  if (reduced || isStatic) { stop(); void nextTick(() => { measure(); draw() }) }
})
onMounted(() => { observer = new ResizeObserver(measure); if (root.value) observer.observe(root.value); void nextTick(measure) })
onBeforeUnmount(() => { stop(); observer?.disconnect() })
defineExpose({ transition })
</script>
<template>
  <div ref="root" class="world" :class="[`skin-${act.skin}`, { static: props.static, reduced: props.reduced }]" @scroll="onScroll">
    <div ref="scene" class="scene" :style="{ width: `${size.width}px`, height: `${size.height}px`, left: `max(50%, ${size.width * scale / 2}px)`, top: `max(50%, ${size.height * scale / 2}px)`, transform: `translate(-50%,-50%) scale(${scale})` }">
      <div class="layout" :class="{ 'has-arrows': step.arrows.length, stacked }">
        <div v-if="framesOf(step).length" class="frames" :style="{ '--layout-order': layoutOrder(step) }"><span class="stack-title">{{ stackLabel }}</span>
          <div v-for="(group, index) in framesOf(step)" :key="group.id" class="group frame" :class="{ 'train-chain': trainChain(step, group.id) }" :style="{ '--stack-index': index, zIndex: index }" :data-group="group.id"><span class="group-title">{{ group.title }}</span><div class="cells">
            <div v-for="item in step.cells.filter(c => c.group === group.id)" :key="item.id" class="cell" :class="{ focus: step.focus?.includes(item.id), dim: item.dim || (step.focus?.length && !step.focus.includes(item.id)), pointer: pointerIds.has(item.id), breathing: breathing && step.focus?.includes(item.id), null: /^(null|None)$/.test(item.value) }" :data-cell="item.id"><div class="door"/><div class="cell-head"><span>{{ item.name }}</span><span>{{ item.addr }}</span></div><div class="value" :class="{ empty: item.value === '\u7a7a' }">{{ item.value }}</div><span v-if="step.note?.at === item.id" class="note">{{ step.note.text.replace(/`/g, '') }}</span></div>
          </div></div>
        </div>
        <div v-for="group in othersOf(step)" :key="group.id" class="group" :class="[group.kind, { 'train-chain': trainChain(step, group.id) }]" :style="{ '--layout-order': layoutOrder(step, group.id) }" :data-group="group.id"><span class="group-title">{{ group.title }}</span><div class="cells">
          <div v-for="item in step.cells.filter(c => c.group === group.id)" :key="item.id" class="cell" :class="{ focus: step.focus?.includes(item.id), dim: item.dim || (step.focus?.length && !step.focus.includes(item.id)), pointer: pointerIds.has(item.id), breathing: breathing && step.focus?.includes(item.id), null: /^(null|None)$/.test(item.value) }" :data-cell="item.id"><div class="door"/><div class="cell-head"><span>{{ item.name }}</span><span>{{ item.addr }}</span></div><div class="value" :class="{ empty: item.value === '\u7a7a' }">{{ item.value }}</div><span v-if="step.note?.at === item.id" class="note">{{ step.note.text.replace(/`/g, '') }}</span></div>
        </div></div>
      </div>
      <svg class="arrows" aria-hidden="true"><defs><marker :id="marker" markerUnits="userSpaceOnUse" markerWidth="10" markerHeight="9" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="currentColor" /></marker></defs><path v-for="p in paths" :key="p.key" class="arrow" :data-arrow="p.key" :data-from="p.key.split(':')[0]" :d="p.d" :marker-end="`url(#${marker})`" /></svg>
    </div>
    <div v-if="step.out !== undefined || step.fly?.to === 'out'" class="output-pin" :style="{ transform: `translate(${scroll.x}px, ${scroll.y}px)` }"><div class="output"><small>{{ VIDEO_PLAYER_TEXT.output }}</small><pre>{{ step.out }}</pre></div></div>
    <div ref="probes" class="probes" aria-hidden="true"><div v-for="(sample, n) in act.steps" :key="n" class="sample-layout layout" :class="{ 'has-arrows': sample.arrows.length }"><div v-if="framesOf(sample).length" class="frames" :style="{ '--layout-order': layoutOrder(sample) }"><div v-for="(group, index) in framesOf(sample)" :key="group.id" class="group frame" :class="{ 'train-chain': trainChain(sample, group.id) }" :style="{ '--stack-index': index, zIndex: index }"><span class="group-title">{{ group.title }}</span><div class="cells"><div v-for="item in sample.cells.filter(c => c.group === group.id)" :key="item.id" class="cell" :class="{ pointer: pointerIds.has(item.id) }"><div class="cell-head"><span>{{ item.name }}</span><span>{{ item.addr }}</span></div><div class="value" :class="{ empty: item.value === '\u7a7a' }">{{ item.value }}</div></div></div></div></div><div v-for="group in othersOf(sample)" :key="group.id" class="group" :class="[group.kind, { 'train-chain': trainChain(sample, group.id) }]" :style="{ '--layout-order': layoutOrder(sample, group.id) }"><span class="group-title">{{ group.title }}</span><div class="cells"><div v-for="item in sample.cells.filter(c => c.group === group.id)" :key="item.id" class="cell" :class="{ pointer: pointerIds.has(item.id) }"><div class="cell-head"><span>{{ item.name }}</span><span>{{ item.addr }}</span></div><div class="value" :class="{ empty: item.value === '\u7a7a' }">{{ item.value }}</div></div></div></div></div></div>
  </div>
</template>
<style scoped>
.world{position:relative;flex:1;min-width:0;min-height:240px;overflow:hidden;background:var(--mi-canvas)}.scene{position:absolute;left:50%;top:50%;transform-origin:center;transition:transform .4s;overflow:visible}.layout{display:flex;align-items:flex-start;gap:56px;width:max-content}.frames{display:flex;flex-direction:column-reverse;gap:16px;position:relative;padding-top:26px}.stack-title{position:absolute;top:0;left:0;color:var(--mi-text-3);font-size:14px}.group{box-sizing:border-box;border:1px dashed var(--mi-border);border-radius:var(--mi-radius-lg);padding:36px 16px 16px;position:relative;min-width:200px}.group-title{position:absolute;top:7px;left:14px;color:var(--mi-text-3);font-size:14px}.cells{display:flex;flex-direction:column;gap:16px}.array .cells{flex-direction:row;gap:0}.cell{box-sizing:border-box;position:relative;min-width:200px;min-height:80px;background:var(--mi-bg);border:1px solid var(--mi-border);border-radius:var(--mi-radius);padding:10px 12px}.array .cell{min-width:96px}.cell.dim{opacity:.38}.cell-head{display:flex;justify-content:space-between;gap:12px;color:var(--mi-text-3);font:14px var(--mi-code)}.value{font:28px/1.25 var(--mi-code)}.door{display:none}.skin-locker .cells{flex-direction:row;gap:16px}.skin-locker .cell:not(.pointer){height:122px;border:2px solid var(--mi-border-control,var(--mi-border));border-radius:10px;padding:36px 14px 10px;perspective:500px}.skin-locker .cell:not(.pointer) .cell-head span:last-child{position:absolute;top:5px;left:50%;transform:translateX(-50%);background:var(--mi-text);color:white;border-radius:4px;padding:2px 10px}.skin-locker .cell:not(.pointer) .cell-head span:first-child{color:var(--mi-blue-deep)}.skin-locker .cell:not(.pointer) .door{display:block;position:absolute;inset:2px;border:1px solid var(--mi-border);border-left:2px solid var(--mi-border);background:#ffffff18;transform-origin:left center;pointer-events:none;backface-visibility:visible}.skin-locker .cell:not(.pointer) .door:after{content:'';position:absolute;right:7px;top:50%;width:8px;height:8px;background:var(--mi-text-3);border-radius:50%}.skin-locker .pointer{background:#fffdf3;border:1.5px dashed var(--mi-border);transform:rotate(-3deg);box-shadow:0 3px 7px #0002}.skin-locker .pointer:after{content:'';position:absolute;right:0;top:0;border-left:12px solid transparent;border-top:12px solid #e8dfc8}.skin-sheet .frame{background:repeating-linear-gradient(to bottom,#fff 0,#fff 27px,#e4eaf3 28px);box-shadow:0 4px 8px #0002;padding-left:30px}.skin-sheet .frame:before{content:'●\a ●\a ●';white-space:pre;position:absolute;left:8px;top:24px;line-height:28px;color:#cbd0d7}.skin-sheet .frames{display:grid;gap:0}.skin-sheet .frames .frame{grid-area:1/1;margin-top:calc(var(--stack-index) * 28px);margin-left:calc(var(--stack-index) * 12px)}.skin-train .cell{border-radius:18px 18px 6px 6px}.skin-train .cell:after{content:'●     ●';position:absolute;bottom:-17px;left:15px;white-space:pre;font-size:14px;color:var(--mi-text-3)}.skin-train .cell.null:after{content:'│';right:-12px;left:auto;bottom:30px;font-size:22px}.skin-train .arrow{stroke-width:4}.note{position:absolute;z-index:3;left:50%;top:-26px;transform:translateX(-50%);background:var(--mi-text);color:var(--mi-bg);padding:4px 8px;border-radius:var(--mi-radius);white-space:nowrap;font-size:12px}.arrows{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;color:#b34b28}.arrow{fill:none;stroke:currentColor;stroke-width:2}.output{position:absolute;right:12px;bottom:12px;background:#222;color:white;padding:8px 12px;border-radius:8px;min-width:80px}.output pre{margin:0;white-space:pre-wrap}:deep(.follow-dot){position:absolute;left:-5px;top:-5px;width:10px;height:10px;border-radius:50%;background:#b34b28;box-shadow:0 0 8px #b34b28}:deep(.fly-label){background:#b34b28;color:white;border-radius:14px;padding:3px 12px}.old-value.struck{text-decoration:line-through}.probes{position:absolute;visibility:hidden;pointer-events:none;left:-100000px;top:0}.sample-layout{position:relative}.breathing{animation:breathe 2s ease-in-out infinite}@keyframes breathe{50%{transform:scale(1.03)}}.world.static{min-height:0;width:100%;height:100%;overflow:visible}.static .scene,.reduced .scene{transition:none}@media(max-width:700px){.world{min-height:180px}.layout{gap:56px}}

/* D1-D4: constrain doors, retain readable scale and expose older stack titles. */
.world{--video-locker-value-size:34px;--video-empty-value-size:20px;--video-fly-size:20px}
.output-pin{position:absolute;right:12px;bottom:12px;z-index:4;pointer-events:none}.output-pin .output{position:static}
.layout.has-arrows{padding:44px 60px 0 0}
.skin-memory .group{width:max-content}
.skin-memory .array .cell{min-width:200px}
.skin-memory .value{white-space:nowrap}
.skin-train .train-chain .cells{flex-direction:row;align-items:center;gap:28px}
.world:not(.static){overflow:auto}.world:not(.static):has(.layout.stacked){overflow-x:hidden}.layout.stacked{flex-direction:column;align-items:center;gap:16px}.layout.stacked > *{order:var(--layout-order)}
.skin-locker .cell:not(.pointer){width:132px;min-width:132px;height:150px;min-height:150px;overflow:hidden;border:2px solid #b9b5a8;background:linear-gradient(#fff,#f6f4ee);padding:0}
.skin-locker .cell:not(.pointer) .cell-head span:first-child{position:absolute;left:12px;top:32px;color:#a84e30}
.skin-locker .cell:not(.pointer) .cell-head span:last-child{top:0;border-radius:0 0 7px 7px;font-size:14px}
.skin-locker .cell:not(.pointer) .value{position:absolute;left:0;right:0;top:58px;text-align:center;font-size:var(--video-locker-value-size);line-height:1.2}
.skin-locker .cell:not(.pointer) .value.empty{font-size:var(--video-empty-value-size);color:#6b6963;top:68px}
.skin-locker .cell:not(.pointer) .door{visibility:hidden;inset:26px 6px 6px;border:1px solid #cfcabc;border-radius:6px;background:linear-gradient(90deg,#efece4,#e4e0d4);transform-origin:left center;z-index:2}
.skin-locker .cell:not(.pointer):before{content:'';position:absolute;left:10px;top:30px;bottom:12px;width:2px;background:#d8d4c8}
.skin-locker .cell:not(.pointer):after{content:'';position:absolute;right:12px;top:78px;width:9px;height:9px;background:#b9b5a8;border-radius:50%}
.cell.focus{border-color:#b34b28;box-shadow:0 0 0 4px #f6e6df}
.skin-locker .pointer{width:150px;min-width:150px;min-height:96px;height:96px}
.skin-locker .cells:has(> .pointer + .pointer){flex-direction:column-reverse}
.skin-memory .frames{gap:8px}
.skin-memory .frame{padding:28px 12px 8px}
.skin-memory .frame .cells{gap:8px}
.skin-memory .frame .cell{min-height:64px;padding:4px 10px}
.skin-sheet .frames{display:flex;flex-direction:column-reverse;gap:0}
.skin-sheet .frames .frame{margin:0;min-width:240px}
.skin-sheet .frames .frame:not(:last-child){height:38px;min-height:38px;margin:-6px 6px 0;overflow:hidden;padding:0 30px;background:#fbfaf7}
.skin-sheet .frames .frame:not(:last-child):not(:nth-last-child(2)){margin-left:12px;margin-right:12px;background:#f6f5f1}
.skin-sheet .frames .frame:not(:last-child) .cells{display:none}
.skin-sheet .frames .frame:not(:last-child) .group-title{left:30px}
.skin-sheet .frames .frame:not(:last-child):before{display:none}
:deep(.fly-label){font:var(--video-fly-size)/1.2 var(--mi-code);z-index:8}

.door { opacity: 1; }
</style>
