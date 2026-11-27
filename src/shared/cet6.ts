/**
 * 六级真题（CET-6）：类型 + 全部纯函数。行为基准是 cet6_p/app.js，docs/27 §6。
 * 只放纯函数（可被 Vitest 直接测）；DOM、IPC、存储都不在这里。
 */

import { assertSupportedVersion } from './data-version'

// 听力原文占位句（数据判据，不是界面文案）；放在文件最前，避开文案扫描的 `>…<` 文本节点误匹配
const TRANSCRIPT_PLACEHOLDER = /^听力录音音频已在上方/

// ---------------------------------------------------------------- 类型

export type Cet6Kind = 'single-choice' | 'word-bank' | 'matching' | 'essay' | 'translation'
export type Cet6SectionType = 'writing' | 'listening' | 'reading' | 'translation'

export interface Cet6Option {
  key: string
  text: string
}

export interface Cet6Question {
  id: string
  number: number
  kind: Cet6Kind
  stem: string
  blockId: string
  options?: Cet6Option[]
  answer?: string
  explanation?: string
  verified?: boolean
  verificationNote?: string
  unanswerable?: boolean
  /**
   * 解析在原文里的依据位置（2026-11-23）：做完题看解析时，左侧原文 / 听力原文把这几段标亮并滚过去，
   * 学员不用自己回原文找。由 scripts/cet6-evidence 生成、content 校验核对 quote === 原文[start, end)。
   */
  evidence?: Cet6Evidence[]
}

export interface Cet6Evidence {
  /** 所在 block（通常就是题目的 blockId） */
  blockId: string
  /** 阅读在 text 里找，听力在 transcript 里找 */
  field: 'text' | 'transcript'
  /** UTF-16 下标，左闭右开 */
  start: number
  end: number
  /** 原文里的这一段，必须等于 block[field].slice(start, end)；用来防偏移漂移 */
  quote: string
}

export interface Cet6Block {
  id: string
  title?: string
  text?: string
  transcript?: string
  transcriptDraft?: string
  asrDraft?: string
  translation?: string
}

export interface Cet6Section {
  id: string
  type: Cet6SectionType
  title: string
  directions?: string
  audio?: { src?: string; note?: string; sharedWith?: Array<string | number> } | null
  blocks?: Cet6Block[]
  questions?: Cet6Question[]
  figure?: { src?: string; alt?: string }
  sharedWithExamId?: string
  sharedWithTitle?: string
  sharedNote?: string
}

export interface Cet6Exam {
  id: string
  title: string
  year: number
  month: number
  set: number
  issues?: string[]
  sources?: Array<{ title?: string }>
  sections: Cet6Section[]
}

export interface Cet6Meta {
  id: string
  title: string
  year: number
  month: number
  set: number
  file: string
  status?: string
  issues?: string[]
}

export const CET_LEVELS = ['cet6', 'cet4'] as const
export type CetLevel = (typeof CET_LEVELS)[number]

/** 练习支持暂停和选词；考试按等级倒计时，期间锁定界面（docs/27 §8.1）。 */
export type Cet6Mode = 'practice' | 'exam'

export const CURRENT_CET6_VERSION = 2

export interface Cet6AiGrade {
  score: number
  comment: string
  at: number
}

export interface Cet6Record {
  answers: Record<string, string>
  marks: string[]
  submitted: boolean
  seconds: number
  mode: Cet6Mode
  aiGrades?: Record<string, Cet6AiGrade>
}

export interface Cet6File {
  version: number
  mediaRoot: string | null
  /** 目录页「练习 | 考试」切换的上次选择 */
  lastMode: Cet6Mode
  records: Record<string, Cet6Record>
}

export interface Cet6MediaStatus {
  /** 当前生效的音频目录（用户设置，或默认目录存在时的默认值） */
  root: string | null
  /** 目录是否存在 */
  ok: boolean
}

export interface Cet6State {
  records: Record<string, Cet6Record>
  media: Cet6MediaStatus
  lastMode: Cet6Mode
  readOnlyNewer?: boolean
}

/** 写作 30 + 听力 30 + 阅读 40 + 翻译 30 */
export const EXAM_SECONDS = 130 * 60

export const CET6_EXAM_ID = /^\d{4}-\d{2}-\d$/
/** 兼容旧调用方；界面套数以已载入的目录为准。 */
export const CET6_EXAM_TOTAL = 52

export const CET6_LIMITS = {
  answerKeys: 400,
  keyLength: 64,
  valueLength: 20000,
  marks: 400,
  seconds: 7 * 24 * 3600
} as const

const SECTION_OF_UNIT: Record<string, string> = { conversation: 'A', passage: 'B', recording: 'C' }
const CET4_SECTION_OF_UNIT: Record<string, string> = { 'news report': 'A', conversation: 'B', passage: 'C' }
const CJK = '\\u4e00-\\u9fff'

export function hasCjk(text: string): boolean {
  return new RegExp(`[${CJK}]`).test(text)
}

// ---------------------------------------------------------------- 题型判断

export function isObjective(q: Cet6Question): boolean {
  return q.kind === 'single-choice' || q.kind === 'word-bank' || q.kind === 'matching'
}

export function isScored(q: Cet6Question): boolean {
  return isObjective(q) && !!q.answer && q.verified === true && !q.unanswerable
}

export function normalizedAnswer(q: Pick<Cet6Question, 'answer'>): string {
  return String(q.answer).trim().toUpperCase()
}

export function isRight(q: Cet6Question, given: string | undefined): boolean {
  return String(given || '').trim().toUpperCase() === normalizedAnswer(q)
}

// ---------------------------------------------------------------- 排版

/** 只取试卷上会印的那部分；资料里的题型说明、主题、提取注记都不上卷 */
export function blockHeading(section: Cet6Section, block: Cet6Block, level: CetLevel = 'cet6'): { section: string; unit: string } {
  if (section.type !== 'listening' && section.type !== 'reading') return { section: '', unit: '' }
  const title = block.title || ''
  const unit = level === 'cet4'
    ? title.match(/(News Report|Conversation|Passage)\b(?:\s+(?:One|Two|Three|[1-3])\b)?/i)
    : title.match(/(Conversation|Passage|Recording)\s+(One|Two|Three)/i)
  const letter = title.match(/Section\s*([ABC])/i)
  let sectionLetter = letter ? letter[1].toUpperCase() : ''
  if (!sectionLetter && unit && section.type === 'listening') sectionLetter = (level === 'cet4' ? CET4_SECTION_OF_UNIT : SECTION_OF_UNIT)[unit[1].toLowerCase()]
  return { section: sectionLetter && `Section ${sectionLetter}`, unit: unit ? unit[0] : '' }
}

/** 真实试卷的听力题干只在录音里，交卷前不印；交卷后才显示 */
export function stemOf(section: Cet6Section, q: Cet6Question, submitted: boolean): string {
  const stem = q.stem || ''
  if (section.type === 'listening') {
    if (!submitted) return ''
    if (!/^Question\s*\d+/.test(stem)) return stem
    const translated = stem.match(/题目译文：(.+?)[）)]\s*$/)
    return translated ? translated[1] : ''
  }
  return stem
}

/** 还原 PDF 的硬换行，让段落按版心重新排版 */
export function paragraphs(text: string): string[] {
  const out: string[] = []
  let current = ''
  const flush = (): void => {
    if (current) out.push(current)
    current = ''
  }
  text.split(/\r?\n/).forEach((raw) => {
    const line = raw.trim()
    if (!line) {
      flush()
      return
    }
    if (/[.?!:;"”’)]$/.test(current) && /^[A-Z“"‘]/.test(line)) flush()
    if (!current) {
      current = line
      return
    }
    const cjkJoin = new RegExp(`[${CJK}，。；：、）]$`).test(current) && new RegExp(`^[${CJK}（]`).test(line)
    current += (cjkJoin ? '' : ' ') + line
  })
  flush()
  return out
}

export interface MatchingItem {
  letter: string
  mark: string
  text: string
}
export interface MatchingPassage {
  title: string
  items: MatchingItem[]
}

const matchingCache = new WeakMap<object, MatchingPassage>()

/**
 * Section B 的段落标签格式不一（换行、夹在行中、无空格），依字母顺序逐个切开；
 * 标签前的文字是残缺的说明、误入的词库和文章标题，只留标题。
 */
export function parseMatchingPassage(block: Pick<Cet6Block, 'text'>): MatchingPassage {
  const cached = matchingCache.get(block)
  if (cached) return cached
  const text = block.text || ''
  const cuts: Array<{ letter: string; start: number; bodyStart: number; mark: string }> = []
  let pos = 0
  for (let code = 65; code <= 84; code++) {
    const letter = String.fromCharCode(code)
    // 第一个标签前可能紧接文章标题，没有句末标点
    const before = code === 65 ? '(?:^|\\s)' : '(?:^|\\n|[.?!"”’):．。…]\\s+)'
    const label = new RegExp(`${before}\\s*(\\[${letter}\\]\\.?|${letter}[).])\\s*(?=[A-Zl“"‘'])`, 'g')
    label.lastIndex = pos
    const match = label.exec(text)
    if (!match) continue
    const start = match.index + match[0].lastIndexOf(match[1])
    cuts.push({ letter, start, bodyStart: match.index + match[0].length, mark: match[1] })
    pos = match.index + match[0].length
  }
  const clean = (s: string): string => s.replace(/\s+/g, ' ').trim()
  const heading = cuts.length ? clean(text.slice(0, cuts[0].start).replace(/^[\s\S]*Answer\s*Sheet\s*\d\s*[.．]?/i, '')) : ''
  const parsed: MatchingPassage = {
    title: heading.length <= 120 ? heading : '',
    items: cuts.map((cut, i) => ({
      letter: cut.letter,
      mark: cut.mark,
      text: clean(text.slice(cut.bodyStart, i + 1 < cuts.length ? cuts[i + 1].start : undefined))
    }))
  }
  matchingCache.set(block, parsed)
  return parsed
}

export function withoutEmbeddedQuestions(text: string, section: Cet6Section, block: Cet6Block): string {
  const questions = (section.questions || []).filter((q) => q.blockId === block.id)
  const first = questions.length ? Math.min(...questions.map((q) => q.number)) : 0
  // shortcut: only remove a numbered question at the beginning of a line; review ambiguous OCR manually.
  if ([36, 46, 51].includes(first)) {
    return text.split(new RegExp(`\\n\\s*${first}\\s*[.．]\\s+(?=[A-Z])`))[0]
  }
  return text
}

/** 部分资料把段落选项补到 T，比文章实际段落多；只留到最后出现的段落或答案字母 */
export function answerKeys(section: Cet6Section, q: Cet6Question): string[] {
  const keys = (q.options || []).map((o) => o.key)
  if (q.kind !== 'matching') return keys
  const block = (section.blocks || []).find((b) => b.id === q.blockId)
  const labels = block ? parseMatchingPassage(block).items.map((item) => item.letter) : []
  if (labels.length < 5) return keys
  const answers = (section.questions || []).filter((x) => x.kind === 'matching' && x.answer).map(normalizedAnswer)
  const last = [...labels, ...answers].sort().pop() as string
  return keys.filter((key) => key <= last)
}

// ---------------------------------------------------------------- 解析与原文

export function usableExplanation(q: Cet6Question): string {
  const text = q.explanation
  if (!text || !isObjective(q)) return ''
  const onlyRestatesAnswer = /^(?:请听录音作答。|经原版解析核对，|经原卷解析核对，)?(?:(?:官方)?标准答案为|对应文章段落)\s*\[?[A-Z]\]?\s*$/.test(text.trim())
  const placeholder = /答案待|待进一步核验|待核对|待精查|官方未提供本题答案|解析册为52页精析图册/.test(text)
  const garbled = /UUJrl|Xif Jf JJ|讠吾|讠置|亻旦|丬|[A-Z]{2,}[a-z]+[A-Z]+/.test(text) || /\b[BCDFGHJKLMNPQRSTVWXZ]{4,}\b/i.test(text)
  return onlyRestatesAnswer || placeholder || garbled ? '' : text
}

export function listeningTranscript(block: Cet6Block): string {
  const transcript = (block.transcript || '').trim()
  if (transcript && !TRANSCRIPT_PLACEHOLDER.test(transcript)) return transcript
  if ((block.transcriptDraft || '').trim()) return block.transcriptDraft as string
  return (block.text || '').trim().length > 80 ? (block.text as string) : ''
}

/** 原文标题与是否「机器转写」「可能混入解析」，照搬 app.js printTranscript 的判据 */
export function transcriptInfo(block: Cet6Block): { text: string; usesDraft: boolean; needsReview: boolean; chineseCount: number } {
  const text = listeningTranscript(block)
  const usesDraft = (!(block.transcript || '').trim() || TRANSCRIPT_PLACEHOLDER.test(block.transcript || '')) && !!block.transcriptDraft
  const chineseCount = (text.match(new RegExp(`[${CJK}]`, 'g')) || []).length
  const needsReview = /[�-]|[A-Za-z]{35,}/.test(text) || (chineseCount >= 100 && chineseCount / text.length > 0.08)
  return { text, usesDraft, needsReview, chineseCount }
}

export function englishLinesOnly(text: string): string {
  return text
    .split('\n')
    .filter((line) => line.trim() && !new RegExp(`[${CJK}]`).test(line))
    .join('\n')
}

// ---------------------------------------------------------------- 统计与作答

export function countWords(str: string): number {
  const matches = (str || '').match(/\b\w+\b/g)
  return matches ? matches.length : 0
}

export function score(exam: Cet6Exam, answers: Record<string, string>): { correct: number; total: number; accuracy: string } {
  const scored = (exam.sections || []).flatMap((sec) => sec.questions || []).filter(isScored)
  const correct = scored.filter((q) => isRight(q, answers[q.id])).length
  return { correct, total: scored.length, accuracy: scored.length > 0 ? ((correct / scored.length) * 100).toFixed(1) : '0.0' }
}

export function isOpen(q: Cet6Question, answers: Record<string, string>): boolean {
  return !answers[q.id] && q.unanswerable !== true
}

/** `afterId` 之后第一个未作答题；没有则 null（afterId 不在列表里时从头找） */
export function nextOpen(list: Cet6Question[], answers: Record<string, string>, afterId: string | null): Cet6Question | null {
  const from = afterId ? list.findIndex((q) => q.id === afterId) + 1 : 0
  return list.slice(from).find((q) => isOpen(q, answers)) || null
}

/** 全卷题数与已答数（不含 unanswerable），交卷确认用 */
export function answerTally(exam: Cet6Exam, answers: Record<string, string>): { total: number; answered: number } {
  let total = 0
  let answered = 0
  for (const sec of exam.sections || []) {
    for (const q of (sec.questions || []).filter((x) => x.unanswerable !== true)) {
      total++
      if (answers[q.id] && answers[q.id].trim() !== '') answered++
    }
  }
  return { total, answered }
}

/** 考试模式剩余秒数；已用时间为负或非数按 0，超出按 0 封底 */
export function examRemaining(elapsed: number, level: CetLevel = 'cet6'): number {
  const used = Number.isFinite(elapsed) ? Math.max(0, Math.floor(elapsed)) : 0
  return Math.max(0, (level === 'cet4' ? 125 * 60 : EXAM_SECONDS) - used)
}

/** 成绩弹窗的分 Part 统计：只含有计分题的部分（听力、阅读），按卷面顺序 */
export function partTally(exam: Cet6Exam, answers: Record<string, string>): Array<{ type: Cet6SectionType; correct: number; total: number }> {
  const out: Array<{ type: Cet6SectionType; correct: number; total: number }> = []
  for (const sec of exam.sections || []) {
    const scored = (sec.questions || []).filter(isScored)
    if (!scored.length) continue
    out.push({ type: sec.type, correct: scored.filter((q) => isRight(q, answers[q.id])).length, total: scored.length })
  }
  return out
}

/** 「只看错题」：计分题里答错（含未答）的那些；待核实与不可答的题不算 */
export function wrongQuestions(exam: Cet6Exam, answers: Record<string, string>): Cet6Question[] {
  return (exam.sections || []).flatMap((sec) => sec.questions || []).filter((q) => isScored(q) && !isRight(q, answers[q.id]))
}

// ---------------------------------------------------------------- 持久化入口校验

export function emptyRecord(mode: Cet6Mode = 'practice'): Cet6Record {
  return { answers: {}, marks: [], submitted: false, seconds: 0, mode }
}

export function asMode(raw: unknown): Cet6Mode {
  return raw === 'exam' ? 'exam' : 'practice'
}

/** 入参不可信。非对象返回 null；其余按上限裁剪，不抛。 */
export function sanitizeRecord(raw: unknown): Cet6Record | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const answers: Record<string, string> = {}
  if (typeof r.answers === 'object' && r.answers !== null && !Array.isArray(r.answers)) {
    for (const [k, v] of Object.entries(r.answers as Record<string, unknown>)) {
      if (Object.keys(answers).length >= CET6_LIMITS.answerKeys) break
      if (typeof v !== 'string' || k.length === 0 || k.length > CET6_LIMITS.keyLength) continue
      answers[k] = v.slice(0, CET6_LIMITS.valueLength)
    }
  }
  const marks = Array.isArray(r.marks)
    ? r.marks.filter((m): m is string => typeof m === 'string' && m.length > 0 && m.length <= CET6_LIMITS.keyLength).slice(0, CET6_LIMITS.marks)
    : []
  const sec = typeof r.seconds === 'number' && Number.isFinite(r.seconds) ? Math.floor(r.seconds) : 0
  const out: Cet6Record = {
    answers,
    marks,
    submitted: r.submitted === true,
    seconds: Math.min(Math.max(sec, 0), CET6_LIMITS.seconds),
    mode: asMode(r.mode)
  }
  const aiGrades = sanitizeAiGrades(r.aiGrades)
  if (aiGrades) out.aiGrades = aiGrades
  return out
}

function sanitizeAiGrades(raw: unknown): Record<string, Cet6AiGrade> | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
  const out: Record<string, Cet6AiGrade> = {}
  for (const [qid, g] of Object.entries(raw as Record<string, unknown>)) {
    if (Object.keys(out).length >= CET6_LIMITS.answerKeys) break
    if (!qid || qid.length > CET6_LIMITS.keyLength || typeof g !== 'object' || g === null || Array.isArray(g)) continue
    const rec = g as Record<string, unknown>
    if (typeof rec.score !== 'number' || !Number.isFinite(rec.score)) continue
    if (typeof rec.comment !== 'string') continue
    const comment = rec.comment.trim().slice(0, 200)
    if (!comment) continue
    const at = typeof rec.at === 'number' && Number.isFinite(rec.at) ? Math.max(0, Math.floor(rec.at)) : 0
    out[qid] = {
      score: Math.min(15, Math.max(0, Math.round(rec.score))),
      comment,
      at
    }
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/** 将 v1 或未带版本号的 cet6.json 迁移至 v2，保留全部作答与设置 */
function sameJson(left: unknown, right: unknown): boolean {
  if (left === right) return true
  if (Array.isArray(left) && Array.isArray(right)) return left.length === right.length && left.every((value, i) => sameJson(value, right[i]))
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object' || Array.isArray(left) || Array.isArray(right)) return false
  const a = left as Record<string, unknown>, b = right as Record<string, unknown>
  const keys = Object.keys(a)
  return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && sameJson(a[key], b[key]))
}

export function migrateCet6File(raw: unknown): Cet6File {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error('cet6: invalid file')
  const f = raw as Record<string, unknown>
  assertSupportedVersion(f, CURRENT_CET6_VERSION)
  if (f.version !== undefined && f.version !== 1 && f.version !== CURRENT_CET6_VERSION) throw new Error('cet6: unsupported version')
  if (f.mediaRoot !== undefined && f.mediaRoot !== null && typeof f.mediaRoot !== 'string') throw new Error('cet6: invalid media root')
  if (f.lastMode !== undefined && f.lastMode !== 'practice' && f.lastMode !== 'exam') throw new Error('cet6: invalid mode')
  if (f.records !== undefined && (typeof f.records !== 'object' || f.records === null || Array.isArray(f.records))) throw new Error('cet6: invalid records')
  const records: Record<string, Cet6Record> = {}
  if (f.records !== undefined) {
    for (const [id, rec] of Object.entries(f.records as Record<string, unknown>)) {
      const clean = CET6_EXAM_ID.test(id) ? sanitizeRecord(rec) : null
      const row = rec as Record<string, unknown> | null
      const valid = clean && row && ['answers', 'marks', 'submitted', 'seconds', 'mode'].every(
        key => sameJson(row[key], (clean as unknown as Record<string, unknown>)[key])
      ) && (row.aiGrades === undefined || sameJson(row.aiGrades, clean.aiGrades))
      if (!valid) {
        console.warn(`[miai] cet6| cannot preserve invalid record ${id}`)
        throw new Error(`cet6: invalid record ${id}`)
      }
      records[id] = { ...row, ...clean }
    }
  }
  return {
    ...f,
    version: CURRENT_CET6_VERSION,
    mediaRoot: typeof f.mediaRoot === 'string' ? f.mediaRoot : null,
    lastMode: asMode(f.lastMode),
    records
  }
}

// ---------------------------------------------------------------- URL

/**
 * `source-media/<rel>` → <base>media/…；其余（assets/figures/x.png）→ <base>data/…。按段 encode。
 * `base` 缺省 = 桌面的 `miai-cet6://`；手机浏览器传 `/cet6/`（渲染层经 lib/asset-base.ts 的 assetBase() 取）。
 */
export function mediaUrl(src: string, base = 'miai-cet6://'): string {
  const media = src.startsWith('source-media/')
  const rel = media ? src.slice('source-media/'.length) : src
  return `${base}${media ? 'media' : 'data'}/${rel.split('/').map(encodeURIComponent).join('/')}`
}

export function formatClock(totalSec: number): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(Math.floor(totalSec / 3600))}:${pad(Math.floor((totalSec % 3600) / 60))}:${pad(totalSec % 60)}`
}

export function formatTime(sec: number): string {
  const s = Math.floor(sec || 0)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
