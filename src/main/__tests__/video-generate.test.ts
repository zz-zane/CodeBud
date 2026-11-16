import { describe, expect, it, vi } from 'vitest'
import example from '../../../fixtures/video-pointer.json'
import recursionFixture from '../../../fixtures/video-recursion.json'
import { generateOutline, generateVideo, matchesTraceOutput, validateGenerateRequest, validateOutlineRequest } from '../video/generate'
import type { VideoGenerateRequest } from '../../shared/video'

const input: VideoGenerateRequest = {
  requestId: 'test', question: '指针是什么？',
  outline: { title: '指针', confusion: '地址与值', analogy: '门牌', scenes: [
    { kind: 'card', goal: '类比' }, { kind: 'memory', goal: '展示' }, { kind: 'card', goal: '易错' }
  ] }
}

describe('video generation', () => {
  it('checks untrusted inputs and rejects oversized excerpts', () => {
    expect(validateOutlineRequest(input)).toBe(true)
    expect(validateGenerateRequest(input)).toBe(true)
    expect(validateOutlineRequest({ ...input, excerpt: 'a'.repeat(2001) })).toBe(false)
    expect(validateOutlineRequest({ ...input, excerpt: 'a'.repeat(2000) + '\u0000' })).toBe(true)
    expect(validateOutlineRequest({ ...input, question: '🐱'.repeat(500) })).toBe(true)
    expect(validateGenerateRequest({ ...input, outline: {} })).toBe(false)
    expect(validateOutlineRequest({ ...input, question: 'x' + '\u0000'.repeat(150000) })).toBe(false)
    expect(validateGenerateRequest({ ...input, outline: { ...input.outline, analogy: 'x' + '\u0000'.repeat(1000) } })).toBe(false)
  })
  it('strips input control characters before building the prompt', async () => {
    const prompt = vi.fn().mockResolvedValue(JSON.stringify(input.outline))
    await generateOutline({ ...input, question: '指\u0000针', excerpt: 'a\u0001b' }, prompt, new AbortController().signal)
    expect(prompt.mock.calls[0][0]).toContain('指针')
    expect(prompt.mock.calls[0][0]).not.toContain('\\u0000')
    expect(prompt.mock.calls[0][0]).toContain('ab')
  })
  it('does not send an oversized repair prompt', async () => {
    const prompt = vi.fn().mockResolvedValue('x'.repeat(64001))
    await expect(generateVideo(input, prompt, vi.fn(), new AbortController().signal)).rejects.toThrow('讲解请求太长')
    expect(prompt).toHaveBeenCalledTimes(1)
  })
  it('repairs a bad response once and uses trusted metadata', async () => {
    const prompt = vi.fn().mockResolvedValueOnce('{broken').mockResolvedValueOnce(JSON.stringify(example))
    const video = await generateVideo(input, prompt, vi.fn(), new AbortController().signal)
    expect(prompt).toHaveBeenCalledTimes(2)
    expect(prompt.mock.calls[1][0]).toContain('输出不是有效的视频 JSON')
    expect(video.question).toBe(input.question)
    expect(video.id).not.toBe(example.id)
    expect(video.codeVerified).toBeNull()
  })
  it('returns an error after one failed repair', async () => {
    const prompt = vi.fn().mockResolvedValue('{}')
    await expect(generateVideo(input, prompt, vi.fn(), new AbortController().signal)).rejects.toThrow()
    expect(prompt).toHaveBeenCalledTimes(2)
  })
  it('repairs a failed code check and marks a missing toolchain as unverified', async () => {
    const candidate = structuredClone(example) as unknown as Record<string, unknown>
    const scenes = candidate.scenes as Array<Record<string, unknown>>
    const oldSteps = scenes[2].steps as Array<{ say: string }>
    scenes[2] = { kind: 'trace', title: '运行', lang: 'python', code: ['print(1)', 'print(2)', 'print(3)', 'print(4)'], expectedOutput: '1\n2\n3\n4',
      steps: oldSteps.map((step, index) => ({ say: step.say, at: index + 1, vars: [] })) }
    const prompt = vi.fn().mockResolvedValue(JSON.stringify(candidate))
    const verify = vi.fn().mockResolvedValueOnce({ missing: false, error: '输出不一致' }).mockResolvedValueOnce({ missing: true })
    const video = await generateVideo(input, prompt, verify, new AbortController().signal)
    expect(prompt).toHaveBeenCalledTimes(2)
    expect(prompt.mock.calls[1][0]).toContain('输出不一致')
    expect(video.codeVerified).toBe(false)
  })

  it('normalizes lossless trace shapes before validateVideo', async () => {
    const candidate = structuredClone(recursionFixture) as Record<string, unknown>
    const scenes = candidate.scenes as Array<Record<string, unknown>>
    const trace = structuredClone(scenes.find((s) => s.kind === 'trace')!)
    const rawSteps = trace.steps as Array<Record<string, unknown>>
    trace.code = (trace.code as string[]).join('\n')
    trace.steps = rawSteps.map((step, i) => ({
      say: step.say,
      at: step.at,
      vars: { n: i + 1 },
      ...(step.out !== undefined ? { output: step.out } : {}),
    }))
    scenes[3] = trace
    const prompt = vi.fn().mockResolvedValue(JSON.stringify(candidate))
    const verify = vi.fn().mockResolvedValue({ missing: false, stdout: trace.expectedOutput })
    const video = await generateVideo(input, prompt, verify, new AbortController().signal)
    expect(prompt).toHaveBeenCalledTimes(1)
    expect(video.codeVerified).toBe(true)
  })

  it('shuffles check options after validation while preserving the right answer and logs failed attempts without leaking secrets', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const candidate = structuredClone(example) as unknown as Record<string, unknown>
    candidate.checks = [
      { stem: 'Q1?', options: ['Right', 'WrongA', 'WrongB', 'WrongC'], answer: 0, explanation: 'Because' }
    ]
    const prompt = vi.fn()
      .mockResolvedValueOnce('{broken')
      .mockResolvedValueOnce(JSON.stringify(candidate))
    // Sequence [0.5, 0.2, 0.8] moves index 0 away from slot 0 deterministically
    const seq = [0.5, 0.2, 0.8]
    let k = 0
    const video = await generateVideo(
      { ...input, excerpt: 'SECRET_EXCERPT_DO_NOT_LOG' },
      prompt,
      vi.fn(),
      new AbortController().signal,
      () => seq[k++ % seq.length]
    )
    expect(video.checks[0].options[video.checks[0].answer]).toBe('Right')
    expect(video.checks[0].answer).not.toBe(0)
    expect(warn).toHaveBeenCalledTimes(1)
    const logged = String(warn.mock.calls[0].join(' '))
    expect(logged).toContain('attempt')
    expect(logged).toContain(input.question)
    expect(logged).not.toContain('SECRET_EXCERPT_DO_NOT_LOG')
    expect(logged).not.toContain('{broken')
    warn.mockRestore()
  })

  it('normalizes CRLF/CR newlines in trace output comparison and persisted expectedOutput', async () => {
    expect(matchesTraceOutput('a\nb\nc', 'a\r\nb\rc\r\n')).toBe(true)
    expect(matchesTraceOutput('a\nb', 'a\r\nc\r\n')).toBe(false)

    const candidate = structuredClone(recursionFixture) as Record<string, unknown>
    const scenes = candidate.scenes as Array<Record<string, unknown>>
    const trace = structuredClone(scenes.find((s) => s.kind === 'trace')!)
    trace.expectedOutput = 'line1\r\nline2\r'
    scenes[3] = trace
    const prompt = vi.fn().mockResolvedValueOnce(JSON.stringify(candidate))
    const verify = vi.fn().mockImplementation(async (scene) => {
      return matchesTraceOutput(scene.expectedOutput, 'line1\nline2\n')
        ? { missing: false }
        : { missing: false, error: 'mismatch' }
    })
    const video = await generateVideo(input, prompt, verify, new AbortController().signal)
    expect(prompt).toHaveBeenCalledTimes(1)
    const savedTrace = video.scenes.find((s) => s.kind === 'trace')
    expect(savedTrace?.kind === 'trace' && savedTrace.expectedOutput).toBe('line1\nline2')
  })
})
