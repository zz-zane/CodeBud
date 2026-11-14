import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useContentStore } from '../../stores/content'
import { maskComments } from '../../../../shared/__tests__/mask-comments'

describe('Lite course catalog regression', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('the course list has its own route', () => {
    const router = readFileSync(join(__dirname, '../../router/index.ts'), 'utf8')
    expect(router).toContain("path: '/courses'")
    expect(router).toContain("import('../views/CoursesView.vue')")
  })
  it('catalog and course picker derive their selection from the same store', () => {
    // 侧栏课程目录已按 ROOT-PLAN-v1 移除；验证课程中心与 AI 上下文栏统一从 content store 获取语言
    for (const file of ['views/CoursesView.vue', 'components/domain/AiContextRail.vue']) {
      const source = maskComments(readFileSync(join(__dirname, '../..', file), 'utf8'))
      expect(source).toContain('content.selectLang(')
    }
  })

  it('all five languages expose every stage and written courses are open for a new profile', () => {
    // Node has no DOM event target; preload and IPC are never replaced here.
    vi.stubGlobal('window', { addEventListener: () => {} })
    setActivePinia(createPinia())
    const content = useContentStore()
    for (const lang of ['common', 'c', 'cpp', 'java', 'python'] as const) {
      content.selectLang(lang)
      expect(content.activeLang).toBe(lang)
      const modules = content.bundle.outline.filter((m) => m.lang === content.activeLang)
      expect(modules.map((m) => m.stage)).toEqual(lang === 'common' ? [0] : [1, 2, 3])
      for (const lesson of modules.flatMap((m) => m.lessons).filter((l) => l.hasContent)) {
        expect(content.statusOf(lesson.id)).toBe('open')
      }
    }
    expect(content.statusOf('python-stage3-05')).toBe('open')
  })
})
