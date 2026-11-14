import { STUDY_TEXT } from '../../shared/study-copy'
import { createHash } from 'node:crypto'
import { isStudyRoute, STUDY_MAIN_SESSION_ID, type StudyActionRecord, type StudySnapshot } from '../../shared/study-companion'
import type { AiChatSession } from '../../shared/types'
import { idInput, objectInput, StudyStore, textInput } from './store'

export const STUDY_ACTION_INSTRUCTIONS = STUDY_TEXT.ACTION_INSTRUCTIONS

function actionId(turnId: string, index: number): string {
  const hex = createHash('sha256').update(`${turnId}:${index}`).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

export function applyStudyActions(input: { store: StudyStore; text: string; sessionId: string; turnId: string; isLesson(id: string): boolean; createChat(session: AiChatSession): void }): { text: string; actions: StudyActionRecord[]; createdSessions: AiChatSession[] } {
  const actions: StudyActionRecord[] = []
  const createdSessions: AiChatSession[] = []
  let index = 0
  const text = input.text.replace(/```study-actions\s*\n([\s\S]*?)\n```/g, (_block, raw: string) => {
    let values: unknown[]
    try {
      if (raw.length > 200_000) throw new Error(STUDY_TEXT.ACTION_TOO_LONG)
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed) || parsed.length > 4) throw new Error(STUDY_TEXT.ACTION_LIMIT_ERROR)
      values = parsed
    } catch {
      return STUDY_TEXT.ACTION_FORMAT_INVALID
    }
    const lines: string[] = []
    for (const value of values) {
      if (index >= 4) { lines.push(STUDY_TEXT.ACTION_LIMIT_REACHED); break }
      const id = actionId(input.turnId, index++)
      const previous = input.store.read().actions?.find(action => action.id === id)
      if (previous) { actions.push(previous); lines.push(previous.message); continue }
      let result: StudyActionRecord = { id, turnId: input.turnId, type: 'invalid', message: '', ok: false, at: Date.now() }
      try {
        const data = objectInput(value)
        const type = textInput(data.type, 30)
        result.type = type
        if (input.sessionId !== STUDY_MAIN_SESSION_ID && type !== 'navigate') throw new Error(STUDY_TEXT.ACTION_MAIN_ONLY)
        if (type === 'navigate') {
          const route = textInput(data.route, 500)
          if (!isStudyRoute(route) || (route.startsWith('/lesson/') && !input.isLesson(route.split('?')[0].slice(8)))) throw new Error(STUDY_TEXT.ACTION_ROUTE_MISSING)
          result.route = route
          result.message = route.startsWith('/lesson/') ? STUDY_TEXT.COURSE_LINK(route.split('?')[0].slice(8)) : STUDY_TEXT.NAVIGATION_READY(route)
        } else if (type === 'create_chat') {
          const session: AiChatSession = { id, title: textInput(data.title, 100), createdAt: Date.now(), updatedAt: Date.now(), messages: [] }
          if (data.question !== undefined) session.messages.push({ id: `${id}-question`, role: 'user', content: textInput(data.question, 20_000), createdAt: Date.now() })
          input.createChat(session)
          createdSessions.push(session)
          result.sessionId = id
          result.message = STUDY_TEXT.TOPIC_CREATED(session.title)
        } else if (type === 'remember' || type === 'forget' || type === 'save_note') {
          input.store.update(state => applyDataAction(state, data, type, id, input.turnId))
          result.message = type === 'remember' ? STUDY_TEXT.ACTION_MEMORY_SAVED : type === 'forget' ? STUDY_TEXT.ACTION_MEMORY_FORGOTTEN : STUDY_TEXT.ACTION_NOTE_SAVED
        } else throw new Error(STUDY_TEXT.ACTION_UNSUPPORTED)
        result.ok = true
      } catch (error) { result.message = STUDY_TEXT.ACTION_FAILED_PREFIX + (error instanceof Error ? error.message : STUDY_TEXT.ACTION_DATA_INVALID) }
      input.store.update(state => { (state.actions ??= []).push(result) })
      actions.push(result)
      lines.push(result.message)
    }
    return lines.map(line => `\n- ${line}`).join('') + '\n'
  })
  return { text, actions, createdSessions }
}

function applyDataAction(state: StudySnapshot, data: Record<string, unknown>, type: string, id: string, turnId: string): void {
  if (type === 'remember') {
    const text = textInput(data.text, 4000)
    if (!state.memory.some(item => item.id === id || item.text === text)) state.memory.push({ id, text, source: STUDY_TEXT.MEMORY_PROVENANCE(turnId), updatedAt: Date.now() })
  } else if (type === 'forget') {
    const memoryId = idInput(data.id)
    const index = state.memory.findIndex(item => item.id === memoryId)
    if (index < 0) throw new Error(STUDY_TEXT.ACTION_MEMORY_MISSING)
    state.memory.splice(index, 1)
  } else {
    const noteId = data.id === undefined ? id : idInput(data.id)
    const index = state.notes.findIndex(note => note.id === noteId)
    if (data.id !== undefined && index < 0) throw new Error(STUDY_TEXT.ACTION_NOTE_MISSING)
    const format = data.format ?? 'markdown'
    if (!['markdown', 'html'].includes(format as string)) throw new Error(STUDY_TEXT.ACTION_NOTE_FORMAT)
    if (data.tags !== undefined && (!Array.isArray(data.tags) || data.tags.length > 20)) throw new Error(STUDY_TEXT.NOTE_TAGS_INVALID)
    const note = { id: noteId, title: textInput(data.title, 300), body: textInput(data.body, 200_000, true), tags: (data.tags as unknown[] | undefined ?? []).map(tag => textInput(tag, 80)), format: format as 'markdown' | 'html', updatedAt: Date.now(), archived: false }
    if (index < 0) state.notes.push(note)
    else state.notes[index] = note
  }
}
