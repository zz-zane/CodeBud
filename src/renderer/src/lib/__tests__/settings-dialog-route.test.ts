/**
 * `/settings` → 设置面板 的翻译规则。
 *
 * 只测决定行为的两个纯函数 + 用真 router 跑一遍守卫的三种情况：
 * ① 从背景页点设置 → 中止导航、背景不变、面板打开；
 * ② 直接以 /settings 启动（无背景）→ 落到 /learn 再开面板，且只走一次（不死循环）；
 * ③ ?card=ai / ?card=wall 的旧值映射。
 */
import { describe, expect, it } from 'vitest'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { cardFromQuery, installSettingsDialogGuard } from '../settings-dialog-route'
import { useSettingsDialogStore } from '../../stores/settings-dialog'

const Blank = { template: '<div />' }

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/learn', component: Blank },
      { path: '/lesson/:id', component: Blank },
      { path: '/settings', name: 'settings', component: Blank },
      { path: '/login', redirect: '/settings' }
    ]
  })
}

describe('cardFromQuery：旧参数 → 面板分类', () => {
  it('五个分类原样通过', () => {
    for (const c of ['appearance', 'editor', 'study', 'env', 'ai'] as const) {
      expect(cardFromQuery(c)).toBe(c)
    }
  })

  it('桌宠菜单的 wall 落到外观，未知值也回外观（不留空面板）', () => {
    expect(cardFromQuery('wall')).toBe('appearance')
    expect(cardFromQuery('nonsense')).toBe('appearance')
    expect(cardFromQuery(undefined)).toBe('appearance')
  })

  it('数组形式的 query（?card=a&card=b）取第一个', () => {
    expect(cardFromQuery(['ai', 'env'])).toBe('ai')
  })
})

describe('installSettingsDialogGuard', () => {
  it('从课文页点设置：导航被中止，背景留在课文，面板打开', async () => {
    const router = makeRouter()
    const pinia = createPinia()
    installSettingsDialogGuard(router, pinia)
    await router.push('/lesson/common-01')

    await router.push('/settings')
    const dialog = useSettingsDialogStore(pinia)
    expect(router.currentRoute.value.fullPath).toBe('/lesson/common-01')
    expect(dialog.open).toBe(true)
    expect(dialog.background).toBe('/lesson/common-01')
    expect(dialog.card).toBe('appearance')
  })

  it('带 ?card=ai 打开时落到 AI 分类，且背景不丢', async () => {
    const router = makeRouter()
    const pinia = createPinia()
    installSettingsDialogGuard(router, pinia)
    await router.push('/lesson/common-01')

    await router.push('/settings?card=ai')
    const dialog = useSettingsDialogStore(pinia)
    expect(dialog.card).toBe('ai')
    expect(router.currentRoute.value.fullPath).toBe('/lesson/common-01')
  })

  it('直接以 /settings 启动：补一个 /learn 背景，只走一次，不死循环', async () => {
    const router = makeRouter()
    const pinia = createPinia()
    installSettingsDialogGuard(router, pinia)

    await router.push('/settings')
    const dialog = useSettingsDialogStore(pinia)
    expect(router.currentRoute.value.path).toBe('/learn')
    expect(dialog.open).toBe(true)
    expect(dialog.background).toBe('/learn')
  })

  it('旧 /login 重定向到 /settings 时同样只开面板、背景不变', async () => {
    const router = makeRouter()
    const pinia = createPinia()
    installSettingsDialogGuard(router, pinia)
    await router.push('/lesson/common-02')

    await router.push('/login')
    const dialog = useSettingsDialogStore(pinia)
    expect(dialog.open).toBe(true)
    expect(router.currentRoute.value.fullPath).toBe('/lesson/common-02')
  })

  it('非 /settings 的路由不受影响', async () => {
    const router = makeRouter()
    const pinia = createPinia()
    installSettingsDialogGuard(router, pinia)
    await router.push('/lesson/common-03')
    expect(router.currentRoute.value.fullPath).toBe('/lesson/common-03')
    expect(useSettingsDialogStore(pinia).open).toBe(false)
  })
})
