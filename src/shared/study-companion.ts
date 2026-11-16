import { STUDY_TEXT } from './study-copy'
﻿import type { AiChatSession } from './types'

export const STUDY_MAIN_SESSION_ID = 'study-main'
export const CURRENT_STUDY_VERSION = 2

export type StudyResult<T> = { ok: true; data: T } | { ok: false; error: string }
export interface StudyMemory { id: string; text: string; source: string; refs: string[]; updatedAt: number }
export interface StudyNote { id: string; title: string; body: string; tags: string[]; format: 'markdown' | 'html'; updatedAt: number; archived?: boolean }
export interface StudyMaterial { id: string; name: string; kind: string; charCount: number; createdAt: number; status: 'ready' | 'unsupported' | 'error'; error?: string }
export interface StudyTask { id: string; title: string; description: string; status: 'todo' | 'doing' | 'done'; sourceRef?: string; lessonId?: string }
export interface StudyPlan { id: string; title: string; materialId: string; tasks: StudyTask[]; createdAt: number; source: 'ai' | 'manual'; draft: boolean }
export interface StudyPosition { route: string; lessonId?: string; lessonTitle?: string; learnedCount: number; totalLessons: number; weakLessons?: string[]; updatedAt?: number }
export interface StudyConnection { id: string; kind: 'claude' | 'codex' | 'antigravity' | 'custom'; label: string; command: string; args: string[]; model?: string; status: 'disconnected' | 'connecting' | 'ready' | 'error'; error?: string; authMethods?: Array<{ id: string; name: string; type?: string }> }
export interface StudyUsageRecord { id: string; at: number; provider: string; model: string; sessionId: string; inputTokens: number | null; outputTokens: number | null; cachedInputTokens: number | null; totalTokens: number | null; costUsd?: number; source: string }
export interface StudyQuota { provider: string; label: string; remaining: number | null; unit: string; limit?: number; resetsAt?: string; source: string; updatedAt: number; detail?: string }
export interface StudyUsage { records: StudyUsageRecord[]; quotas: StudyQuota[] }
export interface StudyActionRecord { id: string; turnId: string; type: string; message: string; ok: boolean; at: number; route?: string; sessionId?: string }
export interface StudySnapshot {
  version: number
  memory: StudyMemory[]
  notes: StudyNote[]
  materials: StudyMaterial[]
  plans: StudyPlan[]
  position: StudyPosition | null
  connections: StudyConnection[]
  activeConnectionId: string | null
  usage?: StudyUsageRecord[]
  actions?: StudyActionRecord[]
  lastLesson?: { id: string; title: string; route: string; updatedAt: number }
}
export interface StudyApi {
  getState(): Promise<StudySnapshot>
  createHtmlPreview(html: string): Promise<StudyResult<string>>
  saveMemory(input: { id?: string; text: string; source?: string }): Promise<StudyResult<StudyMemory>>
  forgetMemory(id: string): Promise<StudyResult<void>>
  saveNote(input: { id?: string; title: string; body: string; tags?: string[]; format?: 'markdown' | 'html' }): Promise<StudyResult<StudyNote>>
  archiveNote(id: string): Promise<StudyResult<void>>
  importMaterials(): Promise<StudyResult<StudyMaterial[]>>
  readMaterial(id: string): Promise<StudyResult<{ text: string }>>
  generatePlan(input: { materialId: string; goal: string }): Promise<StudyResult<StudyPlan>>
  confirmPlan(input: { planId: string; title: string; tasks: Array<{ id: string; title: string; description: string }> }): Promise<StudyResult<StudyPlan>>
  discardPlan(planId: string): Promise<StudyResult<void>>
  setTaskStatus(input: { planId: string; taskId: string; status: 'todo' | 'doing' | 'done' }): Promise<StudyResult<void>>
  updatePosition(input: StudyPosition): Promise<StudyResult<void>>
  saveConnection(input: { id?: string; kind: StudyConnection['kind']; label: string; command: string; args: string[]; model?: string }): Promise<StudyResult<StudyConnection>>
  detectAgent(): Promise<StudyResult<string | null>>
  listModels(command: string): Promise<StudyResult<Array<{ id: string; name: string }>>>
  connect(id: string): Promise<StudyResult<StudyConnection>>
  authenticate(input: { connectionId: string; methodId: string }): Promise<StudyResult<StudyConnection>>
  disconnect(id: string): Promise<StudyResult<void>>
  setModel(input: { connectionId: string; model: string }): Promise<StudyResult<StudyConnection>>
  removeConnection(id: string): Promise<StudyResult<void>>
  selectConnection(id: string | null): Promise<StudyResult<void>>
  getUsage(refresh?: boolean): Promise<StudyResult<StudyUsage>>
  runMath(input: { script: string; plot?: boolean }): Promise<StudyResult<{ output: string; plots: string[] }>>
  exportVault(): Promise<StudyResult<{ path: string } | null>>
}

const STUDY_ROUTES = new Set(['/', '/today', '/ai', '/learn', '/courses', '/practice', '/playground', '/review', '/overview', '/memo', '/favorites', '/settings', '/study'])
export function isStudyRoute(value: string): boolean {
  if (value.length > 500 || /[\\\u0000-\u001f]/.test(value)) return false
  const base = value.split('?')[0]
  return STUDY_ROUTES.has(base) || /^\/lesson\/[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(base)
}

export function studyContext(
  snapshot: StudySnapshot,
  query = '',
  currentMastery?: { lessonId: string; score: number; attempts: number } | null
): string {
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const masteryInfo = currentMastery
    ? {
        lessonId: currentMastery.lessonId,
        score: Math.round(currentMastery.score * 100) / 100,
        attempts: currentMastery.attempts
      }
    : undefined
  const positionObj = snapshot.position
    ? masteryInfo
      ? { ...snapshot.position, currentLessonMastery: masteryInfo }
      : snapshot.position
    : masteryInfo
      ? { currentLessonMastery: masteryInfo }
      : null
  const position = positionObj ? JSON.stringify(positionObj) : STUDY_TEXT.POSITION_UNKNOWN
  const memories = snapshot.memory.slice(-30).map(m => ({ id: m.id, text: m.text.slice(0, 1000), source: m.source }))
  const terms = query.toLocaleLowerCase().match(/[a-z0-9_]{2,}|[\p{Script=Han}]{2}/gu) ?? []
  const notes = snapshot.notes.filter(note => !note.archived && note.format === 'markdown').map(note => ({ note, score: terms.reduce((score, term) => score + ((note.title + '\n' + note.body).toLocaleLowerCase().includes(term) ? 1 : 0), 0) })).sort((a, b) => b.score - a.score || b.note.updatedAt - a.note.updatedAt).slice(0, 3).map(({ note }) => ({ id: note.id, title: note.title, excerpt: note.body.slice(0, 1400) }))
  const tasks = snapshot.plans.filter(plan => !plan.draft).flatMap(plan => plan.tasks.filter(task => task.status !== 'done').map(task => ({ planId: plan.id, ...task }))).slice(0, 6)
  const resources = { lastLesson: snapshot.lastLesson, notes, tasks, materials: snapshot.materials.map(material => ({ id: material.id, name: material.name })).slice(-30) }
  return STUDY_TEXT.LEARNING_CONTEXT(escape(position).slice(0, 3000), escape(JSON.stringify(memories)).slice(0, 8000), escape(JSON.stringify(resources)).slice(0, 10_000))
}

export function assertChatSessions(value: unknown): asserts value is AiChatSession[] {
  if (!Array.isArray(value)) throw new TypeError('Invalid chat sessions')
  const ids = new Set<string>()
  for (const session of value) {
    if (!session || typeof session.id !== 'string' || !session.id || ids.has(session.id) ||
      typeof session.title !== 'string' || !Number.isFinite(session.createdAt) ||
      !Number.isFinite(session.updatedAt) || !Array.isArray(session.messages)) {
      throw new TypeError('Invalid chat session')
    }
    ids.add(session.id)
    const messageIds = new Set<string>()
    for (const message of session.messages) {
      if (!message || typeof message.id !== 'string' || !message.id || messageIds.has(message.id) ||
        !['user', 'assistant'].includes(message.role) || typeof message.content !== 'string' ||
        !Number.isFinite(message.createdAt)) throw new TypeError('Invalid chat message')
      messageIds.add(message.id)
    }
  }
}

export function ensureMainSession(sessions: AiChatSession[], previous: AiChatSession[] = []): AiChatSession[] {
  assertChatSessions(sessions)
  assertChatSessions(previous)
  const main = sessions.find(s => s.id === STUDY_MAIN_SESSION_ID) ?? previous.find(s => s.id === STUDY_MAIN_SESSION_ID)
  const persistedMain = previous.find(s => s.id === STUDY_MAIN_SESSION_ID)
  const now = Date.now()
  const messages = new Map(persistedMain?.messages.map(message => [message.id, message]) ?? [])
  for (const message of main?.messages ?? []) messages.set(message.id, message)
  return [{
    ...(main ?? { id: STUDY_MAIN_SESSION_ID, createdAt: now, updatedAt: now }),
    title: STUDY_TEXT.MAIN_TITLE,
    createdAt: persistedMain?.createdAt ?? main?.createdAt ?? now,
    updatedAt: Math.max(main?.updatedAt ?? now, persistedMain?.updatedAt ?? 0),
    messages: [...messages.values()].sort((a, b) => a.createdAt - b.createdAt)
  }, ...sessions.filter(s => s.id !== STUDY_MAIN_SESSION_ID)]
}
