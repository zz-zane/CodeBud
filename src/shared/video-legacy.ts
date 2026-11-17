import { createClientId } from './client-id'

export const VIDEO_FILE_VERSION = 1
export type VideoLang = 'c' | 'cpp' | 'java' | 'python'

export interface ExplainerVideo {
  id: string
  title: string
  question: string
  lessonId?: string
  source: 'ai' | 'demo'
  createdAt: number
  scenes: VideoScene[]
  checks: VideoCheck[]
  codeVerified: boolean | null
}

export type VideoScene = CardScene | TraceScene | MemoryScene | ArrayScene

export interface CardScene {
  kind: 'card'
  role: 'problem' | 'analogy' | 'pitfall' | 'summary'
  heading: string
  body: string
  say: string
}

export interface TraceScene {
  kind: 'trace'
  title: string
  lang: VideoLang | null
  code: string[]
  expectedOutput: string
  steps: { say: string; at: number; vars: { name: string; value: string }[]; stack?: string[]; out?: string }[]
}

export interface MemoryScene {
  kind: 'memory'
  title: string
  steps: {
    say: string
    cells: { id: string; label: string; value: string; region: 'stack' | 'heap' }[]
    arrows: { from: string; to: string }[]
    focus?: string[]
  }[]
}

export interface ArrayScene {
  kind: 'array'
  title: string
  steps: { say: string; items: string[]; highlights?: number[]; pointers?: Record<string, string>; note?: string }[]
}

export interface VideoCheck {
  stem: string
  options: string[]
  answer: number
  explanation: string
}

export interface VideoOutline {
  title: string
  confusion: string
  analogy: string
  scenes: { kind: VideoScene['kind']; goal: string }[]
}

export interface VideoOutlineRequest {
  requestId: string
  question: string
  lessonId?: string
  excerpt?: string
  lang?: VideoLang
  avoid?: string
}

export interface VideoGenerateRequest extends Omit<VideoOutlineRequest, 'avoid'> {
  outline: VideoOutline
}

export type VideoResult<T> = { ok: true; data: T } | { ok: false; error: string }

export interface VideoVerifyPrompt {
  requestId: string
  confirmationId: string
  lang: VideoLang
  code: string[]
}

/** The relevant part of a parsed lesson demo, kept independent of the renderer. */
export interface VideoDemoBlock {
  title: string
  code: string[]
  steps: { say: string; at: number; vars: { name: string; value: string }[] }[]
}

export function demoToVideo(block: VideoDemoBlock, lessonId: string, title: string): ExplainerVideo {
  return {
    id: createClientId(), title, question: block.title, lessonId,
    source: 'demo', createdAt: Date.now(), codeVerified: null, checks: [],
    scenes: [{ kind: 'trace', title: block.title, lang: null, code: block.code,
      expectedOutput: '', steps: block.steps.map(({ say, at, vars }) => ({ say, at, vars })) }]
  }
}

export const cleanLength = (s: string): number => Array.from(s.replace(/[\u0000-\u001f\u007f-\u009f]/g, '')).length
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)

/**
 * Lossless shape normalization before validation:
 * 1) trace.code string -> split lines into string[]
 * 2) trace.steps[].vars plain object -> {name, value}[]
 * 3) trace.steps[].output (when out omitted) -> out
 */
export function normalizeVideoShape(input: unknown): unknown {
  if (!record(input) || !Array.isArray(input.scenes)) return input
  return {
    ...input,
    scenes: input.scenes.map((scene) => {
      if (!record(scene) || scene.kind !== 'trace') return scene
      const nextScene: Record<string, unknown> = { ...scene }
      if (typeof scene.code === 'string') {
        const trimmed = scene.code.replace(/\r?\n$/, '')
        nextScene.code = trimmed === '' ? [] : trimmed.split(/\r?\n/)
      }
      if (Array.isArray(scene.steps)) {
        nextScene.steps = scene.steps.map((step) => {
          if (!record(step)) return step
          const nextStep: Record<string, unknown> = { ...step }
          if (record(step.vars)) {
            nextStep.vars = Object.entries(step.vars).map(([name, value]) => ({ name, value: String(value) }))
          }
          if (step.output !== undefined && step.out === undefined) {
            nextStep.out = step.output
            delete nextStep.output
          }
          return nextStep
        })
      }
      return nextScene
    })
  }
}

/**
 * Shuffles each check's options via Fisher-Yates using the injected PRNG while
 * remapping `answer` so it points to the same correct option text.
 */
export function shuffleVideoChecks(checks: readonly VideoCheck[], random: () => number = Math.random): VideoCheck[] {
  return checks.map((check) => {
    const order = check.options.map((_, i) => i)
    for (let i = order.length - 1; i > 0; i--) {
      const r = random()
      const j = Math.min(i, Math.max(0, Math.floor((Number.isFinite(r) ? r : 0) * (i + 1))))
      ;[order[i], order[j]] = [order[j], order[i]]
    }
    const answer = order.indexOf(check.answer)
    return { ...check, options: order.map((idx) => check.options[idx]), answer: answer >= 0 ? answer : check.answer }
  })
}
