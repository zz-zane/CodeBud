import { handle } from '../ipc'
import { CET6_VOCAB_SYSTEM } from '../../shared/copy'
import { IPC } from '../../shared/ipc-channels'
import type { Cet6MediaStatus, Cet6Mode, Cet6State } from '../../shared/cet6'
import type { Cet6LookupResult, Cet6VocabEntry } from '../../shared/cet6-vocab'
import { cet6AssetResponse, cet6DataRoot, createCet6Service, installCet6Protocol, pickCet6MediaRoot } from '../cet6'
import { createCet6VocabService, type VocabAsk } from '../cet6-vocab'
import type { MainContext, MainFeature } from '../context'

const LOOKUP_TIMEOUT_MS = 30_000

/**
 * 一次性问答：独占一个随机会话 id，用完立刻 clearSession，不进用户的聊天会话；
 * 不传 onUsage，所以不写用量记录。不共享任何锁，不影响别处的 AI 调用。
 */
function vocabAsk(ctx: MainContext): VocabAsk {
  return async (prompt) => {
    const sessionId = `cet6-vocab-${crypto.randomUUID()}`
    try {
      const r = await ctx.study.harness.runTurn({ sessionId, prompt, systemPrompt: CET6_VOCAB_SYSTEM, timeoutMs: LOOKUP_TIMEOUT_MS })
      if (r.ok) return { ok: true, text: r.data.text }
      if (r.reason === 'unauthorized' || r.reason === 'quota') return { ok: false, reason: 'no-key' }
      if (r.reason === 'timeout') return { ok: false, reason: 'timeout' }
      return { ok: false, reason: 'network' }
    } catch {
      return { ok: false, reason: 'network' }
    } finally {
      ctx.study.harness.clearSession(sessionId)
    }
  }
}

export const cet6Feature: MainFeature = {
  name: 'cet6',
  register(ctx) {
    const cet6Service = createCet6Service(ctx.storageDir)
    const vocab = createCet6VocabService(ctx.storageDir, vocabAsk(ctx))
    installCet6Protocol(() => cet6Service.mediaRoot())
    // 手机连接：同一套 路径→Response 逻辑挂到 HTTP（不开 CORS；Range 照常支持）
    for (const kind of ['data', 'media'] as const) {
      ctx.httpAssets.set(`/cet6/${kind}/`, (req) =>
        cet6AssetResponse({ kind, ...req }, { dataRoot: cet6DataRoot(), mediaRoot: cet6Service.mediaRoot() }, { 'Accept-Ranges': 'bytes' })
      )
    }
    handle(IPC.cet6GetState, (): Cet6State => cet6Service.state())
    handle(IPC.cet6SaveRecord, (_e, examId: unknown, record: unknown): void => cet6Service.saveRecord(examId, record))
    handle(IPC.cet6ResetRecord, (_e, examId: unknown): void => cet6Service.resetRecord(examId))
    handle(IPC.cet6PickMediaRoot, (e): Promise<Cet6MediaStatus> => pickCet6MediaRoot(e, cet6Service))
    handle(IPC.cet6SetLastMode, (_e, mode: unknown): Cet6Mode => cet6Service.setLastMode(mode))
    handle(IPC.cet6VocabList, (): Cet6VocabEntry[] => vocab.list())
    handle(IPC.cet6VocabAdd, (_e, input: unknown): Cet6VocabEntry[] => vocab.add(input))
    handle(IPC.cet6VocabUpdate, (_e, id: unknown, patch: unknown): Cet6VocabEntry[] => vocab.update(id, patch))
    handle(IPC.cet6VocabRemove, (_e, ids: unknown): Cet6VocabEntry[] => vocab.remove(ids))
    handle(IPC.cet6VocabLookup, (_e, input: unknown): Promise<Cet6LookupResult> => vocab.lookup(input))
  }
}
