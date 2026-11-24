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
  vocabKey,
  gradeEntry,
  VOCAB_GRADES,
  type Cet6VocabGrade,
  type Cet6Gloss,
  type Cet6LookupFail,
  type Cet6LookupResult,
  type Cet6VocabEntry,
  type Cet6VocabFile
} from '../shared/cet6-vocab'
import { createJsonStore } from './store/json-store'
import { todayKey } from '../shared/dates'

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
      return { version: 2, entries: [] }
    }
    return normalizeVocabFile(raw)
  }

  function assertInput(raw: unknown): NonNullable<ReturnType<typeof sanitizeVocabInput>> {
    const input = sanitizeVocabInput(raw)
    if (!input) throw new Error('cet6-vocab: invalid input')
    return input
  }

  // 最近查过的释义，加入生词本时复用；只在内存里，重启即清
  const glossCache = new Map<string, Cet6Gloss>()
  function remember(key: string, gloss: Cet6Gloss): void {
    glossCache.delete(key)
    glossCache.set(key, gloss)
    if (glossCache.size > 200) glossCache.delete(glossCache.keys().next().value as string)
  }

  return {
    list: () => load().entries,
    add(raw) {
      const input = assertInput(raw)
      const file = load()
      // 带上刚才「释义」查到的结果，省得再问一次 AI
      const res = upsertEntry(file, input, glossCache.get(vocabKey(input.text)) ?? null, crypto.randomUUID(), new Date().toISOString())
      if (!res.ok) throw new Error('cet6-vocab: full')
      if (res.file !== file) store.write(res.file)
      return res.file.entries
    },
    update(id, patch) {
      if (typeof id !== 'string' || id.length === 0 || id.length > 100) throw new Error('cet6-vocab: invalid id')
      const p = (typeof patch === 'object' && patch !== null ? patch : {}) as { mastered?: unknown; grade?: unknown }
      // 翻卡自评：今天按主进程时钟算，不信渲染层给的日期
      if (VOCAB_GRADES.includes(p.grade as Cet6VocabGrade)) {
        const graded = gradeEntry(load(), id, p.grade as Cet6VocabGrade, todayKey())
        store.write(graded)
        return graded.entries
      }
      if (typeof p.mastered !== 'boolean') throw new Error('cet6-vocab: invalid patch')
      const next = updateEntry(load(), id, { mastered: p.mastered })
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
      // 查释义不再自动加入生词本（2026-11-24 用户要求：点「加入生词本」才加）。已在生词本里的词顺手刷新释义。
      remember(vocabKey(input.text), gloss)
      const file = load()
      const res = upsertEntry(file, input, gloss, crypto.randomUUID(), now)
      if (res.ok && !res.added) store.write(res.file)
      const entry: Cet6VocabEntry = res.ok ? res.entry : { id: '', text: input.text, kind: classifyText(input.text), context: input.context, source: input.source, addedAt: now, mastered: false, gloss, review: null }
      return { ok: true, entry, added: false }
    }
  }
}
