import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import type { ExplainerVideo } from '../../../../shared/video'

it('places the inserted carriage between its predecessor and successor without reversing the links', () => {
  const video = JSON.parse(readFileSync('content/animations/linked-list-insert.json', 'utf8')) as ExplainerVideo
  const step = video.acts[0].steps[2]
  expect(step.cells.map(cell => cell.id)).toEqual(['n1', 'n2', 'n3'])
  expect(step.arrows).toEqual([{ from: 'n1', to: 'n3' }, { from: 'n2', to: 'n3' }])
})
