import { parseFlashCards, parsePretest, type FlashCardItem, type FlashCardsBlock, type PretestBlock } from './lesson-blocks'
/**
 * M3-01：markdown-it 渲染管线。
 * - 代码块：hljs 四语言高亮（c/cpp/java/python），其余语言按纯文本安全转义
 * - 提示容器：::: tip / ::: warn / ::: note 等 → 圆角提示卡（markdown-it-container）
 * - 数学公式：$inline$ / $$block$$ → KaTeX 排版渲染
 * - 图片：相对路径适配 file:// 生产环境与开发服务器
 * - compare 对比块：正文里只留一个占位元素（`.compare-slot`），结构数据交给
 *   CompareGrid 组件渲染（按钮可交互），并且插回它在正文里的那个位置
 * - demo 演示块（2026-09-19）：同一套槽位机制（`.demo-slot`），交给 DemoPlayer
 *   逐步播放。和 compare 共用切分器，不另起一套
 * - 链接：lesson:// 拦截跳转；http(s) 一律新窗口交给系统浏览器（main 进程 setWindowOpenHandler）
 * - html:false：正文原始 HTML 一律按文本转义，维持严格安全边界
 */
import MarkdownIt from 'markdown-it'
import container from 'markdown-it-container'
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { LANG_OF_CODE } from '../../../shared/types'
import type { LangOfCode } from '../../../shared/types'
import { ADMONITION, CODE_BLOCK } from './copy'
import { isRemote } from './asset-base'
import hljs from 'highlight.js/lib/core'
import cLang from 'highlight.js/lib/languages/c'
import cppLang from 'highlight.js/lib/languages/cpp'
import javaLang from 'highlight.js/lib/languages/java'
import pythonLang from 'highlight.js/lib/languages/python'
import '../styles/md.css'

hljs.registerLanguage('c', cLang)
hljs.registerLanguage('cpp', cppLang)
hljs.registerLanguage('java', javaLang)
hljs.registerLanguage('python', pythonLang)

// ---------------------------------------------------------------- compare 块提取

export { parseFlashCards, parsePretest }
export type { FlashCardItem, FlashCardsBlock, PretestBlock }

export interface CompareBlock {
  langs: string[]
  code: Record<string, string>
}

/** 解析 ```compare 围栏内 lang:: 分段（与 content-validate 的切分规则一致） */
export function parseCompare(content: string): CompareBlock {
  const code: Record<string, string> = {}
  const langs: string[] = []
  const parts = content.split(/^(\w+)::\s*$/m)
  for (let i = 1; i + 1 < parts.length; i += 2) {
    const lang = parts[i].trim()
    const snippet = parts[i + 1].trim()
    if (lang && snippet) {
      langs.push(lang)
      code[lang] = snippet
    }
  }
  return { langs, code }
}

/**
 * 认出正文里的 compare 围栏 —— 凭据交给 markdown-it 自己（它已经把
 * 正文切成 token 了），不再自己写正则去扫原文。
 */
function isCompareFence(info: string): boolean {
  return (info || '').trim().split(/\s+/)[0] === 'compare'
}

/**
 * 把一课正文里的 compare 块按出现顺序收集出来（不渲染，不跑高亮）。
 */
export function collectCompare(body: string): CompareBlock[] {
  const out: CompareBlock[] = []
  for (const t of md.parse(body, {})) {
    if (t.type === 'fence' && isCompareFence(t.info)) out.push(parseCompare(t.content))
  }
  return out
}

/**
 * 正文 HTML 里代替「活组件」的那个占位元素。
 */
export type SlotKind = 'compare' | 'demo' | 'flash-cards' | 'pretest'

/** 类名与属性名都由 kind 推出 */
const slotClass = (kind: SlotKind): string => `${kind}-slot`

export const COMPARE_SLOT_CLASS = slotClass('compare')
export const DEMO_SLOT_CLASS = slotClass('demo')
export const FLASH_CARDS_SLOT_CLASS = slotClass('flash-cards')
export const PRETEST_SLOT_CLASS = slotClass('pretest')

/**
 * 这是「正文里的占位元素长什么样」的唯一凭据。
 */
const SLOT_RE = /<div class="(compare|demo|flash-cards|pretest)-slot" data-\1-slot="(\d+)"><\/div>/g

/** 写占位元素。和 `SLOT_RE` 共用 `slotClass` */
function slotTag(kind: SlotKind, index: number): string {
  return `<div class="${slotClass(kind)}" data-${kind}-slot="${index}"></div>\n`
}

/** 切开之后的一段：要么是一截正文 HTML，要么是「这里该插第 i 个活组件」 */
export type SlotPart =
  | { kind: 'html'; html: string }
  | { kind: 'compare'; index: number }
  | { kind: 'demo'; index: number }
  | { kind: 'flash-cards'; index: number }
  | { kind: 'pretest'; index: number }

/**
 * 把渲染好的正文 HTML 按占位元素切开，返回交替的片段序列。
 */
export function splitSlots(html: string): SlotPart[] {
  const parts: SlotPart[] = []
  let last = 0

  const pushHtml = (chunk: string): void => {
    if (chunk.trim()) parts.push({ kind: 'html', html: chunk })
  }
  for (const m of html.matchAll(SLOT_RE)) {
    const at = m.index ?? 0
    if (at > last) pushHtml(html.slice(last, at))
    parts.push({ kind: m[1] as SlotKind, index: Number(m[2]) })
    last = at + m[0].length
  }
  if (last < html.length) pushHtml(html.slice(last))
  return parts
}

// ---------------------------------------------------------------- demo 块提取

export interface DemoStep {
  label: string
  at: number
  say: string
  meow: string
  pose: string
  vars: { name: string; value: string }[]
}

export interface DemoBlock {
  title: string
  code: string[]
  steps: DemoStep[]
}

/**
 * 解析 ````demo` 围栏。
 */
export function parseDemo(content: string): DemoBlock {
  const code: string[] = []
  const steps: DemoStep[] = []
  let title = ''
  let cur: DemoStep | null = null
  let inCode = false

  const closeStep = (): void => {
    if (cur) steps.push(cur)
    cur = null
  }

  for (const raw of content.split('\n')) {
    const line = raw.trimEnd()

    if (inCode) {
      if (line.startsWith('|')) {
        code.push(line.slice(1).replace(/^ /, ''))
        continue
      }
      inCode = false
    }

    const t = line.trim()
    if (!t) continue

    if (t.startsWith('title:')) {
      title = t.slice('title:'.length).trim()
      continue
    }
    if (t === 'code:') {
      inCode = true
      continue
    }
    if (t === 'step' || t.startsWith('step ')) {
      closeStep()
      cur = {
        label: t.slice('step'.length).trim(),
        at: 0,
        say: '',
        meow: '',
        pose: '',
        vars: []
      }
      continue
    }

    if (cur) {
      const reserved = t.match(/^(at|say|meow|pose)\s*:\s*(.*)$/)
      if (reserved) {
        if (reserved[1] === 'at') cur.at = Number(reserved[2].trim())
        else if (reserved[1] === 'say') cur.say = reserved[2].trim()
        else if (reserved[1] === 'meow') cur.meow = reserved[2].trim()
        else cur.pose = reserved[2].trim()
        continue
      }
      const v = t.match(/^([^:=]+?)\s*=\s*(.*)$/)
      if (v) {
        cur.vars.push({ name: v[1].trim(), value: v[2].trim() })
        continue
      }
    }
  }
  closeStep()

  return { title, code, steps }
}

function isDemoFence(info: string): boolean {
  return (info || '').trim() === 'demo'
}

export function collectDemo(body: string): DemoBlock[] {
  const out: DemoBlock[] = []
  for (const t of md.parse(body, {})) {
    if (t.type === 'fence' && isDemoFence(t.info)) out.push(parseDemo(t.content))
  }
  return out
}


function isFlashCardsFence(info: string): boolean {
  return (info || '').trim().split(/\s+/)[0] === 'flash-cards'
}

export function collectFlashCards(body: string): FlashCardsBlock[] {
  const out: FlashCardsBlock[] = []
  for (const t of md.parse(body, {})) {
    if (t.type === 'fence' && isFlashCardsFence(t.info)) {
      const p = parseFlashCards(t.content)
      if (p) out.push(p)
    }
  }
  return out
}

function isPretestFence(info: string): boolean {
  return (info || '').trim().split(/\s+/)[0] === 'pretest'
}

export function collectPretest(body: string): PretestBlock[] {
  const out: PretestBlock[] = []
  for (const t of md.parse(body, {})) {
    if (t.type === 'fence' && isPretestFence(t.info)) {
      const p = parsePretest(t.content)
      if (p) out.push(p)
    }
  }
  return out
}

// ---------------------------------------------------------------- 可运行代码块提取

export interface RunnableBlock {
  lang: LangOfCode
  code: string
}

/** 只对有明显入口的示例自动尝试运行；片段留给用户补全。 */
export function hasRunnableEntry(lang: LangOfCode, code: string): boolean {
  if (lang === 'c' || lang === 'cpp') return /\b(?:int|void)\s+main\s*\(/.test(code)
  if (lang === 'java') return /\bstatic\s+void\s+main\s*\(/.test(code)
  return /^(?:if\s+__name__\s*==\s*['"]__main__['"]\s*:|print\s*\()/m.test(code)
}

function looksComplete(lang: LangOfCode, code: string): boolean {
  if (lang === 'c' || lang === 'cpp') return /\bmain\s*\(/.test(code)
  if (lang === 'java') return /static\s+void\s+main\s*\(/.test(code)
  return true
}

export function firstRunnableBlock(body: string): RunnableBlock | null {
  for (const t of md.parse(body, {})) {
    if (t.type !== 'fence') continue
    const tag = (t.info || '').trim().split(/\s+/)[0].toLowerCase()
    const lang = LANG_OF_CODE.find((l) => l === tag)
    if (!lang) continue
    if (looksComplete(lang, t.content)) return { lang, code: t.content.replace(/\s+$/, '') }
  }
  return null
}

// ---------------------------------------------------------------- md 实例

const md = new MarkdownIt({
  html: false,
  linkify: false,
  typographer: false,
  breaks: false
})

md.inline.ruler.before('link', 'study_wiki', (state, silent) => {
  if (!state.env.wikiLinks || state.src.slice(state.pos, state.pos + 2) !== '[[') return false
  const end = state.src.indexOf(']]', state.pos + 2)
  if (end < 0) return false
  const [target, alias] = state.src.slice(state.pos + 2, end).split('|')
  if (!target.trim()) return false
  if (!silent) {
    const open = state.push('link_open', 'a', 1)
    open.attrs = [['href', '#'], ['class', 'wiki-link'], ['data-wiki-note', encodeURIComponent(target.trim())]]
    state.push('text', '', 0).content = alias?.trim() || target.trim()
    state.push('link_close', 'a', -1)
  }
  state.pos = end + 2
  return true
})

// ---------------------------------------------------------------- 数学公式解析

// Block math: $$ ... $$ or \[ ... \]
md.block.ruler.before('fence', 'math_block', (state, startLine, endLine, silent) => {
  const start = state.bMarks[startLine] + state.tShift[startLine]
  const max = state.eMarks[startLine]
  if (start + 2 > max) return false
  const prefix = state.src.slice(start, start + 2)
  if (prefix !== '$$' && prefix !== '\\[') return false
  const closeMarker = prefix === '$$' ? '$$' : '\\]'

  const pos = start + 2
  let firstLine = state.src.slice(pos, max)

  if (silent) return true

  let haveEndMarker = false
  let nextLine = startLine

  if (firstLine.trim().endsWith(closeMarker) && firstLine.trim().length >= closeMarker.length) {
    firstLine = firstLine.trim().slice(0, -closeMarker.length)
    haveEndMarker = true
  }

  const lines = [firstLine]

  while (!haveEndMarker) {
    nextLine++
    if (nextLine >= endLine) break

    const s = state.bMarks[nextLine] + state.tShift[nextLine]
    const m = state.eMarks[nextLine]
    if (s < m && state.tShift[nextLine] < state.blkIndent) break

    const line = state.src.slice(s, m)
    if (line.trim().endsWith(closeMarker)) {
      haveEndMarker = true
      lines.push(line.trim().slice(0, -closeMarker.length))
      break
    }
    lines.push(line)
  }

  state.line = nextLine + 1
  const token = state.push('math_block', 'math', 0)
  token.block = true
  token.content = lines.join('\n').trim()
  token.markup = prefix
  return true
})

// Inline math: $ ... $ or \( ... \)
// Placed before 'escape' so \( and \) are not unescaped into literal parentheses
md.inline.ruler.before('escape', 'math_inline', (state, silent) => {
  const max = state.src.length
  if (state.pos >= max) return false

  let isParen = false
  let openLen = 1

  if (state.src.slice(state.pos, state.pos + 2) === '\\(') {
    isParen = true
    openLen = 2
  } else if (state.src[state.pos] === '$') {
    if (state.src[state.pos + 1] === '$') return false // Block math handled separately
    if (state.pos > 0 && state.src[state.pos - 1] === '\\') return false // Escaped \$
    isParen = false
    openLen = 1
  } else {
    return false
  }

  const startPos = state.pos + openLen
  let end = -1

  if (isParen) {
    for (let i = startPos; i < max - 1; i++) {
      if (state.src.slice(i, i + 2) === '\\)') {
        end = i
        break
      }
    }
  } else {
    for (let i = startPos; i < max; i++) {
      if (state.src[i] === '$' && state.src[i - 1] !== '\\') {
        end = i
        break
      }
    }
  }

  if (end === -1) return false
  if (!silent) {
    const token = state.push('math_inline', 'math', 0)
    token.content = state.src.slice(startPos, end)
    token.markup = isParen ? '\\(' : '$'
  }
  state.pos = end + (isParen ? 2 : 1)
  return true
})

md.renderer.rules.math_inline = (tokens, idx) => {
  const content = tokens[idx].content
  try {
    return katex.renderToString(content, { displayMode: false, throwOnError: false })
  } catch {
    return `<code class="katex-fallback">${md.utils.escapeHtml(content)}</code>`
  }
}

md.renderer.rules.math_block = (tokens, idx) => {
  const content = tokens[idx].content
  try {
    return `<div class="math-block">${katex.renderToString(content, { displayMode: true, throwOnError: false })}</div>\n`
  } catch {
    return `<pre class="math-block"><code class="katex-fallback">${md.utils.escapeHtml(content)}</code></pre>\n`
  }
}

/** 代码块围栏：hljs 高亮 + 复制按钮 */
md.renderer.rules.fence = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const lang = (token.info || '').trim().split(/\s+/)[0]

  if (isCompareFence(token.info)) {
    const bag = env as { compareBlocks?: CompareBlock[] }
    const i = bag.compareBlocks ? bag.compareBlocks.push(parseCompare(token.content)) - 1 : 0
    return slotTag('compare', i)
  }

  if (isDemoFence(token.info)) {
    const bag = env as { demoBlocks?: DemoBlock[] }
    const i = bag.demoBlocks ? bag.demoBlocks.push(parseDemo(token.content)) - 1 : 0
    return slotTag('demo', i)
  }

  if (isFlashCardsFence(token.info)) {
    const parsed = parseFlashCards(token.content)
    if (parsed) {
      const bag = env as { flashCardsBlocks?: FlashCardsBlock[] }
      const i = bag.flashCardsBlocks ? bag.flashCardsBlocks.push(parsed) - 1 : 0
      return slotTag('flash-cards', i)
    }
  }

  if (isPretestFence(token.info)) {
    const parsed = parsePretest(token.content)
    if (parsed) {
      const bag = env as { pretestBlocks?: PretestBlock[] }
      const i = bag.pretestBlocks ? bag.pretestBlocks.push(parsed) - 1 : 0
      return slotTag('pretest', i)
    }
  }

  let highlighted = ''
  if (lang && hljs.getLanguage(lang)) {
    try {
      highlighted = hljs.highlight(token.content, { language: lang, ignoreIllegals: true }).value
    } catch {
      highlighted = ''
    }
  }
  const body = highlighted || md.utils.escapeHtml(token.content)
  const label = highlighted ? md.utils.escapeHtml(lang) : 'text'
  const runLang = (env as { runnable?: boolean }).runnable && !isRemote() ? LANG_OF_CODE.find((item) => item === lang) : undefined
  const run = runLang ? `<button class="code-copy code-run" data-run="${runLang}" type="button">${CODE_BLOCK.RUN}</button>` : ''
  const copyBtn =
    `<button class="code-copy" data-copy type="button" title="${CODE_BLOCK.COPY}" aria-label="${CODE_BLOCK.COPY}">` +
    `<svg class="copy-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>` +
    `<svg class="check-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>` +
    `</button>`
  return (
    `<pre class="code-block" data-lang="${label}" aria-label="${label}">` +
    `<div class="code-actions"><span class="code-lang" aria-hidden="true">${label}</span>${run}${copyBtn}</div>` +
    `<code class="hljs">${body}</code></pre>`
  )
}

/**
 * 图片规则：防御性将任何 /algo/ 根路径修正为相对路径 ./algo/，保障生产 file:// 协议可达
 */
md.renderer.rules.image = (tokens, idx, options, _env, self) => {
  const token = tokens[idx]
  const src = String(token.attrGet('src') || '')
  if (src.startsWith('/algo/')) {
    token.attrSet('src', '.' + src)
  }
  return self.renderToken(tokens, idx, options)
}

/** 链接：lesson:// 内部跳转、http 外开 */
md.renderer.rules.link_open = (tokens, idx, options, _env, self) => {
  const token = tokens[idx]
  const href = String(token.attrGet('href') ?? '')
  if (href.startsWith('lesson://')) {
    token.attrSet('data-lesson', href.slice('lesson://'.length))
    token.attrSet('href', '#')
  } else if (/^https?:\/\//i.test(href)) {
    token.attrSet('target', '_blank')
    token.attrSet('rel', 'noopener noreferrer')
  }
  return self.renderToken(tokens, idx, options)
}

/** 提示容器工厂 */
function admonition(kind: string, icon: string, fallbackTitle: string) {
  return {
    validate: (params: string) => params.trim().split(/\s+/)[0] === kind,
    render: (tokens: { nesting: number; info: string }[], idx: number) => {
      const t = tokens[idx]
      if (t.nesting === 1) {
        const title = t.info.trim().replace(new RegExp(`^${kind}\\s*`), '') || fallbackTitle
        return (
          `<div class="mi-admonition mi-${kind}">` +
          `<div class="mi-admonition-title">${icon} ${md.utils.escapeHtml(title)}</div>\n`
        )
      }
      return '</div>\n'
    }
  }
}

md.use(container, 'tip', admonition('tip', ADMONITION.TIP_ICON, ADMONITION.TIP_TITLE))
md.use(container, 'warn', admonition('warn', ADMONITION.WARN_ICON, ADMONITION.WARN_TITLE))
md.use(container, 'note', admonition('note', ADMONITION.NOTE_ICON, ADMONITION.NOTE_TITLE))
md.use(container, 'question', admonition('question', ADMONITION.QUESTION_ICON, ADMONITION.QUESTION_TITLE))
md.use(container, 'quote', admonition('quote', ADMONITION.QUOTE_ICON, ADMONITION.QUOTE_TITLE))
md.use(container, 'abstract', admonition('abstract', ADMONITION.ABSTRACT_ICON, ADMONITION.ABSTRACT_TITLE))
md.use(container, 'success', admonition('success', ADMONITION.SUCCESS_ICON, ADMONITION.SUCCESS_TITLE))

/**
 * 渲染一课正文：返回 HTML + 提取出的对比块与演示块。
 */
export function renderMarkdown(body: string, runnable = false, wikiLinks = false): {
  html: string
  compareBlocks: CompareBlock[]
  demoBlocks: DemoBlock[]
  flashCardsBlocks: FlashCardsBlock[]
  pretestBlocks: PretestBlock[]
} {
  const compareBlocks: CompareBlock[] = []
  const demoBlocks: DemoBlock[] = []
  const flashCardsBlocks: FlashCardsBlock[] = []
  const pretestBlocks: PretestBlock[] = []
  const html = md.render(body, { compareBlocks, demoBlocks, flashCardsBlocks, pretestBlocks, runnable, wikiLinks })
  return { html, compareBlocks, demoBlocks, flashCardsBlocks, pretestBlocks }
}

/** 单段代码高亮；未知语言安全转义 */
export function highlightCode(code: string, lang: string): string {
  if (lang && hljs.getLanguage(lang)) {
    try {
      return hljs.highlight(code, { language: lang, ignoreIllegals: true }).value
    } catch {
      /* 高亮失败按纯文本 */
    }
  }
  return md.utils.escapeHtml(code)
}
