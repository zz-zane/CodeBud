import { randomUUID } from 'node:crypto'
import { VIDEO_TEXT } from '../../shared/copy'
import { gradeByRun, normalizeRunOutput } from '../../shared/run-grading'
import { buildVideoOutlinePrompt, buildVideoPrompt } from '../../shared/video-prompt'
import { cleanLength, normalizeVideoShape, shuffleVideoChecks, validateVideo, type ExplainerVideo, type TraceScene, type VideoGenerateRequest, type VideoOutline, type VideoOutlineRequest } from '../../shared/video'

export function matchesTraceOutput(expectedOutput: string, actualOutput: string): boolean {
  return gradeByRun(expectedOutput, actualOutput)
}

type Prompt = (prompt: string, signal: AbortSignal, tag: string) => Promise<string>
type Verify = (scene: TraceScene, signal: AbortSignal) => Promise<{ missing: boolean; error?: string }>
export const MAX_VIDEO_PROMPT_LENGTH = 64_000
const cleanText = (value: string): string => value.replace(/[\u0000-\u001f\u007f-\u009f]/g, '')
const bounded = (value: string, max: number): boolean => value.length <= max * 2 && cleanLength(value) <= max

function sanitizeInput<T extends VideoOutlineRequest>(input: T): T {
  const cleanOptional = (value: string | undefined): string | undefined => value === undefined ? undefined : cleanText(value)
  const result = { ...input, question: cleanText(input.question), lessonId: cleanOptional(input.lessonId), excerpt: cleanOptional(input.excerpt), avoid: cleanOptional(input.avoid) }
  if ('outline' in result) {
    const outline = (result as VideoGenerateRequest).outline
    Object.assign(result, { outline: { title: cleanText(outline.title), confusion: cleanText(outline.confusion), analogy: cleanText(outline.analogy), scenes: outline.scenes.map(scene => ({ kind: scene.kind, goal: cleanText(scene.goal) })) } })
  }
  return result
}

function boundedPrompt(prompt: string): string {
  if (prompt.length > MAX_VIDEO_PROMPT_LENGTH) throw new Error(VIDEO_TEXT.PROMPT_TOO_LONG)
  return prompt
}

function parseJson(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  return JSON.parse(trimmed)
}

function isOutline(value: unknown): value is VideoOutline {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.title === 'string' && cleanLength(item.title.trim()) > 0 && bounded(item.title, 40) &&
    typeof item.confusion === 'string' && cleanLength(item.confusion.trim()) > 0 && bounded(item.confusion, 500) &&
    typeof item.analogy === 'string' && cleanLength(item.analogy.trim()) > 0 && bounded(item.analogy, 500) &&
    Array.isArray(item.scenes) && item.scenes.length >= 3 && item.scenes.length <= 6 &&
    item.scenes.every((scene: unknown) => !!scene && typeof scene === 'object' &&
      typeof (scene as Record<string, unknown>).kind === 'string' && ['card', 'trace', 'memory', 'array'].includes((scene as Record<string, unknown>).kind as string) &&
      typeof (scene as Record<string, unknown>).goal === 'string' &&
      cleanLength(((scene as Record<string, unknown>).goal as string).trim()) > 0 && bounded((scene as Record<string, unknown>).goal as string, 500))
}

export function validateOutlineRequest(input: unknown): input is VideoOutlineRequest {
  if (!input || typeof input !== 'object') return false
  const r = input as Record<string, unknown>
  const optional = (v: unknown, max: number): boolean => v === undefined || (typeof v === 'string' && bounded(v, max))
  return typeof r.requestId === 'string' && r.requestId.length > 0 && r.requestId.length <= 128 && cleanText(r.requestId) === r.requestId &&
    typeof r.question === 'string' && cleanLength(r.question.trim()) > 0 && bounded(r.question, 500) &&
    optional(r.lessonId, 256) && optional(r.excerpt, 2000) && optional(r.avoid, 500) &&
    (r.lang === undefined || (typeof r.lang === 'string' && ['c', 'cpp', 'java', 'python'].includes(r.lang)))
}

export function validateGenerateRequest(input: unknown): input is VideoGenerateRequest {
  return validateOutlineRequest(input) && isOutline((input as VideoGenerateRequest).outline)
}

export async function generateOutline(input: VideoOutlineRequest, prompt: Prompt, signal: AbortSignal): Promise<VideoOutline> {
  const raw = await prompt(boundedPrompt(buildVideoOutlinePrompt(sanitizeInput(input))), signal, 'video-outline')
  const parsed = parseJson(raw)
  if (!isOutline(parsed)) throw new Error(VIDEO_TEXT.OUTLINE_INVALID)
  return parsed
}

export async function generateVideo(
  input: VideoGenerateRequest,
  prompt: Prompt,
  verify: Verify,
  signal: AbortSignal,
  random: () => number = Math.random
): Promise<ExplainerVideo> {
  input = sanitizeInput(input)
  let errors: string[] = []
  let previous = ''
  for (let attempt = 0; attempt < 2; attempt++) {
    if (signal.aborted) throw new Error(VIDEO_TEXT.CANCELED)
    const raw = await prompt(boundedPrompt(buildVideoPrompt(input, errors, previous)), signal, 'video-generate')
    previous = raw
    let video: ExplainerVideo | undefined
    try {
      const parsed = normalizeVideoShape(parseJson(raw))
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object')
      video = { ...parsed as ExplainerVideo, id: randomUUID(), question: input.question, lessonId: input.lessonId,
        source: 'ai', createdAt: Date.now(), codeVerified: null }
      errors = validateVideo(video)
    } catch {
      errors = [VIDEO_TEXT.JSON_INVALID]
    }
    if (video && errors.length === 0) {
      const traces = video.scenes.filter((scene): scene is TraceScene => scene.kind === 'trace')
      let missing = false
      for (const [index, scene] of traces.entries()) {
        if (signal.aborted) throw new Error(VIDEO_TEXT.CANCELED)
        const result = await verify(scene, signal)
        if (result.missing) missing = true
        else if (result.error) errors.push(VIDEO_TEXT.CODE_ERROR(index + 1, result.error))
      }
      video.codeVerified = traces.length === 0 ? null : !missing
      if (signal.aborted) throw new Error(VIDEO_TEXT.CANCELED)
      if (!errors.length) {
        for (const scene of video.scenes) {
          if (scene.kind === 'trace') scene.expectedOutput = normalizeRunOutput(scene.expectedOutput)
        }
        video.checks = shuffleVideoChecks(video.checks, random)
        return video
      }
    }
    if (errors.length > 0) {
      console.warn('[miai] video generate attempt failed', JSON.stringify({
        requestId: input.requestId,
        question: input.question,
        attempt: attempt + 1,
        errors
      }))
    }
  }
  throw new Error(errors.join('\n'))
}
