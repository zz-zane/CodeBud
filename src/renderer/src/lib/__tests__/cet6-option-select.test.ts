/**
 * 六级做题页：选项里能选词查释义（2026-11-23）。
 * - 交卷后选项用 aria-disabled 而不是 disabled：停用的 <button> 不派发鼠标事件，选词条收不到 mouseup。
 * - 选项点击先过 isSelectingTextIn：在按钮里拖选单词时浏览器会补一个 click，不拦就会顺手改答案。
 * - Section B 已选段落开头字母划掉（只划字母）。
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

const read = (rel: string): string => readFileSync(join(__dirname, '..', '..', rel), 'utf8')
const paper = read('components/cet6/Cet6Paper.vue')
const panel = read('components/cet6/Cet6Panel.vue')

describe('六级选项可选词', () => {
  it('作答控件不再用 :disabled 锁定，改用 aria-disabled', () => {
    for (const src of [paper, panel]) {
      expect(src).not.toContain(':disabled="submitted || q.unanswerable === true"')
      expect(src).toContain(':aria-disabled="submitted || q.unanswerable === true"')
    }
  })

  it('每个选答案的点击都先判断锁定与「正在选字」', () => {
    const clicks = [...(paper + panel).matchAll(/@click="([^"]*emit\('choose'[^"]*)"/g)].map((m) => m[1])
    expect(clicks.length).toBe(4)
    for (const c of clicks) {
      expect(c).toContain('!(submitted || q.unanswerable === true)')
      expect(c).toContain('!isSelectingTextIn($event.currentTarget)')
    }
  })

  it('Section B：已选段落的开头字母划掉，字母格里被别的题选过的也划掉', () => {
    expect(paper).toContain(':class="{ used: usedLetters.has(item.letter) }"')
    expect(paper).toMatch(/\.cet6-marker\.used \{[^}]*line-through/)
    expect(panel).toContain(":class=\"{ ...ctlClass(q, k), used: used.has(k) }\"")
    expect(panel).toMatch(/\.cet6-letter\.used:not\(\.on\)[^{]*\{[^}]*line-through/)
  })
})

describe('手机长按选词（不触发系统复制菜单）', () => {
  const bar = read('components/cet6/Cet6SelectionBar.vue')
  it('粗指针下关掉原生选字与长按菜单，输入框除外；用自画覆盖层画选中', () => {
    expect(bar).toContain("el.classList.add('cet6-tap-select')")
    expect(bar).toMatch(/\.cet6-tap-select \.cet6-right \{[^}]*user-select: none;[^}]*-webkit-touch-callout: none;/)
    expect(bar).toMatch(/\.cet6-tap-select input \{[^}]*user-select: text;/)
    expect(bar).toContain("createRangeOverlay('pick')") // 自画覆盖层：旧版 iPad Safari 不支持 CSS Highlight
    expect(bar).toContain("addEventListener('contextmenu', onContextMenu)")
  })
  it('长按后松手吞掉 click（选项上长按不选答案）；系统选区变化不收起长按选的词', () => {
    expect(bar).toMatch(/if \(longPressed\) \{ longPressed = false; e\.preventDefault\(\); return \}/)
    expect(bar).toMatch(/function onSelectionChange\(\): void \{\s*\/\/[^\n]*\n\s*if \(picked\) return/)
  })
})
