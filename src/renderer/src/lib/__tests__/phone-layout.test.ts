import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { maskComments } from '../../../../shared/__tests__/mask-comments'

/**
 * 手机版面闸门（docs/29 §4）：phone.css 的每一条规则都必须落在 `@media (max-width: 768px)` 里，
 * 桌面窗口最小宽 1000px，命不中它，才能保证桌面像素不变。壳层的手机分支（抽屉、手机标题）
 * 只在 isPhone 为真时渲染。
 */
const SRC = join(__dirname, '..', '..')
const read = (...p: string[]): string => readFileSync(join(SRC, ...p), 'utf8')

/** 去掉所有 `@media (max-width: 768px) { ... }` 块（花括号配平）后剩下的文本 */
function stripPhoneMedia(css: string): string {
  const head = '@media (max-width: 768px)'
  let out = ''
  let i = 0
  while (i < css.length) {
    if (css.startsWith(head, i)) {
      const open = css.indexOf('{', i)
      let depth = 0
      let j = open
      for (; j < css.length; j++) {
        if (css[j] === '{') depth++
        else if (css[j] === '}' && --depth === 0) break
      }
      i = j + 1
    } else {
      out += css[i++]
    }
  }
  return out
}

describe('phone.css 门控', () => {
  const css = maskComments(read('styles', 'phone.css'))

  it('文件里没有任何一条规则在 768px 媒体查询之外', () => {
    expect(stripPhoneMedia(css).trim()).toBe('')
  })

  it('只用 max-width: 768px 一个断点，没有 min-width / 其它宽度', () => {
    const queries = [...css.matchAll(/@media\s*([^{]+)\{/g)].map((m) => m[1].trim())
    expect(queries.length).toBeGreaterThan(0)
    for (const q of queries) expect(q).toBe('(max-width: 768px)')
  })

  it('没有颜色字面量（只读令牌）', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(css).not.toMatch(/\brgba?\(/)
  })

  it('phone.css 在 main.ts 里在其它样式之后引入', () => {
    const main = read('main.ts')
    expect(main.indexOf("styles/phone.css")).toBeGreaterThan(main.indexOf("styles/page.css"))
  })
})

describe('壳层手机分支只在 isPhone 下渲染', () => {
  const app = read('App.vue')

  it('抽屉遮罩、手机标题都带 isPhone 条件', () => {
    expect(app).toMatch(/v-if="isPhone && phoneNavOpen && !examLock"[^>]*\s+class="phone-backdrop"|class="phone-backdrop"/)
    expect(app).toMatch(/v-if="isPhone && !isBare && !examLock" class="phone-title"/)
  })

  it('isPhone 来自 768px 媒体查询', () => {
    expect(app).toContain("window.matchMedia('(max-width: 768px)')")
  })

  it('桌面分支不受 phoneNavOpen 影响：is-hidden 仅在非手机时给', () => {
    expect(app).toContain("'is-hidden': sidebarHidden && !isPhone")
  })
})

describe('手机操作体验（docs/29「手机操作体验」）静态守卫', () => {
  const app = read('App.vue')
  const css = maskComments(read('styles', 'phone.css'))

  it('viewport 用 resizes-visual 且不禁用缩放', () => {
    const html = readFileSync(join(SRC, '..', 'index.html'), 'utf8')
    const meta = html.match(/<meta name="viewport"[^>]*>/)?.[0] ?? ''
    expect(meta).toContain('interactive-widget=resizes-visual')
    expect(meta).not.toMatch(/user-scalable\s*=\s*(no|0)/)
    expect(meta).not.toContain('maximum-scale')
    expect(html).not.toContain('resizes-content')
  })

  it('壳层高度是稳定的 100dvh，不再依赖键盘驱动的变量', () => {
    expect(css).not.toContain('--mi-phone-vh')
    expect(app).not.toContain('--mi-phone-vh')
    expect(css).toMatch(/\.claude-app-container \{\s*height: 100dvh;/)
  })

  it('标签栏与手机转场都由 isPhone 门控；桌面保持 mi-route + out-in', () => {
    expect(app).toMatch(/showTabBar = computed\(\s*\(\) =>\s*isPhone\.value &&/)
    expect(app).toContain('<PhoneTabBar v-if="showTabBar" />')
    expect(app).toContain(":name=\"isPhone ? slideName || 'mi-instant' : 'mi-route'\"")
    expect(app).toContain(":mode=\"isPhone ? 'default' : 'out-in'\"")
    expect(app).toContain(':css="!isPhone || !!slideName"')
    // 考试页 / 考试锁 / 全屏浮层里不显示
    for (const needle of ["route.name !== 'cet6-exam'", '!examLock.value', '!isQuizActive.value', '!settingsDialog.open', '!shouldShowRightPanel.value']) {
      expect(app).toContain(needle)
    }
    expect(css).toContain('.phone-tabbar')
    expect(css).toContain('.mi-slide-fwd-enter-from')
  })

  it('详情页顶栏返回键与桌面前进 / 后退键只在对应宽度渲染', () => {
    expect(app).toContain('v-if="isPhoneDetail"')
    expect(app).toMatch(/v-if="!isPhone"\s+type="button"\s+class="nav-cluster-btn nav-back-btn"/)
  })

  it('各类浮层都接了共享的系统返回关闭组合式函数，且只有它动 history', () => {
    for (const f of [
      ['components', 'base', 'MiModal.vue'],
      ['components', 'base', 'MiDrawer.vue'],
      ['components', 'domain', 'quiz', 'QuizOverlay.vue'],
      ['components', 'cet6', 'Cet6SelectionBar.vue'],
      ['views', 'AiWorkspaceView.vue'],
      ['views', 'Cet6ExamView.vue'],
      ['App.vue']
    ]) {
      expect(read(...f), f.join('/')).toContain('usePhoneBackClose(')
      expect(read(...f), f.join('/')).not.toMatch(/history\.(pushState|back|go)\(/)
    }
    // 设置对话框复用 MiModal，不另挂
    expect(read('components', 'domain', 'SettingsDialog.vue')).toContain('<MiModal')
  })

  it('键盘开着时收起标签栏 / 悬浮球 / 课文底栏；输入区读 --mi-kb-inset / --mi-kb-lift', () => {
    expect(css).toMatch(/kb-open \.phone-tabbar/)
    expect(css).toMatch(/kb-open #app \.ai-floating-ball/)
    expect(css).toMatch(/kb-open #app \.lesson-actions\.fixed-bar/)
    expect(css).toContain('--mi-kb-lift')
    expect(css).toContain('scroll-padding-bottom: var(--mi-kb-inset)')
  })

  it('输入控件手机上 ≥16px，发送键按下不抢走输入框焦点', () => {
    expect(css).toMatch(/:is\(input:not\(\[type=checkbox\]\)[^{]*\) \{ font-size: var\(--mi-fs-read\); \}/)
    expect(read('components', 'domain', 'AiPanel.vue')).toContain('@pointerdown="keepComposerFocus"')
  })
})
