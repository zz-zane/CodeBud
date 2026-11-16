import { expect, it } from 'vitest'
import { gradeQuestion, isAnswered } from '../../../../shared/quiz-grading'
import type { CodeFillQuestion } from '../../../../shared/types'
import { wrongAnswerOf } from './answer-fixture'

it('builds a submittable wrong answer for every codefill blank', () => {
  const question = { type: 'codefill', blanks: [{ answer: 'int' }, { answer: 'return' }] } as CodeFillQuestion
  const answer = wrongAnswerOf(question)
  expect(isAnswered(question, answer)).toBe(true)
  expect(gradeQuestion(question, answer)).toBe(false)
})
