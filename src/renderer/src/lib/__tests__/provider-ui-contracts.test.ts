import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { maskComments } from '../../../../shared/__tests__/mask-comments'

/** docs/30 §1：Provider 列表与聊天框选择器的源码契约（没有 DOM 测试环境，读源码守住几条不能丢的规则） */
const SRC = join(__dirname, '..', '..')
const read = (rel: string): string => maskComments(readFileSync(join(SRC, rel), 'utf8'))

describe('Provider 界面契约', () => {
  const bar = read('components/domain/ComposerProviderBar.vue')
  const menu = read('components/base/MiPopMenu.vue')
  const list = read('components/domain/ProviderList.vue')

  it('设置与资料库「模型」页签渲染同一个组件', () => {
    expect(read('views/SettingsView.vue')).toContain('ProviderList')
    expect(read('components/study/StudyConnectionsTab.vue')).toContain('ProviderList')
  })

  it('手机端（isRemote）：Provider 芯片只读、没有设置入口与模型 / 强度菜单', () => {
    expect(bar).toContain('providerChipMode')
    expect(bar).toMatch(/v-if="mode === 'menu'"/)
    // 内置 API 的模型：手机是静态 span，电脑才是去设置的按钮
    expect(bar).toMatch(/<span v-if="remote" class="pb-static model-chip"/)
    expect(bar).toMatch(/<button v-else type="button" class="pb-btn model-chip"/)
    // 推理强度、Antigravity 模型与强度菜单都要求非手机
    expect(bar).toMatch(/v-if="showEffort && !remote"/)
    expect(bar).toMatch(/v-if="!remote && modelItems\.length"/)
    expect(bar).toMatch(/v-if="!remote && strengthItems\.length"/)
    // 手机不去拉模型列表（命令路径在手机上被抹掉，且该通道不在白名单）
    expect(bar).toMatch(/!remote && set === 'antigravity'/)
  })

  it('生成中禁用全部选择；强度用 title + aria-label，菜单有 aria-haspopup / aria-expanded', () => {
    expect(bar).toContain('ai.isStreaming')
    expect((bar.match(/:disabled="locked"/g) ?? []).length).toBeGreaterThanOrEqual(5)
    expect(menu).toContain('aria-haspopup="menu"')
    expect(menu).toContain(':aria-expanded="open"')
    expect(menu).toContain(':aria-label="label"')
    expect(menu).toMatch(/'Escape'/)
    expect(menu).toMatch(/'ArrowDown'/)
  })

  it('图标按钮都带 title 与 aria-label，没有颜色字面量', () => {
    for (const src of [bar, menu, list]) {
      expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
      expect(src).not.toMatch(/rgba?\(/)
    }
    for (const match of list.match(/<button[^>]*class="pl-icon-btn[^>]*>/g) ?? []) {
      expect(match, match).toMatch(/:?title=/)
      expect(match, match).toMatch(/:?aria-label=/)
    }
  })

  it('聊天框右段仍包含 .input-trail 与常驻发送键，手机端依赖的 .model-chip 类还在新芯片上', () => {
    const panel = readFileSync(join(SRC, 'components/domain/AiPanel.vue'), 'utf8') // 原文：AiPanel 里的 HTML 注释会让 maskComments 吞掉后面的标签
    expect(panel).toContain('class="input-trail"')
    expect(panel).toContain('data-kb-managed')
    expect(bar).toContain('trigger-class="model-chip"')
  })
})
