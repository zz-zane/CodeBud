import { describe, expect, it } from 'vitest'
import { currentAgySelection, groupAgyModels, joinAgyModelId, pickAgyModelId, splitAgyModelId, strengthsOf } from '../agy-models'

const models = [
  { id: 'gemini-4-argon-medium', name: 'Gemini 4 Argon (Medium)' }, { id: 'gemini-4-argon-high', name: 'Gemini 4 Argon (High)' }, { id: 'gemini-4-argon-low', name: 'Gemini 4 Argon (Low)' },
  { id: 'gemini-3.8-flash-high', name: 'Gemini 3.8 Flash (High)' }, { id: 'gemini-3.8-flash-low', name: 'Gemini 3.8 Flash (Low)' },
  { id: 'gpt-oss-120b-medium', name: 'GPT-OSS 120B (Medium)' }, { id: 'plain-model', name: 'Plain' }
]

describe('agy model ids', () => {
  it('splits the last segment into strength and recombines', () => {
    expect(splitAgyModelId('gemini-3.8-flash-high')).toEqual({ family: 'gemini-3.8-flash', strength: 'high' })
    expect(splitAgyModelId('plain-model')).toEqual({ family: 'plain-model', strength: null })
    expect(splitAgyModelId('x-highest')).toEqual({ family: 'x-highest', strength: null })
    expect(joinAgyModelId('gemini-3.8-flash', 'low')).toBe('gemini-3.8-flash-low')
    expect(joinAgyModelId('plain-model', null)).toBe('plain-model')
  })
  it('groups families in order with names stripped of the strength', () => {
    const f = groupAgyModels(models)
    expect(f.map(x => x.family)).toEqual(['gemini-4-argon', 'gemini-3.8-flash', 'gpt-oss-120b', 'plain-model'])
    expect(f[0].name).toBe('Gemini 4 Argon')
    expect(strengthsOf(f[0])).toEqual(['low', 'medium', 'high'])
    expect(strengthsOf(f[1])).toEqual(['low', 'high'])
    expect(strengthsOf(f[3])).toEqual([])
    expect(f[3].single).toBe('plain-model')
  })
  it('keeps the wanted strength, else falls back to medium, else the first available', () => {
    const [argon, flash, , plain] = groupAgyModels(models)
    expect(pickAgyModelId(argon, 'high')).toBe('gemini-4-argon-high')
    expect(pickAgyModelId(argon, null)).toBe('gemini-4-argon-medium')
    expect(pickAgyModelId(flash, 'medium')).toBe('gemini-3.8-flash-low')
    expect(pickAgyModelId(plain, 'high')).toBe('plain-model')
  })
  it('derives the current family and strength from the saved id', () => {
    expect(currentAgySelection(models, 'gemini-3.8-flash-low')).toMatchObject({ family: { family: 'gemini-3.8-flash' }, strength: 'low' })
    expect(currentAgySelection(models, 'plain-model')).toMatchObject({ family: { family: 'plain-model' }, strength: null })
    expect(currentAgySelection(models, 'unknown-high').family).toBeUndefined()
    expect(currentAgySelection(models, undefined).family).toBeUndefined()
  })
})
