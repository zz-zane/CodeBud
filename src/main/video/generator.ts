import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { validateVideo, type ExplainerVideo, type VideoAct, type VideoGenerationInput, type VideoGenerationResult, type VideoProgress } from '../../shared/video'
import { judgePrompt, scriptPrompt } from './prompts'
import { VIDEO_GENERATION_TEXT as T } from '../../shared/video-copy'

type Prompt = (prompt: string, signal: AbortSignal, tag: string) => Promise<string>
export type VerifyResult = { status: 'ok' | 'missing' | 'mismatch' | 'error'; detail?: string }
type Verify = (code: NonNullable<VideoAct['code']>, signal: AbortSignal) => Promise<VerifyResult>
type Progress = (event: VideoProgress) => void
export interface BuiltinCatalogEntry {
  id: string
  title: string
  concept: string
  keywords: string[]
  lessonIds: string[]
  video?: ExplainerVideo
}
export type BuiltinMatch = { kind: 'builtin'; id: string }

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const parse = (raw: string): unknown => JSON.parse(raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''))

let cachedCatalog: BuiltinCatalogEntry[] | null = null

export function loadBuiltinCatalog(): BuiltinCatalogEntry[] {
  if (cachedCatalog) return cachedCatalog
  const candidates = [
    path.resolve(process.cwd(), 'content', 'animations'),
    path.resolve(__dirname, '..', '..', 'content', 'animations'),
    path.resolve(__dirname, '..', '..', '..', 'content', 'animations')
  ]
  const dir = candidates.find(d => fs.existsSync(d))
  if (!dir) { cachedCatalog = []; return cachedCatalog }
  cachedCatalog = fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .flatMap(f => {
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as ExplainerVideo & { keywords?: string[]; lessonIds?: string[] }
        return [{
          id: raw.id,
          title: raw.title,
          concept: raw.concept,
          keywords: Array.isArray(raw.keywords) ? raw.keywords : [],
          lessonIds: Array.isArray(raw.lessonIds) ? raw.lessonIds : (raw.lessonId ? [raw.lessonId] : []),
          video: raw
        }]
      } catch {
        return []
      }
    })
  return cachedCatalog
}

export function matchBuiltin(question: string, lessonId: string | undefined, catalog: BuiltinCatalogEntry[]): BuiltinMatch | null {
  const q = question.toLowerCase()
  let best: { id: string; score: number } | null = null
  for (const entry of catalog) {
    const hits = entry.keywords.filter(kw => kw && q.includes(kw.toLowerCase())).length
    const inLesson = Boolean(lessonId && entry.lessonIds.includes(lessonId))
    if ((inLesson && hits >= 1) || hits >= 2) {
      const score = hits + (inLesson ? 1 : 0)
      if (!best || score > best.score) best = { id: entry.id, score }
    }
  }
  return best ? { kind: 'builtin', id: best.id } : null
}

export function validVideoGenerationInput(value: unknown): value is VideoGenerationInput {
  if (!object(value)) return false
  const optional = (x: unknown, max: number): boolean => x === undefined || (typeof x === 'string' && x.length <= max)
  return typeof value.requestId === 'string' && /^[\w-]{1,128}$/.test(value.requestId) &&
    typeof value.question === 'string' && value.question.trim().length > 0 && value.question.length <= 1000 &&
    optional(value.code, 5000) && optional(value.excerpt, 2000) && optional(value.wrongOption, 500) && optional(value.lessonId, 256) &&
    (value.lang === undefined || ['c', 'cpp', 'java', 'python'].includes(value.lang as string)) &&
    (value.avoid === undefined || (Array.isArray(value.avoid) && value.avoid.length <= 4 && value.avoid.every(x => typeof x === 'string' && x.length <= 40)))
}

export async function generateExplainer(input: VideoGenerationInput, prompt: Prompt, verify: Verify, progress: Progress, signal: AbortSignal): Promise<VideoGenerationResult> {
  const emit = (stage: VideoProgress['stage'], status: VideoProgress['status'], detail?: string): void => progress({ requestId: input.requestId, stage, status, ...(detail ? { detail } : {}) })
  const abort = (): void => { if (signal.aborted) throw new Error(T.canceled) }
  const fallback = async (reason: string): Promise<VideoGenerationResult> => {
    emit('done', 'failed', reason)
    let text = T.fallback as string
    try { text = await prompt(T.fallbackPrompt + JSON.stringify({ question: input.question, code: input.code, wrongOption: input.wrongOption }), signal, 'video-fallback'); abort() }
    catch { abort() }
    return { ok: false, fallback: text, reason }
  }
  abort()
  const catalog = loadBuiltinCatalog()
  const skipBuiltin = Boolean(input.avoid?.length) || input.question.startsWith(T.unknownPrefix)
  if (!skipBuiltin && catalog.length) {
    const matched = matchBuiltin(input.question, input.lessonId, catalog)
    const entry = matched ? catalog.find(item => item.id === matched.id) : undefined
    if (entry?.video) {
      emit('judging', 'ok', entry.concept)
      emit('done', 'ok')
      return { ok: true, video: entry.video }
    }
  }
  emit('judging', 'running')
  let plan: unknown
  try { plan = parse(await prompt(judgePrompt(input), signal, 'video-judge')); abort() }
  catch (error) { abort(); return fallback(error instanceof Error ? error.message : T.judgeFailed) }
  if (!object(plan)) return fallback(T.badJudge)
  if (plan.mode === 'builtin' && typeof plan.builtinId === 'string') {
    const entry = catalog.find(item => item.id === plan.builtinId)
    if (entry?.video) {
      emit('judging', 'ok', entry.concept)
      emit('done', 'ok')
      return { ok: true, video: entry.video }
    }
  }
  if (typeof plan.shouldAnimate !== 'boolean') return fallback(T.badJudge)
  if (!plan.shouldAnimate) return fallback(typeof plan.reason === 'string' ? plan.reason : T.textReason)
  if (typeof plan.concept !== 'string' || !plan.concept.trim() || !Array.isArray(plan.actsPlan) || plan.actsPlan.length !== 2 ||
      !plan.actsPlan.every(act => object(act) && Number.isInteger(act.steps) && (act.steps as number) > 0) ||
      plan.actsPlan.reduce((sum, act) => sum + (act.steps as number), 0) > 12) return fallback(T.badPlan)
  emit('judging', 'ok', plan.concept)
  let errors: string[] = [], previous = ''
  for (let attempt = 0; attempt < 2; attempt++) {
    abort(); emit('scripting', 'running', attempt ? T.retrying : undefined)
    try { previous = await prompt(scriptPrompt(input, plan, errors, previous), signal, 'video-generate'); abort() }
    catch (error) { abort(); return fallback(error instanceof Error ? error.message : T.generateFailed) }
    let video: ExplainerVideo | undefined
    try {
      const parsed = parse(previous)
      if (!object(parsed)) throw new Error('invalid JSON')
      video = { ...parsed, id: randomUUID(), question: input.question, lessonId: input.lessonId, source: 'ai', createdAt: Date.now(), codeVerified: null } as unknown as ExplainerVideo
      errors = validateVideo(video)
      if (Array.isArray(video.acts) && (video.acts.length !== 2 || video.acts.reduce((sum, act) => sum + (Array.isArray(act.steps) ? act.steps.length : 0), 0) > 12)) errors.push(T.badActs)
    } catch { errors = [T.badJson] }
    if (video && !errors.length) {
      emit('scripting', 'ok'); emit('verifying', 'running')
      const results: VerifyResult[] = []
      for (const act of video.acts) if (act.code) { abort(); results.push(await verify(act.code, signal)); abort() }
      const failures = results.filter(result => result.status === 'error' || result.status === 'mismatch')
      errors = failures.map(result => result.detail || (result.status === 'mismatch' ? T.mismatch : T.runFailed))
      if (!errors.length || (attempt === 1 && failures.length > 0 && results.every(result => result.status === 'ok' || result.status === 'mismatch'))) {
        video.codeVerified = results.length === 0 ? null : results.every(result => result.status === 'ok')
        emit('verifying', errors.length ? 'failed' : 'ok', errors.join(T.separator) || undefined)
        emit('done', 'ok')
        return { ok: true, video }
      }
      emit('verifying', 'failed', errors.join(T.separator))
    } else emit('scripting', 'failed', errors.join(T.separator))
  }
  return fallback(errors.join(T.separator) || T.invalid)
}
