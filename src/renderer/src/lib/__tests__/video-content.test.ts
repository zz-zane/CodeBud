import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { demoToVideo, validateVideo } from '../../../../shared/video'
import { collectDemo } from '../md'

it('rejects legacy lesson demos under the v2 video rules', () => {
  const root = join(process.cwd(), 'content')
  let count = 0
  for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || entry.name !== 'lesson.md') continue
    const path = join(entry.parentPath, entry.name)
    for (const block of collectDemo(readFileSync(path, 'utf8'))) {
      count++
      expect(validateVideo(demoToVideo(block, 'lesson', block.title)), path).not.toEqual([])
    }
  }
  expect(count).toBeGreaterThan(200)
})
