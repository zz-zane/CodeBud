import { describe, expect, it, vi } from 'vitest'
import { runStudyAsyncActions } from '../async-actions'

describe('asynchronous learning tools', () => {
  it('places real tool output into the reply and leaves safe data actions for validation', async () => {
    const calculate = vi.fn(async () => ({ output: '-2\n', plots: [] }))
    const createPlan = vi.fn(async () => { throw new Error('not expected') })
    const text = '```study-actions\n' + JSON.stringify([{ type: 'calculate', script: 'disp(1)' }, { type: 'remember', text: 'preference' }]) + '\n```'
    const response = await runStudyAsyncActions({ text, sessionId: 'study-main', calculate, createPlan })
    expect(calculate).toHaveBeenCalledTimes(1)
    expect(response).toContain('Octave 实际计算结果')
    expect(response).toContain('-2')
    expect(response).toContain('"type":"remember"')
    expect(response).not.toContain('"type":"calculate"')
  })
  it('does not pretend runtime errors are successful calculations', async () => {
    const response = await runStudyAsyncActions({ text: '```study-actions\n[{"type":"calculate","script":"1+1"}]\n```', sessionId: 'study-main', calculate: async () => { throw new Error('Octave unavailable') }, createPlan: async () => { throw new Error('unused') } })
    expect(response).toContain('未执行：Octave unavailable')
    expect(response).not.toContain('实际计算结果')
  })
})
