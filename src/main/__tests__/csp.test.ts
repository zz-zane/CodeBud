import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'

/**
 * 渲染层 CSP 静态闸门（P10.1 §7.1-12 加固项：form-action / object-src /
 * base-uri 三项净增）
 *
 * 只读文件、不起 Electron：这层证明「发出去的 index.html 里那条 CSP 串长对
 * 了」；运行时拦不拦得住不归它管 —— CDP 测不出页面 CSP（DevTools 对它豁免，
 * 见 index.html 注释），那份证据在真实挂载里。
 *
 * 三条纪律：
 *  ① 尺子自检在前：meta 抠不出 / 抠出来是空串 / 不含 default-src ⇒ 每个
 *    用例当场红 —— 绝不允许「没抠到 ⇒ 跳过」（那是假绿的标准配方）。
 *  ② 正控：五项加固目标逐字在串里（connect-src 'self' 是「不许回退成
 *    'none'」的音效命脉，docs/22 §7.3-a）。
 *  ③ 负控：connect-src 不许出现 `*`；整串不许含 unsafe-eval；已退役的
 *    miai-wall: 协议不许再出现在任何源里。
 *
 * 【字符串纪律】代码内字符串一律英文；中文只在注释里。
 */

const HTML_PATH = resolve(__dirname, '../../renderer/index.html')

/** 匹配真实写法（属性跨行，用 \s+ 串联）；抠的是 content 的引号内整串 */
const CSP_META_RE = /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"/

/**
 * 抠出 CSP content 串；抠失败直接红。每个用例都先过这层 —— 尺子不可能被
 * 绕开：文件被改到正则对不上时，红的是「找不到 CSP」，而不是静默跳过。
 */
function extractCsp(): string {
  const html = readFileSync(HTML_PATH, 'utf8')
  const match = CSP_META_RE.exec(html)
  expect(match, 'ruler self-check: CSP meta tag not found in index.html').not.toBeNull()
  const csp = match?.[1] ?? ''
  expect(csp.length, 'ruler self-check: extracted CSP string is empty').toBeGreaterThan(0)
  expect(csp, 'ruler self-check: extracted string lacks default-src').toContain('default-src')
  return csp
}

describe('renderer CSP content string', () => {
  it('positive: every hardened directive is present verbatim', () => {
    const csp = extractCsp()
    const required = [
      "default-src 'self'",
      "connect-src 'self'",
      "form-action 'none'",
      "object-src 'none'",
      "base-uri 'none'"
    ]
    for (const item of required) {
      expect(csp, `missing CSP directive: ${item}`).toContain(item)
    }
  })

  it('negative: no connect-src wildcard, no ws:, no dev-server http source', () => {
    const csp = extractCsp()
    // `*` 会把加固整个抹平：一个源都不设防等于没设 CSP
    expect(csp, 'connect-src * defeats the whole policy').not.toContain('connect-src *')
    // dev HMR 的 WebSocket 是同源 ws://localhost:5173，CSP3 下 'self' 已覆盖
    // （Chromium 实现）—— 加 ws: / connect-src http://localhost:* 是多余的
    // 放宽，会削弱加固（P10.1 本批明确不许加；这条守着那份决定不被好心人
    // 「修 HMR 报错」时悄悄反转）。
    expect(csp, "ws: must not be added; same-origin ws is covered by 'self'").not.toContain('ws:')
    expect(csp, 'dev-server http source must not be added to connect-src').not.toContain('connect-src http://localhost:*')
  })

  it('negative: unsafe-eval is absent from every directive', () => {
    const csp = extractCsp()
    // script-src 'unsafe-eval' once existed only for the retired wallpaper engine
    // (new Function); nothing in the renderer build needs it any more.
    expect(csp, 'unsafe-eval must not appear anywhere in the CSP').not.toContain('unsafe-eval')
  })

  it('negative: retired miai-wall: scheme is not listed in any source', () => {
    const csp = extractCsp()
    expect(csp, 'miai-wall: scheme is no longer registered').not.toContain('miai-wall:')
  })
})
