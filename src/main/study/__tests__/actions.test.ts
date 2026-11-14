import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { StudyStore } from '../store'
import { applyStudyActions } from '../actions'
import type { AiChatSession } from '../../../shared/types'

const root = resolve('D:/project/coding/outputs/study-companion-20261105/root-tests')
let dir: string
let store: StudyStore
beforeEach(() => { mkdirSync(root, { recursive: true }); dir = mkdtempSync(join(root, 'actions-')); store = new StudyStore(dir) })
afterEach(() => {
  if (!dir.startsWith(root + '\\') && !dir.startsWith(root + '/')) throw new Error('Invalid cleanup target')
  rmSync(dir, { recursive: true, force: true })
})
const text = (actions: unknown[]) => 'Reply\n```study-actions\n' + JSON.stringify(actions) + '\n```'
function apply(actions: unknown[], sessionId = 'study-main', createChat: (session: AiChatSession) => void = () => {}, turnId: string = crypto.randomUUID()) {
  return applyStudyActions({ store, text: text(actions), sessionId, turnId, isLesson: id => id === 'common-01', createChat })
}

describe('audited study actions', () => {
  it('creates grounded memory and knowledge once per turn and preserves existing data', () => {
    store.saveMemory({ text: 'user fact' })
    const values = [{ type: 'remember', text: 'I prefer examples' }, { type: 'save_note', title: 'Loops', body: 'See [[Variables]]', tags: ['coding'] }]
    const first = apply(values, 'study-main', () => {}, 'same-turn')
    expect(first.actions.every(item => item.ok)).toBe(true)
    expect(first.text).not.toContain('```study-actions')
    apply(values, 'study-main', () => {}, 'same-turn')
    expect(store.read().memory).toHaveLength(2)
    expect(store.read().notes).toHaveLength(1)
    expect(store.read().actions).toHaveLength(2)
    expect(new StudyStore(dir).read().notes[0].body).toContain('[[Variables]]')
  })
  it('rejects side-chat writes, external routes and invented lessons', () => {
    expect(apply([{ type: 'remember', text: 'not allowed' }], 'side-chat').actions[0].ok).toBe(false)
    expect(apply([{ type: 'navigate', route: 'https://example.com' }]).actions[0].ok).toBe(false)
    expect(apply([{ type: 'navigate', route: '/lesson/fake-course' }]).actions[0].ok).toBe(false)
    expect(store.read().memory).toEqual([])
  })
  it('returns a real validated course target and creates a separate topic conversation', () => {
    const created: AiChatSession[] = []
    const result = apply([{ type: 'navigate', route: '/lesson/common-01' }, { type: 'create_chat', title: 'Vectors', question: 'Explain vectors' }], 'study-main', session => created.push(session))
    expect(result.actions[0].route).toBe('/lesson/common-01')
    expect(created[0].id).not.toBe('study-main')
    expect(created[0].messages[0].content).toBe('Explain vectors')
    expect(result.createdSessions).toEqual(created)
  })
  it('does not execute malformed or unknown actions', () => {
    expect(apply([{ type: 'shell', command: 'delete files' }]).actions[0].ok).toBe(false)
    const malformed = applyStudyActions({ store, text: '```study-actions\nnot json\n```', sessionId: 'study-main', turnId: 't', isLesson: () => false, createChat: () => {} })
    expect(malformed.actions).toEqual([])
    expect(malformed.text).toContain('未执行')
  })
})
