import { expect, it } from 'vitest'
import { judgePrompt, scriptPrompt } from '../video/prompts'

it('includes the catalog and describes motion and frame layout', () => {
  const input = { requestId: 'a', question: 'p' }
  expect(judgePrompt(input, [{ id: 'pointer', title: 'pointer', concept: 'address' }])).toContain('pointer')
  expect(judgePrompt(input)).toContain('builtinId')
  const text = scriptPrompt(input, {})
  expect(text).toContain('follow')
  expect(text).toContain('open')
  expect(text).toContain('frame')
})
