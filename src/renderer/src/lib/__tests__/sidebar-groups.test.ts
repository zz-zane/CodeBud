/**
 * 侧栏主导航与结构静态契约（Lite 架构 · ROOT-PLAN-v1）
 *
 * 契约变更（2026-11-04 AI 简化与去重复入口轮次）：
 * 1. 默认入口调整为 AI（/ai），旧 /learn 从主导航中移除（路由层保留向 /ai 的兼容重定向，不报 404）
 * 2. （2026-11-13 docs/31 起）8 个主要导航项：今天 /today、课程 /courses、练习 /practice、复习 /review、六级真题 /cet6，分隔线，资料库 /study、AI /ai、进度 /overview，以及底部设置入口
 * 3. 侧栏内搜索框、普通/算法课程大纲树及 AI 页“课程目录/选择课程”分组彻底移除，去重复入口
 * 4. isNavActive 契约：/ai 独立高亮，/playground 归入练习，/memo 与 /favorites 归入总览
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { maskComments } from '../../../../shared/__tests__/mask-comments'

const SRC_DIR = join(__dirname, '..', '..')
const SIDEBAR_PATH = join(SRC_DIR, 'components', 'domain', 'Sidebar.vue')
// 主导航项与高亮分组映射 2026-11 起抽到 lib/nav-items.ts（侧栏与手机标签栏共用）；契约不变，读两个文件
const raw = readFileSync(SIDEBAR_PATH, 'utf8') + ' ' + readFileSync(join(SRC_DIR, 'lib', 'nav-items.ts'), 'utf8')
const sidebar = maskComments(raw)

describe('Lite 架构 · 侧栏主导航契约（ROOT-PLAN-v1）', () => {
  it('包含且仅包含 8 个主导航项（含今天、课程、六级真题）与底部设置入口', () => {
    expect(sidebar).toContain("path: '/today'")
    expect(sidebar).toContain("path: '/courses'")
    expect(sidebar).toContain("path: '/ai'")
    expect(sidebar).toContain("path: '/study'")
    expect(sidebar.match(/path:\s*'\/[a-z0-9]+'/g)).toHaveLength(8)
    expect(sidebar).toContain("path: '/cet6'")
    expect(sidebar).toContain("path: '/practice'")
    expect(sidebar).toContain("path: '/review'")
    expect(sidebar).toContain("path: '/overview'")

    // 旧 learn 入口彻底不挂载在主导航中
    expect(sidebar).not.toContain("path: '/learn'")

    // 底部设置入口保持
    expect(sidebar).toContain("navigate('/settings')")
    expect(sidebar).toContain('footer-settings-btn')
  })

  it('退役的娱乐与重复导航项零挂载（签到、排行榜、仓库、旧折叠组、旧大纲树）', () => {
    expect(sidebar).not.toContain("path: '/checkin'")
    expect(sidebar).not.toContain("path: '/leaderboard'")
    expect(sidebar).not.toContain("path: '/warehouse'")
    expect(sidebar).not.toContain('class="nav-groups"')
    expect(sidebar).not.toContain('class="group-body"')
    expect(sidebar).not.toContain('class="course-tree-section"')
    expect(sidebar).not.toContain('openGroups')
    expect(sidebar).not.toContain('checkin-dot')
  })

  it('侧栏不渲染搜索框与重复大纲/选课，保持精简', () => {
    expect(sidebar).not.toContain('<SearchPanel')
    expect(sidebar).not.toContain('class="lang-pills"')
    expect(sidebar).not.toContain('ai-sidebar-course')
  })

  it('分组是数据：分隔线由 group 字段切段得出；侧栏不再挂数字徽标（2026-11-21）', () => {
    expect(sidebar).toContain("group: 'daily'")
    expect(sidebar).toContain("group: 'library'")
    expect(sidebar).toContain('navSections(')
    expect(sidebar).toContain('class="nav-divider"')
    expect(sidebar).not.toContain('nav-badge')
  })

  it('选中态是一块滑动底块（2026-11-21）：按 .active 的 offset 定位，按钮自身不再叠背景', () => {
    expect(sidebar).toContain('class="nav-active-pill"')
    expect(sidebar).toContain("querySelector<HTMLElement>('.nav-tab-btn.active')")
    expect(sidebar).toMatch(/\.nav-tab-btn\.active \{\s*background: transparent;/)
  })

  it('图标动效：每项带 data-nav 供悬停动作区分，选中时描线（pathLength=1）+ 轻弹', () => {
    expect(sidebar).toContain(':data-nav="item.key"')
    expect(sidebar).toContain('<path :d="item.icon" pathLength="1" />')
    expect(sidebar).toContain('@keyframes mi-icon-draw')
    expect(sidebar).toContain('@keyframes mi-icon-pop')
  })

  it('AI 会话区：主聊天 / 新建用 .nav-icon 图标列；悬停底色只挂整行；焦点环画在内侧（不被滚动容器裁成黑竖线）', () => {
    expect(sidebar).not.toContain('<MiIcon')
    expect(sidebar).not.toContain('ai-new-plus')
    expect(sidebar).not.toMatch(/\.ai-sidebar-item:hover\s*\{/)
    expect(sidebar).toContain('v-auto-animate class="ai-sidebar-scroll"')
    expect(sidebar).toMatch(/\.ai-sidebar-lists button:focus-visible \{\s*outline: 1\.5px solid var\(--mi-border-control\);\s*outline-offset: -1\.5px;/)
    expect(sidebar).not.toContain('.ai-session-row.active .ai-sidebar-add')
  })

  it('手机底部标签栏也不挂数字（2026-11-21）', () => {
    const tab = maskComments(readFileSync(join(SRC_DIR, 'components', 'domain', 'PhoneTabBar.vue'), 'utf8'))
    expect(tab).not.toContain('phone-tab-pip')
    expect(tab).not.toContain('useTodayCounts')
    expect(readFileSync(join(SRC_DIR, 'styles', 'phone.css'), 'utf8')).not.toContain('.phone-tab-pip')
  })

  it('高亮激活规则：/today、/ai 独立激活，/lesson 归入课程，/playground 归入练习，/memo 与 /favorites 归入进度', () => {
    expect(sidebar).toContain("path === '/today'")
    expect(sidebar).toContain("path === '/ai'")
    expect(sidebar).toContain("path.startsWith('/lesson/')")
    expect(sidebar).toContain("path === '/playground'")
    expect(sidebar).toContain("path === '/memo'")
    expect(sidebar).toContain("path === '/favorites'")
  })
})
