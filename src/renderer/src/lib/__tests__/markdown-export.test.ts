import { describe, expect, it } from 'vitest'
import type { MemoItem, WrongBookEntry, ChoiceQuestion } from '../../../../shared/types'
import {
  sanitizeMarkdownFilename,
  dedupeFilenames,
  formatMemoToMarkdown,
  formatWrongEntryToMarkdown,
  prepareMarkdownExportFiles
} from '../markdown-export'

describe('markdown-export 纯函数模块', () => {
  describe('sanitizeMarkdownFilename 净化文件名', () => {
    it('去除或替换 Windows 非法字符', () => {
      expect(sanitizeMarkdownFilename('abc/def\\ghi:jkl*mno?pq"rst<uv>w|x')).toBe('abc_def_ghi_jkl_mno_pq_rst_uv_w_x')
    })

    it('拦截 Windows 保留名如 CON, AUX, NUL, PRN 并加前缀保护', () => {
      expect(sanitizeMarkdownFilename('CON')).toBe('_CON')
      expect(sanitizeMarkdownFilename('aux')).toBe('_aux')
      expect(sanitizeMarkdownFilename('NUL.txt')).toBe('_NUL.txt')
    })

    it('空标题时回退到 fallbackId', () => {
      expect(sanitizeMarkdownFilename('', 'fallback-1')).toBe('fallback-1')
      expect(sanitizeMarkdownFilename('   ', 'fallback-2')).toBe('fallback-2')
      expect(sanitizeMarkdownFilename('...___...', 'fallback-3')).toBe('fallback-3')
    })

    it('截断超长文件名', () => {
      const longTitle = 'a'.repeat(100)
      const res = sanitizeMarkdownFilename(longTitle, 'fb', 30)
      expect(res.length).toBeLessThanOrEqual(30)
    })
  })

  describe('dedupeFilenames 文件名重名去重', () => {
    it('无重名时不加编号', () => {
      expect(dedupeFilenames(['a.md', 'b.md', 'c.md'])).toEqual(['a.md', 'b.md', 'c.md'])
    })

    it('有重名时为后续项追加 (2), (3)', () => {
      expect(dedupeFilenames(['note.md', 'note.md', 'other.md', 'note.md'])).toEqual([
        'note.md',
        'note (2).md',
        'other.md',
        'note (3).md'
      ])
    })

    it('输入已包含 (2) 时跳过自撞序号分配空位', () => {
      expect(dedupeFilenames(['a.md', 'a (2).md', 'a.md'])).toEqual([
        'a.md',
        'a (2).md',
        'a (3).md'
      ])
    })
  })

  describe('formatMemoToMarkdown 格式化备忘录', () => {
    it('生成符合 YAML Frontmatter 格式的 Markdown', () => {
      const memo: MemoItem = {
        id: 'memo-123',
        kind: 'knowledge',
        title: 'Python 列表切片心得',
        body: '切片操作 list[start:end:step] 左闭右开喵！',
        createdAt: 1761904800000,
        updatedAt: 1761905100000
      }

      const md = formatMemoToMarkdown(memo)
      expect(md).toContain('---')
      expect(md).toContain('type: memo')
      expect(md).toContain('kind: knowledge')
      expect(md).toContain('Python 列表切片心得')
      expect(md).toContain('切片操作 list[start:end:step] 左闭右开喵！')
    })
  })

  describe('formatWrongEntryToMarkdown 格式化错题本', () => {
    it('正确整合题目、题干与选项信息', () => {
      const entry: WrongBookEntry = {
        key: 'python-stage1-03:q1',
        lessonId: 'python-stage1-03',
        qid: 'q1',
        wrongCount: 3,
        lastWrongAt: '2026-10-31T11:00:00.000Z',
        cleared: false,
        hole: true
      }

      const q: ChoiceQuestion = {
        id: 'q1',
        type: 'choice',
        stem: '在 Python 中怎样定义变量？',
        options: ['直接赋值', '使用 var', '使用 dim'],
        answer: 0,
        explanation: '直接写变量名并赋值即可喵！'
      }

      const md = formatWrongEntryToMarkdown(entry, q)
      expect(md).toContain('type: wrong_question')
      expect(md).toContain('wrongCount: 3')
      expect(md).toContain('hole: true')
      expect(md).toContain('在 Python 中怎样定义变量？')
      expect(md).toContain('- **A.** 直接赋值')
      expect(md).toContain('直接写变量名并赋值即可喵！')
    })
  })

  describe('prepareMarkdownExportFiles 聚合导出', () => {
    it('聚合备忘录与错题本并进行全局去重', () => {
      const memos: MemoItem[] = [
        {
          id: '1',
          kind: 'code',
          title: '重复标题',
          body: 'code 1',
          createdAt: 1761904800000,
          updatedAt: 1761904800000
        },
        {
          id: '2',
          kind: 'code',
          title: '重复标题',
          body: 'code 2',
          createdAt: 1761904800000,
          updatedAt: 1761904800000
        }
      ]

      const files = prepareMarkdownExportFiles({
        memos,
        wrongEntries: []
      })

      expect(files).toHaveLength(2)
      expect(files[0].filename).not.toBe(files[1].filename)
      expect(files[1].filename).toContain('(2)')
    })
  })
})
