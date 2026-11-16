import { defineStore } from 'pinia'
import { ref } from 'vue'
import { isRemote } from '../lib/asset-base'

/** 设置面板的五个分类（与 SettingsView 的 TabKey 同序同值） */
export type SettingsCard = 'appearance' | 'editor' | 'study' | 'env' | 'ai' | 'remote' | 'about'

/**
 * 设置面板的开关状态（2026-10-28 主人要求：点设置开一个覆盖当前页面的大面板）。
 *
 * 【为什么是一个 store 而不是路由】
 * 面板要盖在**当前页面**上，底下的课文/练习代码/AI 会话都不能卸载 ——
 * 一旦把 /settings 当成普通页面路由过去，router-view 换的就是背景那一格，
 * 课文 DOM、滚动位置、正在生成的 AI 回答全部会重建。所以：
 *   · 背景始终留在原来的路由上（lesson/practice/…）；
 *   · 面板是叠在上面的浮层，开关只动这个 store；
 *   · `/settings` 这个地址仍保留（桌宠快捷入口、深链），由路由守卫翻译成
 *     「记下背景 + 打开面板」，见 main.ts 的 installSettingsDialogGuard。
 */
export const useSettingsDialogStore = defineStore('settings-dialog', () => {
  const open = ref(false)
  const card = ref<SettingsCard>('appearance')
  /** 打开面板时脚下的那条路由；关闭时回到这里 */
  const background = ref('/learn')

  function openSettings(next: SettingsCard = 'appearance', from?: string): void {
    if (from) background.value = from
    // 手机浏览器里这几页不存在（环境检测 / AI Key / 手机连接，见 SettingsDialog）
    if (isRemote() && (next === 'env' || next === 'ai' || next === 'remote' || next === 'about')) next = 'appearance'
    card.value = next
    open.value = true
  }

  function close(): void {
    open.value = false
  }

  return { open, card, background, openSettings, close }
})
