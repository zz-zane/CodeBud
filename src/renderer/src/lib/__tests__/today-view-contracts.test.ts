/**
 * 「今天」页静态契约（docs/31）：不写颜色字面量、文案全走 TODAY、数字不另算一份、
 * 手机版面只在 phone.css 的媒体查询里、打卡触发点齐全、考试锁仍然收起导航与徽标。
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { maskComments } from '../../../../shared/__tests__/mask-comments'
import { TODAY } from '../copy'

const SRC = join(__dirname, '..', '..')
const raw = (rel: string): string => readFileSync(join(SRC, rel), 'utf8')
const view = raw('views/TodayView.vue')
const viewCode = maskComments(view)
const styleBlock = view.slice(view.indexOf('<style'))

describe('TodayView 静态契约', () => {
  it('样式里没有颜色字面量，颜色全走令牌', () => {
    expect(styleBlock).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(styleBlock).not.toMatch(/\b(rgb|rgba|hsl|hsla|oklch|color-mix)\(/)
    expect(styleBlock).toContain('var(--mi-blue-deep)')
  })

  it('模板与脚本里没有写死的中文，用到的 TODAY 键都存在', () => {
    expect(viewCode).not.toMatch(/[一-鿿]/)
    const used = [...viewCode.matchAll(/TODAY\.([A-Za-z0-9_]+)/g)].map((m) => m[1])
    expect(used.length).toBeGreaterThan(20)
    for (const key of new Set(used)) expect(Object.keys(TODAY), `TODAY.${key}`).toContain(key)
  })

  it('数字复用现有实现：不在视图里重写估时 / 计划挑选 / 到期计算', () => {
    expect(viewCode).toContain("from '../../../shared/today'")
    expect(viewCode).toContain("from '../lib/use-today-counts'")
    expect(viewCode).not.toMatch(/function (estimateMinutes|pickActivePlan|weekDots|dueLessons)/)
    expect(viewCode).toContain('content.continueLesson')
    expect(viewCode).toContain('study.setTaskStatus')
  })

  it('行是 button，复选框是真 checkbox 且带文字标签，进度条有 progressbar 角色', () => {
    expect(view).toContain('<button v-for="r in rows"')
    expect(view).toContain('type="checkbox"')
    expect(view).toMatch(/<label v-for="t in planTasks"/)
    expect(view.match(/role="progressbar"/g)?.length).toBe(2)
    expect(view).toContain(':aria-valuenow')
    expect(view).toContain(':focus-visible')
  })

  it('点击去向：复习页、练习页错题本页签、生词本、四级和六级卷、资料库任务页签', () => {
    expect(view).toContain("to: '/review'")
    expect(view).toContain("query: { tab: 'wrongbook' }")
    expect(view).toContain("path: '/cet6/vocab', query: { review: '1' }") // 生词行直接进翻卡
    expect(view).toContain('/${level}/${p.id}')
    expect(view).toContain("query: { tab: 'tasks' }")
  })

  it('提问条走 AI 助教现有的发送入口，没有可用 Provider 时打开设置的 AI 页', () => {
    expect(viewCode).toContain('ai.sendDraft()')
    expect(viewCode).toContain("openSettings('ai'")
  })

  it('手机：不渲染大标题 / 提问条 / 计划卡；版面规则只在 phone.css 的媒体查询里', () => {
    expect(view).toMatch(/<h1 v-if="!isPhone"/)
    expect(view).toMatch(/<section v-if="!isPhone" class="t-plan-col"/)
    expect(view).toMatch(/<form v-if="!isPhone/)
    expect(styleBlock).not.toContain('@media')
    const css = raw('styles/phone.css')
    const block = css.slice(css.indexOf('「今天」页'))
    expect(block).toContain('@media (max-width: 768px)')
    expect(block).toContain('height: 60px')
    expect(block).toContain('height: 44px')
  })
})

describe('自动打卡触发点', () => {
  it('标记已学 / 答题会话收尾 / 六级交卷都调 markStudiedToday', () => {
    expect(maskComments(raw('stores/progress.ts'))).toMatch(/writer\.record\(\{ k: 'learned', id: lessonId, on: true, at \}\)\s*void markStudiedToday\(\)/)
    expect(maskComments(raw('stores/quiz.ts'))).toContain('useProgressStore().markStudiedToday()')
    expect(maskComments(raw('stores/cet6.ts'))).toContain('useProgressStore().markStudiedToday()')
  })
})

describe('考试锁与导航', () => {
  const app = maskComments(raw('App.vue'))
  it('考试锁下侧栏（含徽标）与手机标签栏都不渲染', () => {
    expect(app).toMatch(/v-if="!examLock"\s+id="app-sidebar-drawer"/)
    expect(app).toMatch(/const showTabBar = computed\([\s\S]*!examLock\.value/)
  })
  it('侧栏不挂数字徽标（2026-11-21 用户要求移除）', () => {
    const sb = maskComments(raw('components/domain/Sidebar.vue'))
    expect(sb).not.toContain('nav-badge')
    expect(sb).not.toContain('useTodayCounts')
  })
})
