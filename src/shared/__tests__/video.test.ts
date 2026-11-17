import { describe, expect, it } from 'vitest'
import recursion from '../../../fixtures/video-recursion.json'
import { normalizeVideoShape, shuffleVideoChecks, type ExplainerVideo } from '../video-legacy'

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
