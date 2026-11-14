// 六级生词本存储与 AI 查询（docs/27 §8.3）。cet6-vocab.json，主进程是唯一写方。
// 纯 Node（不依赖 electron）：AI 调用由 features/cet6.ts 以 `ask` 注入。
import { copyFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildLookupPrompt,
  classifyText,
  normalizeVocabFile,
  parseGloss,
  removeEntries,
  sanitizeVocabInput,
  updateEntry,
  upsertEntry,
  type Cet6LookupFail,
  type Cet6LookupResult,
  type Cet6VocabEntry,
  type Cet6VocabFile
} from '../shared/cet6-vocab'
import { createJsonStore } from './store/json-store'

export type VocabAsk = (prompt: string) => Promise<{ ok: true; text: string } | { ok: false; reason: Exclude<Cet6LookupFail, 'bad-response' | 'full'> }>

export interface Cet6VocabService {
  list(): Cet6VocabEntry[]
  add(input: unknown): Cet6VocabEntry[]
  update(id: unknown, patch: unknown): Cet6VocabEntry[]
  remove(ids: unknown): Cet6VocabEntry[]
  lookup(input: unknown): Promise<Cet6LookupResult>
}

export function createCet6VocabService(dir: string, ask: VocabAsk): Cet6VocabService {
  const store = createJsonStore<Cet6VocabFile>(dir, 'cet6-vocab.json')
  const file = join(dir, 'cet6-vocab.json')
  let backedUp = false

  function load(): Cet6VocabFile {
    const raw = store.read()
    if (raw === null) {
      if (existsSync(file) && !backedUp) {
        // 文件在但读不出：留日志并另存一份，绝不静默用空档覆盖
        backedUp = true
        console.error('[miai] cet6-vocab| cet6-vocab.json unreadable, keeping a copy as cet6-vocab.json.corrupt')
        try {
          copyFileSync(file, file + '.corrupt')
        } catch (err) {
          console.error('[miai] cet6-vocab| backup of corrupt file failed', err)
        }
      }
      return { version: 1, entries: [] }
    }
    return normalizeVocabFile(raw)
  }

  function assertInput(raw: unknown): NonNullable<ReturnType<typeof sanitizeVocabInput>> {
    const input = sanitizeVocabInput(raw)
    if (!input) throw new Error('cet6-vocab: invalid input')
    return input
  }

  return {
    list: () => load().entries,
    add(raw) {
      const input = assertInput(raw)
      const res = upsertEntry(load(), input, null, crypto.randomUUID(), new Date().toISOString())
      if (!res.ok) throw new Error('cet6-vocab: full')
      if (res.added) store.write(res.file)
      return res.file.entries
    },
    update(id, patch) {
      if (typeof id !== 'string' || id.length === 0 || id.length > 100) throw new Error('cet6-vocab: invalid id')
      if (typeof patch !== 'object' || patch === null || typeof (patch as { mastered?: unknown }).mastered !== 'boolean') {
        throw new Error('cet6-vocab: invalid patch')
      }
      const next = updateEntry(load(), id, patch as { mastered: boolean })
      store.write(next)
      return next.entries
    },
    remove(ids) {
      if (!Array.isArray(ids) || ids.length > 5000 || ids.some((x) => typeof x !== 'string')) throw new Error('cet6-vocab: invalid ids')
      const next = removeEntries(load(), ids as string[])
      store.write(next)
      return next.entries
    },
    async lookup(raw) {
      const input = assertInput(raw)
      const answer = await ask(buildLookupPrompt(input))
      if (!answer.ok) return { ok: false, reason: answer.reason }
      const now = new Date().toISOString()
      const gloss = parseGloss(answer.text, classifyText(input.text), now)
      if (!gloss) return { ok: false, reason: 'bad-response' }
      // 等待 AI 期间文件可能已被改过：写入前重新读盘，同步完成读改写，不会丢更新
      const res = upsertEntry(load(), input, gloss, crypto.randomUUID(), now)
      if (!res.ok) return { ok: false, reason: 'full' }
      store.write(res.file)
      return { ok: true, entry: res.entry, added: res.added }
    }
  }
}
