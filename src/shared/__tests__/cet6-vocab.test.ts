import { describe, expect, it, vi } from 'vitest'
import {
  VOCAB_LIMITS,
  buildLookupPrompt,
  classifyText,
  extractContext,
  normalizeVocabFile,
  parseGloss,
  removeEntries,
  sanitizeVocabInput,
  updateEntry,
  upsertEntry,
  validateSelection,
  vocabKey,
  gradeEntry,
  isVocabDue,
  nextReview,
  vocabDueKey,
  type Cet6Gloss,
  type Cet6VocabEntry,
  type Cet6VocabFile,
  type Cet6VocabInput
} from '../cet6-vocab'
import { REVIEW_INTERVALS_DAYS } from '../review-schedule'

const NOW = '2026-11-10T00:00:00.000Z'
const input = (text: string, over: Partial<Cet6VocabInput> = {}): Cet6VocabInput => ({ text, context: '', source: null, ...over })
const empty = (): Cet6VocabFile => ({ version: 2, entries: [] })
const gloss = (meaning: string): Cet6Gloss => ({ phonetic: '', pos: '', meaning, collocations: [], translation: '', structure: [], at: NOW })

describe('cet6-vocab 选区与分类', () => {
  it('vocabKey：去首尾空白、压缩空白、转小写，保留原文大小写不在这里处理', () => {
    expect(vocabKey('  Make   UP\n for ')).toBe('make up for')
  })

  it('classifyText：4 个词以内是 word，5 个词起是 sentence', () => {
    expect(classifyText('ubiquitous')).toBe('word')
    expect(classifyText('a b c d')).toBe('word')
    expect(classifyText('a b c d e')).toBe('sentence')
    expect(classifyText('  in   spite of  ')).toBe('word')
  })

  it('validateSelection：1~300 字符、必须含字母、返回去空白后的文本', () => {
    expect(validateSelection('  hello ')).toBe('hello')
    expect(validateSelection('')).toBeNull()
    expect(validateSelection('   ')).toBeNull()
    expect(validateSelection('123 456')).toBeNull()
    expect(validateSelection('a')).toBe('a')
    expect(validateSelection('a'.repeat(300))).toHaveLength(300)
    expect(validateSelection('a'.repeat(301))).toBeNull()
    expect(validateSelection(' ' + 'a'.repeat(300) + ' ')).toHaveLength(300)
    expect(validateSelection(42)).toBeNull()
  })

  it('extractContext：取包含选区的那一句，跨句取到末句，压缩空白，找不到为空串，最长 600', () => {
    const text = 'First sentence here.  The   quick brown fox jumps! Is it the last one? Yes.'
    expect(extractContext(text, 'brown')).toBe('The quick brown fox jumps!')
    expect(extractContext(text, 'First')).toBe('First sentence here.')
    expect(extractContext(text, 'fox jumps! Is it')).toBe('The quick brown fox jumps! Is it the last one?')
    expect(extractContext(text, 'Yes')).toBe('Yes.')
    expect(extractContext(text, 'absent')).toBe('')
    expect(extractContext('', 'x')).toBe('')
    expect(extractContext('word ' + 'x'.repeat(900), 'word')).toHaveLength(VOCAB_LIMITS.context)
  })

  it('sanitizeVocabInput：校验文本、上下文长度、来源格式', () => {
    expect(sanitizeVocabInput({ text: ' hi ', context: ' ctx ', source: { examId: '2025-06-1', sectionType: 'reading' } })).toEqual({
      text: 'hi', context: 'ctx', source: { examId: '2025-06-1', sectionType: 'reading' }
    })
    expect(sanitizeVocabInput({ text: 'hi', context: '' })!.source).toBeNull()
    expect(sanitizeVocabInput({ text: '', context: '' })).toBeNull()
    expect(sanitizeVocabInput({ text: 'hi', context: 'x'.repeat(601) })).toBeNull()
    expect(sanitizeVocabInput({ text: 'hi', context: '', source: { examId: 'bad', sectionType: 'reading' } })).toBeNull()
    expect(sanitizeVocabInput({ text: 'hi', context: '', source: { examId: '2025-06-1', sectionType: 'x' } })).toBeNull()
    expect(sanitizeVocabInput(null)).toBeNull()
    expect(sanitizeVocabInput([])).toBeNull()
  })
})

describe('cet6-vocab 文件归一化', () => {
  it('损坏的文件：坏条目丢弃并 warn，好条目保留，重复键只留第一条', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const good: Cet6VocabEntry = { id: 'a', text: 'Alpha', kind: 'word', context: 'ctx', source: null, addedAt: NOW, mastered: true, gloss: gloss('x'), review: null }
    const file = normalizeVocabFile({
      version: 1,
      entries: [
        good,
        null,
        'oops',
        { id: '', text: 'noid' },
        { id: 'b', text: '12345' },
        { id: 'c', text: 'alpha' },
        { id: 'd', text: 'Beta gamma delta epsilon zeta', mastered: 'yes', gloss: { meaning: 7, collocations: ['ok', 3] }, source: { examId: 'nope', sectionType: 'reading' } }
      ]
    })
    expect(file.entries.map((e) => e.id)).toEqual(['a', 'd'])
    expect(file.entries[0]).toEqual(good)
    expect(file.entries[1]).toMatchObject({ kind: 'sentence', mastered: false, source: null })
    expect(file.entries[1].gloss).toMatchObject({ meaning: '', collocations: ['ok'] })
    expect(warn).toHaveBeenCalledTimes(5)
    warn.mockRestore()
  })

  it('整体不是对象 / 没有 entries：得到空文件，不抛', () => {
    expect(normalizeVocabFile(null)).toEqual(empty())
    expect(normalizeVocabFile({ version: 1 })).toEqual(empty())
    expect(normalizeVocabFile('x')).toEqual(empty())
  })
})

describe('cet6-vocab 归约', () => {
  it('新增：追加到最前，kind 由文本分类，mastered 为 false', () => {
    const a = upsertEntry(empty(), input('one'), null, 'id1', NOW)
    expect(a.ok && a.added).toBe(true)
    const b = upsertEntry((a as { file: Cet6VocabFile }).file, input('two', { context: 'c' }), null, 'id2', NOW)
    expect(b.ok && b.file.entries.map((e) => e.id)).toEqual(['id2', 'id1'])
    expect(b.ok && b.entry).toMatchObject({ kind: 'word', mastered: false, gloss: null, context: 'c' })
  })

  it('重复新增（忽略大小写与空白）：不加、不改', () => {
    const first = upsertEntry(empty(), input('Make Up'), null, 'id1', NOW)
    const file = (first as { file: Cet6VocabFile }).file
    const again = upsertEntry(file, input('  make   up '), null, 'id2', NOW)
    expect(again).toMatchObject({ ok: true, added: false })
    expect((again as { file: Cet6VocabFile }).file).toBe(file)
  })

  it('对已有条目查释义：更新 gloss，保留 addedAt / mastered / id / 原文大小写', () => {
    const first = upsertEntry(empty(), input('Make Up', { context: 'old' }), null, 'id1', '2020-01-01T00:00:00.000Z')
    const marked = updateEntry((first as { file: Cet6VocabFile }).file, 'id1', { mastered: true })
    const res = upsertEntry(marked, input('make up', { context: 'new' }), gloss('化妆'), 'id9', NOW)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.added).toBe(false)
    expect(res.file.entries).toHaveLength(1)
    expect(res.entry).toMatchObject({ id: 'id1', text: 'Make Up', addedAt: '2020-01-01T00:00:00.000Z', mastered: true, context: 'old' })
    expect(res.entry.gloss?.meaning).toBe('化妆')
  })

  it('5000 条上限：满了拒绝新增，但已有条目仍可补释义', () => {
    const entries: Cet6VocabEntry[] = Array.from({ length: VOCAB_LIMITS.entries }, (_, i) => ({
      id: `i${i}`, text: `word${i}`, kind: 'word', context: '', source: null, addedAt: NOW, mastered: false, gloss: null, review: null
    }))
    const full: Cet6VocabFile = { version: 2, entries }
    expect(upsertEntry(full, input('brand new'), null, 'x', NOW)).toEqual({ ok: false, reason: 'full' })
    expect(upsertEntry(full, input('word7'), gloss('g'), 'x', NOW)).toMatchObject({ ok: true, added: false })
  })

  it('updateEntry 只改 mastered；removeEntries 按 id 批量删', () => {
    const base: Cet6VocabFile = {
      version: 2,
      entries: ['a', 'b', 'c'].map((id) => ({ id, text: id + 'x', kind: 'word', context: '', source: null, addedAt: NOW, mastered: false, gloss: null, review: null }))
    }
    const marked = updateEntry(base, 'b', { mastered: true, text: 'hacked' } as { mastered: boolean })
    expect(marked.entries.map((e) => [e.text, e.mastered])).toEqual([['ax', false], ['bx', true], ['cx', false]])
    expect(updateEntry(base, 'b', { mastered: 'yes' })).toBe(base)
    expect(removeEntries(base, ['a', 'c', 'zzz']).entries.map((e) => e.id)).toEqual(['b'])
  })
})

describe('cet6-vocab AI 提示词与解析', () => {
  it('提示词含选中文本与所在句；句子与单词用不同模板', () => {
    const w = buildLookupPrompt({ text: 'ubiquitous', context: 'Phones are ubiquitous now.' })
    expect(w).toContain('ubiquitous')
    expect(w).toContain('Phones are ubiquitous now.')
    expect(w).toContain('meaning')
    const s = buildLookupPrompt({ text: 'Although it rained, we went out anyway.', context: 'Ctx sentence.' })
    expect(s).toContain('Although it rained, we went out anyway.')
    expect(s).toContain('Ctx sentence.')
    expect(s).toContain('structure')
    expect(buildLookupPrompt({ text: 'word', context: '' })).toContain('word')
  })

  it('干净 JSON', () => {
    const g = parseGloss('{"phonetic":"/a/","pos":"n.","meaning":"意思","collocations":["a b","c d"]}', 'word', NOW)
    expect(g).toEqual({ phonetic: '/a/', pos: 'n.', meaning: '意思', collocations: ['a b', 'c d'], translation: '', structure: [], at: NOW })
  })

  it('带 ```json 围栏与前后说明', () => {
    const g = parseGloss('好的：\n```json\n{"translation":"译文","structure":["主干：A","从句：B"]}\n```\n以上。', 'sentence', NOW)
    expect(g).toMatchObject({ translation: '译文', structure: ['主干：A', '从句：B'], meaning: '' })
    expect(parseGloss('结果 {"meaning":"x"} 完毕', 'word', NOW)?.meaning).toBe('x')
  })

  it('缺字段补空串 / 空数组，类型不对的字段当缺失', () => {
    const g = parseGloss('{"meaning":"只有这个","collocations":"not-an-array","pos":5}', 'word', NOW)!
    expect(g).toMatchObject({ phonetic: '', pos: '', meaning: '只有这个', collocations: [], structure: [] })
  })

  it('非 JSON 的文字：单词放 meaning，句子放 translation', () => {
    expect(parseGloss('就是「普遍存在」的意思', 'word', NOW)).toMatchObject({ meaning: '就是「普遍存在」的意思', translation: '' })
    expect(parseGloss('这是翻译。', 'sentence', NOW)).toMatchObject({ translation: '这是翻译。', meaning: '' })
  })

  it('空串 / 纯空白 / 有 JSON 但没有任何有用字段：null', () => {
    expect(parseGloss('', 'word', NOW)).toBeNull()
    expect(parseGloss('  \n ', 'sentence', NOW)).toBeNull()
    expect(parseGloss('{}', 'word', NOW)).toBeNull()
    expect(parseGloss('{"phonetic":"/x/"}', 'word', NOW)).toBeNull()
  })
})

describe('cet6-vocab 翻卡复习（v2）', () => {
  it('v1 文件迁移：条目补 review: null，其余字段保留，版本升到 2', () => {
    const f = normalizeVocabFile({ version: 1, entries: [{ id: 'a', text: 'Alpha', context: 'c', source: null, addedAt: NOW, mastered: false, gloss: null }] })
    expect(f.version).toBe(2)
    expect(f.entries[0]).toMatchObject({ id: 'a', text: 'Alpha', context: 'c', review: null })
  })

  it('坏的 review 当作未复习；step 越界被夹住', () => {
    const f = normalizeVocabFile({ entries: [
      { id: 'a', text: 'a1', addedAt: NOW, review: { step: 3, due: 'nope' } },
      { id: 'b', text: 'b1', addedAt: NOW, review: { step: 99, due: '2026-11-20' } }
    ] })
    expect(f.entries[0].review).toBeNull()
    expect(f.entries[1].review).toEqual({ step: REVIEW_INTERVALS_DAYS.length - 1, due: '2026-11-20' })
  })

  it('没复习过的词加入当天到期；已掌握的不算到期', () => {
    const e = { id: 'a', text: 'a', kind: 'word' as const, context: '', source: null, addedAt: '2026-11-10T02:00:00.000Z', mastered: false, gloss: null, review: null }
    expect(vocabDueKey(e)).toBe('2026-11-10')
    expect(isVocabDue(e, '2026-11-09')).toBe(false)
    expect(isVocabDue(e, '2026-11-10')).toBe(true)
    expect(isVocabDue({ ...e, mastered: true }, '2026-11-12')).toBe(false)
  })

  it('自评：认识升一档、模糊不升、忘记回起点明天再来', () => {
    const T = '2026-11-10'
    expect(nextReview(null, 'good', T)).toEqual({ step: 0, due: '2026-11-11' })
    expect(nextReview({ step: 0, due: T }, 'good', T)).toEqual({ step: 1, due: '2026-11-13' })
    expect(nextReview({ step: 2, due: T }, 'hard', T)).toEqual({ step: 2, due: '2026-11-17' })
    expect(nextReview(null, 'hard', T)).toEqual({ step: 0, due: '2026-11-11' })
    expect(nextReview({ step: 4, due: T }, 'again', T)).toEqual({ step: -1, due: '2026-11-11' })
    const top = REVIEW_INTERVALS_DAYS.length - 1
    expect(nextReview({ step: top, due: T }, 'good', T).step).toBe(top)
  })

  it('gradeEntry 只改目标条目的 review', () => {
    const base = normalizeVocabFile({ entries: [{ id: 'a', text: 'a1', addedAt: NOW }, { id: 'b', text: 'b1', addedAt: NOW }] })
    const next = gradeEntry(base, 'b', 'good', '2026-11-10')
    expect(next.entries[0].review).toBeNull()
    expect(next.entries[1].review).toEqual({ step: 0, due: '2026-11-11' })
  })
})
