import { VIDEO_COPY, VIDEO_FORMAT } from './video-copy'
import { canonicalJson } from './cloud/canonical-json'

import type { VideoCheck, VideoScene } from './video-legacy'

export type VideoLang = 'c' | 'cpp' | 'java' | 'python'
export type VideoSkin = 'memory' | 'locker' | 'sheet' | 'train'
export interface VideoGenerationInput {
  requestId: string; question: string; code?: string; excerpt?: string; lang?: VideoLang
  wrongOption?: string; lessonId?: string; avoid?: string[]
}
export type VideoGenerationResult = { ok: true; video: ExplainerVideo } | { ok: false; fallback: string; reason: string }
export interface VideoProgress {
  requestId: string; stage: 'judging' | 'scripting' | 'verifying' | 'done'
  status: 'running' | 'ok' | 'failed'; detail?: string
}
export interface ExplainerVideo {
  id: string; title: string; question: string; concept: string; lessonId?: string
  keywords?: string[]; lessonIds?: string[]
  source: 'ai' | 'builtin' | 'demo'; createdAt: number; acts: VideoAct[]; codeVerified: boolean | null
  // shortcut: old renderer types remain until M2/P3 replace their consumers.
  scenes: VideoScene[]; checks: VideoCheck[]
}
export interface VideoAct {
  title: string; skin: VideoSkin
  code?: { lang: VideoLang; lines: string[]; expectedOutput: string }
  steps: VideoStep[]
}
export interface VideoStep {
  say: string; line?: number
  groups: { id: string; title: string; kind: 'frame' | 'heap' | 'array' | 'plain' }[]
  cells: { id: string; group: string; name?: string; addr?: string; value: string; dim?: boolean }[]
  arrows: { from: string; to: string }[]
  focus?: string[]; fly?: { from: string; to: string; text: string }
  follow?: string; open?: string[]
  note?: { at: string; text: string }; out?: string
  ask?: { stem: string; options: string[]; answer: number; why: string }
}
const obj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown): v is string => typeof v === 'string'
const nonempty = (v: unknown): v is string => text(v) && v.trim().length > 0
const len = (s: string): number => Array.from(s.replace(/[\u0000-\u001f\u007f-\u009f]/g, '')).length
const strs = (v: unknown): v is string[] => Array.isArray(v) && v.every(text)

/** Validate untrusted v2 video data. Legacy migrations use only structural and reference checks. */
function validate(input: unknown, legacy: boolean, structural = false): string[] {
  const errors: string[] = []
  const fail = (where: string, reason: string): void => { errors.push(`${where}: ${reason}`) }
  if (!obj(input) || !Array.isArray(input.acts)) return [VIDEO_COPY.INVALID]
  if (!nonempty(input.id) || !nonempty(input.title) || len(input.title) > 30 || !nonempty(input.question) ||
      !nonempty(input.concept) || len(input.concept) > 20 || !['ai', 'builtin'].includes(input.source as string) ||
      typeof input.createdAt !== 'number' || !Number.isFinite(input.createdAt) ||
      (input.lessonId !== undefined && !text(input.lessonId)) || (input.keywords !== undefined && !strs(input.keywords)) || (input.lessonIds !== undefined && !strs(input.lessonIds)) || ![true, false, null].includes(input.codeVerified as boolean | null)) fail(VIDEO_COPY.VIDEO, VIDEO_COPY.METADATA)
  if (structural && (input.acts.length < 1 || input.acts.length > 32 || input.acts.reduce((total, act) => total + (obj(act) && Array.isArray(act.steps) ? act.steps.length : 0), 0) > 1000)) return [VIDEO_COPY.INVALID]
  if (!legacy && (input.acts.length < 1 || input.acts.length > 3)) fail(VIDEO_COPY.VIDEO, VIDEO_COPY.ACT_COUNT)
  let count = 0, chars = 0, asks = 0, motion = false, hasCode = false
  let previous: string | undefined
  input.acts.forEach((act, i) => {
    const where = VIDEO_FORMAT.act(i + 1)
    if (!obj(act) || !Array.isArray(act.steps) || (structural && (!act.steps.length || act.steps.length > 1000))) { fail(where, VIDEO_COPY.FORMAT); return }
    if (!nonempty(act.title) || len(act.title) > 16 || !['memory', 'locker', 'sheet', 'train'].includes(act.skin as string)) fail(where, VIDEO_COPY.ACT_METADATA)
    if (act.code !== undefined) {
      hasCode = true
      if (!obj(act.code) || !['c', 'cpp', 'java', 'python'].includes(act.code.lang as string) || !strs(act.code.lines) ||
          !text(act.code.expectedOutput) || ((!legacy || structural) && (act.code.lines.length > 20 || act.code.lines.some(line => len(line) > 70))) || (!legacy && act.code.lines.length < 1)) fail(where, VIDEO_COPY.CODE)
    }
    act.steps.forEach((step, j) => {
      const at = VIDEO_FORMAT.step(where, j + 1); count++
      if (!obj(step)) { fail(at, VIDEO_COPY.FORMAT); return }
      if (!text(step.say)) fail(at, VIDEO_COPY.SAY)
      else {
        const n = len(step.say); chars += n
        if ((!structural && n < 8) || n > 60) fail(at, VIDEO_COPY.SAY_LENGTH)
        const say = step.say
        if (!legacy && [VIDEO_COPY.SPEAK_STAR, VIDEO_COPY.SPEAK_ADDRESS, VIDEO_COPY.SPEAK_ARROW, VIDEO_COPY.SPEAK_EQ_EQ].some(word => say.includes(word))) fail(at, VIDEO_COPY.SAY_SYMBOLS)
      }
      if (!legacy && act.code !== undefined && (!obj(act.code) || !strs(act.code.lines) || !Number.isInteger(step.line) || (step.line as number) < 1 || (step.line as number) > act.code.lines.length)) fail(at, VIDEO_COPY.CODE_LINE)
      if (structural && step.line !== undefined && (!Number.isInteger(step.line) || (step.line as number) < 1 || (obj(act.code) && strs(act.code.lines) && (step.line as number) > act.code.lines.length))) fail(at, VIDEO_COPY.CODE_LINE)
      if (step.line !== undefined && !Number.isInteger(step.line)) fail(at, VIDEO_COPY.LINE)
      const groups = step.groups, cells = step.cells
      if (!Array.isArray(groups) || groups.length > 4 || !groups.every(g => obj(g) && nonempty(g.id) && text(g.title) && ['frame', 'heap', 'array', 'plain'].includes(g.kind as string))) { fail(at, VIDEO_COPY.GROUPS); return }
      if (!Array.isArray(cells) || cells.length > 12 || (!legacy && cells.length < 1) || !cells.every(c => obj(c) && nonempty(c.id) && nonempty(c.group) && text(c.value) && (c.name === undefined || text(c.name)) && (c.addr === undefined || text(c.addr)) && (c.dim === undefined || typeof c.dim === 'boolean'))) { fail(at, VIDEO_COPY.CELLS); return }
      const gids = groups.map(g => g.id), ids = cells.map(c => c.id)
      if (new Set(gids).size !== gids.length || new Set(ids).size !== ids.length || cells.some(c => !gids.includes(c.group))) fail(at, VIDEO_COPY.IDS)
      const exists = (id: unknown): boolean => text(id) && ids.includes(id)
      if (!Array.isArray(step.arrows) || (structural && step.arrows.length > 144) || !step.arrows.every(a => obj(a) && exists(a.from) && exists(a.to))) fail(at, VIDEO_COPY.ARROWS)
      else {
        if (step.arrows.length) motion = true
        if (!structural && step.arrows.some(a => {
          const from = cells.find(c => c.id === a.from), to = cells.find(c => c.id === a.to)
          return from && to && from.group !== to.group && groups.find(g => g.id === from.group)?.kind === 'frame' && groups.find(g => g.id === to.group)?.kind === 'frame'
        })) fail(at, VIDEO_COPY.ARROWS)
      }
      if (step.follow !== undefined && (!text(step.follow) || (!structural && (!Array.isArray(step.arrows) || !step.arrows.some(a => obj(a) && a.from === step.follow))))) fail(at, VIDEO_COPY.ARROWS)
      if (step.open !== undefined && (!strs(step.open) || !step.open.every(exists))) fail(at, VIDEO_COPY.CELLS)
      if (step.focus !== undefined && (!strs(step.focus) || !step.focus.every(exists))) fail(at, VIDEO_COPY.FOCUS)
      if (step.fly !== undefined) {
        if (!obj(step.fly) || !exists(step.fly.from) || !(step.fly.to === 'out' || exists(step.fly.to)) || !text(step.fly.text)) fail(at, VIDEO_COPY.FLY)
        else motion = true
      }
      if (step.note !== undefined && (!obj(step.note) || !exists(step.note.at) || !text(step.note.text) || len(step.note.text) > 20)) fail(at, VIDEO_COPY.NOTE)
      if (step.out !== undefined && !text(step.out)) fail(at, VIDEO_COPY.OUTPUT)
      if (step.ask !== undefined) {
        asks++
        const a = step.ask
        if (!obj(a) || !nonempty(a.stem) || !strs(a.options) || (structural && a.options.length > 4) || (!legacy && (a.options.length < 3 || a.options.length > 4)) || !a.options.every(nonempty) || !Number.isInteger(a.answer) || (a.answer as number) < 0 || (a.answer as number) >= a.options.length || !nonempty(a.why)) fail(at, VIDEO_COPY.ASK)
      }
      const state = canonicalJson([
        Number.isInteger(step.line) ? step.line : null,
        groups.map(g => ({ id: g.id, title: g.title, kind: g.kind })),
        cells.map(c => ({ id: c.id, group: c.group, name: c.name, addr: c.addr, value: c.value, dim: c.dim })),
        Array.isArray(step.arrows) ? step.arrows.filter(a => obj(a) && text(a.from) && text(a.to)).map(a => ({ from: a.from, to: a.to })) : [],
        strs(step.focus) ? step.focus : [],
        text(step.follow) ? step.follow : null, strs(step.open) ? step.open : [],
        obj(step.fly) && text(step.fly.from) && text(step.fly.to) && text(step.fly.text) ? { from: step.fly.from, to: step.fly.to, text: step.fly.text } : null,
        obj(step.note) && text(step.note.at) && text(step.note.text) ? { at: step.note.at, text: step.note.text } : null,
        text(step.out) ? step.out : ''
      ])
      if (!legacy && previous === state) fail(at, VIDEO_COPY.UNCHANGED)
      previous = state
    })
  })
  if (!legacy && (count < 8 || count > 18 || chars / 4.5 < 40 || chars / 4.5 > 110)) fail(VIDEO_COPY.VIDEO, VIDEO_COPY.DURATION)
  if (!legacy && !hasCode) fail(VIDEO_COPY.VIDEO, VIDEO_COPY.MISSING_CODE)
  if (!legacy && (asks < 1 || asks > 3)) fail(VIDEO_COPY.VIDEO, VIDEO_COPY.ASK_COUNT)
  if (!legacy && !motion) fail(VIDEO_COPY.VIDEO, VIDEO_COPY.MOTION)
  return errors
}

export const validateVideo = (input: unknown): string[] => {
  const errors = validate(input, true, true)
  return errors.length ? errors : validate(input, false)
}
export const validateMigratedVideo = (input: unknown): string[] => validate(input, true)
export const validateVideoStructure = (input: unknown): string[] => validate(input, true, true)

/** Converts one validated v1 video without modifying it; caller records returned warnings. */
export function migrateVideoV1(value: unknown): { video: ExplainerVideo; warnings: string[] } {
  if (!obj(value) || !Array.isArray(value.scenes) || !Array.isArray(value.checks)) throw new Error(VIDEO_COPY.OLD_VIDEO)
  const acts: VideoAct[] = [], warnings: string[] = [], pending: string[] = []
  for (const raw of value.scenes) {
    if (!obj(raw)) throw new Error(VIDEO_COPY.OLD_SCENE)
    if (raw.kind === 'card') {
      if (!text(raw.say)) throw new Error(VIDEO_COPY.OLD_SAY)
      pending.push(raw.say)
      continue
    }
    if (!text(raw.title) || !Array.isArray(raw.steps)) throw new Error(VIDEO_COPY.OLD_SCENE)
    const act: VideoAct = { title: raw.title, skin: 'memory', steps: [] }
    if (raw.kind === 'trace') {
      if (!strs(raw.code) || !text(raw.expectedOutput) || !['c','cpp','java','python'].includes(raw.lang as string)) throw new Error(VIDEO_COPY.OLD_CODE)
      act.code = { lang: raw.lang as VideoLang, lines: [...raw.code], expectedOutput: raw.expectedOutput }
    }
    for (const old of raw.steps) {
      if (!obj(old) || !text(old.say)) throw new Error(VIDEO_COPY.OLD_STEP)
      const step: VideoStep = { say: old.say, groups: [], cells: [], arrows: [] }
      if (raw.kind === 'trace') {
        if (!Array.isArray(old.vars) || !old.vars.every(v => obj(v) && text(v.name) && text(v.value)) || !Number.isInteger(old.at)) throw new Error(VIDEO_COPY.OLD_VARS)
        step.groups = [{ id: 'frame', title: raw.title, kind: 'frame' }]
        step.cells = old.vars.map(v => ({ id: v.name as string, group: 'frame', name: v.name as string, value: v.value as string }))
        step.line = old.at as number
        if (text(old.out)) step.out = old.out
      } else if (raw.kind === 'memory') {
        if (!Array.isArray(old.cells) || !old.cells.every(c => obj(c) && text(c.id) && text(c.label) && text(c.value) && (c.region === 'stack' || c.region === 'heap')) || !Array.isArray(old.arrows)) throw new Error(VIDEO_COPY.OLD_MEMORY)
        step.groups = [{ id: 'stack', title: VIDEO_COPY.STACK, kind: 'frame' }, { id: 'heap', title: VIDEO_COPY.HEAP, kind: 'heap' }]
        step.cells = old.cells.map(c => ({ id: c.id as string, group: c.region as string, name: c.label as string, value: c.value as string }))
        step.arrows = old.arrows.map(a => { if (!obj(a) || !text(a.from) || !text(a.to)) throw new Error(VIDEO_COPY.OLD_ARROWS); return { from: a.from, to: a.to } })
        if (old.focus !== undefined) { if (!strs(old.focus)) throw new Error(VIDEO_COPY.OLD_FOCUS); step.focus = [...old.focus] }
      } else if (raw.kind === 'array') {
        if (!strs(old.items)) throw new Error(VIDEO_COPY.OLD_ARRAY)
        step.groups = [{ id: 'array', title: raw.title, kind: 'array' }]
        step.cells = old.items.map((item, index) => ({ id: String(index), group: 'array', name: String(index), value: item }))
        if (Array.isArray(old.highlights)) step.focus = old.highlights.map(String)
        if (obj(old.pointers)) for (const [id, name] of Object.entries(old.pointers)) {
          if (!text(name)) throw new Error(VIDEO_COPY.OLD_POINTER)
          const cell = step.cells[Number(id)]
          if (!cell || !/^(0|[1-9]\d*)$/.test(id)) throw new Error(VIDEO_COPY.OLD_POINTER_REF)
          cell.name = `${cell.name} ${name}`
        }
        if (text(old.note) && step.cells.length) step.note = { at: step.cells[0].id, text: old.note }
      } else throw new Error(VIDEO_COPY.OLD_KIND)
      if (!act.steps.length && pending.length) { step.say = `${pending.join(' ')} ${step.say}`; pending.length = 0 }
      const parts = Array.from(step.say)
      while (parts.length > 60) {
        const size = parts.length - 60 < 8 ? parts.length - 8 : 60
        act.steps.push({ ...step, say: parts.splice(0, size).join('') })
      }
      step.say = parts.join('')
      act.steps.push(step)
    }
    acts.push(act)
  }
  if (pending.length) warnings.push(VIDEO_FORMAT.dropped(pending.length))
  const lastAct = acts.at(-1), last = lastAct?.steps.at(-1)
  if (value.checks.length && !last) throw new Error(VIDEO_COPY.OLD_CHECK_TARGET)
  for (let i = 0; i < value.checks.length; i++) {
    const check = value.checks[i]
    if (!obj(check) || !text(check.stem) || !strs(check.options) || !Number.isInteger(check.answer) || !text(check.explanation)) throw new Error(VIDEO_COPY.OLD_CHECK)
    const target = i === 0 ? last! : structuredClone(last!)
    target.ask = { stem: check.stem, options: [...check.options], answer: check.answer as number, why: check.explanation }
    if (i > 0) lastAct!.steps.push(target)
  }
  const video = { id: value.id, title: value.title, question: value.question, concept: text(value.title) ? Array.from(value.title).slice(0, 20).join('') : '',
    ...(value.lessonId === undefined ? {} : { lessonId: value.lessonId }), source: value.source, createdAt: value.createdAt,
    acts, codeVerified: value.codeVerified } as ExplainerVideo
  const errors = validateMigratedVideo(video)
  if (errors.length) throw new Error(VIDEO_FORMAT.migrationError(errors))
  return { video, warnings }
}

export { speechText } from './video-speech'
export { cleanLength, normalizeVideoShape, shuffleVideoChecks } from './video-legacy'
export type { VideoScene, CardScene, TraceScene, MemoryScene, ArrayScene, VideoCheck, VideoOutline, VideoOutlineRequest, VideoGenerateRequest, VideoResult, VideoVerifyPrompt, VideoDemoBlock } from './video-legacy'
import { demoToVideo as legacyDemoToVideo, type VideoDemoBlock } from './video-legacy'

export const VIDEO_FILE_VERSION = 2
// shortcut: old lesson entry remains until P3 removes it and this bridge.
export function demoToVideo(block: VideoDemoBlock, lessonId: string, title: string): ExplainerVideo {
  return legacyDemoToVideo(block, lessonId, title) as unknown as ExplainerVideo
}
