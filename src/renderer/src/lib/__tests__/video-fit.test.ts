import { describe, expect, it } from 'vitest'
import { fitScale, fitStepScale, fitReadableScale, flipKeyframes, orderGroups, resetStageElements } from '../video-fit'

describe('video stage layout', () => {
  it('clamps fit and handles zero sizes', () => {
    expect(fitScale({ width: 100, height: 100 }, { width: 1000, height: 800 })).toBe(2.2)
    expect(fitScale({ width: 1500, height: 100 }, { width: 1000, height: 800 })).toBeLessThan(1)
    expect(fitScale({ width: 0, height: 100 }, { width: 1000, height: 800 })).toBe(1)
    expect(fitScale({ width: 1200, height: 600 }, { width: 280, height: 168 }, 0.2)).toBeCloseTo(0.20067, 4)
  })
  it('enlarges sparse frames without exceeding the available stage', () => {
    const scale = fitStepScale({ width: 1200, height: 500 }, { width: 300, height: 180 }, { width: 256, height: 112 }, { width: 1120, height: 500 })
    expect(scale * 256 / 1120).toBeGreaterThanOrEqual(0.45)
    expect(scale * 300).toBeLessThanOrEqual(1120 * 0.86)
  })
  it('keeps code-scene text at its original size and scrolls oversized content', () => {
    const content = { width: 1600, height: 900 }, stage = { width: 600, height: 400 }
    expect(fitReadableScale(content, content, content, stage, true)).toBe(0.85)
    expect(fitReadableScale(content, content, content, stage, false)).toBe(0.85)
    expect(fitReadableScale({ width: 50, height: 50 }, { width: 50, height: 50 }, { width: 50, height: 50 }, stage, true)).toBe(1.4)
  })
  it('returns FLIP offsets to zero and clears interrupted inline state', () => {
    expect(flipKeyframes({ left: 10, top: 20 }, { left: 110, top: 60 }, 2)).toEqual({ x: [-50, 0], y: [-20, 0] })
    expect(flipKeyframes({ left: -200, top: -100 }, { left: 100, top: 80 }, 1, { left: 80, top: 40, width: 200, height: 100 }, { left: 0, top: 0, width: 300, height: 200 })).toEqual({ x: [-80, 0], y: [-40, 0] })
    const cell = { style: { opacity: '0', transform: 'translateX(-500px)', boxShadow: 'red', visibility: 'visible' } }
    const arrow = { style: { strokeDasharray: '10', strokeDashoffset: '8', strokeWidth: '4' } }
    const scene = { querySelectorAll: (selector: string) => selector === '.arrow' ? [arrow] : [cell] } as unknown as ParentNode
    resetStageElements(scene)
    expect(cell.style).toEqual({ opacity: '', transform: '', boxShadow: '', visibility: '' })
    expect(arrow.style).toEqual({ strokeDasharray: '', strokeDashoffset: '', strokeWidth: '' })
  })
  it('puts a one-way source left while preserving contradictory order', () => {
    const groups = [{ id: 'a', title: '', kind: 'plain' as const }, { id: 'b', title: '', kind: 'plain' as const }]
    const cells = [{ id: 'x', group: 'a', value: '' }, { id: 'y', group: 'b', value: '' }]
    expect(orderGroups(groups, cells, [{ from: 'y', to: 'x' }]).map(g => g.id)).toEqual(['b', 'a'])
    expect(orderGroups(groups, cells, [{ from: 'y', to: 'x' }, { from: 'x', to: 'y' }]).map(g => g.id)).toEqual(['a', 'b'])
    expect(groups.map(g => g.id)).toEqual(['a', 'b'])
  })
})
