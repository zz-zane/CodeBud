import { describe, expect, it } from 'vitest'
import { findLoose, normalizeWithMap } from '../cet6-evidence'

describe('解析依据在页面文字里的宽松匹配', () => {
  it('规范化：空白压成一个、首尾空白去掉、弯引号统一，map 指回原串', () => {
    const { norm, map } = normalizeWithMap('  It’s   a\n“test”  ')
    expect(norm).toBe('It\'s a "test"')
    expect(map[0]).toBe(2)
    expect(map[norm.length - 1]).toBe(16) // 原串里收尾的 ” 在第 16 位
  })

  it('跨换行、大小写不同、弯直引号不同都能找到，返回原串下标', () => {
    const page = 'A) Levels noticed that\n there was a growing need for “people like himself”.'
    const quote = 'there was a growing need for "people like himself"'
    const hit = findLoose(page, quote)!
    expect(page.slice(hit[0], hit[1])).toBe('there was a growing need for “people like himself”')
  })

  it('找不到或空引文返回 null', () => {
    expect(findLoose('abc def', 'xyz')).toBeNull()
    expect(findLoose('abc def', '   ')).toBeNull()
  })
})

describe('依据定位接线', () => {
  const read = (rel: string): string => require('fs').readFileSync(require('path').join(__dirname, '..', '..', rel), 'utf8') as string
  it('阅读原文两处、听力原文一处挂了容器标记，做题页启用定位，解析里有定位按钮；波浪线常驻、点定位才闪', () => {
    const ev = read('lib/use-cet6-evidence.ts')
    expect(ev).toContain("createRangeOverlay('evidence')")
    expect(ev).toContain('show(current.value?.evidence, false)')
    expect(ev).toContain('show(q.evidence, true)')
    const css = read('styles/range-overlay.css')
    expect(css).toContain('.range-ov--evidence .range-ov-row::after')
    expect(css).toMatch(/\.range-ov--evidence\.flash \.range-ov-row \{ animation: range-ov-flash/)
    const paper = read('components/cet6/Cet6Paper.vue')
    expect(paper.match(/:data-evidence-text=/g)?.length).toBe(2)
    expect(paper).toContain(':data-evidence-transcript="bv.block.id"')
    expect(read('views/Cet6ExamView.vue')).toContain('useCet6Evidence(rootEl, currentQ, submitted)')
    const review = read('components/cet6/Cet6Review.vue')
    expect(review).toContain('CET6.LOCATE_EVIDENCE')
  })
})
