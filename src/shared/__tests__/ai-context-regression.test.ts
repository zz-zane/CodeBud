import { describe, expect, it } from 'vitest'
import { buildStudentUserPrompt } from '../ai-assistant-prompt'

describe('student context', () => {
  it('includes bounded lesson and selection as read-only reference for a question', () => {
    const prompt = buildStudentUserPrompt('question', [
      {id:'1',type:'selection',title:'selection',content:'selected paragraph'},
      {id:'2',type:'lesson',title:'lesson',content:'lesson title'}
    ])
    expect(prompt).toContain('<student_selection>\nselected paragraph\n</student_selection>')
    expect(prompt).toContain('<lesson_context>lesson title</lesson_context>')
    expect(prompt).toContain('question')
  })
})
