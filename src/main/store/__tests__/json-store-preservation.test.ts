import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it, vi } from 'vitest'

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return { ...actual, copyFileSync: (from: string, to: string, flags?: number) => {
    if (to.includes('.corrupt-')) throw new Error('cannot preserve')
    return actual.copyFileSync(from, to, flags)
  } }
})

import { createJsonStore } from '../json-store'

it('preservation failure stops backup recovery without changing the corrupt original', () => {
  const dir = mkdtempSync(join(tmpdir(), 'miai-preserve-'))
  const file = join(dir, 'data.json')
  try {
    writeFileSync(file, '{broken')
    writeFileSync(file + '.bak', '{"old":true}')
    const store = createJsonStore(dir, 'data.json')
    expect(() => store.read()).toThrow()
    expect(readFileSync(file, 'utf8')).toBe('{broken')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
