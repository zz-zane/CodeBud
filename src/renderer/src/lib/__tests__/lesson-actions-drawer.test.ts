import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { LESSON } from '../copy'

const RENDERER_SRC = join(__dirname, '../..')

describe('随堂笔记与操作栏文案契约 (copy.ts)', () => {
  it('随堂笔记文案符合专业中文要求，且不含猫咪语气后缀', () => {
    expect(LESSON.NOTE_DRAWER_TITLE).toBe('随堂笔记')
    expect(LESSON.NOTE_DRAWER_BACK).toBe('← 返回课文')
    expect(LESSON.NOTE_DRAWER_PH).toBe('记录思考、要点或疑问，支持 Markdown')
    expect(LESSON.NOTE_DRAWER_SAVED).toBe('已自动保存')
    expect(LESSON.NOTE_DRAWER_NOT_SAVED).toBe('输入后自动保存')
    expect(LESSON.NOTE_DRAWER_ALL).toBe('查看全部笔记')

    const values = [
      LESSON.NOTE_DRAWER_TITLE,
      LESSON.NOTE_DRAWER_BACK,
      LESSON.NOTE_DRAWER_PH,
      LESSON.NOTE_DRAWER_SAVED,
      LESSON.NOTE_DRAWER_NOT_SAVED,
      LESSON.NOTE_DRAWER_ALL
    ]
    for (const v of values) {
      expect(v).not.toContain('喵')
      expect(v).not.toContain('～')
    }
  })
})

describe('MiDrawer.vue 契约与插槽支持', () => {
  const content = readFileSync(join(RENDERER_SRC, 'components/base/MiDrawer.vue'), 'utf-8')

  it('具备可选 header 插槽并传出 close 回调', () => {
    expect(content).toContain('<slot name="header" :close="close">')
  })

  it('保留默认 mi-drawer-head 作为 fallback', () => {
    expect(content).toContain('class="mi-drawer-head"')
    expect(content).toContain('class="mi-drawer-title"')
    expect(content).toContain('class="mi-drawer-close"')
  })

  it('closable 默认 true 且保留 Escape 监听', () => {
    expect(content).toContain('{ width: 380, closable: true }')
    expect(content).toContain("e.key === 'Escape'")
  })

  it('mi-drawer-body 支持 flex 列排布与盒模型约束', () => {
    expect(content).toContain('display: flex;')
    expect(content).toContain('flex-direction: column;')
    expect(content).toContain('box-sizing: border-box;')
  })
})

describe('LessonDetailView.vue 操作区与笔记抽屉契约', () => {
  const content = readFileSync(join(RENDERER_SRC, 'views/LessonDetailView.vue'), 'utf-8')

  it('取消高特异性 nowrap 和 overflow-x: auto', () => {
    const fixedBarBlock = content.match(/#app \.claude-app-container \.lesson-actions\.fixed-bar\s*\{[^}]+\}/)?.[0] ?? ''
    expect(fixedBarBlock).not.toContain('flex-wrap: nowrap')
    expect(fixedBarBlock).not.toContain('overflow-x: auto')
  })

  it('拆分为学习工具行与独立章节导航行两层布局（含左侧课程名与右侧导航组）', () => {
    expect(content).toContain('class="lesson-tools-row"')
    expect(content).toContain('class="lesson-nav-row"')
    expect(content).toContain('class="lesson-current-title"')
    expect(content).toContain('class="lesson-nav-buttons"')
    expect(content).toContain('class="nav-col nav-prev"')
    expect(content).toContain('class="nav-col nav-catalog"')
    expect(content).toContain('class="nav-col nav-next"')
  })

  it('导航行采用两端对齐与自然换行布局', () => {
    expect(content).toContain('justify-content: space-between;')
    expect(content).toContain('flex-wrap: wrap;')
  })

  it('保留所有现有交互 handler 与条件判断', () => {
    expect(content).toContain('@click="toggleLearned"')
    expect(content).toContain('@click="startPractice"')
    expect(content).toContain('@click="runCode"')
    expect(content).toContain('@click="toggleFavorite"')
    expect(content).toContain('@click="openLessonNote"')
    expect(content).toContain('@click="openLesson(prevId)"')
    expect(content).toContain('@click="openLesson(nextId)"')
    expect(content).toContain("router.push('/courses?cat=algo')")
    expect(content).toContain('isAlgo')
    expect(content).toContain('quizCount > 0')
  })

  it('随堂笔记使用 header 插槽提供返回课文按钮并移除重复右上 ×', () => {
    expect(content).toContain('<template #header="{ close }">')
    expect(content).toContain('class="note-drawer-back-btn"')
    expect(content).toContain('LESSON.NOTE_DRAWER_BACK')
  })

  it('随堂笔记具备焦点管理：打开聚焦输入框，关闭恢复记笔记按钮焦点', () => {
    expect(content).toContain('noteBtnRef')
    expect(content).toContain('noteTextareaRef')
    expect(content).toContain('focusNoteBtn')
  })

  it('笔记 textarea 禁止手动拉伸且独立滚动，页头页脚常驻可见', () => {
    expect(content).toContain('resize: none;')
    expect(content).toContain('overflow-y: auto;')
    expect(content).toContain('flex-shrink: 0;')
  })

  it('提供不少于 44px 点击命中区且避免按钮重叠', () => {
    expect(content).toContain('.lesson-actions .mi-btn::after')
    expect(content).toContain('top: -6px;')
    expect(content).toContain('bottom: -6px;')
  })

  it('具备防 sticky 遮挡正文末尾与键盘焦点的安全间距', () => {
    expect(content).toContain('scroll-margin-bottom: 140px;')
    expect(content).toContain('scroll-margin-bottom: 120px;')
  })
})
