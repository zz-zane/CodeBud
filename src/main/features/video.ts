import type { MainFeature } from '../context'
import { randomUUID } from 'node:crypto'
import { handle } from '../ipc'
import { IPC } from '../../shared/ipc-channels'
import { VIDEO_TEXT } from '../../shared/copy'
import { nativeEnv, refreshLangs } from '../env/detect'
import { enqueueRunJob, runCode } from '../runner/runner'
import { nativeGateReason, runCodeNative } from '../runner/native'
import { generateOutline, generateVideo, matchesTraceOutput, validateGenerateRequest, validateOutlineRequest } from '../video/generate'
import { createVideoStore } from '../video/store'

const requests = new Map<string, { controller: AbortController; done: Promise<void> }>()
const confirmations = new Map<string, { senderId: number; answer: (choice: boolean | null) => void }>()

export const videoFeature: MainFeature = {
  name: 'video',
  register(ctx) {
    const store = createVideoStore(ctx.storageDir)

    async function request<T>(id: string, work: (signal: AbortSignal) => Promise<T>): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
      if (requests.has(id)) return { ok: false, error: VIDEO_TEXT.REQUEST_BUSY }
      const controller = new AbortController()
      let finish!: () => void
      const done = new Promise<void>((resolve) => { finish = resolve })
      requests.set(id, { controller, done })
      try {
        return { ok: true, data: await work(controller.signal) }
      } catch (error) {
        return { ok: false, error: controller.signal.aborted ? VIDEO_TEXT.CANCELED : error instanceof Error ? error.message : String(error) }
      } finally {
        requests.delete(id)
        finish()
      }
    }

    handle(IPC.videoOutline, (_event, input: unknown) => {
      if (!validateOutlineRequest(input)) return { ok: false, error: VIDEO_TEXT.REQUEST_INVALID }
      return request(input.requestId, (signal) => generateOutline(input, ctx.study.promptOnce, signal))
    })

    handle(IPC.videoGenerate, (event, input: unknown) => {
      if (!validateGenerateRequest(input)) return { ok: false, error: VIDEO_TEXT.REQUEST_INVALID }
      return request(input.requestId, async (signal) => {
        const video = await generateVideo(input, ctx.study.promptOnce, async (scene) => {
          if (scene.lang === null) return { missing: true }
          const { report } = await refreshLangs(ctx.readConfig(false).envCache.report, scene.lang)
          if (!report[scene.lang]?.found) return { missing: true }
          const lang = scene.lang
          const settings = ctx.readConfig(false)
          let useNative: boolean | null = settings.nativeRunEnabled && settings.nativeRunQuiet
          if (settings.nativeRunEnabled && !settings.nativeRunQuiet) {
            useNative = await new Promise<boolean | null>((resolve, reject) => {
              const confirmationId = randomUUID()
              const finish = (choice: boolean | null): void => {
                confirmations.delete(confirmationId)
                signal.removeEventListener('abort', abort)
                resolve(choice)
              }
              const abort = (): void => finish(null)
              confirmations.set(confirmationId, { senderId: event.sender.id, answer: finish })
              signal.addEventListener('abort', abort, { once: true })
              if (signal.aborted) { finish(null); return }
              try {
                event.sender.send(IPC.videoVerifyPrompt, { requestId: input.requestId, confirmationId, lang, code: scene.code })
              } catch (error) {
                confirmations.delete(confirmationId)
                signal.removeEventListener('abort', abort)
                reject(error)
              }
            })
          }
          if (signal.aborted) throw new Error(VIDEO_TEXT.CANCELED)
          if (useNative === null) return { missing: true }
          const gate = nativeGateReason(ctx.readConfig(false).nativeRunEnabled, useNative)
          if (gate) throw new Error(gate)
          const req = { lang, code: scene.code.join('\n'), timeoutSec: 10 }
          const result = await enqueueRunJob(async () => {
            if (signal.aborted) return null
            if (useNative) {
              const env = await nativeEnv()
              if (signal.aborted) return null
              return runCodeNative(req, report, { env }, signal)
            }
            return runCode(req, report, signal)
          }, signal)
          if (!result || signal.aborted) throw new Error(VIDEO_TEXT.CANCELED)
          if (result.envIssue) return { missing: true }
          if (!result.ok || result.truncated) return { missing: false, error: result.stderr || result.message || VIDEO_TEXT.RUN_FAILED }
          if (!matchesTraceOutput(scene.expectedOutput, result.stdout)) return { missing: false, error: VIDEO_TEXT.OUTPUT_MISMATCH(JSON.stringify(result.stdout)) }
          return { missing: false }
        }, signal)
        if (signal.aborted) throw new Error(VIDEO_TEXT.CANCELED)
        store.add(video)
        return video
      })
    })

    handle(IPC.videoCancel, async (_event, id: unknown) => {
      if (typeof id !== 'string' || id.length > 128) return { ok: false }
      const request = requests.get(id)
      request?.controller.abort()
      await request?.done
      return { ok: true }
    })
    handle(IPC.videoVerifyAnswer, (event, id: unknown, choice: unknown) => {
      if (typeof id !== 'string' || (choice !== null && typeof choice !== 'boolean')) return { ok: false }
      const pending = confirmations.get(id)
      if (!pending || pending.senderId !== event.sender.id) return { ok: false }
      pending.answer(choice)
      return { ok: true }
    })
    handle(IPC.videoList, () => store.list())
    handle(IPC.videoDelete, (_event, id: unknown) => {
      if (typeof id !== 'string' || !id || id.length > 128) return { ok: false }
      store.delete(id)
      return { ok: true }
    })
  },
  dispose() {
    for (const request of requests.values()) request.controller.abort()
    requests.clear()
    confirmations.clear()
  }
}
