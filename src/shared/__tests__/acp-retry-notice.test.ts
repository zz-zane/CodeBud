import { describe, expect, it } from 'vitest'
import { RetryNoticeFilter } from '../acp-retry-notice'

const NOTICE = ' ⚠ API error (attempt 1): request failed: Post "https://daily-cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse": EOF'
const run = (chunks: string[]) => {
  const f = new RetryNoticeFilter()
  const out = chunks.map(c => f.push(c)).join('') + f.flush()
  return { out, dropped: f.dropped }
}

describe('RetryNoticeFilter', () => {
  it('drops a notice that arrives as its own chunk', () => {
    const r = run([NOTICE + '\n', '答案'])
    expect(r.out).toBe('答案')
    expect(r.dropped).toContain('attempt 1')
  })
  it('drops a notice at the start of a chunk and keeps the answer behind it', () => {
    expect(run([NOTICE + '\n真正的回答'])).toMatchObject({ out: '真正的回答' })
  })
  it('handles a notice split across chunk boundaries', () => {
    const r = run([' ⚠ API error (att', 'empt 2): request failed: Post "https://x/y": EOF', '\n回答', '继续'])
    expect(r.out).toBe('回答继续')
    expect(r.out).not.toContain('https')
  })
  it('drops several notices in a row', () => {
    expect(run([NOTICE + '\n⚠ API error (attempt 2): request failed: EOF\n', 'ok']).out).toBe('ok')
  })
  it('drops a trailing notice with no newline at the end of the turn', () => {
    const r = run(['hello', '\n⚠ API error (attempt 3): EOF'])
    expect(r.out).toBe('hello')
    expect(r.dropped).toContain('attempt 3')
  })
  it('keeps normal text, including text that only mentions errors or starts with another warning', () => {
    expect(run(['The API error (attempt) message means retry.']).out).toBe('The API error (attempt) message means retry.')
    expect(run(['⚠ 注意：变量要先声明\n然后使用']).out).toBe('⚠ 注意：变量要先声明\n然后使用')
    expect(run(['⚠ API error handling is covered next.\nok']).out).toBe('⚠ API error handling is covered next.\nok')
    expect(run(['a ⚠ API error (attempt 1): x']).out).toBe('a ⚠ API error (attempt 1): x')
  })
  it('keeps a paragraph break when a notice interrupts the answer', () => {
    expect(run(['第一段', '\n⚠ API error (attempt 1): EOF\n', '第二段']).out).toBe('第一段\n第二段')
  })
})
