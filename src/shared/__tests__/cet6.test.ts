import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import {
  answerKeys,
  blockHeading,
  countWords,
  EXAM_SECONDS,
  examRemaining,
  isScored,
  listeningTranscript,
  mediaUrl,
  nextOpen,
  normalizedAnswer,
  paragraphs,
  partTally,
  parseMatchingPassage,
  sanitizeRecord,
  score,
  stemOf,
  usableExplanation,
  withoutEmbeddedQuestions,
  wrongQuestions,
  type Cet6Exam,
  type Cet6Meta,
  type Cet6Question,
  type Cet6Section
} from '../cet6'

const ROOT = join(__dirname, '..', '..', '..', 'content', 'cet6')
const metas = JSON.parse(readFileSync(join(ROOT, 'index.json'), 'utf8')) as Cet6Meta[]
const exams = metas.map((m) => JSON.parse(readFileSync(join(ROOT, m.file), 'utf8')) as Cet6Exam)

const q = (over: Partial<Cet6Question>): Cet6Question => ({ id: 'x', number: 1, kind: 'single-choice', stem: '', blockId: 'b', ...over })
const sec = (over: Partial<Cet6Section>): Cet6Section => ({ id: 's', type: 'reading', title: 't', ...over })

describe('cet6 纯函数', () => {
  it.each([
    ['cet4', 125 * 60],
    ['cet6', 130 * 60]
  ] as const)('%s uses the configured exam duration', (level, seconds) => {
    expect(examRemaining(0, level)).toBe(seconds)
    expect(examRemaining(seconds - 1, level)).toBe(1)
    expect(examRemaining(seconds + 1, level)).toBe(0)
  })

  it.each([
    ['News Report Three', 'A'],
    ['Conversation Two', 'B'],
    ['Passage One', 'C']
  ])('CET-4 listening maps %s to Section %s', (title, letter) => {
    expect(blockHeading(sec({ type: 'listening' }), { id: 'b', title }, 'cet4'))
      .toEqual({ section: `Section ${letter}`, unit: title })
  })

  it('blockHeading：阅读取 Section / Passage；听力按单元推出 Section 字母；其它部分为空', () => {
    expect(blockHeading(sec({ type: 'reading' }), { id: 'b', title: 'Section B Passage One 说明' })).toEqual({ section: 'Section B', unit: 'Passage One' })
    expect(blockHeading(sec({ type: 'listening' }), { id: 'b', title: 'Conversation Two' })).toEqual({ section: 'Section A', unit: 'Conversation Two' })
    expect(blockHeading(sec({ type: 'listening' }), { id: 'b', title: 'Recording One' }).section).toBe('Section C')
    expect(blockHeading(sec({ type: 'writing' }), { id: 'b', title: 'Section A' })).toEqual({ section: '', unit: '' })
  })

  it('stemOf：听力交卷前为空；交卷后取题目译文或原题干；阅读原样', () => {
    const listening = sec({ type: 'listening' })
    const stem = 'Question 1 (请根据录音音频选择最佳答案；题目译文：他们在谈什么？）'
    expect(stemOf(listening, q({ stem }), false)).toBe('')
    expect(stemOf(listening, q({ stem }), true)).toBe('他们在谈什么？')
    expect(stemOf(listening, q({ stem: 'Question 3' }), true)).toBe('')
    expect(stemOf(listening, q({ stem: 'What is true?' }), true)).toBe('What is true?')
    expect(stemOf(sec({}), q({ stem: 'Why?' }), false)).toBe('Why?')
  })

  it('paragraphs：还原硬换行，句末遇大写开头另起一段，中文相接不加空格', () => {
    expect(paragraphs('The cat sat\non the mat.\nThen it left.\n\nNew one')).toEqual(['The cat sat on the mat.', 'Then it left.', 'New one'])
    expect(paragraphs('这是第一\n行文字')).toEqual(['这是第一行文字'])
  })

  it('parseMatchingPassage：按字母顺序切段，标签前只留标题', () => {
    const text = 'Title Here\n[A] First para.\n[B] Second para goes on.\nC) Third one.\n[D] Fourth.\n[E] Fifth.'
    const parsed = parseMatchingPassage({ text })
    expect(parsed.title).toBe('Title Here')
    expect(parsed.items.map((i) => i.letter)).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(parsed.items[0].text).toBe('First para.')
    expect(parsed.items[2].mark).toBe('C)')
  })

  it('withoutEmbeddedQuestions：只在 36/46/51 起头的块里，砍掉行首题号之后的内容', () => {
    const section = sec({ questions: [q({ id: 'q46', number: 46, blockId: 'p' })] })
    const text = 'Passage body.\n46. What is it?\nA) x'
    expect(withoutEmbeddedQuestions(text, section, { id: 'p' })).toBe('Passage body.')
    const other = sec({ questions: [q({ id: 'q40', number: 40, blockId: 'p' })] })
    expect(withoutEmbeddedQuestions(text, other, { id: 'p' })).toBe(text)
  })

  it('answerKeys：匹配题只留到文章实际最后一段（或答案字母）', () => {
    const text = ['T', '[A] A1.', '[B] B1.', '[C] C1.', '[D] D1.', '[E] E1.'].join('\n')
    const options = 'ABCDEFGHIJKLMNOPQRST'.split('').map((key) => ({ key, text: key }))
    const m = q({ id: 'm', kind: 'matching', blockId: 'p', options, answer: 'C' })
    const section = sec({ blocks: [{ id: 'p', text }], questions: [m] })
    expect(answerKeys(section, m)).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(answerKeys(section, q({ options: [{ key: 'A', text: '' }, { key: 'B', text: '' }] }))).toEqual(['A', 'B'])
  })

  it('isScored / normalizedAnswer：需有答案、verified、未标缺页', () => {
    expect(isScored(q({ answer: 'b', verified: true }))).toBe(true)
    expect(isScored(q({ answer: 'B' }))).toBe(false)
    expect(isScored(q({ answer: 'B', verified: true, unanswerable: true }))).toBe(false)
    expect(isScored(q({ kind: 'essay', answer: 'x', verified: true }))).toBe(false)
    expect(normalizedAnswer({ answer: ' b ' })).toBe('B')
  })

  it('usableExplanation：过滤只复述答案、待核对、乱码', () => {
    expect(usableExplanation(q({ explanation: '标准答案为 B' }))).toBe('')
    expect(usableExplanation(q({ explanation: '答案待核对' }))).toBe('')
    expect(usableExplanation(q({ explanation: 'BCDFG 乱' }))).toBe('')
    expect(usableExplanation(q({ explanation: '第二段说明了原因，所以选 B。' }))).toBe('第二段说明了原因，所以选 B。')
    expect(usableExplanation(q({ kind: 'essay', explanation: '好文章' }))).toBe('')
  })

  it('listeningTranscript：正式原文 > 机器转写 > 够长的 text', () => {
    expect(listeningTranscript({ id: 'b', transcript: 'Real', transcriptDraft: 'Draft' })).toBe('Real')
    expect(listeningTranscript({ id: 'b', transcript: '听力录音音频已在上方', transcriptDraft: 'Draft' })).toBe('Draft')
    expect(listeningTranscript({ id: 'b', text: 'short' })).toBe('')
    expect(listeningTranscript({ id: 'b', text: 'x'.repeat(81) })).toHaveLength(81)
  })

  it('countWords', () => {
    expect(countWords('')).toBe(0)
    expect(countWords("Hello, brave new world's")).toBe(5)
  })

  it('score：只统计 isScored，正确率保留一位', () => {
    const exam = {
      id: 'e', title: 'e', year: 2020, month: 1, set: 1,
      sections: [sec({ questions: [
        q({ id: 'a', answer: 'A', verified: true }),
        q({ id: 'b', answer: 'B', verified: true }),
        q({ id: 'c', answer: 'C', verified: true }),
        q({ id: 'd', answer: 'D' })
      ] })]
    } as Cet6Exam
    expect(score(exam, { a: 'A', b: 'a', c: 'C', d: 'D' })).toEqual({ correct: 2, total: 3, accuracy: '66.7' })
    expect(score({ ...exam, sections: [] }, {})).toEqual({ correct: 0, total: 0, accuracy: '0.0' })
  })

  it('nextOpen：afterId 之后第一个未答且可答的题', () => {
    const list = [q({ id: 'a' }), q({ id: 'b' }), q({ id: 'c', unanswerable: true }), q({ id: 'd' })]
    expect(nextOpen(list, { b: 'A' }, 'a')?.id).toBe('d')
    expect(nextOpen(list, {}, null)?.id).toBe('a')
    expect(nextOpen(list, { a: 'A', b: 'A', d: 'A' }, 'a')).toBeNull()
  })

  it('sanitizeRecord：非对象 → null；裁剪键数、长度；seconds 取非负整数', () => {
    expect(sanitizeRecord(null)).toBeNull()
    expect(sanitizeRecord([])).toBeNull()
    expect(sanitizeRecord({ answers: { a: 'B', b: 5, '': 'x' }, marks: ['a', 3], submitted: 1, seconds: -4 })).toEqual({
      answers: { a: 'B' }, marks: ['a'], submitted: false, seconds: 0, mode: 'practice'
    })
    const big = sanitizeRecord({ answers: { essay: 'x'.repeat(30000) }, seconds: 12.9, submitted: true })!
    expect(big.answers.essay).toHaveLength(20000)
    expect(big.seconds).toBe(12)
    expect(big.submitted).toBe(true)
    const many: Record<string, string> = {}
    for (let i = 0; i < 1000; i++) many['q' + i] = 'A'
    expect(Object.keys(sanitizeRecord({ answers: many })!.answers)).toHaveLength(400)
  })

  it('sanitizeRecord：mode 缺省（旧记录）补 practice，exam 原样保留，其余值回落', () => {
    expect(sanitizeRecord({ answers: {} })!.mode).toBe('practice')
    expect(sanitizeRecord({ mode: 'exam' })!.mode).toBe('exam')
    expect(sanitizeRecord({ mode: 'practice' })!.mode).toBe('practice')
    expect(sanitizeRecord({ mode: 'nonsense' })!.mode).toBe('practice')
  })

  it('examRemaining：边界与封底', () => {
    expect(EXAM_SECONDS).toBe(7800)
    expect(examRemaining(0)).toBe(7800)
    expect(examRemaining(7799)).toBe(1)
    expect(examRemaining(7800)).toBe(0)
    expect(examRemaining(9999)).toBe(0)
    expect(examRemaining(-5)).toBe(7800)
    expect(examRemaining(Number.NaN)).toBe(7800)
  })

  const mini: Cet6Exam = {
    id: '2025-06-1', title: 't', year: 2025, month: 6, set: 1,
    sections: [
      sec({ type: 'listening', questions: [q({ id: 'l1', answer: 'A', verified: true }), q({ id: 'l2', answer: 'B', verified: true })] }),
      sec({
        type: 'reading',
        questions: [
          q({ id: 'r1', answer: 'C', verified: true }),
          q({ id: 'r2', answer: 'D' }),
          q({ id: 'r3', answer: 'A', verified: true, unanswerable: true }),
          q({ id: 'r4', kind: 'essay', answer: 'x', verified: true })
        ]
      }),
      sec({ type: 'writing', questions: [] })
    ]
  }

  it('partTally：只含有计分题的部分，分听力与阅读', () => {
    expect(partTally(mini, { l1: 'A', l2: 'C', r1: 'C' })).toEqual([
      { type: 'listening', correct: 1, total: 2 },
      { type: 'reading', correct: 1, total: 1 }
    ])
  })

  it('wrongQuestions：与 isScored 同口径，未答算错，待核实 / 不可答 / 主观题不算', () => {
    expect(wrongQuestions(mini, { l1: 'A', l2: 'C', r2: 'A', r3: 'B' }).map((x) => x.id)).toEqual(['l2', 'r1'])
    expect(wrongQuestions(mini, { l1: 'a', l2: ' b ', r1: 'c' })).toEqual([])
  })

  it('mediaUrl：音频与附图换协议，按段 encode', () => {
    expect(mediaUrl('source-media/2026年06月第1套/a b.mp3')).toBe(
      `miai-cet6://media/${encodeURIComponent('2026年06月第1套')}/a%20b.mp3`
    )
    expect(mediaUrl('assets/figures/2021-06-1.png')).toBe('miai-cet6://data/assets/figures/2021-06-1.png')
  })
})

describe('content/cet6 完整性（移植自 cet6_a test_frontend.py test_10）', () => {
  it('52 套，id 唯一，清单字段与文件一致，按年月降序、套升序', () => {
    expect(metas).toHaveLength(52)
    expect(new Set(metas.map((m) => m.id)).size).toBe(52)
    readdirSync(join(ROOT, 'exams')).forEach((f) => expect(metas.some((m) => m.file === `exams/${f}`)).toBe(true))
    metas.forEach((m, i) => {
      expect(m.id).toMatch(/^\d{4}-\d{2}-\d$/)
      expect(exams[i].id).toBe(m.id)
      if (i > 0) {
        const p = metas[i - 1]
        expect(p.year * 100 + p.month > m.year * 100 + m.month || (p.year === m.year && p.month === m.month && p.set < m.set)).toBe(true)
      }
    })
  })

  it('每题答案在选项键内；词库 15 项、答案不重复、空格齐全；选项无泄漏；匹配题干干净', () => {
    const problems: unknown[] = []
    const leak = /four choices marked|四、翻译|\u{1F4D6}|淘宝/u
    for (const exam of exams) {
      for (const section of exam.sections) {
        if (/_{4,}|F o ?r ?t h/.test(section.directions || '')) problems.push([exam.id, section.type, 'directions'])
        const bankAnswers = (section.questions || []).filter((x) => x.kind === 'word-bank' && x.answer).map((x) => x.answer)
        if (new Set(bankAnswers).size !== bankAnswers.length) problems.push([exam.id, section.type, 'duplicate word-bank answers'])
        for (const x of section.questions || []) {
          const keys = (x.options || []).map((o) => o.key)
          if ((x.options || []).some((o) => !o.text.trim() || leak.test(o.text))) problems.push([exam.id, x.number, 'option'])
          if (x.kind !== 'essay' && x.kind !== 'translation' && x.answer && !keys.includes(x.answer)) problems.push([exam.id, x.number, 'answer'])
          if (x.kind === 'word-bank') {
            if (keys.length !== 15) problems.push([exam.id, x.number, 'bank size', keys.length])
            const block = (section.blocks || []).find((b) => b.id === x.blockId)
            if (!block || !(block.text || '').includes(`__(${x.number})__`)) problems.push([exam.id, x.number, 'blank'])
          }
          if (x.kind === 'matching' && (leak.test(x.stem) || x.stem.length > 300)) problems.push([exam.id, x.number, 'stem'])
        }
      }
    }
    expect(problems).toEqual([])
  })

  it('阅读文章：Section C 文章 ≥1200 字符，且没有 OCR 残留', () => {
    const problems: unknown[] = []
    const ocr = /_{3,}\(|[，．：；]|\([^()]*[£¥½¾{}~^*#][^()]*\)/
    for (const exam of exams) {
      for (const section of exam.sections.filter((s) => s.type === 'reading')) {
        for (const block of section.blocks || []) {
          const text = block.text || ''
          const linked = (section.questions || []).filter((x) => x.blockId === block.id).map((x) => x.number)
          if (linked.length && [46, 51].includes(Math.min(...linked)) && text.length < 1200) problems.push([exam.id, block.title, 'passage too short'])
          if (ocr.test(text)) problems.push([exam.id, block.title, 'passage'])
        }
      }
    }
    expect(problems).toEqual([])
  })

  it('翻译参考译文 ≥400 字符且无中文', () => {
    for (const exam of exams) {
      for (const section of exam.sections.filter((s) => s.type === 'translation')) {
        const ref = section.questions?.[0]?.answer || ''
        expect([exam.id, ref.length >= 400, /[一-鿿]/.test(ref)]).toEqual([exam.id, true, false])
      }
    }
  })

  it('写作附图文件都在 assets/figures 下；共用听力的目标卷存在', () => {
    const files = new Set(readdirSync(join(ROOT, 'assets', 'figures')))
    const ids = new Set(metas.map((m) => m.id))
    for (const exam of exams) {
      for (const s of exam.sections) {
        if (s.figure?.src) expect(files.has(s.figure.src.replace('assets/figures/', ''))).toBe(true)
        if (s.sharedWithExamId) expect(ids.has(s.sharedWithExamId)).toBe(true)
      }
    }
  })

  it('v1 → v2 迁移：老 cet6.json 读出来字段齐全、作答不丢，且合法 aiGrades 可保留与清洗', async () => {
    const { CURRENT_CET6_VERSION, migrateCet6File, sanitizeRecord } = await import('../cet6')
    const v1 = {
      version: 1,
      mediaRoot: 'D:/Audio/cet6',
      lastMode: 'exam',
      records: {
        '2025-06-1': {
          answers: { '1': 'A', W1: 'My essay.' },
          marks: ['1'],
          submitted: true,
          seconds: 3200,
          mode: 'exam'
        }
      }
    }
    const migrated = migrateCet6File(v1)
    expect(migrated.version).toBe(CURRENT_CET6_VERSION)
    expect(CURRENT_CET6_VERSION).toBe(2)
    expect(migrated.mediaRoot).toBe('D:/Audio/cet6')
    expect(migrated.lastMode).toBe('exam')
    expect(migrated.records['2025-06-1']).toEqual(v1.records['2025-06-1'])

    const withGrades = sanitizeRecord({
      ...v1.records['2025-06-1'],
      aiGrades: {
        W1: { score: 11.7, comment: '  论证清晰  ', at: 1700000000 },
        bad: { score: Number.NaN, comment: 'invalid', at: 1 },
        empty: { score: 8, comment: '   ', at: 1 }
      }
    })
    expect(withGrades?.aiGrades).toEqual({
      W1: { score: 12, comment: '论证清晰', at: 1700000000 }
    })
  })
})
