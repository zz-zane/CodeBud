import { CET6_LIMITS, type Cet6AiGrade, type CetLevel } from './cet6'
import { CET6_GRADE_PROMPT } from './copy'

export type Cet6SubjectiveKind = 'writing' | 'translation'

export const CET6_GRADE_MAX_SCORE = 15
export const CET6_GRADE_COMMENT_MAX = 200

export interface Cet6GradeResult {
  score: number
  comment: string
}

export interface Cet6GradeRequest {
  examId: string
  questionId: string
  kind: Cet6SubjectiveKind
  prompt: string
  answer: string
}

export type Cet6GradeResponse =
  | { ok: true; grade: Cet6AiGrade }
  | { ok: false; reason: 'no-key' | 'network' | 'bad-response' | 'stale' }

/** 构造六级写作 / 翻译 AI 估分提示词（复用 CET6_LIMITS 长度上限） */
export function buildGradePrompt(kind: Cet6SubjectiveKind, prompt: string, answer: string, level: CetLevel = 'cet6'): string {
  const safePrompt = prompt.slice(0, CET6_LIMITS.valueLength)
  const safeAnswer = answer.slice(0, CET6_LIMITS.valueLength)
  return CET6_GRADE_PROMPT(kind, safePrompt, safeAnswer, level)
}

/**
 * 解析模型返回的 JSON 估分结果：
 * - `score` 取整并钳在 0–15
 * - `comment` 裁剪至 ≤ 200 字且非空
 * - 解析失败 / 缺字段时返回 `null`（绝不给保底分）
 */
export function parseGrade(raw: string): Cet6GradeResult | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  if (!trimmed) return null

  const candidate = extractJsonObject(trimmed)
  if (!candidate) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(candidate)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null

  const obj = parsed as Record<string, unknown>
  if (typeof obj.score !== 'number' || !Number.isFinite(obj.score)) return null
  if (typeof obj.comment !== 'string') return null

  const comment = truncateGradeComment(obj.comment.trim())
  if (!comment) return null

  const score = Math.min(CET6_GRADE_MAX_SCORE, Math.max(0, Math.round(obj.score)))
  return { score, comment }
}

const SENTENCE_END_RE = /[。！？.!?]/

function truncateGradeComment(text: string): string {
  if (text.length <= CET6_GRADE_COMMENT_MAX) return text
  const window = text.slice(0, CET6_GRADE_COMMENT_MAX)
  for (let i = window.length - 1; i >= 0; i--) {
    if (SENTENCE_END_RE.test(window[i])) return window.slice(0, i + 1)
  }
  return window
}

function extractJsonObject(text: string): string | null {
  if (text.startsWith('{') && text.endsWith('}')) return text
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  return text.slice(start, end + 1)
}
