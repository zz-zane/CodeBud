import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { createMainContext } from '../context'
import { recordStudyUsage } from '../study/usage'
import { DEFAULT_APP_CONFIG } from '../../shared/types'

vi.mock('electron', () => ({
  app: { isPackaged: false },
  BrowserWindow: { getAllWindows: () => [] },
  nativeTheme: {},
  safeStorage: { isEncryptionAvailable: () => false }
}))
vi.mock('../study/usage', () => ({ recordStudyUsage: vi.fn() }))

const root = resolve('outputs/codebud-prompt-once-tests')
let dir: string
beforeEach(() => {
  mkdirSync(root, { recursive: true })
  dir = mkdtempSync(join(root, 'case-'))
  vi.stubGlobal('__STUDY_LESSON_IDS__', [])
  vi.clearAllMocks()
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  if (!resolve(dir).startsWith(root + sep)) throw new Error('Invalid cleanup path')
  rmSync(dir, { recursive: true, force: true })
})

it('routes a one-shot native request with context, cancellation and usage', async () => {
  const ctx = createMainContext({ storageDir: dir, studyMathPath: '', rendererDir: '' })
  const run = vi.spyOn(ctx.study.harness, 'runTurn').mockImplementation(async args => {
    args.onUsage?.({ inputTokens: 2, outputTokens: 3, cachedInputTokens: 0, totalTokens: 5 })
    return { ok: true, data: { text: 'native reply' } } as never
  })
  const signal = new AbortController().signal
  expect(await ctx.study.promptOnce('my prompt', signal, 'video')).toBe('native reply')
  expect(run).toHaveBeenCalledOnce()
  const args = run.mock.calls[0][0]
  expect(args.sessionId).toMatch(/^video-/)
  expect(args.prompt).toContain('my prompt')
  expect(args.signal).toBe(signal)
  expect(args.timeoutMs).toBe(90_000)
  expect(recordStudyUsage).toHaveBeenCalledOnce()
})

it('future config is readable but all writes preserve the original bytes', () => {
  const file = join(dir, 'config.json')
  const newer = JSON.stringify({ version: 999, soundEnabled: false, future: 'keep' })
  writeFileSync(file, newer)
  const ctx = createMainContext({ storageDir: dir, studyMathPath: '', rendererDir: '' })
  expect(ctx.readConfig().version).toBe(999)
  expect(ctx.readPublicConfig().version).toBe(999)
  expect(() => ctx.configStore.write(ctx.readConfig(false))).toThrow('数据来自较新版本')
  expect(readFileSync(file, 'utf8')).toBe(newer)
})

it('invalid config shape is preserved before recovering a backup', () => {
  const file = join(dir, 'config.json')
  writeFileSync(file, '[]')
  writeFileSync(file + '.bak', JSON.stringify({ version: 25, soundEnabled: false }))
  const ctx = createMainContext({ storageDir: dir, studyMathPath: '', rendererDir: '' })
  expect(ctx.readConfig(false).soundEnabled).toBe(false)
  const saved = readdirSync(dir).find(name => name.startsWith('config.json.corrupt-'))
  expect(saved).toBeTruthy()
  expect(readFileSync(join(dir, saved!), 'utf8')).toBe('[]')
})

it('corrupt config without backup returns defaults and preserves the original', () => {
  const file = join(dir, 'config.json')
  writeFileSync(file, '{broken')
  const ctx = createMainContext({ storageDir: dir, studyMathPath: '', rendererDir: '' })
  expect(ctx.readConfig(false)).toEqual(DEFAULT_APP_CONFIG)
  const saved = readdirSync(dir).find(name => name.startsWith('config.json.corrupt-'))
  expect(saved).toBeTruthy()
  expect(readFileSync(join(dir, saved!), 'utf8')).toBe('{broken')
})

it('readConfig with secrets does not throw when corrupt config was preserved and no backup exists', () => {
  writeFileSync(join(dir, 'config.json'), '{broken')
  const ctx = createMainContext({ storageDir: dir, studyMathPath: '', rendererDir: '' })
  expect(() => ctx.readConfig()).not.toThrow()
  expect(readdirSync(dir).some(name => name.startsWith('config.json.corrupt-'))).toBe(true)
})

it('routes the selected ACP connection and records its usage', async () => {
  const ctx = createMainContext({ storageDir: dir, studyMathPath: '', rendererDir: '' })
  const state = ctx.study.store.read()
  vi.spyOn(ctx.study.store, 'read').mockReturnValue({ ...state, activeConnectionId: 'test', connections: [{ id: 'test', kind: 'custom', label: 'example' } as never] })
  const prompt = vi.spyOn(ctx.study.connections, 'prompt').mockResolvedValue({ text: 'acp reply', usage: { inputTokens: 1, outputTokens: 2, cachedInputTokens: 0, totalTokens: 3 } } as never)
  const native = vi.spyOn(ctx.study.harness, 'runTurn')
  const signal = new AbortController().signal
  expect(await ctx.study.promptOnce('acp prompt', signal, 'video')).toBe('acp reply')
  expect(prompt.mock.calls[0][0]).toMatch(/^video-/)
  expect(prompt.mock.calls[0][1]).toContain('acp prompt')
  expect(prompt.mock.calls[0][2]).toBe(signal)
  expect(native).not.toHaveBeenCalled()
  expect(recordStudyUsage).toHaveBeenCalledOnce()
})
