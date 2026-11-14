import { describe, expect, it } from 'vitest'
import {
  ANNOTATION_QUOTE_MAX_CHARS,
  buildAnnotationMemoBody,
  normalizeAnnotationQuote,
  saveLessonAnnotation
} from '../lesson-annotation'

describe('lesson-annotation 随堂批注纯逻辑测试', () => {
  it('normalizeAnnotationQuote 规范化选中文本并执行超长截断', () => {
    expect(normalizeAnnotationQuote('   \t\r\n   ')).toEqual({ text: '', truncated: false })
    expect(normalizeAnnotationQuote('一段正常文本')).toEqual({ text: '一段正常文本', truncated: false })

    const longText = 'A'.repeat(ANNOTATION_QUOTE_MAX_CHARS + 50)
    const normalized = normalizeAnnotationQuote(longText)
    expect(normalized.truncated).toBe(true)
    expect(normalized.text.length).toBe(ANNOTATION_QUOTE_MAX_CHARS + 1) // 1000 chars + 1 ellipsis
    expect(normalized.text.endsWith('…')).toBe(true)
  })

  it('buildAnnotationMemoBody 正确组装引用、批注与课时 id', () => {
    const body = buildAnnotationMemoBody({
      quote: '第一行引用\n第二行引用',
      note: '这是我的学习心得喵～',
      lessonId: 'common-01'
    })

    expect(body).toContain('> 第一行引用\n> 第二行引用')
    expect(body).toContain('这是我的学习心得喵～')
    expect(body).toContain('课时：common-01')
  })

  it('buildAnnotationMemoBody 支持代码块模式', () => {
    const body = buildAnnotationMemoBody({
      quote: 'int a = 1;\nint b = 2;',
      note: '代码变量赋值',
      lessonId: 'c-01',
      inCodeBlock: true
    })

    expect(body).toContain('```\nint a = 1;\nint b = 2;\n```')
    expect(body).toContain('代码变量赋值')
    expect(body).toContain('课时：c-01')
  })

  it('saveLessonAnnotation 防护空批注与空引用并调用 memoStore', () => {
    const mockItems: any[] = []
    const mockStore = {
      add: (kind: any) => {
        const item = { id: 'memo-1', kind, title: '', body: '', createdAt: 1, updatedAt: 1 }
        mockItems.push(item)
        return item
      },
      setTitle: (id: string, title: string) => {
        const it = mockItems.find((x) => x.id === id)
        if (it) it.title = title
        return true
      },
      setBody: (id: string, body: string) => {
        const it = mockItems.find((x) => x.id === id)
        if (it) it.body = body
        return true
      },
      remove: (id: string) => {
        const idx = mockItems.findIndex((x) => x.id === id)
        if (idx !== -1) mockItems.splice(idx, 1)
        return true
      }
    }

    const lesson = { id: 'common-02', title: '变量定义', category: 'basics' as const }

    // 1. 空批注拦截
    const res1 = saveLessonAnnotation({
      memoStore: mockStore,
      lesson,
      quote: '引用文本',
      note: '   '
    })
    expect(res1.ok).toBe(false)
    expect(res1.error).toBe('empty_note')

    // 2. 空引用拦截
    const res2 = saveLessonAnnotation({
      memoStore: mockStore,
      lesson,
      quote: '  ',
      note: '批注心得'
    })
    expect(res2.ok).toBe(false)
    expect(res2.error).toBe('empty_quote')

    // 3. 正常保存
    let removedId = ''
    const mockStoreWithRemove = {
      ...mockStore,
      remove: (id: string) => {
        removedId = id
        return true
      }
    }

    const res3 = saveLessonAnnotation({
      memoStore: mockStoreWithRemove,
      lesson,
      quote: '重要知识点',
      note: '深刻理解这一句',
      inCodeBlock: false
    })
    expect(res3.ok).toBe(true)
    expect(res3.item?.id).toBe('memo-1')
    expect(res3.item?.title).toContain('变量定义')
    expect(res3.item?.body).toContain('> 重要知识点')
    expect(res3.item?.body).toContain('深刻理解这一句')
    expect(res3.item?.body).toContain('课时：common-02')
  })

  it('saveLessonAnnotation 拦截超长批注且不调用 add()', () => {
    let addCalled = false
    const mockStore = {
      add: () => {
        addCalled = true
        return { id: 'm-1', kind: 'knowledge' as const, title: '', body: '', createdAt: 0, updatedAt: 0 }
      },
      setTitle: () => true,
      setBody: () => true,
      remove: () => true
    }

    const lesson = { id: 'common-02', title: '变量定义' }
    const res = saveLessonAnnotation({
      memoStore: mockStore,
      lesson,
      quote: '引用文本',
      note: 'x'.repeat(2001) // 超出 2000 字符限制
    })

    expect(res.ok).toBe(false)
    expect(res.error).toBe('note_too_long')
    expect(addCalled).toBe(false)
  })

  it('saveLessonAnnotation 当 setBody 失败时触发 remove 回滚不留空条目', () => {
    let removedId = ''
    const mockStore = {
      add: () => ({ id: 'memo-orphaned', kind: 'knowledge' as const, title: '', body: '', createdAt: 0, updatedAt: 0 }),
      setTitle: () => true,
      setBody: () => false, // 模拟存储失败（例如超出 64KB）
      remove: (id: string) => {
        removedId = id
        return true
      }
    }

    const lesson = { id: 'common-02', title: '变量定义' }
    const res = saveLessonAnnotation({
      memoStore: mockStore,
      lesson,
      quote: '引用文本',
      note: '有效批注'
    })

    expect(res.ok).toBe(false)
    expect(res.error).toBe('body_save_failed')
    expect(removedId).toBe('memo-orphaned')
  })
})
