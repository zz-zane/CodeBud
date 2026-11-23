import { describe, expect, it } from 'vitest'
import { checkExam, matchQuote, reviewRows } from './cet6-evidence.mjs'
import { validatePick } from './cet6-evidence-ai.mjs'

describe('CET-6 evidence', () => {
  const source = '🎧 She said, “It’s not the quantity but the\n  quality of work that counts.”'

  it.each([
    ['IT’S not the quantity ... the quality of work', 'It’s not the quantity but the\n  quality of work'],
    ["it's not the quantity… that counts", 'It’s not the quantity but the\n  quality of work that counts'],
    ['“THE QUALITY of work”', 'the\n  quality of work'],
  ])('locates %s with original UTF-16 offsets', (quote, exact) => {
    const start = source.indexOf(exact)
    expect(matchQuote(source, quote)).toEqual([{ start, end: start + exact.length }])
  })

  it('returns no result if an ellipsis anchor or the entire quote is missing', () => {
    expect(matchQuote(source, "it's not the quantity … when the work ends")).toEqual([])
    expect(matchQuote(source, 'an unrelated sentence')).toEqual([])
    expect(matchQuote(source, '…')).toEqual([])
  })

  it('uses the answer paragraph for matching questions', () => {
    const exact = 'Underground trains can transport thousands of passengers every hour.'
    const text = 'A) Underground trains need regular maintenance.\n[B] ' + exact
    const exam = { sections: [{
      type: 'reading',
      blocks: [{ id: 'passage', text }],
      questions: [{
        id: 'q36', number: 36, blockId: 'passage', kind: 'matching', answer: 'B',
        stem: 'Underground trains carry thousands of passengers each hour.',
        explanation: 'B 段提到 “transport thousands of passengers every hour”。',
      }],
    }] }
    expect([...reviewRows(exam)][0].evidence).toEqual([{
      blockId: 'passage', field: 'text', quote: exact, start: text.indexOf(exact), end: text.length,
    }])
  })

  it('checks the source block, field, bounds and exact quote while allowing missing evidence', () => {
    const valid = { blockId: 'b1', field: 'transcript', start: 0, end: 2, quote: '🎧' }
    const evidence = [
      valid,
      { ...valid, blockId: 'unknown' },
      { ...valid, field: 'text' },
      { ...valid, start: -1 },
      { ...valid, end: 1.5 },
      { ...valid, end: source.length + 1 },
      { ...valid, end: 0 },
      { ...valid, quote: 'changed' },
    ]
    const exam = { sections: [{
      blocks: [{ id: 'b1', transcript: source }],
      questions: [{ id: 'q1', evidence }, { id: 'q2' }],
    }] }
    expect(checkExam(exam)).toHaveLength(evidence.length - 1)
  })
})

describe('CET-6 AI picks', () => {
  const source = '🎧 A complete sentence. A different complete sentence.'
  const first = { blockId: 'b1', field: 'text', start: 3, end: 23, quote: 'A complete sentence.', score: 0.9 }
  const second = { blockId: 'b1', field: 'text', start: 24, end: source.length, quote: 'A different complete sentence.', score: 0.4 }
  const select = (pick, confidence = 'high') => JSON.stringify({ pick, confidence })

  it('derives the quote from the source and validates the UTF-16 range', () => {
    const { score, ...evidence } = first
    expect(validatePick(select([1]), [first, second], source)).toEqual({ evidence: [evidence] })
    expect(() => validatePick(select([1]), [{ ...first, quote: 'Changed' }], source)).toThrow('matches source')
  })

  it.each([
    select([]),
    select([1], 'uncertain'),
    select([0]),
    select([1, 1]),
    select([3]),
    select([1.5]),
    select([2]),
    '{"pick":[1],"confidence":"high","quote":"injected"}',
    'not JSON',
  ])('keeps %s pending', (response) => {
    expect(validatePick(response, [first, second], source)).toEqual({ reason: expect.any(String) })
  })
})
