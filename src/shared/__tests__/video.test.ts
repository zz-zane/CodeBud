import { describe, expect, it } from 'vitest'
import pointer from '../../../fixtures/video-pointer.json'
import recursion from '../../../fixtures/video-recursion.json'
import { demoToVideo, normalizeVideoShape, shuffleVideoChecks, validateVideo, type ExplainerVideo } from '../video'

const valid = (): ExplainerVideo => structuredClone(pointer) as ExplainerVideo
const errors = (change: (v: ExplainerVideo) => void): string[] => {
  const video = valid()
  change(video)
  return validateVideo(video)
}

describe('validateVideo', () => {
  it('accepts both hand-written examples', () => {
    expect(validateVideo(pointer)).toEqual([])
    expect(validateVideo(recursion)).toEqual([])
  })
  it('rejects broken teaching structure, duration, checks and unchanged pictures', () => {
    expect(errors(v => { v.scenes = v.scenes.slice(0, 3) })).not.toEqual([])
    expect(errors(v => { v.scenes.reverse() })).not.toEqual([])
    expect(errors(v => { v.checks[0].answer = 8 })).not.toEqual([])
    expect(errors(v => { v.scenes[0] = { kind: 'card', role: 'problem', heading: '', body: '', say: '短' } })).not.toEqual([])
    expect(errors(v => { const s = v.scenes[2]; if (s.kind === 'memory') s.steps[1] = { ...s.steps[0], say: s.steps[1].say } })).not.toEqual([])
    expect(errors(v => {
      const s = v.scenes[2]
      if (s.kind === 'memory') {
        const cell = s.steps[0].cells[0]
        s.steps[1] = { ...s.steps[0], cells: [{ value: cell.value, label: cell.label, id: cell.id, region: cell.region }], say: s.steps[1].say }
      }
    })).not.toEqual([])
  })
  it('rejects invalid visual references and malformed model output', () => {
    expect(errors(v => { const s = v.scenes[2]; if (s.kind === 'memory') s.steps[0].arrows = [{ from: 'x', to: 'missing' }] })).not.toEqual([])
    const array = structuredClone(recursion) as ExplainerVideo
    const scene = array.scenes[2]
    if (scene.kind === 'array') scene.steps[0].pointers = { '9': 'p' }
    expect(validateVideo(array)).not.toEqual([])
    expect(validateVideo({ source: 'ai', scenes: [null] })).not.toEqual([])
    expect(validateVideo({})).not.toEqual([])
  })
  it('checks the analogy, pitfall, visual length and total narration rules', () => {
    expect(errors(v => { v.scenes = v.scenes.filter(s => s.kind !== 'card' || s.role !== 'analogy') })).not.toEqual([])
    expect(errors(v => { v.scenes = v.scenes.filter(s => s.kind !== 'card' || s.role !== 'pitfall') })).not.toEqual([])
    expect(errors(v => { const s = v.scenes[2]; if (s.kind === 'memory') s.steps = s.steps.slice(0, 2) })).not.toEqual([])
    expect(errors(v => { for (const s of v.scenes) { if (s.kind === 'card') s.say = '这是八个字\u0000'; else s.steps.forEach(step => { step.say = '这是八个字\u0000' }) } })).not.toEqual([])
    expect(errors(v => { v.checks[0].options = ['a', 'b'] })).not.toEqual([])
    expect(errors(v => { v.checks[0].explanation = ' ' })).not.toEqual([])
  })
  it('checks trace positions and limits, memory references and array indices', () => {
    const demo = demoToVideo({ title: '演示', code: ['a'], steps: [{ say: '好', at: 1, vars: [] }] }, 'x', 'x')
    const trace = demo.scenes[0]
    if (trace.kind !== 'trace') throw new Error('expected trace')
    trace.steps[0].vars = Array.from({ length: 9 }, () => ({ name: 'x', value: '1' }))
    expect(validateVideo(demo)).not.toEqual([])
    trace.steps[0].vars = []
    trace.code = ['a'.repeat(81)]
    expect(validateVideo(demo)).not.toEqual([])
    expect(errors(v => { const s = v.scenes[2]; if (s.kind === 'memory') s.steps[0].focus = ['missing'] })).not.toEqual([])
    expect(errors(v => { const s = v.scenes[2]; if (s.kind === 'memory') s.steps[0].cells = Array.from({ length: 13 }, (_, i) => ({ id: String(i), label: '', value: '', region: 'stack' })) })).not.toEqual([])
    const array = structuredClone(recursion) as ExplainerVideo
    const scene = array.scenes[2]
    if (scene.kind === 'array') scene.steps[0].highlights = [-1]
    expect(validateVideo(array)).not.toEqual([])
  })
  it('preserves demo narration and skips rules 1–10 but checks visual bounds', () => {
    const block = { title: '演示', code: ['x'], steps: [{ say: '短', at: 1, vars: [] }, { say: '短', at: 1, vars: [] }] }
    const demo = demoToVideo(block, 'lesson', '课程')
    expect(demo.scenes[0]).toMatchObject({ lang: null, expectedOutput: '', steps: block.steps })
    expect(validateVideo(demo)).toEqual([])
    const scene = demo.scenes[0]
    if (scene.kind === 'trace') scene.steps[0].at = 2
    expect(validateVideo(demo)).not.toEqual([])
    demo.source = 'ai'
    expect(validateVideo(demo).some(e => e.includes('语言'))).toBe(true)
  })
  it('pinpoints scene, step and field shape in validation error messages', () => {
    const base = structuredClone(recursion) as unknown as Record<string, unknown>
    const scenes = base.scenes as Array<Record<string, unknown>>
    const trace = scenes[3]
    trace.code = 'not-an-array'
    ;(trace.steps as Array<Record<string, unknown>>)[1].vars = { n: '0' }
    ;(trace.steps as Array<Record<string, unknown>>)[1].stack = 'bad-stack'
    ;(trace.steps as Array<Record<string, unknown>>)[1].out = 123
    const errs = validateVideo(base)
    expect(errs.some(e => e.includes('场景4') && e.includes('code') && e.includes('字符串数组'))).toBe(true)
    expect(errs.some(e => e.includes('场景4 第2步') && e.includes('vars') && e.includes('{name,value}'))).toBe(true)
    expect(errs.some(e => e.includes('场景4 第2步') && e.includes('stack') && e.includes('字符串数组'))).toBe(true)
    expect(errs.some(e => e.includes('场景4 第2步') && e.includes('out') && e.includes('字符串'))).toBe(true)
  })
})

describe('normalizeVideoShape', () => {
  it('losslessly normalizes trace code strings, vars objects and step.output while preserving other fields', () => {
    const raw = structuredClone(recursion) as unknown as Record<string, unknown>
    const scenes = raw.scenes as Array<Record<string, unknown>>
    const origTrace = scenes[3]
    const origSteps = origTrace.steps as Array<Record<string, unknown>>
    origTrace.code = (origTrace.code as string[]).join('\n') + '\n'
    origSteps[0].vars = { n: 2 }
    origSteps[0].output = origSteps[0].out
    delete origSteps[0].out
    // When out is already present alongside output, keep existing out untouched
    origSteps[1].output = 'ignored-output'

    const normalized = normalizeVideoShape(raw) as ExplainerVideo
    expect(validateVideo(normalized)).toEqual([])
    const normTrace = normalized.scenes[3]
    expect(normTrace.kind).toBe('trace')
    if (normTrace.kind === 'trace') {
      expect(Array.isArray(normTrace.code)).toBe(true)
      expect(normTrace.code).toHaveLength(9)
      expect(normTrace.steps[0].vars).toEqual([{ name: 'n', value: '2' }])
      expect(normTrace.steps[0].out).toBe('enter 2\n')
      expect('output' in (normTrace.steps[0] as Record<string, unknown>)).toBe(false)
      expect(normTrace.steps[1].out).toBe('enter 1\nenter 0\n')
    }
    // Original input is not mutated
    expect(typeof origTrace.code).toBe('string')
  })
})

describe('shuffleVideoChecks', () => {
  it('reorders options with injected random while preserving answer identity', () => {
    const original = [{ stem: 'Q?', options: ['A', 'B', 'C', 'D'], answer: 0, explanation: 'Because A' }]
    const seq = [0.25, 0.5, 0]
    let i = 0
    const shuffled = shuffleVideoChecks(original, () => seq[i++])
    expect(shuffled).toHaveLength(1)
    expect(shuffled[0].options).not.toEqual(original[0].options)
    expect(shuffled[0].options.slice().sort()).toEqual(['A', 'B', 'C', 'D'])
    expect(shuffled[0].options[shuffled[0].answer]).toBe('A')
    expect(shuffled[0].answer).not.toBe(0)
    expect(original[0].answer).toBe(0)
  })
})
