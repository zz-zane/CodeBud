/**
 * 交卷后：当前题的解析依据直接画在左侧原文 / 听力原文上（2026-11-23 用户要求「定位要直接在原文里显示，比如划线」）。
 * - 换题（交卷后）：依据每行底部画橘色波浪线，并滚到视野中间；波浪线常驻，直到定位另一道题。
 * - 点解析里的「在原文中定位」（window 事件 cet6-locate，detail = 那道题）：滚过去，并按用户给的录屏
 *   让整行黄底先加深再淡出，波浪线保留。
 * 听力原文在折叠的 <details> 里时先展开。画法用自画覆盖层（lib/range-overlay.ts），旧版 Safari 也能显示。
 */
import { nextTick, onBeforeUnmount, onMounted, watch, type Ref } from 'vue'
import type { Cet6Evidence, Cet6Question } from '../../../shared/cet6'
import { evidenceContainer, rangeInElement } from './cet6-evidence'
import { createRangeOverlay, scrollParent } from './range-overlay'

export const CET6_LOCATE_EVENT = 'cet6-locate'

export function useCet6Evidence(root: Ref<HTMLElement | null>, current: Ref<Cet6Question | null>, active: Ref<boolean>): void {
  const layer = createRangeOverlay('evidence')
  let seq = 0

  async function show(evidence: Cet6Evidence[] | undefined, flash: boolean): Promise<void> {
    const my = ++seq
    if (!active.value || !evidence?.length) { layer.clear(); return }
    await nextTick()
    const box0 = root.value
    if (!box0 || my !== seq) return
    const ranges: Range[] = []
    for (const ev of evidence) {
      const box = evidenceContainer(box0, ev)
      if (!box) continue
      const fold = box.closest('details')
      if (fold && !fold.open) { fold.open = true; await nextTick() }
      const r = rangeInElement(box, ev.quote)
      if (r) ranges.push(r)
    }
    if (my !== seq) return
    if (!ranges.length) { layer.clear(); return }
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
    // 按依据句本身居中，而不是它所在的元素：听力原文是一整段长文字，把整段居中会让依据句跑出视野（2026-11-23 WebKit 实测）
    const clip = scrollParent(ranges[0].commonAncestorContainer)
    const r = ranges[0].getBoundingClientRect()
    const box = clip?.getBoundingClientRect() ?? { top: 0, height: innerHeight }
    const dy = r.top + r.height / 2 - (box.top + box.height / 2)
    ;(clip ?? window).scrollBy({ top: dy, behavior: reduce ? 'auto' : 'smooth' })
    layer.set(ranges)
    if (flash) layer.flash()
  }

  // 换题 / 交卷 / 重新作答：换成这道题的波浪线；flush post 等左侧换成这道题的原文后再找
  watch([() => current.value?.id, active], () => void show(current.value?.evidence, false), { flush: 'post' })

  function onLocate(e: Event): void {
    const q = (e as CustomEvent<Cet6Question>).detail
    if (q) void show(q.evidence, true)
  }
  onMounted(() => window.addEventListener(CET6_LOCATE_EVENT, onLocate))
  onBeforeUnmount(() => {
    window.removeEventListener(CET6_LOCATE_EVENT, onLocate)
    seq++
    layer.destroy()
  })
}
