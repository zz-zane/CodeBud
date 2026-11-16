import { VIDEO_TEXT } from './copy'
import { createClientId } from './client-id'
import { canonicalJson } from './cloud/canonical-json'

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
const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === 'string')
const stringMap = (v: unknown): v is Record<string, string> => record(v) && Object.values(v).every((s) => typeof s === 'string')

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

/** Validate untrusted model output before it can be saved or rendered. */
export function validateVideo(input: unknown): string[] {
  const errors: string[] = []
  const fail = (where: string): void => { errors.push(where) }
  if (!record(input) || (input.source !== 'ai' && input.source !== 'demo') || !Array.isArray(input.scenes)) return [VIDEO_TEXT.INVALID_VIDEO]
  const ai = input.source === 'ai'
  if (typeof input.id !== 'string' || typeof input.title !== 'string' || typeof input.question !== 'string' ||
      typeof input.createdAt !== 'number' || !Number.isFinite(input.createdAt) ||
      (input.lessonId !== undefined && typeof input.lessonId !== 'string') ||
      ![true, false, null].includes(input.codeVerified as boolean | null) || !Array.isArray(input.checks)) fail(VIDEO_TEXT.INVALID_METADATA)
  if (ai && (typeof input.title !== 'string' || cleanLength(input.title) > 40 || typeof input.question !== 'string' || cleanLength(input.question) > 500)) fail(VIDEO_TEXT.TITLE_TOO_LONG)
  const scenes = input.scenes
  if (ai) {
    if (scenes.length < 4 || scenes.length > 8) fail(VIDEO_TEXT.SCENE_COUNT)
    const first = scenes[0], last = scenes.at(-1)
    if (!record(first) || first.kind !== 'card' || first.role !== 'problem') fail(VIDEO_TEXT.FIRST_PROBLEM)
    if (!record(last) || last.kind !== 'card' || last.role !== 'summary') fail(VIDEO_TEXT.LAST_SUMMARY)
    const visualIndex = scenes.findIndex((s) => record(s) && s.kind !== 'card')
    if (visualIndex < 0 || scenes.slice(0, visualIndex).filter((s) => record(s) && s.kind === 'card' && s.role === 'analogy').length !== 1) fail(VIDEO_TEXT.ANALOGY)
    if (!scenes.some((s) => record(s) && s.kind === 'card' && s.role === 'pitfall')) fail(VIDEO_TEXT.PITFALL)
    if (!scenes.some((s) => record(s) && s.kind !== 'card' && Array.isArray(s.steps) && s.steps.length >= 3)) fail(VIDEO_TEXT.VISUAL_STEPS)
  }
  let count = 0, chars = 0
  const say = (v: unknown, where: string): void => {
    if (typeof v !== 'string') { fail(VIDEO_TEXT.SAY_INVALID(where)); return }
    const n = cleanLength(v); count++; chars += n
    if (ai && (n < 8 || n > 70)) fail(VIDEO_TEXT.SAY_LENGTH(where))
  }
  scenes.forEach((scene, i) => {
    const where = VIDEO_TEXT.SCENE(i + 1)
    if (!record(scene)) { fail(VIDEO_TEXT.INVALID(where)); return }
    if (scene.kind === 'card') {
      if (typeof scene.role !== 'string' || !['problem', 'analogy', 'pitfall', 'summary'].includes(scene.role) || typeof scene.heading !== 'string' || typeof scene.body !== 'string') { fail(VIDEO_TEXT.CARD_INVALID(where)); return }
      if (ai && (!cleanLength(scene.heading.trim()) || !cleanLength(scene.body.trim()) || cleanLength(scene.heading) > 24 || cleanLength(scene.body) > 120)) fail(VIDEO_TEXT.CARD_LENGTH(where))
      say(scene.say, where); return
    }
    if (typeof scene.kind !== 'string' || !['trace', 'memory', 'array'].includes(scene.kind) || typeof scene.title !== 'string' || !Array.isArray(scene.steps)) { fail(VIDEO_TEXT.VISUAL_INVALID(where)); return }
    if (scene.kind === 'trace') {
      if (!strings(scene.code) || scene.code.length > 30 || scene.code.some((line) => cleanLength(line) > 80)) fail(VIDEO_TEXT.TRACE_CODE(where))
      if (typeof scene.expectedOutput !== 'string') fail(VIDEO_TEXT.TRACE_EXPECTED_OUTPUT(where))
      if (!(scene.lang === null ? !ai : typeof scene.lang === 'string' && ['c', 'cpp', 'java', 'python'].includes(scene.lang))) fail(VIDEO_TEXT.TRACE_LANG(where))
    }
    let previous: string | undefined
    scene.steps.forEach((step, j) => {
      const at = VIDEO_TEXT.STEP(where, j + 1)
      if (!record(step)) { fail(VIDEO_TEXT.INVALID(at)); return }
      say(step.say, at)
      let visual: unknown
      if (scene.kind === 'trace') {
        let stepOk = true
        if (strings(scene.code) && (!Number.isInteger(step.at) || (step.at as number) < 1 || (step.at as number) > scene.code.length)) {
          fail(VIDEO_TEXT.TRACE_AT(at)); stepOk = false
        }
        if (!Array.isArray(step.vars) || step.vars.length > 8 || !step.vars.every((v) => record(v) && typeof v.name === 'string' && typeof v.value === 'string')) {
          fail(VIDEO_TEXT.TRACE_VARS(at)); stepOk = false
        }
        if (step.stack !== undefined && !strings(step.stack)) { fail(VIDEO_TEXT.TRACE_STACK(at)); stepOk = false }
        if (step.out !== undefined && typeof step.out !== 'string') { fail(VIDEO_TEXT.TRACE_OUT(at)); stepOk = false }
        if (!stepOk || !strings(scene.code)) return
        visual = [step.at, (step.vars as { name: string; value: string }[]).map(({ name, value }) => ({ name, value })), step.stack ?? [], step.out ?? '']
      } else if (scene.kind === 'memory') {
        const cells = step.cells, arrows = step.arrows
        if (!Array.isArray(cells) || cells.length > 12 || !cells.every((c) => record(c) && typeof c.id === 'string' && typeof c.label === 'string' && typeof c.value === 'string' && (c.region === 'stack' || c.region === 'heap'))) { fail(VIDEO_TEXT.MEMORY_CELLS(at)); return }
        const ids = cells.map((c) => (c as Record<string, unknown>).id)
        let stepOk = true
        if (new Set(ids).size !== ids.length) { fail(VIDEO_TEXT.MEMORY_CELL_IDS(at)); stepOk = false }
        if (!Array.isArray(arrows) || !arrows.every((a) => record(a) && ids.includes(a.from) && ids.includes(a.to))) { fail(VIDEO_TEXT.MEMORY_ARROWS(at)); stepOk = false }
        if (step.focus !== undefined && (!strings(step.focus) || !step.focus.every((id) => ids.includes(id)))) { fail(VIDEO_TEXT.MEMORY_FOCUS(at)); stepOk = false }
        if (!stepOk) return
        visual = [cells.map((cell) => {
          const { id, label, value, region } = cell as Record<string, unknown>
          return { id, label, value, region }
        }), (arrows as { from: string; to: string }[]).map(({ from, to }) => ({ from, to })), step.focus ?? []]
      } else {
        const items = step.items
        if (!strings(items) || items.length > 12) { fail(VIDEO_TEXT.ARRAY_ITEMS(at)); return }
        const validIndex = (n: unknown): boolean => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < items.length
        let stepOk = true
        if (step.highlights !== undefined && (!Array.isArray(step.highlights) || !step.highlights.every(validIndex))) { fail(VIDEO_TEXT.ARRAY_HIGHLIGHTS(at)); stepOk = false }
        if (step.pointers !== undefined && (!stringMap(step.pointers) || !Object.keys(step.pointers).every((key) => /^(0|[1-9]\d*)$/.test(key) && validIndex(Number(key))))) { fail(VIDEO_TEXT.ARRAY_POINTERS(at)); stepOk = false }
        if (step.note !== undefined && typeof step.note !== 'string') { fail(VIDEO_TEXT.ARRAY_NOTE(at)); stepOk = false }
        if (!stepOk) return
        visual = [items, step.highlights ?? [], step.pointers ?? {}]
      }
      const state = canonicalJson(visual)
      if (ai && previous === state) fail(VIDEO_TEXT.NO_CHANGE(at))
      previous = state
    })
  })
  if (ai && (count < 8 || count > 40 || chars / 4.5 < 45 || chars / 4.5 > 180)) fail(VIDEO_TEXT.DURATION)
  if (ai && Array.isArray(input.checks)) {
    if (input.checks.length < 1 || input.checks.length > 2) fail(VIDEO_TEXT.CHECK_COUNT)
    input.checks.forEach((check, i) => {
      if (!record(check) || typeof check.stem !== 'string' || !cleanLength(check.stem.trim()) || !strings(check.options) || check.options.length < 3 || check.options.length > 4 ||
          !check.options.every((o) => cleanLength(o.trim()) > 0) || !Number.isInteger(check.answer) || (check.answer as number) < 0 || (check.answer as number) >= check.options.length ||
          typeof check.explanation !== 'string' || !cleanLength(check.explanation.trim())) fail(VIDEO_TEXT.CHECK_INVALID(i + 1))
    })
  }
  return errors
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
