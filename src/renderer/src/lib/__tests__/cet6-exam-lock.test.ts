import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

/**
 * 考试锁的静态守卫（docs/27 §8.1 / §8.2）：这几处是「一个标志管所有入口」，
 * 谁改模板时顺手删了条件，界面不会报错，只是考试里又能问 AI 了。读源码文本钉住。
 */
const src = (rel: string): string => readFileSync(join(__dirname, '..', '..', rel), 'utf8')

describe('考试锁接线', () => {
  it('Cet6ExamView 只在没有考试锁时渲染选词工具条', () => {
    const view = src('views/Cet6ExamView.vue')
    const tags = view.match(/<Cet6SelectionBar[^>]*>/g) ?? []
    expect(tags).toHaveLength(1)
    expect(tags[0]).toMatch(/v-if="[^"]*!cet6\.examLock[^"]*"/)
  })

  it('Cet6ExamView 在做题页挂载 / 卸载时开关 examPageActive，并有离开确认', () => {
    const view = src('views/Cet6ExamView.vue')
    expect(view).toContain('cet6.examPageActive = true')
    expect(view).toContain('cet6.examPageActive = false')
    expect(view).toContain('onBeforeRouteLeave(guardLeave)')
  })

  it('App.vue 用锁收起侧栏 / 顶条入口，并让全局快捷键直接返回', () => {
    const app = src('App.vue')
    expect(app).toMatch(/const examLock = computed\(\(\) => cet6\.examLock\)/)
    expect(app).toMatch(/<div\s+v-if="!examLock"\s+id="app-sidebar-drawer"\s+class="sidebar-wrapper"/)
    expect(app).toMatch(/class="topbar-right-actions"/)
    expect(app).toMatch(/v-if="!isBare && !examLock" class="topbar-right-actions"/)
    expect(app).toMatch(/v-if="!isBare && !examLock" class="topbar-nav-cluster"/)
    expect(app).toMatch(/function onGlobalKey[\s\S]{0,200}examLock\.value/)
    expect(app).toMatch(/<aside v-if="shouldShowRightPanel && !examLock"/)
  })

  it('AiContextMenu 在考试锁下不弹菜单', () => {
    const menu = src('components/domain/AiContextMenu.vue')
    expect(menu).toMatch(/function onGlobalContextMenu[\s\S]{0,200}cet6\.examLock/)
  })

  it('试卷文字可选中的规则绑在考试锁上，且按钮点击有选区守卫', () => {
    const view = src('views/Cet6ExamView.vue')
    expect(view).toMatch(/class="cet6-exam" :class="\{ 'sel-ok': !cet6\.examLock \}"/)
    expect(view).toMatch(/\.cet6-exam\.sel-ok[^{]*\.cet6-left[^{]*\{ user-select: text; \}/)
    expect(view).toContain('@click.capture="guardSelectClick"')
  })

  it('生词本路由排在 /cet6/:id 之前', () => {
    const router = src('router/index.ts')
    expect(router.indexOf("path: '/cet6/vocab'")).toBeGreaterThan(-1)
    expect(router.indexOf("path: '/cet6/vocab'")).toBeLessThan(router.indexOf("path: '/cet6/:id'"))
  })
})
