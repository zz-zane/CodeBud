import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { maskComments } from '../../../../shared/__tests__/mask-comments'

const SRC_DIR = join(__dirname, '..', '..')
const read = (rel: string): string => maskComments(readFileSync(join(SRC_DIR, rel), 'utf8'))

describe('ROOT-PLAN-v1 · 路由与导航契约', () => {
  const routerSrc = read('router/index.ts')
  // 主导航项 2026-11 起抽到 lib/nav-items.ts（侧栏与手机标签栏共用），契约不变，两个文件合起来读
  const sidebarSrc = read('components/domain/Sidebar.vue') + read('lib/nav-items.ts')

  it('首启 / 与旧 /learn 均平滑重定向至 /today（docs/31：首页由 AI 聊天改为今天）', () => {
    expect(routerSrc).toContain("{ path: '/', redirect: '/today' }")
    expect(routerSrc).toContain("{ path: '/learn', redirect: '/today' }")
    expect(routerSrc).toContain("name: 'today'")
  })

  it('侧栏精简导航：保留 AI / 练习 / 复习 / 总览 与设置，彻底移除旧学习入口与搜索框', () => {
    expect(sidebarSrc).toContain("path: '/ai'")
    expect(sidebarSrc).toContain("path: '/practice'")
    expect(sidebarSrc).toContain("path: '/review'")
    expect(sidebarSrc).toContain("path: '/overview'")
    expect(sidebarSrc).toContain("navigate('/settings')")

    expect(sidebarSrc).not.toContain("path: '/learn'")
    expect(sidebarSrc).not.toContain('<SearchPanel')
  })

  it('侧栏彻底移除普通/算法课程大纲树与 AI 页重复选课分组', () => {
    expect(sidebarSrc).not.toContain('class="course-tree-section"')
    expect(sidebarSrc).not.toContain('ai-sidebar-course')
    expect(sidebarSrc).not.toContain('openAiPicker')
  })
})

describe('ROOT-PLAN-v1 · 课文与 AI 同屏及课程辅助移除契约', () => {
  const appSrc = read('App.vue')
  const rightPanelSrc = read('components/domain/RightPanel.vue')
  const railSrc = read('components/domain/AiContextRail.vue')
  const wsSrc = read('views/AiWorkspaceView.vue')

  it('课文页收起 AI 后整栏消失（shouldShowRightPanel 仅在 aiAssistant.isOpen 时为真）', () => {
    expect(appSrc).toMatch(/shouldShowRightPanel\s*=\s*computed\(\s*\(\)\s*=>\s*!isAiWorkspace\.value\s*&&\s*aiAssistant\.isOpen\s*\)/)
  })

  it('RightPanel 彻底移除旧课程辅助面板，精简为直接复用 AiPanel 的单 AI 壳', () => {
    expect(rightPanelSrc).toContain('<AiPanel />')
    expect(rightPanelSrc).not.toContain('right-panel-tabs')
    expect(rightPanelSrc).not.toContain('lesson-panel-scroll')
    expect(rightPanelSrc).not.toContain('PANEL.START_PRACTICE')
    expect(rightPanelSrc).not.toContain('ALGO_COURSE')
    expect(rightPanelSrc).not.toContain('ref-list')
  })

  it('选课直达课文+AI同屏：AiContextRail choose() 与 AiWorkspaceView useLesson() 均设置 ai.isOpen = true', () => {
    expect(railSrc).toMatch(/function choose\(id: string\) \{[\s\S]*ai\.isOpen = true[\s\S]*openLesson\(id\)/)
    expect(wsSrc).toMatch(/function useLesson\(id: string\) \{[\s\S]*ai\.isOpen = true[\s\S]*openLesson\(id\)/)
  })
})

describe('ROOT-PLAN-v1 · AI 输入框底排与微调契约', () => {
  const panelSrc = read('components/domain/AiPanel.vue')

  it('输入框底排移除课程选择 chip，保留附件/辅导动作/模型名/发送', () => {
    // 明确移除了底排课程选择按钮
    expect(panelSrc).not.toMatch(/class="lead-chip"[\s\S]*contextTitle/)
    // 保留附件按钮
    expect(panelSrc).toContain('openFilePicker')
    // 保留辅导动作选择器
    expect(panelSrc).toContain('aiStore.tutoringAction')
    // docs/30 §1.3：只读模型文字换成 Provider + 模型/强度选择器（ComposerProviderBar）
    expect(panelSrc.match(/ComposerProviderBar/g)?.length).toBeGreaterThanOrEqual(2) // 引入 + 使用
  })

  it('未配置 Key 时主界面的课程入口仍可用，发送验证保持启用', () => {
    expect(panelSrc).toContain('v-if="!hasApiKey && !isMain"')
    expect(panelSrc).toContain(':disabled="!hasApiKey"')
    expect(panelSrc).toContain('if (!hasApiKey.value || composing.value) return')
  })

  it('底排文字字号取 label 档（13px）', () => {
    expect(panelSrc).toMatch(/\.lead-chip,\s*\.model-chip,\s*\.lead-select\s*\{[^}]*font-size:\s*var\(--mi-fs-label\)/)
  })

  it('AiPanel 声明 typing-activity 事件并在 textarea input 时触发', () => {
    expect(panelSrc).toContain("'typing-activity': []")
    expect(panelSrc).toContain('@input="onInput"')
    expect(panelSrc).toContain("emit('typing-activity')")
  })
})

describe('ROOT-PLAN-v1 · 像素角色设计与动画契约', () => {
  const mascotSrc = read('components/domain/AiPixelMascot.vue')
  const wsSrc = read('views/AiWorkspaceView.vue')

  it('角色主体保持 48×约42px（0.8档）且电脑道具紧邻主体', () => {
    expect(mascotSrc).toContain('viewBox="0 0 25 14"')
    expect(mascotSrc).toContain('width="80"')
    expect(mascotSrc).toContain('height="45"')
    // 主体平移 8 单位：x=8..23 对应 48px 宽主体，保留原始矢量坐标
    expect(mascotSrc).toContain('transform="translate(8, 0)"')
    // 主体从 x=8 起，键盘延伸至 x=8，敲击手部与键盘相接。
    expect(mascotSrc).toContain('class="layer-laptop-closed"')
    expect(mascotSrc).toContain('class="layer-laptop-open"')
  })

  it('入场动画从下沿跳跃落位且仅播放一次，不因 hover/focus 重复触发', () => {
    expect(mascotSrc).toContain('@keyframes animMascotEnter')
    expect(mascotSrc).toContain('transform: translateY(44px)')
    expect(mascotSrc).toContain('transform: translateY(0)')
    // 宿主卡片不带 pointerenter / focusin 触发
    expect(wsSrc).not.toContain('@pointerenter="triggerMascotMotion"')
    expect(wsSrc).not.toContain('@focusin="triggerMascotMotion"')
  })

  it('打字敲击由真实 input 驱动，采用 visibility 离散帧与 steps(1)', () => {
    expect(mascotSrc).toContain('function onTyping()')
    expect(mascotSrc).toContain('steps(1)')
    expect(mascotSrc).toContain('animHandsTapA')
    expect(mascotSrc).toContain('animHandsTapB')
    expect(mascotSrc).toContain('visibility: visible')
    expect(mascotSrc).toContain('visibility: hidden')
  })

  it('严格尊重 prefers-reduced-motion', () => {
    expect(mascotSrc).toContain('@media (prefers-reduced-motion: reduce)')
    expect(mascotSrc).toContain('isReducedMotion()')
    expect(mascotSrc).toContain("window.matchMedia('(prefers-reduced-motion: reduce)')")
  })
})
