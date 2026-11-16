import { describe, expect, it } from 'vitest'
import { computeMemoryArrows, type MemoryCellBox } from '../memory-arrows'

function sampleCubicX(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3
}

function parseCubic(path: string): [number, number, number, number, number, number, number, number] {
  const nums = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
  expect(nums).toHaveLength(8)
  return nums as [number, number, number, number, number, number, number, number]
}

const sampleCells: MemoryCellBox[] = [
  { id: 'cur', left: 20, right: 160, top: 40, bottom: 100, region: 'stack' },
  { id: 'n1', left: 230, right: 380, top: 40, bottom: 100, region: 'heap' },
  { id: 'n2', left: 230, right: 380, top: 120, bottom: 180, region: 'heap' },
  { id: 'n3', left: 230, right: 380, top: 200, bottom: 260, region: 'heap' }
]

describe('computeMemoryArrows', () => {
  it('routes cross-region arrows from source right/left edge midpoint to target nearest edge midpoint', () => {
    const [forward, backward] = computeMemoryArrows(sampleCells, [
      { from: 'cur', to: 'n1' },
      { from: 'n2', to: 'cur' }
    ])
    const [fx1, fy1, , , , , fx2, fy2] = parseCubic(forward)
    expect([fx1, fy1, fx2, fy2]).toEqual([160, 70, 230, 70])

    const [bx1, by1, , , , , bx2, by2] = parseCubic(backward)
    expect([bx1, by1, bx2, by2]).toEqual([230, 150, 160, 70])
  })

  it('routes same-column arrows from right edge to right edge bowing outward without crossing cell text', () => {
    const [arc] = computeMemoryArrows(sampleCells, [{ from: 'n1', to: 'n3' }])
    const [x1, y1, cx1, cy1, cx2, cy2, x2, y2] = parseCubic(arc)
    expect([x1, y1, x2, y2]).toEqual([380, 70, 380, 230])
    expect(cy1).toBe(y1)
    expect(cy2).toBe(y2)
    expect(cx1).toBeGreaterThan(380)
    expect(cx2).toBeGreaterThan(380)
    for (const t of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      expect(sampleCubicX(x1, cx1, cx2, x2, t)).toBeGreaterThan(380)
    }
  })

  it('staggers bulge depth for multiple same-column arrows and clears wider middle cells', () => {
    const cells: MemoryCellBox[] = [
      { id: 'a', left: 200, right: 340, top: 40, bottom: 90, region: 'heap' },
      { id: 'wideMid', left: 200, right: 400, top: 110, bottom: 160, region: 'heap' },
      { id: 'b', left: 200, right: 340, top: 180, bottom: 230, region: 'heap' }
    ]
    const [first, second] = computeMemoryArrows(cells, [
      { from: 'a', to: 'b' },
      { from: 'wideMid', to: 'b' }
    ])
    const p1 = parseCubic(first)
    const p2 = parseCubic(second)
    expect(p1[0]).toBe(340)
    expect(p1[6]).toBe(340)
    expect(sampleCubicX(p1[0], p1[2], p1[4], p1[6], 0.5)).toBeGreaterThan(400)
    expect(p2[2]).toBeGreaterThan(p1[2])
  })

  it('handles unknown endpoints and self-loops gracefully', () => {
    const paths = computeMemoryArrows(sampleCells, [
      { from: 'missing', to: 'n1' },
      { from: 'n1', to: 'n1' }
    ])
    expect(paths).toHaveLength(1)
    const [x1, y1, cx1, , , , x2, y2] = parseCubic(paths[0])
    expect(x1).toBe(380)
    expect(x2).toBe(380)
    expect(y1).toBeLessThan(y2)
    expect(cx1).toBeGreaterThan(380)
  })
})
