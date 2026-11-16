import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getAppPath: () => process.cwd() },
  dialog: { showOpenDialog: vi.fn() },
  ipcMain: { handle: vi.fn() },
  protocol: { handle: vi.fn() }
}))

import { IPC } from '../../shared/ipc-channels'
import type { MainContext } from '../context'
import { lookupHandler } from '../ipc'
import { cet6Feature } from '../features/cet6'
import { createCet6Service } from '../cet6'

let storageDir: string

beforeEach(() => {
  storageDir = mkdtempSync(join(tmpdir(), 'cet6-feature-test-'))
})

afterEach(() => {
  rmSync(storageDir, { recursive: true, force: true })
})

function registerWithMock(opts: { apiKey?: string; promptOnce?: (p: string) => Promise<string> }) {
  const ctx = {
    storageDir,
    httpAssets: new Map(),
    readConfig: () => ({ ai: { apiKey: opts.apiKey ?? '' } }),
    study: {
      harness: { runTurn: vi.fn(), clearSession: vi.fn() },
      store: { read: () => ({ activeConnectionId: null }) },
      promptOnce: opts.promptOnce ?? vi.fn()
    }
  } as unknown as MainContext

  cet6Feature.register(ctx)
  lookupHandler(IPC.cet6SaveRecord)!({}, [REQ.examId, { answers: { [REQ.questionId]: REQ.answer }, marks: [], submitted: true, seconds: 0, mode: 'practice' }])
  return lookupHandler(IPC.cet6GradeSubjective)!
}

const REQ = {
  examId: '2026-06-1',
  questionId: 'q-writing',
  kind: 'writing' as const,
  prompt: 'Write an essay on lifelong learning.',
  answer: 'Lifelong learning keeps our mind sharp and adaptable.'
}

describe('cet6:grade-subjective handler', () => {
  it('returns no-key when neither AI key nor ACP connection is configured', async () => {
    const grade = registerWithMock({})
    const res = await grade({}, [REQ])
    expect(res).toEqual({ ok: false, reason: 'no-key' })
  })

  it('parses fake promptOnce JSON and persists AI grade into cet6 state', async () => {
    const grade = registerWithMock({
      apiKey: 'test-key',
      promptOnce: async () => '{"score": 12, "comment": "结构完整，过渡自然。"}'
    })
    const res = await grade({}, [REQ]) as { ok: true; grade: { score: number; comment: string; at: number } }
    expect(res.ok).toBe(true)
    expect(res.grade.score).toBe(12)
    expect(res.grade.comment).toBe('结构完整，过渡自然。')
    expect(typeof res.grade.at).toBe('number')

    const getState = lookupHandler(IPC.cet6GetState)!
    const state = await getState({}, []) as { records: Record<string, { aiGrades?: Record<string, { score: number }> }> }
    expect(state.records['2026-06-1']?.aiGrades?.['q-writing']?.score).toBe(12)
  })

  it('returns bad-response when promptOnce returns unparseable text', async () => {
    const grade = registerWithMock({
      apiKey: 'test-key',
      promptOnce: async () => 'not valid grading output'
    })
    const res = await grade({}, [REQ])
    expect(res).toEqual({ ok: false, reason: 'bad-response' })
  })

  it('returns network when promptOnce rejects', async () => {
    const grade = registerWithMock({
      apiKey: 'test-key',
      promptOnce: async () => {
        throw new Error('timeout')
      }
    })
    const res = await grade({}, [REQ])
    expect(res).toEqual({ ok: false, reason: 'network' })
  })

  it('discards a late grade after the exam was reset', async () => {
    let finish!: (value: string) => void
    const grade = registerWithMock({ apiKey: 'test-key', promptOnce: () => new Promise(resolve => { finish = resolve }) })
    const pending = grade({}, [REQ])
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    await lookupHandler(IPC.cet6ResetRecord)!({}, [REQ.examId])
    finish('{"score":12,"comment":"old answer"}')
    expect(await pending).toEqual({ ok: false, reason: 'stale' })
    const state = await lookupHandler(IPC.cet6GetState)!({}, []) as { records: Record<string, unknown> }
    expect(state.records[REQ.examId]).toBeUndefined()
  })

  it('discards a late grade when the submitted answer has changed', async () => {
    let finish!: (value: string) => void
    const grade = registerWithMock({ apiKey: 'test-key', promptOnce: () => new Promise(resolve => { finish = resolve }) })
    const pending = grade({}, [REQ])
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    await lookupHandler(IPC.cet6SaveRecord)!({}, [REQ.examId, { answers: { [REQ.questionId]: REQ.answer + ' ' }, marks: [], submitted: true, seconds: 0, mode: 'practice' }])
    finish('{"score":12,"comment":"old answer"}')
    expect(await pending).toEqual({ ok: false, reason: 'stale' })
    const state = await lookupHandler(IPC.cet6GetState)!({}, []) as { records: Record<string, { answers: Record<string, string>; aiGrades?: unknown }> }
    expect(state.records[REQ.examId].answers[REQ.questionId]).toBe(REQ.answer + ' ')
    expect(state.records[REQ.examId].aiGrades).toBeUndefined()
  })
})

describe('cet6 migration protection', () => {
  it('rejects a future version without touching the main file or using its backup', () => {
    const file = join(storageDir, 'cet6.json')
    const future = JSON.stringify({ version: 99, records: {}, future: 'keep' })
    writeFileSync(file, future)
    writeFileSync(file + '.bak', JSON.stringify({ version: 1, records: {} }))
    const service = createCet6Service(storageDir)
    expect(service.load().version).toBe(99)
    expect(service.state().readOnlyNewer).toBe(true)
    expect(() => service.setLastMode('exam')).toThrow('数据来自较新版本')
    expect(readFileSync(file, 'utf8')).toBe(future)
    expect(readdirSync(storageDir).some(name => name.includes('.corrupt-'))).toBe(false)
  })

  it('preserves malformed records before rebuilding an empty state', () => {
    const file = join(storageDir, 'cet6.json')
    const original = JSON.stringify({ version: 1, records: { '2026-06-1': { answers: { q: 3 } } } })
    writeFileSync(file, original)
    const service = createCet6Service(storageDir)
    expect(service.load().records).toEqual({})
    expect(readFileSync(file, 'utf8')).toBe(original)
    const backup = readdirSync(storageDir).find(name => name.startsWith('cet6.json.corrupt-'))
    expect(backup).toBeTruthy()
    expect(readFileSync(join(storageDir, backup!), 'utf8')).toBe(original)
    expect(service.setLastMode('exam')).toBe('exam')
    expect(service.load().records).toEqual({})
  })

  it('preserves a corrupt file without backup and returns an empty state', () => {
    const file = join(storageDir, 'cet6.json')
    writeFileSync(file, '{broken')
    const state = createCet6Service(storageDir).state()
    expect(state.records).toEqual({})
    const saved = readdirSync(storageDir).find(name => name.startsWith('cet6.json.corrupt-'))
    expect(saved).toBeTruthy()
    expect(readFileSync(join(storageDir, saved!), 'utf8')).toBe('{broken')
  })

  it('recovers a valid backup after preserving malformed record data', () => {
    const file = join(storageDir, 'cet6.json')
    const original = JSON.stringify({ version: 1, records: { '2026-06-1': { answers: { q: 3 } } } })
    writeFileSync(file, original)
    writeFileSync(file + '.bak', JSON.stringify({ version: 1, records: {}, lastMode: 'exam' }))
    const state = createCet6Service(storageDir).state()
    expect(state.lastMode).toBe('exam')
    const saved = readdirSync(storageDir).find(name => name.startsWith('cet6.json.corrupt-'))
    expect(saved).toBeTruthy()
    expect(readFileSync(join(storageDir, saved!), 'utf8')).toBe(original)
  })

  it('does not restore an older backup when a future schema cannot be read', () => {
    const file = join(storageDir, 'cet6.json')
    const future = JSON.stringify({ version: 99, records: 'new shape' })
    writeFileSync(file, future)
    writeFileSync(file + '.bak', JSON.stringify({ version: 1, records: {} }))
    expect(() => createCet6Service(storageDir).load()).toThrow('数据来自较新版本')
    expect(readFileSync(file, 'utf8')).toBe(future)
    expect(readdirSync(storageDir).some(name => name.includes('.corrupt-'))).toBe(false)
  })
})
