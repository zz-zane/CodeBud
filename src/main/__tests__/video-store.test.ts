import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import example from '../../../fixtures/video-pointer.json'
import oldExample from '../../../fixtures/video-recursion.json'
import type { ExplainerVideo } from '../../shared/video'
import { createVideoStore } from '../video/store'

const dirs: string[] = []
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); vi.restoreAllMocks() })

describe('video store', () => {
  it('keeps the newest sixty videos', () => {
    const dir = mkdtempSync(join(tmpdir(), 'video-store-test-')); dirs.push(dir)
    const store = createVideoStore(dir)
    for (let i = 0; i < 61; i++) store.add({ ...example, source: 'ai', id: String(i), createdAt: i } as ExplainerVideo)
    expect(store.list()).toHaveLength(60)
    expect(store.list()[0].id).toBe('1')
  })
  it('skips only structurally invalid entries and preserves them when writing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'video-store-test-')); dirs.push(dir)
    const file = join(dir, 'videos.json')
    const valid = { ...structuredClone(example), source: 'ai', id: 'valid' }
    const quality = { ...structuredClone(example), source: 'ai', id: 'quality' }
    quality.acts[0].steps[2].groups.forEach(group => { group.kind = 'frame' })
    const damaged = { ...structuredClone(example), source: 'ai', id: 'damaged', extra: { keep: [1, 'original'] } }
    damaged.acts[0].steps[2].arrows[0].to = 'missing'
    const original = JSON.stringify({ version: 2, videos: [damaged, quality, valid] })
    writeFileSync(file, original)
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const store = createVideoStore(dir)
    expect(store.list().map(video => video.id)).toEqual(['quality', 'valid'])
    expect(warning).toHaveBeenCalled()
    expect(readFileSync(file, 'utf8')).toBe(original)
    store.delete('does-not-exist')
    const saved = JSON.parse(readFileSync(file, 'utf8')).videos
    expect(saved).toHaveLength(3)
    expect(saved).toEqual([damaged, quality, valid])
    expect(saved.find((item: { id: string }) => item.id === 'damaged')).toEqual(damaged)
    expect(saved.find((item: { id: string }) => item.id === 'quality')).toEqual(quality)
    expect(store.list().map(video => video.id)).toEqual(['quality', 'valid'])
    store.add({ ...example, source: 'ai', id: 'new' } as ExplainerVideo)
    store.delete('new')
    expect(JSON.parse(readFileSync(file, 'utf8')).videos.find((item: { id: string }) => item.id === 'damaged')).toEqual(damaged)
  })
  it('migrates v1 without writing until a mutation and preserves the original backup', () => {
    const dir = mkdtempSync(join(tmpdir(), 'video-store-test-')); dirs.push(dir)
    const file = join(dir, 'videos.json')
    const original = JSON.stringify({ version: 1, videos: [oldExample] })
    writeFileSync(file, original)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const store = createVideoStore(dir)
    expect(store.list()[0].acts).toHaveLength(2)
    expect(readFileSync(file, 'utf8')).toBe(original)
    store.add({ ...example, source: 'ai' } as ExplainerVideo)
    expect(readFileSync(file + '.bak', 'utf8')).toBe(original)
    expect(JSON.parse(readFileSync(file, 'utf8')).version).toBe(2)
    expect(store.list()).toHaveLength(2)
    const archive = readdirSync(dir).find(name => name.startsWith('videos.json.v1-'))!
    store.delete(example.id)
    expect(readFileSync(join(dir, archive), 'utf8')).toBe(original)
  })
  it('reads a compatible unknown version but refuses all writes without altering files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'video-store-test-')); dirs.push(dir)
    const file = join(dir, 'videos.json')
    const original = JSON.stringify({ version: 99, videos: [{ ...example, source: 'ai' }] })
    writeFileSync(file, original)
    const store = createVideoStore(dir)
    expect(store.list()).toHaveLength(1)
    expect(() => store.delete(example.id)).toThrow(/只能读取/)
    expect(() => store.add({ ...example, source: 'ai' } as ExplainerVideo)).toThrow(/只能读取/)
    expect(readFileSync(file, 'utf8')).toBe(original)
    expect(readdirSync(dir)).toEqual(['videos.json'])
  })
  it('does not create backups or modify an unreadable unknown version', () => {
    const dir = mkdtempSync(join(tmpdir(), 'video-store-test-')); dirs.push(dir)
    const file = join(dir, 'videos.json')
    const original = JSON.stringify({ version: 'future', videos: [{}] })
    writeFileSync(file, original)
    expect(() => createVideoStore(dir).list()).toThrow()
    expect(readFileSync(file, 'utf8')).toBe(original)
    expect(readdirSync(dir)).toEqual(['videos.json'])
  })
  it('preserves a corrupt file and refuses to overwrite it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'video-store-test-')); dirs.push(dir)
    const file = join(dir, 'videos.json')
    writeFileSync(file, '{broken')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const store = createVideoStore(dir)
    expect(() => store.add({ ...example, source: 'ai' } as ExplainerVideo)).toThrow()
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
