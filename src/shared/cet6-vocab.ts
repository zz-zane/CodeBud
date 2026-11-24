/**
 * 六级生词本（docs/27 §8.3）：类型 + 全部纯函数（选区校验、所在句、去重、增删改、AI 提示词与响应解析）。
 * 不碰 IPC / DOM / 存储。界面文案与送给模型的指令都在 copy.ts，这里不写中文字符串。
 */
import { CET6_EXAM_ID } from './cet6'
import { CET6_VOCAB_PROMPT } from './copy'
import { localDateKeyOf, parseDateKey, shiftDateKey } from './dates'
import { REVIEW_INTERVALS_DAYS } from './review-schedule'

export interface Cet6Gloss {
  phonetic: string
  pos: string
  meaning: string
  collocations: string[]
  translation: string
  structure: string[]
  at: string
}

export interface Cet6VocabEntry {
  id: string
  text: string
  kind: 'word' | 'sentence'
  context: string
  source: { examId: string; sectionType: string } | null
  addedAt: string
  mastered: boolean
  gloss: Cet6Gloss | null
  /** 翻卡复习进度（v2 起）。null = 还没复习过，加入当天就到期 */
  review: Cet6VocabReview | null
}

/** step = REVIEW_INTERVALS_DAYS 的下标（-1 = 刚忘记 / 新卡）；due = 下次到期日键（北京时间 YYYY-MM-DD） */
export interface Cet6VocabReview {
  step: number
  due: string
}

export type Cet6VocabGrade = 'again' | 'hard' | 'good'
export const VOCAB_GRADES: readonly Cet6VocabGrade[] = ['again', 'hard', 'good']

export interface Cet6VocabFile {
  version: 2
  entries: Cet6VocabEntry[]
}

/** 渲染层传给主进程的新增 / 查询入参 */
export interface Cet6VocabInput {
  text: string
  context: string
  source: { examId: string; sectionType: string } | null
}

export type Cet6LookupFail = 'no-key' | 'network' | 'timeout' | 'bad-response' | 'full'
export type Cet6LookupResult = { ok: true; entry: Cet6VocabEntry; added: boolean } | { ok: false; reason: Cet6LookupFail }

export const VOCAB_LIMITS = { text: 300, context: 600, entries: 5000, field: 1000, list: 12 } as const
const SECTION_TYPES: readonly string[] = ['writing', 'listening', 'reading', 'translation']

/** 去重键：去首尾空白、压缩空白、转小写 */
export function vocabKey(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** ≤ 4 个词 = 单词 / 短语，其余 = 句子 */
export function classifyText(text: string): 'word' | 'sentence' {
  const words = text.trim().split(/\s+/).filter((w) => /[A-Za-z]/.test(w))
  return words.length <= 4 ? 'word' : 'sentence'
}

/** 选区文本合格（去首尾空白后 1~300 字符且含字母）返回去空白后的文本，否则 null */
export function validateSelection(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const text = raw.trim()
  return text.length >= 1 && text.length <= VOCAB_LIMITS.text && /[A-Za-z]/.test(text) ? text : null
}

/** 从块级元素文本里取包含选区的那一句（按 . ? ! 切；选区跨句则取到末句），最长 600；找不到返回空串 */
export function extractContext(blockText: string, selection: string): string {
  const text = blockText.replace(/\s+/g, ' ').trim()
  const sel = selection.replace(/\s+/g, ' ').trim()
  if (!text || !sel) return ''
  const start = text.indexOf(sel)
  if (start < 0) return ''
  const last = start + sel.length - 1
  let from = 0
  for (const m of text.slice(0, start).matchAll(/[.?!]["”’')]*\s+/g)) from = (m.index ?? 0) + m[0].length
  const stop = text.slice(last).search(/[.?!]["”’')]*(\s|$)/)
  let to = stop < 0 ? text.length : last + stop + 1
  while (to < text.length && /["”’')]/.test(text[to])) to++
  return text.slice(from, to).trim().slice(0, VOCAB_LIMITS.context)
}

/** 入参清洗：不合格返回 null（主进程据此抛错） */
export function sanitizeVocabInput(raw: unknown): Cet6VocabInput | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const text = validateSelection(r.text)
  if (!text) return null
  if (typeof r.context !== 'string' || r.context.length > VOCAB_LIMITS.context) return null
  let source: Cet6VocabInput['source'] = null
  if (r.source !== null && r.source !== undefined) {
    const s = r.source as Record<string, unknown>
    if (typeof s !== 'object' || typeof s.examId !== 'string' || !CET6_EXAM_ID.test(s.examId)) return null
    if (typeof s.sectionType !== 'string' || !SECTION_TYPES.includes(s.sectionType)) return null
    source = { examId: s.examId, sectionType: s.sectionType }
  }
  return { text, context: r.context.trim(), source }
}

// ---------------------------------------------------------------- 文件归一化

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => str(x, VOCAB_LIMITS.field)).filter(Boolean).slice(0, VOCAB_LIMITS.list) : []

function normalizeGloss(raw: unknown): Cet6Gloss | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const g = raw as Record<string, unknown>
  return {
    phonetic: str(g.phonetic, 100),
    pos: str(g.pos, 100),
    meaning: str(g.meaning, VOCAB_LIMITS.field),
    collocations: strList(g.collocations),
    translation: str(g.translation, VOCAB_LIMITS.field),
    structure: strList(g.structure),
    at: str(g.at, 40)
  }
}

function normalizeEntry(raw: unknown): Cet6VocabEntry | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  const text = validateSelection(r.text)
  const id = str(r.id, 100)
  if (!text || !id) return null
  const src = r.source as Record<string, unknown> | null | undefined
  const source =
    src && typeof src === 'object' && typeof src.examId === 'string' && CET6_EXAM_ID.test(src.examId) && typeof src.sectionType === 'string'
      ? { examId: src.examId, sectionType: src.sectionType }
      : null
  return {
    id,
    text,
    kind: classifyText(text),
    context: str(r.context, VOCAB_LIMITS.context),
    source,
    addedAt: str(r.addedAt, 40),
    mastered: r.mastered === true,
    gloss: normalizeGloss(r.gloss),
    review: normalizeReview(r.review)
  }
}

function normalizeReview(raw: unknown): Cet6VocabReview | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  if (typeof r.due !== 'string' || !parseDateKey(r.due)) return null
  const step = typeof r.step === 'number' && Number.isInteger(r.step) ? Math.max(-1, Math.min(REVIEW_INTERVALS_DAYS.length - 1, r.step)) : -1
  return { step, due: r.due }
}

/**
 * 读口归一化 + 迁移：坏条目丢弃并 warn，好条目保留；重复键 / 重复 id 只留第一条；绝不整份丢。
 * v1 → v2：条目没有 review，补 null（= 未复习过、加入当天到期），其余字段原样保留。
 */
export function normalizeVocabFile(raw: unknown): Cet6VocabFile {
  const list = typeof raw === 'object' && raw !== null && Array.isArray((raw as { entries?: unknown }).entries) ? (raw as { entries: unknown[] }).entries : []
  const seen = new Set<string>()
  const entries: Cet6VocabEntry[] = []
  for (const item of list) {
    const e = normalizeEntry(item)
    if (!e || seen.has(vocabKey(e.text)) || seen.has(`id:${e.id}`)) {
      console.warn('[miai] cet6-vocab| dropped invalid or duplicate entry')
      continue
    }
    seen.add(vocabKey(e.text))
    seen.add(`id:${e.id}`)
    entries.push(e)
    if (entries.length >= VOCAB_LIMITS.entries) break
  }
  return { version: 2, entries }
}

// ---------------------------------------------------------------- 归约

export type UpsertResult = { ok: true; file: Cet6VocabFile; entry: Cet6VocabEntry; added: boolean } | { ok: false; reason: 'full' }

/**
 * 新增或补释义。键已存在：给了 gloss 就只换 gloss（保留 addedAt / mastered / context / source），没给就不动；
 * 键不存在：满 5000 条拒绝，否则追加到最前。
 */
export function upsertEntry(file: Cet6VocabFile, input: Cet6VocabInput, gloss: Cet6Gloss | null, id: string, now: string): UpsertResult {
  const key = vocabKey(input.text)
  const found = file.entries.find((e) => vocabKey(e.text) === key)
  if (found) {
    if (!gloss) return { ok: true, file, entry: found, added: false }
    const entry = { ...found, gloss }
    return { ok: true, file: { ...file, entries: file.entries.map((e) => (e === found ? entry : e)) }, entry, added: false }
  }
  if (file.entries.length >= VOCAB_LIMITS.entries) return { ok: false, reason: 'full' }
  const entry: Cet6VocabEntry = {
    id, text: input.text, kind: classifyText(input.text), context: input.context, source: input.source, addedAt: now, mastered: false, gloss, review: null
  }
  return { ok: true, file: { ...file, entries: [entry, ...file.entries] }, entry, added: true }
}

/** 只允许改 mastered；id 不存在或值不是布尔时原样返回 */
export function updateEntry(file: Cet6VocabFile, id: string, patch: { mastered?: unknown }): Cet6VocabFile {
  const mastered = patch.mastered
  if (typeof mastered !== 'boolean') return file
  return { ...file, entries: file.entries.map((e) => (e.id === id ? { ...e, mastered } : e)) }
}

// ---------------------------------------------------------------- 翻卡复习

/** 下次到期日：复习过看 review.due，没复习过 = 加入那天 */
export function vocabDueKey(e: Pick<Cet6VocabEntry, 'review' | 'addedAt'>): string {
  return e.review?.due ?? localDateKeyOf(e.addedAt) ?? '1970-01-01'
}

/** 今天该复习：没掌握且到期日 ≤ 今天 */
export function isVocabDue(e: Cet6VocabEntry, today: string): boolean {
  return !e.mastered && vocabDueKey(e) <= today
}

/**
 * 自评后的下一次：忘记 → 回到起点、明天再来；模糊 → 不升级，按当前档间隔；认识 → 升一档。
 * 间隔沿用课程复习的 1/3/7/14/30/60 天。
 */
export function nextReview(cur: Cet6VocabReview | null, grade: Cet6VocabGrade, today: string): Cet6VocabReview {
  const last = REVIEW_INTERVALS_DAYS.length - 1
  const step = cur?.step ?? -1
  const next = grade === 'again' ? -1 : grade === 'hard' ? Math.max(step, 0) : Math.min(step + 1, last)
  const days = next < 0 ? 1 : REVIEW_INTERVALS_DAYS[next]
  return { step: next, due: shiftDateKey(today, days) ?? today }
}

export function gradeEntry(file: Cet6VocabFile, id: string, grade: Cet6VocabGrade, today: string): Cet6VocabFile {
  return { ...file, entries: file.entries.map((e) => (e.id === id ? { ...e, review: nextReview(e.review, grade, today) } : e)) }
}

export function removeEntries(file: Cet6VocabFile, ids: readonly string[]): Cet6VocabFile {
  const drop = new Set(ids)
  return { ...file, entries: file.entries.filter((e) => !drop.has(e.id)) }
}

// ---------------------------------------------------------------- AI

export function buildLookupPrompt(input: Pick<Cet6VocabInput, 'text' | 'context'>): string {
  return CET6_VOCAB_PROMPT[classifyText(input.text)](input.text, input.context)
}

function extractJson(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = (fenced ? fenced[1] : text).trim()
  for (const candidate of [body, body.slice(body.indexOf('{'), body.lastIndexOf('}') + 1)]) {
    if (!candidate) continue
    try {
      const v: unknown = JSON.parse(candidate)
      if (typeof v === 'object' && v !== null && !Array.isArray(v)) return v as Record<string, unknown>
    } catch {
      /* 试下一个候选 */
    }
  }
  return null
}

/**
 * 宽容解析：剥围栏、缺字段补空；不是 JSON 时把全文当 meaning（单词）/ translation（句子）。
 * 空串、或解析出来所有有用字段都空 → null（调用方报 bad-response）。
 */
export function parseGloss(raw: string, kind: 'word' | 'sentence', now: string): Cet6Gloss | null {
  const text = (raw ?? '').trim()
  if (!text) return null
  const obj = extractJson(text)
  if (obj) {
    const g = normalizeGloss({ ...obj, at: now })!
    return g.meaning || g.translation || g.structure.length || g.collocations.length ? g : null
  }
  const prose = text.slice(0, VOCAB_LIMITS.field)
  return { phonetic: '', pos: '', meaning: kind === 'word' ? prose : '', collocations: [], translation: kind === 'sentence' ? prose : '', structure: [], at: now }
}
