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

const input = { requestId: 'r', question: '指针是什么？', outline: { title: '指针', confusion: '地址', analogy: '门牌', scenes: [
  { kind: 'card', goal: '类比' }, { kind: 'trace', goal: '运行' }, { kind: 'card', goal: '错误' }
] } }
const candidate = structuredClone(example) as any
candidate.scenes[2] = { kind: 'trace', title: '程序', lang: 'python', code: ['print(1)', '# 2', '# 3', '# 4'], expectedOutput: '1',
  steps: candidate.scenes[2].steps.map((step: { say: string }, index: number) => ({ say: step.say, at: index + 1, vars: [] })) }

beforeEach(() => { mocks.handlers.clear(); vi.clearAllMocks() })

it('shows the exact program and skips execution when confirmation is declined', async () => {
  const send = vi.fn()
  const event = { sender: { id: 1, send } }
  const ctx = { storageDir: 'unused', readConfig: () => ({ nativeRunEnabled: true, nativeRunQuiet: false, envCache: {} }),
    study: { promptOnce: async () => JSON.stringify(candidate) } } as unknown as MainContext
  videoFeature.register(ctx)
  const result = mocks.handlers.get(IPC.videoGenerate)!(event, input)
  await vi.waitFor(() => expect(send).toHaveBeenCalledOnce())
  const [channel, prompt] = send.mock.calls[0]
  expect(channel).toBe(IPC.videoVerifyPrompt)
  expect(prompt.code).toEqual(candidate.scenes[2].code)
  expect(mocks.handlers.get(IPC.videoVerifyAnswer)!({ sender: { id: 2 } }, prompt.confirmationId, true)).toEqual({ ok: false })
  expect(mocks.handlers.get(IPC.videoVerifyAnswer)!(event, prompt.confirmationId, null)).toEqual({ ok: true })
  expect((await result).data.codeVerified).toBe(false)
  expect(mocks.run).not.toHaveBeenCalled()
  expect(mocks.native).not.toHaveBeenCalled()
  expect(mocks.add).toHaveBeenCalledOnce()
})

it('runs the selected managed toolchain only after confirmation', async () => {
  const send = vi.fn()
  const event = { sender: { id: 1, send } }
  const ctx = { storageDir: 'unused', readConfig: () => ({ nativeRunEnabled: true, nativeRunQuiet: false, envCache: {} }),
    study: { promptOnce: async () => JSON.stringify(candidate) } } as unknown as MainContext
  mocks.run.mockResolvedValue({ ok: true, stdout: '1\n', truncated: false })
  videoFeature.register(ctx)
  const result = mocks.handlers.get(IPC.videoGenerate)!(event, input)
  await vi.waitFor(() => expect(send).toHaveBeenCalledOnce())
  expect(mocks.run).not.toHaveBeenCalled()
  mocks.handlers.get(IPC.videoVerifyAnswer)!(event, send.mock.calls[0][1].confirmationId, false)
  expect((await result).data.codeVerified).toBe(true)
  expect(mocks.run).toHaveBeenCalledOnce()
  expect(mocks.native).not.toHaveBeenCalled()
})

it('asks again if repair changes the program', async () => {
  const send = vi.fn()
  const event = { sender: { id: 1, send } }
  const repaired = structuredClone(candidate)
  repaired.scenes[2].code[0] = 'print(2)'
  repaired.scenes[2].expectedOutput = '2'
  const promptOnce = vi.fn().mockResolvedValueOnce(JSON.stringify(candidate)).mockResolvedValueOnce(JSON.stringify(repaired))
  const ctx = { storageDir: 'unused', readConfig: () => ({ nativeRunEnabled: true, nativeRunQuiet: false, envCache: {} }),
    study: { promptOnce } } as unknown as MainContext
  mocks.run.mockResolvedValueOnce({ ok: true, stdout: 'wrong', truncated: false }).mockResolvedValueOnce({ ok: true, stdout: '2', truncated: false })
  videoFeature.register(ctx)
  const result = mocks.handlers.get(IPC.videoGenerate)!(event, input)
  await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1))
  mocks.handlers.get(IPC.videoVerifyAnswer)!(event, send.mock.calls[0][1].confirmationId, false)
  await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2))
  expect(send.mock.calls[1][1].code[0]).toBe('print(2)')
  mocks.handlers.get(IPC.videoVerifyAnswer)!(event, send.mock.calls[1][1].confirmationId, false)
  expect((await result).data.codeVerified).toBe(true)
  expect(mocks.run).toHaveBeenCalledTimes(2)
})

it('uses the configured quiet native policy without displaying a confirmation', async () => {
  const send = vi.fn()
  const event = { sender: { id: 1, send } }
  const ctx = { storageDir: 'unused', readConfig: () => ({ nativeRunEnabled: true, nativeRunQuiet: true, envCache: {} }),
    study: { promptOnce: async () => JSON.stringify(candidate) } } as unknown as MainContext
  mocks.native.mockResolvedValue({ ok: true, stdout: '1', truncated: false })
  videoFeature.register(ctx)
  const result = await mocks.handlers.get(IPC.videoGenerate)!(event, input)
  expect(result.data.codeVerified).toBe(true)
  expect(send).not.toHaveBeenCalled()
  expect(mocks.native).toHaveBeenCalledOnce()
  expect(mocks.run).not.toHaveBeenCalled()
})

it('videoCancel waits for its running verifier to finish cleanup', async () => {
  let cleaned = false
  mocks.run.mockImplementation((_req, _report, signal: AbortSignal) => new Promise(resolve => {
    signal.addEventListener('abort', () => setTimeout(() => { cleaned = true; resolve({ ok: false, canceled: true }) }, 30), { once: true })
  }))
  const ctx = { storageDir: 'unused', readConfig: () => ({ nativeRunEnabled: false, nativeRunQuiet: false, envCache: {} }),
    study: { promptOnce: async () => JSON.stringify(candidate) } } as unknown as MainContext
  videoFeature.register(ctx)
  const result = mocks.handlers.get(IPC.videoGenerate)!({ sender: { id: 1, send: vi.fn() } }, input)
  await vi.waitFor(() => expect(mocks.run).toHaveBeenCalledOnce())
  const canceled = mocks.handlers.get(IPC.videoCancel)!({}, 'r')
  expect(cleaned).toBe(false)
  expect(await canceled).toEqual({ ok: true })
  expect(cleaned).toBe(true)
  expect((await result).ok).toBe(false)
})
