import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { demoToVideo, validateVideo } from '../../../../shared/video'
import { collectDemo } from '../md'

it('checks actual lesson demos against the video visual safety rules', () => {
  const root = join(process.cwd(), 'content')
  let count = 0, playable = 0
  for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || entry.name !== 'lesson.md') continue
    const path = join(entry.parentPath, entry.name)
    for (const block of collectDemo(readFileSync(path, 'utf8'))) {
      count++
      const failures = validateVideo(demoToVideo(block, 'lesson', block.title))
      if (!failures.length) playable++
      else {
        const exceedsCodeLimits = block.code.length > 30 || block.code.some(line => Array.from(line.replace(/[\u0000-\u001f\u007f-\u009f]/g, '')).length > 80)
        expect(exceedsCodeLimits, path).toBe(true)
      }
    }
  }
  expect(count).toBeGreaterThan(200)
  expect(playable).toBeGreaterThan(200)
})
