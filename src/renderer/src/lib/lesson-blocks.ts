/**
 * 课时正文交互积木块解析器（flash-cards 与 pretest）
 *
 * 核心原则：
 * 1. 纯函数，零副作用，支持 JSON 与纯文本 Key-Value 双格式
 * 2. 严格校形与清洗，字段缺失或格式损坏时安全降级返回 null（由上层 fallback 为普通代码块）
 * 3. 绝不抛错，绝不让课文渲染中断或空白
 */
import { FLASH_CARDS, PRETEST } from './copy'

export interface FlashCardItem {
  front: string
  back: string
  hint?: string
}

export interface FlashCardsBlock {
  title: string
  cards: FlashCardItem[]
}

export interface PretestBlock {
  title: string
  question: string
  options: string[]
  answer: number // 0-indexed
  explanation: string
}

/**
 * 解析 flash-cards 闪卡围栏
 */
export function parseFlashCards(content: string): FlashCardsBlock | null {
  const raw = (content || '').trim()
  if (!raw) return null

  // 1. 优先尝试 JSON 格式
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        const rawCards = Array.isArray(parsed.cards) ? parsed.cards : []
        const cards: FlashCardItem[] = rawCards
          .filter((c: unknown) => c && typeof c === 'object')
          .map((c: any) => {
            const front = String(c.front || c.q || c.question || '').trim()
            const back = String(c.back || c.a || c.answer || '').trim()
            const hint = typeof c.hint === 'string' && c.hint.trim() ? c.hint.trim() : undefined
            return { front, back, hint }
          })
          .filter((c: FlashCardItem) => Boolean(c.front && c.back))

        if (cards.length > 0) {
          return {
            title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : FLASH_CARDS.DEFAULT_TITLE,
            cards
          }
        }
      }
    } catch {
      // JSON 解析失败则降级走行扫描
    }
  }

  // 2. 行扫描格式解析
  const lines = raw.split('\n')
  let title: string = FLASH_CARDS.DEFAULT_TITLE
  const cards: FlashCardItem[] = []
  let cur: { front?: string; back?: string; hint?: string } = {}

  const flushCard = (): void => {
    if (cur.front && cur.back) {
      cards.push({
        front: cur.front.trim(),
        back: cur.back.trim(),
        ...(cur.hint ? { hint: cur.hint.trim() } : {})
      })
    }
    cur = {}
  }

  for (const line of lines) {
    const t = line.trim()
    if (!t) continue

    if (t.startsWith('title:')) {
      title = t.slice(6).trim() || FLASH_CARDS.DEFAULT_TITLE
      continue
    }

    if (t === 'card' || t === 'card:' || t === '---') {
      flushCard()
      continue
    }

    const m = t.match(/^([a-zA-Z_]+)\s*:\s*(.*)$/)
    if (m) {
      const key = m[1].toLowerCase()
      const val = m[2].trim()
      if (key === 'front' || key === 'q' || key === 'question') {
        cur.front = val
      } else if (key === 'back' || key === 'a' || key === 'answer') {
        cur.back = val
      } else if (key === 'hint') {
        cur.hint = val
      }
    }
  }
  flushCard()

  return cards.length > 0 ? { title, cards } : null
}

/**
 * 解析 pretest 课前小测围栏
 */
export function parsePretest(content: string): PretestBlock | null {
  const raw = (content || '').trim()
  if (!raw) return null

  // 1. 优先尝试 JSON 格式
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        const question = String(parsed.question || parsed.q || '').trim()
        const rawOpts = Array.isArray(parsed.options) ? parsed.options : []
        const options = rawOpts.map((o: unknown) => String(o || '').trim()).filter(Boolean)
        const explanation = String(parsed.explanation || parsed.analysis || '').trim()
        let answer = typeof parsed.answer === 'number' ? parsed.answer : -1
        if (typeof parsed.answer === 'string') {
          const letter = parsed.answer.trim().toUpperCase()
          if (/^[A-D]$/.test(letter)) {
            answer = letter.charCodeAt(0) - 65
          } else {
            const num = Number(parsed.answer)
            if (Number.isInteger(num)) answer = num
          }
        }

        if (question && options.length >= 2 && answer >= 0 && answer < options.length) {
          return {
            title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : PRETEST.DEFAULT_TITLE,
            question,
            options,
            answer,
            explanation
          }
        }
      }
    } catch {
      // JSON 解析失败则降级走行扫描
    }
  }

  // 2. 行扫描格式解析
  const lines = raw.split('\n')
  let title: string = PRETEST.DEFAULT_TITLE
  let question = ''
  const options: string[] = []
  let answer = -1
  let explanation = ''

  for (const line of lines) {
    const t = line.trim()
    if (!t) continue

    if (t.startsWith('title:')) {
      title = t.slice(6).trim() || PRETEST.DEFAULT_TITLE
      continue
    }
    if (t.startsWith('question:') || t.startsWith('q:')) {
      question = t.slice(t.indexOf(':') + 1).trim()
      continue
    }
    if (t.startsWith('option:') || t.startsWith('opt:')) {
      const opt = t.slice(t.indexOf(':') + 1).trim()
      if (opt) options.push(opt)
      continue
    }
    if (t.startsWith('answer:') || t.startsWith('ans:')) {
      const ansStr = t.slice(t.indexOf(':') + 1).trim().toUpperCase()
      if (/^[A-D]$/.test(ansStr)) {
        answer = ansStr.charCodeAt(0) - 65
      } else {
        const num = Number(ansStr)
        if (Number.isInteger(num)) answer = num
      }
      continue
    }
    if (t.startsWith('explanation:') || t.startsWith('exp:')) {
      explanation = t.slice(t.indexOf(':') + 1).trim()
      continue
    }
  }

  if (question && options.length >= 2 && answer >= 0 && answer < options.length) {
    return {
      title,
      question,
      options,
      answer,
      explanation
    }
  }

  return null
}
