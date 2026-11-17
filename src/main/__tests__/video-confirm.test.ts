import { beforeEach, expect, it, vi } from 'vitest'
import example from '../../../fixtures/video-pointer.json'
import { IPC } from '../../shared/ipc-channels'
import { videoFeature } from '../features/video'
import type { MainContext } from '../context'

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: any[]) => any>(),
  run: vi.fn(), native: vi.fn(), add: vi.fn()
}))
vi.mock('../ipc', () => ({ handle: (name: string, fn: (...args: any[]) => any) => mocks.handlers.set(name, fn) }))
vi.mock('../env/detect', () => ({ refreshLangs: async () => ({ report: { python: { found: true, path: 'python' } } }), nativeEnv: async () => ({}) }))
vi.mock('../runner/runner', () => ({ enqueueRunJob: (job: () => Promise<unknown>) => job(), runCode: mocks.run }))
vi.mock('../runner/native', () => ({ runCodeNative: mocks.native, nativeGateReason: (enabled: boolean, native: boolean) => native && !enabled ? 'native run disabled' : null }))
vi.mock('../video/store', () => ({ createVideoStore: () => ({ add: mocks.add, list: () => [], delete: () => {} }) }))

const input = { requestId: 'r', question: '指针是什么？' }
const judgment = JSON.stringify({ shouldAnimate: true, concept: '指针', actsPlan: [{ steps: 5 }, { steps: 6 }] })
const verifyCalls = (send: ReturnType<typeof vi.fn>) => send.mock.calls.filter(call => call[0] === IPC.videoVerifyPrompt)
const candidate = structuredClone(example) as any
candidate.acts[1].code = { lang: 'python', lines: ['print(1)', '# 2', '# 3', '# 4', '# 5', '# 6', '# 7'], expectedOutput: '1' }

beforeEach(() => { mocks.handlers.clear(); vi.clearAllMocks() })

it('shows the exact program and skips execution when confirmation is declined', async () => {
  const send = vi.fn()
  const event = { sender: { id: 1, send } }
  const ctx = { storageDir: 'unused', readConfig: () => ({ nativeRunEnabled: true, nativeRunQuiet: false, envCache: {} }),
    study: { promptOnce: async (_p: string, _s: AbortSignal, tag: string) => tag === 'video-judge' ? judgment : JSON.stringify(candidate) } } as unknown as MainContext
  videoFeature.register(ctx)
  const result = mocks.handlers.get(IPC.videoGenerate)!(event, input)
  await vi.waitFor(() => expect(verifyCalls(send)).toHaveLength(1))
  const [channel, prompt] = verifyCalls(send)[0]
  expect(channel).toBe(IPC.videoVerifyPrompt)
  expect(prompt.code).toEqual(candidate.acts[1].code.lines)
  expect(mocks.handlers.get(IPC.videoVerifyAnswer)!({ sender: { id: 2 } }, prompt.confirmationId, true)).toEqual({ ok: false })
  expect(mocks.handlers.get(IPC.videoVerifyAnswer)!(event, prompt.confirmationId, null)).toEqual({ ok: true })
  expect((await result).video.codeVerified).toBe(false)
  expect(mocks.run).not.toHaveBeenCalled()
  expect(mocks.native).not.toHaveBeenCalled()
  expect(mocks.add).toHaveBeenCalledOnce()
})

it('runs the selected managed toolchain only after confirmation', async () => {
  const send = vi.fn()
  const event = { sender: { id: 1, send } }
  const ctx = { storageDir: 'unused', readConfig: () => ({ nativeRunEnabled: true, nativeRunQuiet: false, envCache: {} }),
    study: { promptOnce: async (_p: string, _s: AbortSignal, tag: string) => tag === 'video-judge' ? judgment : JSON.stringify(candidate) } } as unknown as MainContext
  mocks.run.mockResolvedValue({ ok: true, stdout: '1\n', truncated: false })
  videoFeature.register(ctx)
  const result = mocks.handlers.get(IPC.videoGenerate)!(event, input)
  await vi.waitFor(() => expect(verifyCalls(send)).toHaveLength(1))
  expect(mocks.run).not.toHaveBeenCalled()
  mocks.handlers.get(IPC.videoVerifyAnswer)!(event, verifyCalls(send)[0][1].confirmationId, false)
  expect((await result).video.codeVerified).toBe(true)
  expect(mocks.run).toHaveBeenCalledOnce()
  expect(mocks.native).not.toHaveBeenCalled()
})

it('asks again if repair changes the program', async () => {
  const send = vi.fn()
  const event = { sender: { id: 1, send } }
  const repaired = structuredClone(candidate)
  repaired.acts[1].code.lines[0] = 'print(2)'
  repaired.acts[1].code.expectedOutput = '2'
  const promptOnce = vi.fn().mockResolvedValueOnce(judgment).mockResolvedValueOnce(JSON.stringify(candidate)).mockResolvedValueOnce(JSON.stringify(repaired))
  const ctx = { storageDir: 'unused', readConfig: () => ({ nativeRunEnabled: true, nativeRunQuiet: false, envCache: {} }),
    study: { promptOnce } } as unknown as MainContext
  mocks.run.mockResolvedValueOnce({ ok: true, stdout: 'wrong', truncated: false }).mockResolvedValueOnce({ ok: true, stdout: '2', truncated: false })
  videoFeature.register(ctx)
  const result = mocks.handlers.get(IPC.videoGenerate)!(event, input)
  await vi.waitFor(() => expect(verifyCalls(send)).toHaveLength(1))
  mocks.handlers.get(IPC.videoVerifyAnswer)!(event, verifyCalls(send)[0][1].confirmationId, false)
  await vi.waitFor(() => expect(verifyCalls(send)).toHaveLength(2))
  expect(verifyCalls(send)[1][1].code[0]).toBe('print(2)')
  mocks.handlers.get(IPC.videoVerifyAnswer)!(event, verifyCalls(send)[1][1].confirmationId, false)
  expect((await result).video.codeVerified).toBe(true)
  expect(mocks.run).toHaveBeenCalledTimes(2)
})

it('uses the configured quiet native policy without displaying a confirmation', async () => {
  const send = vi.fn()
  const event = { sender: { id: 1, send } }
  const ctx = { storageDir: 'unused', readConfig: () => ({ nativeRunEnabled: true, nativeRunQuiet: true, envCache: {} }),
    study: { promptOnce: async (_p: string, _s: AbortSignal, tag: string) => tag === 'video-judge' ? judgment : JSON.stringify(candidate) } } as unknown as MainContext
  mocks.native.mockResolvedValue({ ok: true, stdout: '1', truncated: false })
  videoFeature.register(ctx)
  const result = await mocks.handlers.get(IPC.videoGenerate)!(event, input)
  expect(result.video.codeVerified).toBe(true)
  expect(verifyCalls(send)).toHaveLength(0)
  expect(mocks.native).toHaveBeenCalledOnce()
  expect(mocks.run).not.toHaveBeenCalled()
})

it('videoCancel waits for its running verifier to finish cleanup', async () => {
  let cleaned = false
  mocks.run.mockImplementation((_req, _report, signal: AbortSignal) => new Promise(resolve => {
    signal.addEventListener('abort', () => setTimeout(() => { cleaned = true; resolve({ ok: false, canceled: true }) }, 30), { once: true })
  }))
  const ctx = { storageDir: 'unused', readConfig: () => ({ nativeRunEnabled: false, nativeRunQuiet: false, envCache: {} }),
    study: { promptOnce: async (_p: string, _s: AbortSignal, tag: string) => tag === 'video-judge' ? judgment : JSON.stringify(candidate) } } as unknown as MainContext
  videoFeature.register(ctx)
  const result = mocks.handlers.get(IPC.videoGenerate)!({ sender: { id: 1, send: vi.fn() } }, input)
  await vi.waitFor(() => expect(mocks.run).toHaveBeenCalledOnce())
  const canceled = mocks.handlers.get(IPC.videoCancel)!({}, 'r')
  expect(cleaned).toBe(false)
  expect(await canceled).toEqual({ ok: true })
  expect(cleaned).toBe(true)
  expect((await result).ok).toBe(false)
})
