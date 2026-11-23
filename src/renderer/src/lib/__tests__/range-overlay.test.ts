import { describe, expect, it } from 'vitest'
import { mergeLineRects } from '../range-overlay'

describe('覆盖层：同一行的矩形并成一个', () => {
  it('同行的多个片段合并、不同行分开、零宽丢掉，按从上到下排', () => {
    const rows = mergeLineRects([
      { left: 120, top: 40, right: 200, bottom: 60 },
      { left: 10, top: 10, right: 80, bottom: 30 },
      { left: 80, top: 11, right: 150, bottom: 31 },
      { left: 50, top: 70, right: 50.2, bottom: 90 }
    ])
    expect(rows).toEqual([
      { left: 10, top: 10, right: 150, bottom: 31 },
      { left: 120, top: 40, right: 200, bottom: 60 }
    ])
  })
})
