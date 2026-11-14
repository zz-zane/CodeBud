import type { Pinia } from 'pinia'
import type { Router } from 'vue-router'
import { useSettingsDialogStore, type SettingsCard } from '../stores/settings-dialog'

const CARDS: readonly SettingsCard[] = ['appearance', 'editor', 'study', 'env', 'ai']

/**
 * `/settings?card=…` 里的 card 参数 → 面板分类。
 *
 * 【为什么两种旧值要映射】桌宠菜单（主进程 openSettings）只会发 `wall` / `ai` 两种：
 * `ai` 原样落到 AI 助教分类；`wall`（壁纸）在 Lite 版已无对应卡片，落到外观 ——
 * 外观是壁纸退役后剩下的同类设置（主题、字号）。其余一律回外观，绝不留空面板。
 */
export function cardFromQuery(raw: unknown): SettingsCard {
  const v = Array.isArray(raw) ? raw[0] : raw
  if (v === 'ai') return 'ai'
  if (typeof v === 'string' && (CARDS as readonly string[]).includes(v)) return v as SettingsCard
  return 'appearance'
}

/**
 * 把既有的 `/settings` 地址翻译成「在当前页上打开设置面板」。
 *
 * 【为什么是守卫而不是换路由】面板要盖在**当前页面**上：课文 DOM、滚动位置、
 * 正在生成的 AI 回答都不能被卸载。路由到 /settings 会让 router-view 换掉背景，
 * 所以这里**中止这次导航**（返回 false），只开面板 —— URL 留在背景路由上，
 * 不产生 /settings 历史项，关闭时不需要再导航回去（也就没有 history 死循环）。
 *
 * 【首启/深链没有背景页怎么办】`from` 是空匹配（START_LOCATION）时背景无从谈起，
 * 就先 replace 到 /learn 再开面板。返回的是另一条路由而不是 false，所以只走一次。
 */
export function installSettingsDialogGuard(router: Router, pinia: Pinia): void {
  const dialog = useSettingsDialogStore(pinia)
  router.beforeEach((to, from) => {
    if (to.name !== 'settings') return true
    const card = cardFromQuery(to.query.card)
    if (from.matched.length === 0) {
      dialog.openSettings(card, '/learn')
      return { path: '/learn', replace: true }
    }
    dialog.openSettings(card, from.fullPath)
    return false
  })
}
