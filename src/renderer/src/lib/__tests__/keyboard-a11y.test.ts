import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { maskComments } from '../../../../shared/__tests__/mask-comments'

const SRC_DIR = join(__dirname, '..', '..')
const read = (rel: string): string => maskComments(readFileSync(join(SRC_DIR, rel), 'utf8'))

function tagAt(text: string, index: number): string {
  const m = text.slice(0, index).match(/<([a-zA-Z][a-zA-Z0-9-]*)[^>]*$/)
  return m ? m[1] : '?'
}

function assertClassOnButtons(rel: string, cls: string): void {
  const src = read(rel)
  const hits = [...src.matchAll(new RegExp(`class="${cls}`, 'g'))]
  expect(hits.length, `${rel} 里应至少有一处 class="${cls}"`).toBeGreaterThan(0)
  for (const h of hits) {
    expect(
      tagAt(src, h.index ?? 0),
      `${rel} 的 class="${cls}" 必须挂在 <button> 上`
    ).toBe('button')
  }
}

describe('V2-34 侧栏可达性（ROOT-PLAN-v1）', () => {
  it('主导航项、新建会话与会话历史项均为可聚焦 <button>', () => {
    // 侧栏课程大纲已按去重复入口要求移除，验证保留的导航项与会话项语义
    assertClassOnButtons('components/domain/Sidebar.vue', 'nav-tab-btn')
    assertClassOnButtons('components/domain/Sidebar.vue', 'ai-sidebar-item')
    assertClassOnButtons('components/domain/Sidebar.vue', 'ai-sidebar-new')
  })
})

describe('V2-41 课程引用与选课可达性（ROOT-PLAN-v1）', () => {
  it('上下文栏推荐课与选课项目均为 <button>', () => {
    // 右侧旧课程辅助已移除，课程引用与选课由 AiContextRail 统一承载
    assertClassOnButtons('components/domain/AiContextRail.vue', 'ref-item')
    assertClassOnButtons('components/domain/AiContextRail.vue', 'picker-item')
  })
})

describe('V2-40 课程中心课程卡整卡可聚焦', () => {
  it('课程卡使用 semantic <button>', () => {
    assertClassOnButtons('views/CoursesView.vue', 'curriculum-lesson-card')
  })
})

describe('V2-36 MiModal 焦点纪律', () => {
  const src = read('components/base/MiModal.vue')

  it('dialog 语义 + 面板可接焦点', () => {
    expect(src).toContain('role="dialog"')
    expect(src).toContain('aria-modal="true"')
    expect(src).toContain('tabindex="-1"')
    expect(src).toMatch(/:aria-label="title"/)
  })

  it('三件套在场：打开时 focus、Tab 陷阱、关闭时还原焦点', () => {
    expect(src, '缺 focusables() 现查').toContain('function focusables')
    expect(src, '缺 Tab 陷阱').toContain('function trapTab')
    expect(src, '打开时未聚焦面板').toMatch(/nextTick\(\(\) => panel\.value\?\.focus\(\)\)/)
    expect(src, '缺焦点还原').toContain('restoreTo')
  })
})
