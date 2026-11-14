/**
 * 课时随堂批注（reading / co-writer 轻量版纯函数模块）
 *
 * 核心职责：
 * 1. 规范化选区文本与截断保护（上限 ANNOTATION_QUOTE_MAX_CHARS = 1000 字符）
 * 2. 格式化构建备忘录正文（原文引用 + 批注内容 + 课时 id）
 * 3. 校验 DOM 选区是否合法位于同一个 .markdown-body 容器内，识别是否在代码块中
 * 4. 提供安全的备忘保存辅助函数
 */
import type { Lesson, MemoItem, MemoKind } from '../../../shared/types'
import { lessonNoteTitle } from './course-navigation'
import { ANNOTATION } from './copy'

export const ANNOTATION_QUOTE_MAX_CHARS = 1000
export const ANNOTATION_NOTE_MAX_CHARS = 2000

export interface NormalizedQuote {
  text: string
  truncated: boolean
}

/**
 * 规范化选中文本：去除首尾空白，超长截断并补齐省略号
 */
export function normalizeAnnotationQuote(
  rawText: string,
  maxChars = ANNOTATION_QUOTE_MAX_CHARS
): NormalizedQuote {
  const trimmed = (rawText || '').trim()
  if (!trimmed) {
    return { text: '', truncated: false }
  }
  if (trimmed.length > maxChars) {
    return {
      text: trimmed.slice(0, maxChars) + '…',
      truncated: true
    }
  }
  return {
    text: trimmed,
    truncated: false
  }
}

/**
 * 构建随堂批注的备忘录正文：原文引用 + 批注 + 课时 id
 */
export function buildAnnotationMemoBody(params: {
  quote: string
  note: string
  lessonId: string
  inCodeBlock?: boolean
}): string {
  const quote = normalizeAnnotationQuote(params.quote).text
  const note = (params.note || '').trim()
  const lessonId = (params.lessonId || '').trim()

  const quoteBlock = params.inCodeBlock
    ? `\`\`\`\n${quote}\n\`\`\``
    : quote
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n')

  return `${quoteBlock}\n\n${note}\n\n${ANNOTATION.lessonIdLabel(lessonId)}`
}

export interface SelectionValidationResult {
  valid: boolean
  text: string
  inCodeBlock: boolean
  reason?: 'empty' | 'no_selection' | 'out_of_bounds' | 'cross_boundary'
}

/**
 * 校验 DOM 选区合法性：
 * - 必须在同一个 article.markdown-body 内
 * - 不能跨 article 边界
 * - 识别是否在 pre/code 代码块中
 */
export function validateDomSelection(
  selection: Selection | null,
  allowedContainerSelector = '.markdown-body'
): SelectionValidationResult {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return { valid: false, text: '', inCodeBlock: false, reason: 'empty' }
  }

  const rawText = selection.toString()
  const normalized = normalizeAnnotationQuote(rawText)
  if (!normalized.text) {
    return { valid: false, text: '', inCodeBlock: false, reason: 'empty' }
  }

  const range = selection.getRangeAt(0)
  const startEl =
    range.startContainer.nodeType === Node.ELEMENT_NODE
      ? (range.startContainer as Element)
      : range.startContainer.parentElement

  const endEl =
    range.endContainer.nodeType === Node.ELEMENT_NODE
      ? (range.endContainer as Element)
      : range.endContainer.parentElement

  if (!startEl || !endEl) {
    return { valid: false, text: '', inCodeBlock: false, reason: 'out_of_bounds' }
  }

  const startContainer = startEl.closest(allowedContainerSelector)
  const endContainer = endEl.closest(allowedContainerSelector)

  if (!startContainer || !endContainer) {
    return { valid: false, text: '', inCodeBlock: false, reason: 'out_of_bounds' }
  }

  if (startContainer !== endContainer) {
    return { valid: false, text: '', inCodeBlock: false, reason: 'cross_boundary' }
  }

  const inCodeBlock = Boolean(startEl.closest('pre, code') || endEl.closest('pre, code'))

  return {
    valid: true,
    text: normalized.text,
    inCodeBlock
  }
}

export interface SaveLessonAnnotationParams {
  memoStore: {
    add: (kind: MemoKind) => MemoItem
    setTitle: (id: string, title: string) => boolean
    setBody: (id: string, body: string) => boolean
    remove?: (id: string) => boolean
  }
  lesson: Pick<Lesson, 'id' | 'title' | 'category'>
  quote: string
  note: string
  inCodeBlock?: boolean
}

/**
 * 将随堂批注保存到备忘录（复用 memo.json 的 knowledge 类型）
 */
export function saveLessonAnnotation(params: SaveLessonAnnotationParams): {
  ok: boolean
  item?: MemoItem
  error?: string
} {
  const note = (params.note || '').trim()
  if (!note) {
    return { ok: false, error: 'empty_note' }
  }

  if (note.length > ANNOTATION_NOTE_MAX_CHARS) {
    return { ok: false, error: 'note_too_long' }
  }

  const quote = normalizeAnnotationQuote(params.quote).text
  if (!quote) {
    return { ok: false, error: 'empty_quote' }
  }

  const title = lessonNoteTitle(params.lesson)
  const body = buildAnnotationMemoBody({
    quote,
    note,
    lessonId: params.lesson.id,
    inCodeBlock: params.inCodeBlock
  })

  const item = params.memoStore.add('knowledge')
  params.memoStore.setTitle(item.id, title)
  const bodySaved = params.memoStore.setBody(item.id, body)

  if (!bodySaved) {
    params.memoStore.remove?.(item.id)
    return { ok: false, error: 'body_save_failed' }
  }

  return { ok: true, item }
}
