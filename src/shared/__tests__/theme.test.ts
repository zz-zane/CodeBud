import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { TITLE_SYMBOL_COLOR, WINDOW_BG } from '../theme'

/**
 * 原生层颜色的闸门：**把 `theme.ts` 里两个常量钉在 CSS 上**
 * （窗口底色 WINDOW_BG ← cds-adapter.css 的 `--mi-shell-canvas`；
 * 顶栏按钮符号色 TITLE_SYMBOL_COLOR ← tokens.css 的 `--mi-text`）。应用只有浅色。
 *
 * 【为什么需要它】
 * `BrowserWindow.backgroundColor` 是原生层的东西，而主进程**读不到 CSS 变量**，
 * 所以这两个值必然是**写在两处**的 —— CSS 一处、`theme.ts` 一处。
 * 本项目对「同一件事两个真源」是有旧账的（`md.ts:48-58`）。
 * 本测试就是那道赔偿：**改了 CSS 没改这里，它必须红。**
 */

const STYLES = join(__dirname, '..', '..', 'renderer', 'src', 'styles')
const TOKENS = readFileSync(join(STYLES, 'tokens.css'), 'utf8')
const ADAPTER = readFileSync(join(STYLES, 'cds-adapter.css'), 'utf8')

const canvas = /--mi-shell-canvas:\s*(#[0-9a-f]{6});/.exec(ADAPTER)?.[1]

/**
 * ⚠️ 正则里冒号**紧跟在 `text` 后面**：`--mi-text-2` / `--mi-text-3` 的冒号前
 * 还有 `-2`/`-3`，不会误命中。放宽成 `--mi-text[^:]*:` 会悄悄拿错值（假绿）。
 */
const text = /--mi-text:\s*([^;]+);/.exec(TOKENS.slice(TOKENS.indexOf(':root {')))?.[1]?.trim()

describe('窗口底色与设计令牌一致', () => {
  it('canvas 能读出来（防空匹配）', () => {
    expect(canvas).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('WINDOW_BG 逐字等于 --mi-shell-canvas', () => {
    expect(WINDOW_BG).toBe(canvas)
  })
})

describe('顶栏按钮符号色与主文字色一致（2026-10-05 顶条玻璃化）', () => {
  it('--mi-text 能读出来（防空匹配）', () => {
    expect(text).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('TITLE_SYMBOL_COLOR 逐字等于 tokens.css 的 --mi-text', () => {
    expect(TITLE_SYMBOL_COLOR).toBe(text)
  })
})

describe('应用只有浅色：CSS 里不再有任何暗色入口（2026-11-13）', () => {
  it('tokens.css / cds-adapter.css 不含 data-theme / data-mode / color-scheme: dark', () => {
    for (const css of [TOKENS, ADAPTER]) {
      expect(css).not.toMatch(/data-theme|data-mode|color-scheme:\s*dark/)
    }
  })
})
