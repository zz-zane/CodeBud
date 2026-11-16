import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import example from '../../../fixtures/video-pointer.json'
import type { ExplainerVideo } from '../../shared/video'
import { createVideoStore } from '../video/store'

const dirs: string[] = []
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); vi.restoreAllMocks() })

describe('video store', () => {
  it('keeps the newest sixty videos', () => {
    const dir = mkdtempSync(join(tmpdir(), 'video-store-test-')); dirs.push(dir)
    const store = createVideoStore(dir)
    for (let i = 0; i < 61; i++) store.add({ ...example, id: String(i), createdAt: i } as ExplainerVideo)
    expect(store.list()).toHaveLength(60)
    expect(store.list()[0].id).toBe('1')
  })
  it('preserves a corrupt file and refuses to overwrite it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'video-store-test-')); dirs.push(dir)
    const file = join(dir, 'videos.json')
    writeFileSync(file, '{broken')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const store = createVideoStore(dir)
    expect(() => store.add(example as ExplainerVideo)).toThrow()
    expect(readFileSync(file, 'utf8')).toBe('{broken')
    expect(readFileSync(file + '.bak', 'utf8')).toBe('{broken')
  })
  it('keeps an existing backup when preserving a corrupt current file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'video-store-test-')); dirs.push(dir)
    const file = join(dir, 'videos.json')
    writeFileSync(file, '{broken')
    writeFileSync(file + '.bak', 'older backup')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => createVideoStore(dir).list()).toThrow()
    expect(readFileSync(file + '.bak', 'utf8')).toBe('older backup')
    const saved = readdirSync(dir).find((name) => name.startsWith('videos.json.corrupt-'))
    expect(saved).toBeTruthy()
    expect(readFileSync(join(dir, saved!), 'utf8')).toBe('{broken')
  })
})
