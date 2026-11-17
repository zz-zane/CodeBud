import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { maskComments } from '../../../../shared/__tests__/mask-comments'

const SRC = join(__dirname, '..', '..')
const read = (rel: string): string => maskComments(readFileSync(join(SRC, rel), 'utf8'))

describe('MiSelect 自绘下拉与替换契约（docs/35 §7）', () => {
  it('MiSelect 保持 props/emits 不变，无原生 <select>，具备 listbox 语义与键盘支持', () => {
    const src = read('components/base/MiSelect.vue')
    expect(src).not.toMatch(/<select\b/)
    expect(src).toContain('modelValue: string')
    expect(src).toContain("'update:modelValue': [v: string]")
    expect(src).toContain('aria-haspopup="listbox"')
    expect(src).toContain('role="listbox"')
    expect(src).toContain('role="option"')
    for (const key of ['ArrowDown', 'ArrowUp', 'Home', 'End', 'Escape', 'Tab']) {
      expect(src).toContain(`'${key}'`)
    }
  })

  it.each([
    'components/domain/ProviderList.vue',
    'components/study/StudyKnowledgeTab.vue',
    'views/SettingsView.vue',
    'components/domain/video/VideoLibrary.vue'
  ])('%s 已移除原生 <select> 并改用 MiSelect', (rel) => {
    const src = read(rel)
    expect(src).not.toMatch(/<select\b/)
    expect(src).toContain('MiSelect')
  })
})
