import { handle } from '../ipc'
import { AI_APP, cetGradeSystem, CET6_VOCAB_SYSTEM } from '../../shared/copy'
import { IPC } from '../../shared/ipc-channels'
import { CET6_EXAM_ID, CET6_LIMITS, type Cet6MediaStatus, type Cet6Mode, type Cet6State, type CetLevel } from '../../shared/cet6'
import { buildGradePrompt, parseGrade, type Cet6GradeResponse } from '../../shared/cet6-grade'
import type { Cet6LookupResult, Cet6VocabEntry } from '../../shared/cet6-vocab'
import { cet6AssetResponse, cet6DataRoot, createCet6Service, installCet6Protocol, pickCet6MediaRoot, type Cet6Service } from '../cet6'
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
    const cet6Service = registerAssets(ctx, 'cet6')
    const cet4Service = registerAssets(ctx, 'cet4')
    const vocab = createCet6VocabService(ctx.storageDir, vocabAsk(ctx))
    handle(IPC.cet6GetState, (): Cet6State => cet6Service.state())
    handle(IPC.cet6SaveRecord, (_e, examId: unknown, record: unknown): void => cet6Service.saveRecord(examId, record))
    handle(IPC.cet6ResetRecord, (_e, examId: unknown): void => cet6Service.resetRecord(examId))
    handle(IPC.cet6PickMediaRoot, (e): Promise<Cet6MediaStatus> => pickCet6MediaRoot(e, cet6Service))
    handle(IPC.cet6SetLastMode, (_e, mode: unknown): Cet6Mode => cet6Service.setLastMode(mode))
    handle(IPC.cet4GetState, (): Cet6State => cet4Service.state())
    handle(IPC.cet4SaveRecord, (_e, examId: unknown, record: unknown): void => cet4Service.saveRecord(examId, record))
    handle(IPC.cet4ResetRecord, (_e, examId: unknown): void => cet4Service.resetRecord(examId))
    handle(IPC.cet4PickMediaRoot, (e): Promise<Cet6MediaStatus> => pickCet6MediaRoot(e, cet4Service, 'cet4'))
    handle(IPC.cet4SetLastMode, (_e, mode: unknown): Cet6Mode => cet4Service.setLastMode(mode))
    handle(IPC.cet6VocabList, (): Cet6VocabEntry[] => vocab.list())
    handle(IPC.cet6VocabAdd, (_e, input: unknown): Cet6VocabEntry[] => vocab.add(input))
    handle(IPC.cet6VocabUpdate, (_e, id: unknown, patch: unknown): Cet6VocabEntry[] => vocab.update(id, patch))
    handle(IPC.cet6VocabRemove, (_e, ids: unknown): Cet6VocabEntry[] => vocab.remove(ids))
    handle(IPC.cet6VocabLookup, (_e, input: unknown): Promise<Cet6LookupResult> => vocab.lookup(input))
    handle(IPC.cet6GradeSubjective, gradeHandler(ctx, cet6Service, 'cet6'))
    handle(IPC.cet4GradeSubjective, gradeHandler(ctx, cet4Service, 'cet4'))
  }
}

function registerAssets(ctx: MainContext, level: CetLevel): Cet6Service {
  const service = createCet6Service(ctx.storageDir, level)
  installCet6Protocol(() => service.mediaRoot(), level)
  for (const kind of ['data', 'media'] as const) {
    ctx.httpAssets.set(`/${level}/${kind}/`, (req) =>
      cet6AssetResponse({ kind, ...req }, { dataRoot: cet6DataRoot(level), mediaRoot: service.mediaRoot() }, { 'Accept-Ranges': 'bytes' })
    )
  }
  return service
}

function gradeHandler(ctx: MainContext, service: Cet6Service, level: CetLevel) {
  return async (_e: unknown, input: unknown): Promise<Cet6GradeResponse> => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error(`${level}: invalid grade input`)
    const req = input as Record<string, unknown>
    if (typeof req.examId !== 'string' || !CET6_EXAM_ID.test(req.examId)) throw new Error(`${level}: invalid exam id`)
    if (typeof req.questionId !== 'string' || !req.questionId || req.questionId.length > CET6_LIMITS.keyLength) throw new Error(`${level}: invalid question id`)
    if (req.kind !== 'writing' && req.kind !== 'translation') throw new Error(`${level}: invalid question kind`)
    if (typeof req.prompt !== 'string' || req.prompt.length > CET6_LIMITS.valueLength) throw new Error(`${level}: invalid prompt`)
    if (typeof req.answer !== 'string' || !req.answer.trim() || req.answer.length > CET6_LIMITS.valueLength) throw new Error(`${level}: invalid answer`)
    if (!service.gradeMatches(req.examId, req.questionId, req.answer)) return { ok: false, reason: 'stale' }

    const hasKey = ctx.readConfig().ai.apiKey.trim() !== ''
    const hasAcp = Boolean(ctx.study.store.read().activeConnectionId)
    if (!hasKey && !hasAcp) return { ok: false, reason: 'no-key' }

    let raw: string
    try {
      const prompt = `${cetGradeSystem(level)}\n\n${buildGradePrompt(req.kind, req.prompt, req.answer, level)}`
      raw = await ctx.study.promptOnce(prompt, new AbortController().signal, `${level}-grade`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes(AI_APP.ERR_KEY_REQUIRED) || /401|403|unauthorized/i.test(msg)) return { ok: false, reason: 'no-key' }
      return { ok: false, reason: 'network' }
    }

    const parsed = parseGrade(raw)
    if (!parsed) return { ok: false, reason: 'bad-response' }

    const grade = service.saveAiGrade(req.examId, req.questionId, req.answer, { ...parsed, at: Date.now() })
    if (!grade) return { ok: false, reason: 'stale' }
    return { ok: true, grade }
  }
}
