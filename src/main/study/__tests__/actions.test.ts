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
function apply(actions: unknown[], sessionId = 'study-main', createChat: (session: AiChatSession) => void = () => {}, turnId: string = crypto.randomUUID(), userMessage = '') {
  return applyStudyActions({ store, text: text(actions), userMessage, sessionId, turnId, isLesson: id => id === 'common-01', createChat })
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
    expect(store.read().memory[1].refs).toEqual(['chat:same-turn'])
    expect(store.read().notes).toHaveLength(1)
    expect(store.read().actions).toHaveLength(2)
    expect(new StudyStore(dir).read().notes[0].body).toContain('[[Variables]]')
  })

  it('attaches valid lesson refs, rejects banned phrases/unquoted absolutes, and enforces 240 char cap', () => {
    const withLesson = apply([{ type: 'remember', text: '常漏写链表头节点判空', lessonId: 'common-01' }], 'study-main', () => {}, 'turn-1')
    expect(withLesson.actions[0].ok).toBe(true)
    expect(store.read().memory[0].refs).toEqual(['chat:turn-1', 'lesson:common-01'])

    const badLesson = apply([{ type: 'remember', text: '循环边界容易差一', lessonId: 'missing-lesson' }], 'study-main', () => {}, 'turn-2')
    expect(badLesson.actions[0].ok).toBe(false)

    const banned = apply([{ type: 'remember', text: '学员已经彻底掌握链表' }], 'study-main', () => {}, 'turn-3')
    expect(banned.actions[0].ok).toBe(false)
    expect(banned.actions[0].message).toContain('包含绝对化表述')

    const quoted = apply([{ type: 'remember', text: '学员自述「我已经完全掌握指针」，待练题验证' }], 'study-main', () => {}, 'turn-4', '我已经完全掌握指针')
    expect(quoted.actions[0].ok).toBe(true)
    const invented = apply([{ type: 'remember', text: '学员「完全掌握」指针' }], 'study-main', () => {}, 'turn-invented', '我在学习指针')
    expect(invented.actions[0].ok).toBe(false)

    const tooLong = apply([{ type: 'remember', text: 'a'.repeat(241) }], 'study-main', () => {}, 'turn-5')
    expect(tooLong.actions[0].ok).toBe(false)
    expect(store.read().memory).toHaveLength(2)
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
    const malformed = applyStudyActions({ store, text: '```study-actions\nnot json\n```', userMessage: '', sessionId: 'study-main', turnId: 't', isLesson: () => false, createChat: () => {} })
    expect(malformed.actions).toEqual([])
    expect(malformed.text).toContain('未执行')
  })
})
