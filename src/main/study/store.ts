import { STUDY_TEXT } from '../../shared/study-copy'
import { randomUUID } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { assertSupportedVersion, NewerDataVersionError } from '../../shared/data-version'
import { preserveCorruptFile } from '../store/json-store'
import { CURRENT_STUDY_VERSION, isStudyRoute, type StudyMemory, type StudyNote, type StudyPosition, type StudySnapshot } from '../../shared/study-companion'

const MEMORY_REF_RE = /^(?:lesson:[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}|chat:[a-zA-Z0-9_-]{1,128}|user)$/

function assertRefs(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 20) throw new Error(STUDY_TEXT.MEMORY_REFS_INVALID)
  return value.map((ref) => {
    if (typeof ref !== 'string' || !MEMORY_REF_RE.test(ref)) throw new Error(STUDY_TEXT.MEMORY_REFS_INVALID)
    return ref
  })
}

export function objectInput(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(STUDY_TEXT.INPUT_OBJECT_INVALID)
  return value as Record<string, unknown>
}

export function textInput(value: unknown, max: number, optional = false): string {
  if (optional && value === undefined) return ''
  if (typeof value !== 'string' || value.length > max || (!optional && !value.trim()) || value.includes('\0')) throw new Error(STUDY_TEXT.INPUT_TEXT_INVALID)
  return value
}

export function idInput(value: unknown): string {
  const id = textInput(value, 100)
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(id)) throw new Error(STUDY_TEXT.INPUT_ID_INVALID)
  return id
}

function countInput(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > 10_000_000) throw new Error(STUDY_TEXT.PROGRESS_COUNT_INVALID)
  return value
}

export function cleanPosition(input: unknown): StudyPosition {
  const data = objectInput(input)
  const route = textInput(data.route, 500)
  if (!isStudyRoute(route)) throw new Error(STUDY_TEXT.POSITION_ROUTE_INVALID)
  const learnedCount = countInput(data.learnedCount)
  const totalLessons = countInput(data.totalLessons)
  if (learnedCount > totalLessons) throw new Error(STUDY_TEXT.PROGRESS_TOTAL_INVALID)
  const lessonId = data.lessonId === undefined ? undefined : idInput(data.lessonId)
  const lessonTitle = data.lessonTitle === undefined ? undefined : textInput(data.lessonTitle, 300)
  if (route.startsWith('/lesson/') && lessonId !== route.split('?')[0].slice(8)) throw new Error(STUDY_TEXT.POSITION_LESSON_MISMATCH)
  if (data.weakLessons !== undefined && (!Array.isArray(data.weakLessons) || data.weakLessons.length > 20)) throw new Error(STUDY_TEXT.POSITION_WEAK_LESSONS_INVALID)
  const weakLessons = (data.weakLessons as unknown[] | undefined)?.map(value => textInput(value, 300))
  return { route, learnedCount, totalLessons, ...(lessonId ? { lessonId } : {}), ...(lessonTitle ? { lessonTitle } : {}), ...(weakLessons ? { weakLessons } : {}), updatedAt: Date.now() }
}

function emptySnapshot(): StudySnapshot {
  return { version: CURRENT_STUDY_VERSION, memory: [], notes: [], materials: [], plans: [], position: null, connections: [], activeConnectionId: null }
}

/** 将 v1 的 study-companion.json 迁移到当前 v2（保留全部数据，补 refs: [] 与 draft: false） */
export function migrateStudySnapshot(value: unknown): StudySnapshot {
  const data = objectInput(value)
  if (typeof data.version === 'number' && data.version > CURRENT_STUDY_VERSION) {
    try { assertSnapshot({ ...data, version: CURRENT_STUDY_VERSION }) }
    catch { throw new NewerDataVersionError() }
    return data as unknown as StudySnapshot
  }
  if (data.version === CURRENT_STUDY_VERSION) {
    assertSnapshot(data)
    return data
  }
  if (data.version !== 1) throw new Error(STUDY_TEXT.STATE_VERSION_UNSUPPORTED)
  const migrated: Record<string, unknown> = {
    ...data,
    version: CURRENT_STUDY_VERSION,
    memory: Array.isArray(data.memory)
      ? data.memory.map((row) => (row && typeof row === 'object' && !Array.isArray(row) ? { ...row, refs: Array.isArray((row as Record<string, unknown>).refs) ? (row as Record<string, unknown>).refs : [] } : row))
      : data.memory,
    plans: Array.isArray(data.plans)
      ? data.plans.map((row) => (row && typeof row === 'object' && !Array.isArray(row) ? { ...row, draft: typeof (row as Record<string, unknown>).draft === 'boolean' ? (row as Record<string, unknown>).draft : false } : row))
      : data.plans
  }
  assertSnapshot(migrated)
  return migrated
}

function assertSnapshot(value: unknown): asserts value is StudySnapshot {
  const data = objectInput(value)
  if (data.version !== CURRENT_STUDY_VERSION) throw new Error(STUDY_TEXT.STATE_VERSION_UNSUPPORTED)
  for (const key of ['memory', 'notes', 'materials', 'plans', 'connections']) {
    if (!Array.isArray(data[key]) || (data[key] as unknown[]).length > 10_000) throw new Error(STUDY_TEXT.STATE_RECORD_INVALID)
    const ids = new Set<string>()
    for (const row of data[key] as unknown[]) {
      const item = objectInput(row)
      const id = idInput(item.id)
      if (ids.has(id)) throw new Error(STUDY_TEXT.STATE_DUPLICATE_ID)
      ids.add(id)
      if (key === 'memory') {
        textInput(item.text, 4000)
        textInput(item.source, 300, true)
        assertRefs(item.refs)
        if (typeof item.updatedAt !== 'number' || !Number.isFinite(item.updatedAt)) throw new Error(STUDY_TEXT.MEMORY_TIME_INVALID)
      }
      if (key === 'notes') {
        textInput(item.title, 300)
        textInput(item.body, 200_000, true)
        if (!['markdown', 'html'].includes(item.format as string) || !Array.isArray(item.tags) || item.tags.length > 20) throw new Error(STUDY_TEXT.NOTE_FORMAT_INVALID)
        item.tags.forEach(tag => textInput(tag, 80))
        if (typeof item.updatedAt !== 'number' || !Number.isFinite(item.updatedAt) || (item.archived !== undefined && typeof item.archived !== 'boolean')) throw new Error(STUDY_TEXT.NOTE_RECORD_INVALID)
      }
      if (key === 'materials') {
        textInput(item.name, 300)
        textInput(item.kind, 30)
        countInput(item.charCount)
        if (!['ready', 'unsupported', 'error'].includes(item.status as string) || typeof item.createdAt !== 'number' || !Number.isFinite(item.createdAt)) throw new Error(STUDY_TEXT.MATERIAL_RECORD_INVALID)
      }
      if (key === 'plans') {
        textInput(item.title, 300)
        idInput(item.materialId)
        if (typeof item.draft !== 'boolean' || !['ai', 'manual'].includes(item.source as string) || !Array.isArray(item.tasks) || item.tasks.length > 30 || typeof item.createdAt !== 'number' || !Number.isFinite(item.createdAt)) throw new Error(STUDY_TEXT.PLAN_RECORD_INVALID)
        const taskIds = new Set<string>()
        for (const value of item.tasks) {
          const task = objectInput(value)
          const taskId = idInput(task.id)
          if (taskIds.has(taskId)) throw new Error(STUDY_TEXT.TASK_DUPLICATE_ID)
          taskIds.add(taskId)
          textInput(task.title, 300)
          textInput(task.description, 4000)
          if (!['todo', 'doing', 'done'].includes(task.status as string)) throw new Error(STUDY_TEXT.STATE_TASK_STATUS_INVALID)
          if (task.sourceRef !== undefined) textInput(task.sourceRef, 100)
          if (task.lessonId !== undefined) idInput(task.lessonId)
        }
      }
      if (key === 'connections') {
        if (!['claude', 'codex', 'antigravity', 'custom'].includes(item.kind as string) || !['disconnected', 'connecting', 'ready', 'error'].includes(item.status as string)) throw new Error(STUDY_TEXT.CONNECTION_RECORD_INVALID)
        textInput(item.label, 100)
        textInput(item.command, 1000)
        if (!Array.isArray(item.args) || item.args.length > 40) throw new Error(STUDY_TEXT.CONNECTION_PARAMS_INVALID)
        item.args.forEach(arg => textInput(arg, 2000, true))
      }
    }
  }
  if (data.position !== null) cleanPosition(data.position)
  if (data.activeConnectionId !== null) idInput(data.activeConnectionId)
  if (data.usage !== undefined) {
    if (!Array.isArray(data.usage) || data.usage.length > 100_000) throw new Error(STUDY_TEXT.USAGE_RECORD_INVALID)
    for (const value of data.usage) {
      const record = objectInput(value)
      idInput(record.id)
      for (const key of ['inputTokens', 'outputTokens', 'cachedInputTokens', 'totalTokens']) if (record[key] !== null) countInput(record[key])
      for (const key of ['provider', 'model', 'sessionId', 'source']) textInput(record[key], 300)
      if (typeof record.at !== 'number' || !Number.isFinite(record.at)) throw new Error(STUDY_TEXT.USAGE_TIME_INVALID)
    }
  }
  if (data.actions !== undefined && (!Array.isArray(data.actions) || data.actions.length > 50_000)) throw new Error(STUDY_TEXT.ACTION_RECORD_INVALID)
  if (data.lastLesson !== undefined) {
    const lesson = objectInput(data.lastLesson)
    const id = idInput(lesson.id)
    textInput(lesson.title, 300)
    if (typeof lesson.route !== 'string' || !isStudyRoute(lesson.route) || lesson.route.split('?')[0] !== '/lesson/' + id) throw new Error(STUDY_TEXT.RECENT_LESSON_INVALID)
  }
}

export class StudyStore {
  readonly file: string
  constructor(readonly directory: string) {
    this.file = join(directory, 'study-companion.json')
  }

  read(): StudySnapshot {
    const backup = this.file + '.bak'
    if (!existsSync(this.file) && !existsSync(backup)) return emptySnapshot()
    let originalError: unknown
    for (const file of [this.file, backup]) {
      if (!existsSync(file)) continue
      let snapshot: StudySnapshot
      try {
        const value: unknown = JSON.parse(readFileSync(file, 'utf8'))
        snapshot = migrateStudySnapshot(value)
      } catch (error) {
        if (error instanceof NewerDataVersionError) throw error
        originalError = error
        preserveCorruptFile(file, error)
        continue
      }
      if (file === backup) copyFileSync(backup, this.file)
      return snapshot
    }
    throw new Error(STUDY_TEXT.STATE_UNREADABLE, { cause: originalError })
  }

  update<T>(mutate: (snapshot: StudySnapshot) => T): T {
    const state = this.read()
    assertSupportedVersion(state, CURRENT_STUDY_VERSION)
    const result = mutate(state)
    assertSnapshot(state)
    mkdirSync(this.directory, { recursive: true })
    const temporary = this.file + `.${randomUUID()}.tmp`
    try {
      writeFileSync(temporary, JSON.stringify(state, null, 2), { encoding: 'utf8', flag: 'wx' })
      // A failed backup must stop the overwrite: learning records are not disposable.
      if (existsSync(this.file)) copyFileSync(this.file, this.file + '.bak')
      renameSync(temporary, this.file)
    } finally {
      if (existsSync(temporary)) unlinkSync(temporary)
    }
    return result
  }

  saveMemory(input: unknown): StudyMemory {
    const data = objectInput(input)
    const id = data.id === undefined ? randomUUID() : idInput(data.id)
    const text = textInput(data.text, 4000).trim()
    const source = data.source === undefined ? STUDY_TEXT.MEMORY_USER_SOURCE : textInput(data.source, 300).trim()
    const incomingRefs = data.refs === undefined ? undefined : assertRefs(data.refs)
    return this.update(state => {
      const index = state.memory.findIndex(memory => memory.id === id)
      if (data.id !== undefined && index < 0) throw new Error(STUDY_TEXT.MEMORY_MISSING)
      if (index < 0 && state.memory.length >= 500) throw new Error(STUDY_TEXT.MEMORY_LIMIT)
      const refs = incomingRefs ?? (index >= 0 ? state.memory[index].refs : ['user'])
      const memory: StudyMemory = { id, text, source, refs, updatedAt: Date.now() }
      if (index < 0) state.memory.push(memory)
      else state.memory[index] = memory
      return memory
    })
  }

  forgetMemory(value: unknown): void {
    const id = idInput(value)
    this.update(state => {
      const index = state.memory.findIndex(memory => memory.id === id)
      if (index < 0) throw new Error(STUDY_TEXT.MEMORY_MISSING)
      state.memory.splice(index, 1)
    })
  }

  updatePosition(input: unknown): void {
    const position = cleanPosition(input)
    this.update(state => {
      state.position = position
      if (position.lessonId && position.lessonTitle) state.lastLesson = { id: position.lessonId, title: position.lessonTitle, route: position.route, updatedAt: Date.now() }
    })
  }

  saveNote(input: unknown): StudyNote {
    const data = objectInput(input)
    const id = data.id === undefined ? randomUUID() : idInput(data.id)
    const title = textInput(data.title, 300).trim()
    const body = textInput(data.body, 200_000, true)
    const format = data.format ?? 'markdown'
    if (!['markdown', 'html'].includes(format as string)) throw new Error(STUDY_TEXT.NOTE_FORMAT_UNSUPPORTED)
    if (data.tags !== undefined && (!Array.isArray(data.tags) || data.tags.length > 20)) throw new Error(STUDY_TEXT.NOTE_TAGS_INVALID)
    const tags = [...new Set((data.tags as unknown[] | undefined ?? []).map(tag => textInput(tag, 80).trim()))]
    return this.update(state => {
      const index = state.notes.findIndex(note => note.id === id)
      if (data.id !== undefined && index < 0) throw new Error(STUDY_TEXT.NOTE_MISSING)
      const note: StudyNote = { id, title, body, tags, format: format as StudyNote['format'], updatedAt: Date.now(), archived: false }
      if (index < 0) state.notes.push(note)
      else state.notes[index] = note
      return note
    })
  }

  archiveNote(value: unknown): void {
    const id = idInput(value)
    this.update(state => {
      const note = state.notes.find(item => item.id === id)
      if (!note) throw new Error(STUDY_TEXT.NOTE_MISSING)
      note.archived = true
      note.updatedAt = Date.now()
    })
  }
}
