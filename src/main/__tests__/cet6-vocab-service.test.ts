import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { createCet6VocabService } from '../cet6-vocab'

const input = { text: 'resilient', context: 'Children are resilient.', source: { examId: '2026-06-1', sectionType: 'reading' } }
const dirs: string[] = []
function service(): ReturnType<typeof createCet6VocabService> {
  const dir = mkdtempSync(join(tmpdir(), 'cet6-vocab-'))
  dirs.push(dir)
  return createCet6VocabService(dir, async () => ({ ok: true, text: '{"phonetic":"/rɪˈzɪliənt/","pos":"adj.","meaning":"有韧性的"}' }))
}
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }) })

describe('生词本：查释义不自动加入，点「加入」才加', () => {
  it('查释义返回释义但不写进生词本', async () => {
    const s = service()
    const res = await s.lookup(input)
    expect(res.ok && res.entry.gloss?.meaning).toBe('有韧性的')
    expect(res.ok && res.added).toBe(false)
    expect(s.list()).toHaveLength(0)
  })

  it('查过再加入：带上刚查到的释义，不用再问 AI', async () => {
    const s = service()
    await s.lookup(input)
    const entries = s.add(input)
    expect(entries).toHaveLength(1)
    expect(entries[0].gloss?.meaning).toBe('有韧性的')
  })

  it('已在生词本的词再查一次会刷新它的释义', async () => {
    const s = service()
    s.add(input)
    expect(s.list()[0].gloss).toBeNull()
    await s.lookup(input)
    expect(s.list()[0].gloss?.meaning).toBe('有韧性的')
  })
})
