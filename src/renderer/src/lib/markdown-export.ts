/**
 * Markdown 导出模块（备忘录 + 错题本，支持 Obsidian / 本地目录）
 *
 * 核心纯函数：
 * 1. sanitizeMarkdownFilename: 过滤非法字符、Windows 保留名保护、长度上限
 * 2. dedupeFilenames: 批量文件名去重，冲突时自动增加 (2), (3)...
 * 3. formatMemoToMarkdown: 将备忘录条目渲染为带 YAML Frontmatter 的 Markdown
 * 4. formatWrongEntryToMarkdown: 将错题条目渲染为带 YAML Frontmatter 的 Markdown
 * 5. prepareMarkdownExportFiles: 聚合备忘录和错题本，统一生成导出文件清单
 */
import type { MemoItem, WrongBookEntry, Question, MarkdownExportFile } from '../../../shared/types'
import { MARKDOWN_EXPORT, MEMO } from './copy'

const WINDOWS_RESERVED_REGEX = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i
const ILLEGAL_CHARS_REGEX = /[\\/:*?"<>|\x00-\x1f\x7f]/g

/**
 * 清洗并规范化 Markdown 文件名
 */
export function sanitizeMarkdownFilename(
  name: string,
  fallbackId = 'item',
  maxLen = 60
): string {
  const raw = (name || '').trim()
  let cleaned = raw.replace(ILLEGAL_CHARS_REGEX, '_')
  cleaned = cleaned.replace(/^[\s._]+|[\s._]+$/g, '')

  if (!cleaned) {
    cleaned = fallbackId.replace(ILLEGAL_CHARS_REGEX, '_').trim() || 'item'
  }

  if (WINDOWS_RESERVED_REGEX.test(cleaned)) {
    cleaned = '_' + cleaned
  }

  if (cleaned.length > maxLen) {
    cleaned = cleaned.slice(0, maxLen).trim().replace(/[\s._]+$/, '')
  }

  return cleaned || 'item'
}

/**
 * 批量文件名去重，重名项追加 (2), (3)...
 */
export function dedupeFilenames(names: string[]): string[] {
  const used = new Set<string>()
  return names.map((fullname) => {
    if (!used.has(fullname)) {
      used.add(fullname)
      return fullname
    }

    const dotIndex = fullname.lastIndexOf('.')
    const base = dotIndex !== -1 ? fullname.slice(0, dotIndex) : fullname
    const ext = dotIndex !== -1 ? fullname.slice(dotIndex) : ''

    let count = 2
    let candidate = `${base} (${count})${ext}`
    while (used.has(candidate)) {
      count++
      candidate = `${base} (${count})${ext}`
    }

    used.add(candidate)
    return candidate
  })
}

/**
 * 将备忘录单条转换为 Markdown 文本（含 Frontmatter）
 */
export function formatMemoToMarkdown(memo: MemoItem): string {
  const safeTitle = memo.title?.trim() || MARKDOWN_EXPORT.UNTITLED_MEMO
  const kindLabel = memo.kind === 'code' ? MEMO.KIND_CODE : MEMO.KIND_KNOWLEDGE

  const lines = [
    '---',
    'type: memo',
    `kind: ${memo.kind}`,
    `id: ${memo.id}`,
    `title: ${JSON.stringify(safeTitle)}`,
    `createdAt: ${new Date(memo.createdAt).toISOString()}`,
    `updatedAt: ${new Date(memo.updatedAt).toISOString()}`,
    'tags:',
    `  - ${MARKDOWN_EXPORT.TAG_MEMO}`,
    `  - ${kindLabel}`,
    '---',
    '',
    `# ${safeTitle}`,
    '',
    (memo.body || '').trim(),
    ''
  ]

  return lines.join('\n')
}

/**
 * 将错题条目转换为 Markdown 文本（含 Frontmatter、题干、选项、答案与解析）
 */
export function formatWrongEntryToMarkdown(
  entry: WrongBookEntry,
  question?: Question
): string {
  const q = question || entry.ai
  const stemSummary = q?.stem ? q.stem.slice(0, 30).replace(/\s+/g, ' ') : `${entry.lessonId}-${entry.qid}`

  const lines: string[] = [
    '---',
    'type: wrong_question',
    `lessonId: ${entry.lessonId}`,
    `questionId: ${entry.qid}`,
    `wrongCount: ${entry.wrongCount}`,
    `lastWrongAt: ${entry.lastWrongAt}`,
    `cleared: ${Boolean(entry.cleared)}`,
    ...(entry.hole ? ['hole: true'] : []),
    ...(entry.source ? [`source: ${entry.source}`] : []),
    'tags:',
    `  - ${MARKDOWN_EXPORT.TAG_WRONG}`,
    `  - ${entry.lessonId}`,
    '---',
    '',
    `# ${MARKDOWN_EXPORT.TAG_WRONG}：${stemSummary}`,
    ''
  ]

  if (q) {
    lines.push(`## ${MARKDOWN_EXPORT.SECTION_STEM}`, '', q.stem, '')

    if (q.type === 'choice' && Array.isArray(q.options) && q.options.length > 0) {
      lines.push(`## ${MARKDOWN_EXPORT.SECTION_OPTIONS}`, '')
      q.options.forEach((opt, idx) => {
        const letter = String.fromCharCode(65 + idx)
        lines.push(`- **${letter}.** ${opt}`)
      })
      lines.push('')
    }

    if (
      (q.type === 'code' || q.type === 'codefix' || q.type === 'codewrite') &&
      'initialCode' in q &&
      q.initialCode
    ) {
      const codeStr = typeof q.initialCode === 'string' ? q.initialCode : JSON.stringify(q.initialCode)
      lines.push(`## ${MARKDOWN_EXPORT.SECTION_INITIAL_CODE}`, '', '```', codeStr, '```', '')
    }

    if ('answer' in q && q.answer !== undefined) {
      let ansText = ''
      if (Array.isArray(q.answer)) {
        ansText = q.answer.join(', ')
      } else if (typeof q.answer === 'string' || typeof q.answer === 'number' || typeof q.answer === 'boolean') {
        ansText = String(q.answer)
      } else {
        ansText = JSON.stringify(q.answer)
      }
      lines.push(`## ${MARKDOWN_EXPORT.SECTION_ANSWER}`, '', ansText, '')
    }

    if (q.explanation) {
      lines.push(`## ${MARKDOWN_EXPORT.SECTION_EXPLANATION}`, '', q.explanation, '')
    }
  } else {
    lines.push(
      `## ${MARKDOWN_EXPORT.SECTION_INFO}`,
      '',
      `${MARKDOWN_EXPORT.LABEL_LESSON}：${entry.lessonId}`,
      `${MARKDOWN_EXPORT.LABEL_QID}：${entry.qid}`,
      `${MARKDOWN_EXPORT.LABEL_WRONG_COUNT}：${entry.wrongCount}`,
      `${MARKDOWN_EXPORT.LABEL_LAST_WRONG}：${entry.lastWrongAt}`,
      ''
    )
  }

  return lines.join('\n')
}

export interface PrepareExportParams {
  memos: MemoItem[]
  wrongEntries: WrongBookEntry[]
  questionLookup?: (lessonId: string, qid: string) => Question | undefined
}

/**
 * 聚合准备全部导出文件
 */
export function prepareMarkdownExportFiles(params: {
  memos: MemoItem[]
  wrongEntries: WrongBookEntry[]
  questionLookup?: (lessonId: string, qid: string) => Question | undefined
}): MarkdownExportFile[] {
  const rawList: { rawName: string; content: string }[] = []

  // 1. 备忘录
  for (const item of params.memos) {
    const safeTitle = sanitizeMarkdownFilename(item.title, `memo-${item.id}`)
    rawList.push({
      rawName: `${MARKDOWN_EXPORT.PREFIX_MEMO}_${safeTitle}.md`,
      content: formatMemoToMarkdown(item)
    })
  }

  // 2. 错题本 (过滤软删除)
  const activeWrongs = params.wrongEntries.filter((w) => !w.removed)
  for (const entry of activeWrongs) {
    const q = params.questionLookup ? params.questionLookup(entry.lessonId, entry.qid) : entry.ai
    const qDesc = q?.stem ? q.stem.slice(0, 20) : entry.qid
    const safeDesc = sanitizeMarkdownFilename(qDesc, `${entry.lessonId}-${entry.qid}`)
    rawList.push({
      rawName: `${MARKDOWN_EXPORT.PREFIX_WRONG}_${entry.lessonId}_${safeDesc}.md`,
      content: formatWrongEntryToMarkdown(entry, q)
    })
  }

  // 3. 去重
  const dedupedNames = dedupeFilenames(rawList.map((item) => item.rawName))

  return rawList.map((item, idx) => ({
    filename: dedupedNames[idx],
    content: item.content
  }))
}
