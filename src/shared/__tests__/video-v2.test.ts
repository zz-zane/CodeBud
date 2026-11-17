import { describe, expect, it } from 'vitest'
import pointer from '../../../fixtures/video-pointer.json'
import recursion from '../../../fixtures/video-recursion.json'
import oldPointer from '../../../fixtures/video-v1-pointer.json'
import { migrateVideoV1, validateMigratedVideo, validateVideo, validateVideoStructure, type ExplainerVideo } from '../video'

const valid = (): ExplainerVideo => structuredClone(pointer) as ExplainerVideo
const rejected = (change: (v: ExplainerVideo) => void): void => {
  const video = valid()
  change(video)
  expect(validateVideo(video)).not.toEqual([])
}

describe('v2 video validation', () => {
  it('accepts the complete pointer storyboard', () => {
    expect(validateVideo(valid())).toEqual([])
  })
  it('rejects limits, missing code, questions and motion', () => {
    rejected(v => { v.acts = [] })
    rejected(v => { v.acts[0].steps = v.acts[0].steps.slice(0, 1) })
    rejected(v => { v.acts[1].code = undefined })
    rejected(v => { v.acts[1].steps[0].line = 99 })
    rejected(v => { for (const act of v.acts) for (const s of act.steps) { delete s.ask } })
    rejected(v => { v.acts[0].steps[3].ask!.answer = 3 })
    rejected(v => { for (const act of v.acts) for (const s of act.steps) { s.arrows = []; delete s.fly } })
  })
  it('rejects unchanged frames, missing references, excessive text, and spoken symbols', () => {
    rejected(v => { v.acts[0].steps[1] = { ...v.acts[0].steps[0], say: v.acts[0].steps[1].say } })
    rejected(v => { v.acts[0].steps[0].cells = [] })
    rejected(v => { v.acts[0].steps[0].cells[0].group = 'missing' })
    rejected(v => { v.acts[0].steps[2].arrows[0].to = 'missing' })
    rejected(v => { v.acts[0].steps[1].focus = ['missing'] })
    rejected(v => { v.acts[0].steps[3].fly!.to = 'missing' })
    rejected(v => { v.acts[0].steps[1].note!.at = 'missing' })
    rejected(v => { v.acts[0].steps[0].say = '星号 p 表示这个变量的内容。' })
    rejected(v => { v.acts[0].steps[0].say = '短' })
    rejected(v => { v.title = '长'.repeat(31) })
    rejected(v => { v.acts[0].steps[1].note!.text = '长'.repeat(21) })
  })
  it('rejects demo and malformed input', () => {
    expect(validateVideo({ ...valid(), source: 'demo' })).not.toEqual([])
    expect(validateVideo({ acts: [null] })).not.toEqual([])
    expect(validateVideo(null)).not.toEqual([])
    const cyclic = valid() as unknown as Record<string, unknown>
    const acts = cyclic.acts as Array<{ steps: Array<Record<string, unknown>> }>
    acts[0].steps[0].line = cyclic
    expect(() => validateVideo(cyclic)).not.toThrow()
    expect(validateVideo(cyclic)).not.toEqual([])
  })
  it('validates follow, open, metadata and arrows across distinct frames', () => {
    rejected(v => { v.acts[0].steps[2].follow = 'missing' })
    rejected(v => { v.acts[0].steps[2].open = ['missing'] })
    rejected(v => { v.keywords = [7 as unknown as string] })
    rejected(v => {
      const s = v.acts[0].steps[2]
      s.groups = [{ id: 'a', title: '', kind: 'frame' }, { id: 'b', title: '', kind: 'frame' }]
      s.cells = [{ id: 'x', group: 'a', value: '1' }, { id: 'y', group: 'b', value: '2' }]
      s.arrows = [{ from: 'x', to: 'y' }]
    })
  })
  it('accepts quality-only differences for safe playback but rejects broken references', () => {
    const video = valid(), step = video.acts[0].steps[2]
    step.groups.forEach(group => { group.kind = 'frame' })
    step.follow = 'not-an-arrow-source'
    expect(validateVideo(video)).not.toEqual([])
    expect(validateVideoStructure(video)).toEqual([])
    step.arrows[0].to = 'missing'
    expect(validateVideoStructure(video)).not.toEqual([])
  })
})

describe('v1 migration', () => {
  it('converts visual scenes and checks without mutating the input, reporting trailing cards', () => {
    const before = structuredClone(recursion)
    const { video, warnings } = migrateVideoV1(recursion)
    expect(recursion).toEqual(before)
    expect(video.acts[0].steps[0].say).toContain(recursion.scenes[0].say)
    expect(video.acts[0].steps[0].cells[0]).toMatchObject({ group: 'array', value: 'f(2)' })
    expect(video.acts[1].code?.lang).toBe('python')
    expect(video.acts[1].steps[0].cells[0]).toMatchObject({ group: 'frame', name: 'n', value: '2' })
    expect(video.acts[1].steps.at(-1)?.ask?.why).toBe(recursion.checks[0].explanation)
    expect(warnings).toHaveLength(1)
    expect(validateMigratedVideo(video)).toEqual([])
  })
  it('maps stack, heap and references and preserves multiple checks', () => {
    const old = structuredClone(oldPointer)
    old.checks.push(structuredClone(old.checks[0]))
    const memory = old.scenes[2] as { steps: Array<{ cells: Array<{ id: string; label: string; value: string; region: string }>; arrows: Array<{ from: string; to: string }> }> }
    memory.steps[0].cells.push({ id: 'heap-cell', label: 'value', value: '2', region: 'heap' })
    memory.steps[0].arrows.push({ from: 'x', to: 'heap-cell' })
    const { video } = migrateVideoV1(old)
    expect(video.acts[0].steps[0].cells).toContainEqual({ id: 'heap-cell', group: 'heap', name: 'value', value: '2' })
    expect(video.acts[0].steps[0].arrows).toContainEqual({ from: 'x', to: 'heap-cell' })
    expect(video.acts[0].steps.filter(step => step.ask)).toHaveLength(2)
  })
})
