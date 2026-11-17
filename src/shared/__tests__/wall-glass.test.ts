/**
 * 门控测试：玻璃令牌 `--mi-card-glass` 的消费边界 + 全库 opacity 声明快照
 * （文件名沿用历史：它原先守壁纸功能的面板透明度，壁纸退役后令牌只剩这一个，恒等实色）。
 *
 * 【为什么这组断言必须做成静态闸门，不能只测「页面渲染出来长什么样」】
 * 玻璃令牌曾由壁纸功能改写成半透明；它**极易被误用**到正文文字、代码块、
 * 或不需要吃透明度的深层容器上 —— 将来任何功能再让它变透明时，
 * 误用处会出现「字透到看不清」的可用性退化。
 *
 * 这组测试给两张硬名单立闸门：
 *   1. IN 清单：允许消费 `--mi-*-glass` 的容器名单（精确定位到组件名与处数）
 *   2. OUT 清单：绝对禁止出现玻璃令牌的敏感表面（正文、代码、弹窗...）
 * 任何一处漂移，必须先来这里修改清单并给出设计理由，否则 CI 必红。
 * 另有一条 opacity 声明总数的快照：新增 opacity 必须人工过目。
 */

import { readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'
import { describe, expect, it } from 'vitest'
import { maskComments } from './mask-comments'

const ROOT = join(__dirname, '..', '..')
const RENDERER_SRC = join(ROOT, 'renderer', 'src')
const STYLES = join(RENDERER_SRC, 'styles')

/** 玻璃令牌的**消费**写法（`var(--mi-X-glass)`）。定义处（冒号在左边）不匹配 */
const GLASS = /var\(--mi-(?:card|bg|blue-light)-glass\)/g

const rel = (p: string): string => relative(RENDERER_SRC, p).replace(/\\/g, '/')

/**
 * 走一遍 renderer/src。排除 __tests__ —— 那边测试源码里会引用令牌名字，
 * 不排除的话闸门会被自己的说明文字绊倒（maskComments 的由来，同一个坑）。
 */
function sourceFiles(ext: RegExp): string[] {
  const out: string[] = []
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      // Upstream CSS is immutable and hash-checked separately in cds-design.test.ts.
      if (name === '__tests__' || name === 'vendor') continue
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (ext.test(name)) out.push(p)
    }
  }
  walk(RENDERER_SRC)
  return out
}

const styleFiles = sourceFiles(/\.(vue|css)$/)
const allFiles = sourceFiles(/\.(vue|css|ts)$/)

/** 一个文件里消费了几处玻璃令牌（剥注释后再数） */
function glassUses(file: string): number {
  const masked = maskComments(readFileSync(file, 'utf8'))
  return (masked.match(GLASS) ?? []).length
}

/**
 * Lite 模式下允许出现玻璃令牌的容器表面清单（壁纸退役后移除侧栏/学习/设置的玻璃底）：
 *   · MiCard 的底：一切卡片的公共壳 (1)
 *   · LessonDetailView (2)
 * 共 2 个文件、3 处消费（ChallengeView / LoginView 随挑战页、登录页的退役代码清理已删除）。
 *
 * 【RightPanel 为什么不在清单里了（2026-11-04，ROOT-PLAN-v1 §6）】
 * 课文页右侧彻底移除了旧“课程辅助”分区及其卡片，RightPanel 精简为仅承载
 * AiPanel 的单 AI 容器壳，自身不再消费任何 --mi-*-glass 令牌（3 → 0）。
 *
 * 【TopBar 为什么不在清单里了（2026-10-30）】
 * 顶条改成常驻雾化（半透明 + backdrop-filter），**不再消费 --mi-*-glass**：
 * 那组令牌由壁纸门控块定义，壁纸关着时等于实色，而顶条的雾化是结构性的
 * （它永远盖在滚动内容上，与壁纸开不开无关）。改用 color-mix 直接算 alpha。
 * 这是一次**减少**消费者：OUT 面的约束一点没放松，只是承认顶条不是玻璃面了。
 */
const LITE_IN_SURFACES: Record<string, number> = {
  'components/base/MiCard.vue': 1,
  'views/LessonDetailView.vue': 2
}

describe('自检：先证明真的扫到了东西', () => {
  it('扫到的样式文件数量合理，且认得出关键文件', () => {
    expect(styleFiles.length, '一个样式文件都没扫到，下面的断言都是空的').toBeGreaterThan(40)
    expect(styleFiles.some((f) => f.endsWith('MiCard.vue'))).toBe(true)
    expect(allFiles.some((f) => f.endsWith('main.ts'))).toBe(true)
  })
})

describe('tokens.css：玻璃令牌的静态定义（壁纸门控块已随壁纸功能移除，令牌恒为静态值）', () => {
  const tokens = maskComments(readFileSync(join(STYLES, 'tokens.css'), 'utf8'))

  it('--mi-card-glass = 实色 --mi-card（零残留）', () => {
    expect(tokens).toContain('--mi-card-glass: var(--mi-card);')
  })
})

describe('IN/OUT 边界：玻璃令牌全库只允许出现在容器面上', () => {
  it('消费点恰好是 Lite IN 清单那 2 个文件、共 3 处', () => {
    const found: Record<string, number> = {}
    for (const f of allFiles) {
      const n = glassUses(f)
      if (n > 0) found[rel(f)] = n
    }
    expect(
      found,
      '出现的组件/处数与 Lite 容器面清单对不上 —— 多出来的要么登记进 IN、要么就是硬底线被踩了'
    ).toEqual(LITE_IN_SURFACES)
  })

  it.each([
    ['views/FavoritesView.vue', '吸底多选工具条（覆盖层，正文从其底下滚过）'],
    ['styles/md.css', '课文正文与代码块（主人点名硬底线）'],
    ['components/domain/quiz/QuizChoice.vue', '题目选项（主人点名硬底线）'],
    ['components/domain/CodeEditor.vue', '练习场编辑器'],
    ['components/domain/CompareGrid.vue', '对比块'],
    ['components/domain/DemoPlayer.vue', '演示块'],
    ['components/domain/RunnerPanel.vue', '运行输出面板'],
    ['components/base/MiModal.vue', '弹窗（要在最上层读得清）'],
    ['components/base/MiToast.vue', '提示条'],
    ['components/base/MiDrawer.vue', '抽屉'],
    ['components/domain/quiz/QuizOverlay.vue', '答题浮层']
  ])('%s 零玻璃令牌 —— %s 不吃透明度', (file) => {
    expect(glassUses(join(RENDERER_SRC, file)), `${file} 被套上玻璃令牌了`).toBe(0)
  })
})

describe('opacity 快照：本次改动零新增（新增必须人工过目）', () => {
  // 53 → 51（2026-10-28）：插入符从小鱼干图片改回标准细竖线，顺手删掉了
  // `mi-caret-breathe` 那条「呼吸」关键帧（0%/50% 两处 opacity）。编辑器插入符
  // 本就不在玻璃令牌的管辖范围内，删掉的是两个只为旧鱼形服务的值。
  // 51 → 52（2026-10-30，独立审查后修正）：冻结基线实测是 52，不是 51 ——
  // 这条断言在此之前已经红了很久，51 是更早一次改动留下的旧数字。
  // 本轮逐处核对：UI 改造的净新增为 0。
  //   · AiPanel：主界面禁用态改用实色画「淡灰底 + 灰字」，不新增声明；
  //     原来那条 `.send-btn:disabled { opacity:.45 }` 保留了，但收窄成
  //     `.ai-panel:not(.is-main) ...`，只作用于右栏面板 —— 声明数不变，
  //     主界面那颗的 computed opacity 因此是 1（独立审查 T3 实测 0.45 → 1）。
  //   · Sidebar：删除键「悬停才出现」改用 visibility，语义更准且不计入；
  //     显隐条件从 `:focus-visible` 换成行级 `:focus-within`（hidden 元素
  //     不在 tab 序列里，自身焦点样式无从触发，T2）。
  // 多出的 1 处是基线既有、来自 views/SettingsView.vue:566，不是本轮引入。
  // 52 → 50（2026-11-04 AI 简化与去重复入口轮次，ROOT-PLAN-v1 验收要求逐条归因）：
  //   · Sidebar.vue：移除截图左侧重复课程目录大纲，移除了 .lesson-row.draft { opacity: 0.65; } (-1)
  //   · RightPanel.vue：彻底删除课程辅助右栏界面，移除了 .ref-item.draft .ref-status { opacity: 0.45; } (-1)
  //   · AiPixelMascot.vue：重新设计主体 48px 与独立电脑道具，入场采用纯像素物理位移跳跃，零新增 opacity (+0)
  //   净新增 0，声明数由 52 准确归因降为 50。
  // 50 → 53（2026-11-06 全站排版整理）：styles/page.css 新增两处禁用态与行内操作的悬停显隐（净 +3）。
  // 53 → 38（2026-11-10 退役代码清理）：删除了无人引用的组件与模块，随之去掉其 opacity 声明（-15）：
  //   MiMascot.vue -5、MiRadio.vue -2、MiTooltip.vue -2、FullscreenMenu.vue -1、
  //   ZoomControl.vue -1、wallpaper/WallpaperLayer.vue -1、lib/wallpaper/transitions.ts -3。
  //   存活文件的声明一条未动。
  // 38 → 37（2026-11-10 配置 v21：壁纸功能整体移除）：删除 styles/wallpaper.css（-1，
  //   `opacity: 0` 一处）；lib/wallpaper/overlay-dim.ts 无 opacity 声明。存活文件一条未动。
  // 动画讲解的淡入、淡出、换皮、值更新和聚光增加七处透明度声明。
  it('全库 opacity 声明数 = 44（含动画讲解过渡）', () => {
    const hits: string[] = []
    for (const f of allFiles) {
      const lines = maskComments(readFileSync(f, 'utf8')).split('\n')
      lines.forEach((line, i) => {
        if (/opacity\s*:/.test(line)) hits.push(`${rel(f)}:${i + 1}`)
      })
    }
    expect(hits.length, `全部命中：\n${hits.join('\n')}`).toBe(44)
  })
})
