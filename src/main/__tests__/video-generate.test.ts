import { describe, expect, it, vi } from 'vitest'
import example from '../../../fixtures/video-pointer.json'
import { generateOutline, generateVideo, matchesTraceOutput, validateGenerateRequest, validateOutlineRequest } from '../video/generate'
import type { VideoGenerateRequest } from '../../shared/video'

const input: VideoGenerateRequest = {
  requestId: 'test', question: '指针是什么？',
  outline: { title: '指针', confusion: '地址与值', analogy: '门牌', scenes: [
    { kind: 'card', goal: '类比' }, { kind: 'memory', goal: '展示' }, { kind: 'card', goal: '易错' }
  ] }
}

describe('video generation', () => {
  it('validates untrusted request boundaries', () => {
    expect(validateOutlineRequest(input)).toBe(true)
    expect(validateGenerateRequest(input)).toBe(true)
    expect(validateOutlineRequest({ ...input, excerpt: 'a'.repeat(2001) })).toBe(false)
    expect(validateOutlineRequest({ ...input, question: '🐱'.repeat(500) })).toBe(true)
    expect(validateGenerateRequest({ ...input, outline: {} })).toBe(false)
    expect(validateOutlineRequest({ ...input, question: 'x' + '\u0000'.repeat(150000) })).toBe(false)
  })
  it('strips input control characters before building the prompt', async () => {
    const prompt = vi.fn().mockResolvedValue(JSON.stringify(input.outline))
    await generateOutline({ ...input, question: '指\u0000针', excerpt: 'a\u0001b' }, prompt, new AbortController().signal)
    expect(prompt.mock.calls[0][0]).toContain('指针')
    expect(prompt.mock.calls[0][0]).not.toContain('\u0000')
    expect(prompt.mock.calls[0][0]).toContain('ab')
  })
  it('does not send an oversized repair prompt', async () => {
    const prompt = vi.fn().mockResolvedValue('x'.repeat(64001))
    await expect(generateVideo(input, prompt, vi.fn(), new AbortController().signal)).rejects.toThrow('讲解请求太长')
    expect(prompt).toHaveBeenCalledTimes(1)
  })
  it('repairs malformed output once and verifies v2 act code', async () => {
    const prompt = vi.fn().mockResolvedValueOnce('{broken').mockResolvedValueOnce(JSON.stringify(example))
    const verify = vi.fn().mockResolvedValue({ missing: false })
    const video = await generateVideo(input, prompt, verify, new AbortController().signal)
    expect(prompt).toHaveBeenCalledTimes(2)
    expect(video.question).toBe(input.question)
    expect(video.id).not.toBe(example.id)
    expect(video.codeVerified).toBe(true)
    expect(verify.mock.calls[0][0].code).toEqual(example.acts[1].code!.lines)
  })
  it('repairs failed verification and marks a missing toolchain unverified', async () => {
    const prompt = vi.fn().mockResolvedValue(JSON.stringify(example))
    const verify = vi.fn().mockResolvedValueOnce({ missing: false, error: '输出不一致' }).mockResolvedValueOnce({ missing: true })
    const video = await generateVideo(input, prompt, verify, new AbortController().signal)
    expect(prompt).toHaveBeenCalledTimes(2)
    expect(prompt.mock.calls[1][0]).toContain('输出不一致')
    expect(video.codeVerified).toBe(false)
  })
  it('rejects invalid output after one repair', async () => {
    const prompt = vi.fn().mockResolvedValue('{}')
    await expect(generateVideo(input, prompt, vi.fn(), new AbortController().signal)).rejects.toThrow()
    expect(prompt).toHaveBeenCalledTimes(2)
  })
  it('shuffles answers without changing the correct choice and hides excerpts in logs', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const prompt = vi.fn().mockResolvedValueOnce('{broken').mockResolvedValueOnce(JSON.stringify(example))
    const video = await generateVideo({ ...input, excerpt: 'SECRET_EXCERPT_DO_NOT_LOG' }, prompt,
      vi.fn().mockResolvedValue({ missing: false }), new AbortController().signal, () => 0)
    const ask = video.acts[0].steps[3].ask!
    expect(ask.options[ask.answer]).toBe('5')
    expect(String(warn.mock.calls[0].join(' '))).not.toContain('SECRET_EXCERPT_DO_NOT_LOG')
    warn.mockRestore()
  })
  it('normalizes line endings in output comparison and saved output', async () => {
    expect(matchesTraceOutput('a\nb\nc', 'a\r\nb\rc\r\n')).toBe(true)
    expect(matchesTraceOutput('a\nb', 'a\r\nc\r\n')).toBe(false)
    const candidate = structuredClone(example)
    candidate.acts[1].code!.expectedOutput = '5\r\n9\r\n'
    const video = await generateVideo(input, vi.fn().mockResolvedValue(JSON.stringify(candidate)),
      vi.fn().mockResolvedValue({ missing: false }), new AbortController().signal)
    expect(video.acts[1].code?.expectedOutput).toBe('5\n9')
  })
})
