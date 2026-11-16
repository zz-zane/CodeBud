import { describe, expect, it } from 'vitest'
import { buildGradePrompt, parseGrade } from '../cet6-grade'

describe('cet6-grade', () => {
  it('buildGradePrompt includes 15-point scale, official 5 tiers, and kind label', () => {
    const writing = buildGradePrompt('writing', 'Write about teamwork.', 'Teamwork matters.')
    expect(writing).toContain('写作')
    expect(writing).toContain('15 分')
    expect(writing).toContain('2 / 5 / 8 / 11 / 14')
    expect(writing).toContain('<exam_prompt>Write about teamwork.</exam_prompt>')
    expect(writing).toContain('<student_answer>Teamwork matters.</student_answer>')

    const trans = buildGradePrompt('translation', '大运河是中国古代工程奇迹。', 'The Grand Canal is a wonder.')
    expect(trans).toContain('翻译')
    expect(trans).toContain('不超过150字')
  })

  it('parseGrade rounds & clamps score to 0..15, prefers sentence boundary within 200 chars, and hard-caps fallback', () => {
    expect(parseGrade('{"score": 11.6, "comment": "句式多变，逻辑清晰。"}')).toEqual({
      score: 12,
      comment: '句式多变，逻辑清晰。'
    })
    expect(parseGrade('```json\n{"score": 19, "comment": "优秀"}\n```')).toEqual({
      score: 15,
      comment: '优秀'
    })
    expect(parseGrade('评分如下：{"score": -3, "comment": "需补充内容"}')).toEqual({
      score: 0,
      comment: '需补充内容'
    })
    const sentenceComment = '第一句指出核心偏题问题。第二句说明基本语法错误，例如主谓一致与词性误用。' + '补充分析内容细节'.repeat(25)
    const sentenceCapped = parseGrade(JSON.stringify({ score: 4, comment: sentenceComment }))
    expect(sentenceCapped?.comment).toBe('第一句指出核心偏题问题。第二句说明基本语法错误，例如主谓一致与词性误用。')
    const longComment = '评'.repeat(250)
    const capped = parseGrade(JSON.stringify({ score: 8, comment: longComment }))
    expect(capped?.score).toBe(8)
    expect(capped?.comment).toHaveLength(200)
  })

  it('parseGrade returns null on invalid JSON, missing fields, or empty comment (never awards half score)', () => {
    expect(parseGrade('')).toBeNull()
    expect(parseGrade('not json')).toBeNull()
    expect(parseGrade('{"score": "10", "comment": "good"}')).toBeNull()
    expect(parseGrade('{"score": null, "comment": "good"}')).toBeNull()
    expect(parseGrade('{"comment": "missing score"}')).toBeNull()
    expect(parseGrade('{"score": 10, "comment": "   "}')).toBeNull()
    expect(parseGrade('[]')).toBeNull()
  })
})
