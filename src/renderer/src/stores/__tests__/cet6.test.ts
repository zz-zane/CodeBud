/**
 * 六级 store（stores/cet6.ts）：考试锁标志与模式持久化。
 * 考试锁是 App / AiContextMenu / 选词工具条共同读的一个计算属性，错一处就是「考试里还能问 AI」，
 * 所以每个条件各钉一条。假 window.miai 用 structuredClone 收件，和真 IPC 同一个守门员。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useCet6Store } from '../cet6'
import type { Cet6Exam, Cet6Mode, Cet6Record } from '../../../../shared/cet6'

const EXAM: Cet6Exam = { id: '2025-06-1', title: 't', year: 2025, month: 6, set: 1, sections: [] }

function stub(records: Record<string, Cet6Record> = {}, opts: { failMode?: boolean; gradeFn?: (req: unknown) => Promise<unknown> } = {}) {
  const saved: Array<{ id: string; record: Cet6Record }> = []
  const modes: Cet6Mode[] = []
  ;(globalThis as unknown as { window: unknown }).window = {
    addEventListener: () => {},
    miai: {
      cet6: {
        getState: () => Promise.resolve({ records: structuredClone(records), media: { root: null, ok: false }, lastMode: 'practice' }),
        saveRecord: (id: string, record: Cet6Record) => {
          saved.push({ id, record: structuredClone(record) })
          return Promise.resolve()
        },
        resetRecord: () => Promise.resolve(),
        setLastMode: (mode: Cet6Mode) => {
          modes.push(mode)
          return opts.failMode ? Promise.reject(new Error('stub')) : Promise.resolve(mode)
        },
        gradeSubjective: (opts as { gradeFn?: (req: unknown) => Promise<unknown> }).gradeFn
          ?? (() => Promise.resolve({ ok: true, grade: { score: 11, comment: 'good structure', at: 1234567 } }))
      }
    }
  }
  vi.stubGlobal('fetch', () => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(structuredClone(EXAM)) }))
  return { saved, modes }
}

beforeEach(() => setActivePinia(createPinia()))
afterEach(() => vi.unstubAllGlobals())

describe('考试锁 examLock', () => {
  it('考试模式 + 未交卷 + 做题页挂载 + 已载入试卷 才锁', async () => {
    stub()
    const s = useCet6Store()
    expect(s.examLock).toBe(false)
    await s.openExam(EXAM.id, 'exam')
    expect(s.record.mode).toBe('exam')
    expect(s.examLock).toBe(false) // 做题页还没挂载
    s.examPageActive = true
    expect(s.examLock).toBe(true)
    s.examPageActive = false
    expect(s.examLock).toBe(false) // 离开做题页即解锁
  })

  it('练习模式不锁', async () => {
    stub()
    const s = useCet6Store()
    await s.openExam(EXAM.id, 'practice')
    s.examPageActive = true
    expect(s.examLock).toBe(false)
  })

  it('交卷后解除，重做考试模式再锁', async () => {
    stub()
    const s = useCet6Store()
    await s.openExam(EXAM.id, 'exam')
    s.examPageActive = true
    await s.submit()
    expect(s.examLock).toBe(false)
    expect(await s.reset('exam')).toBe(true)
    expect(s.examLock).toBe(true)
    expect(await s.reset('practice')).toBe(true)
    expect(s.examLock).toBe(false)
  })

  it('剩余时间由已用秒数推出，续考从原处继续', async () => {
    stub({ [EXAM.id]: { answers: {}, marks: [], submitted: false, seconds: 7000, mode: 'exam' } })
    const s = useCet6Store()
    await s.loadState()
    await s.openExam(EXAM.id)
    expect(s.remaining).toBe(800)
    s.tick()
    expect(s.remaining).toBe(799)
  })
})

describe('模式持久化', () => {
  it('新卷按传入模式开始，落盘带 mode', async () => {
    const { saved } = stub()
    const s = useCet6Store()
    await s.openExam(EXAM.id, 'exam')
    s.toggleAnswer('q1', 'A')
    await s.flush()
    expect(saved.at(-1)?.record.mode).toBe('exam')
  })

  it('已有记录按它自己的模式继续，不被传入的模式改写', async () => {
    stub({ [EXAM.id]: { answers: { q1: 'A' }, marks: [], submitted: false, seconds: 5, mode: 'exam' } })
    const s = useCet6Store()
    await s.loadState()
    await s.openExam(EXAM.id, 'practice')
    expect(s.record.mode).toBe('exam')
    expect(s.record.answers).toEqual({ q1: 'A' })
  })

  it('lastMode：读自 getState，切换走 IPC，失败回滚', async () => {
    const ok = stub()
    const s = useCet6Store()
    await s.loadState()
    expect(s.lastMode).toBe('practice')
    await s.setLastMode('exam')
    expect(s.lastMode).toBe('exam')
    expect(ok.modes).toEqual(['exam'])

    setActivePinia(createPinia())
    stub({}, { failMode: true })
    const t = useCet6Store()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await t.setLastMode('exam')
    expect(t.lastMode).toBe('practice')
  })
})

describe('主观题 AI 估分', () => {
  it('成功估分时更新 record.aiGrades 与 records 缓存', async () => {
    stub()
    const s = useCet6Store()
    await s.openExam(EXAM.id, 'practice')
    s.setText('q-writing', 'My essay')
    await s.flush()
    s.record.submitted = true
    const ok = await s.gradeSubjective({
      questionId: 'q-writing',
      kind: 'writing',
      prompt: 'Directions...',
      answer: 'My essay'
    })
    expect(ok).toBe(true)
    expect(s.record.aiGrades?.['q-writing']).toEqual({ score: 11, comment: 'good structure', at: 1234567 })
    expect(s.records[EXAM.id]?.aiGrades?.['q-writing']?.score).toBe(11)
    expect(s.gradeError['q-writing']).toBeUndefined()
  })

  it('估分失败时记录错误消息并保留现有记录', async () => {
    stub({}, {
      gradeFn: async () => ({ ok: false, reason: 'bad-response' })
    } as { failMode?: boolean })
    const s = useCet6Store()
    await s.openExam(EXAM.id, 'practice')
    s.setText('q-trans', 'My translation')
    await s.flush()
    s.record.submitted = true
    const ok = await s.gradeSubjective({
      questionId: 'q-trans',
      kind: 'translation',
      prompt: 'Translate...',
      answer: 'My translation'
    })
    expect(ok).toBe(false)
    expect(s.gradeError['q-trans']).toBeTruthy()
    expect(s.grading['q-trans']).toBeUndefined()
  })

  it('重做后忽略旧的在途估分', async () => {
    let finish!: (value: unknown) => void
    stub({}, { gradeFn: () => new Promise(resolve => { finish = resolve }) })
    const s = useCet6Store()
    await s.openExam(EXAM.id, 'practice')
    s.setText('q-writing', 'old answer')
    await s.flush()
    s.record.submitted = true
    const pending = s.gradeSubjective({ questionId: 'q-writing', kind: 'writing', prompt: 'p', answer: 'old answer' })
    await s.reset()
    finish({ ok: true, grade: { score: 12, comment: 'old', at: 1 } })
    expect(await pending).toBe(false)
    expect(s.record.aiGrades).toBeUndefined()
  })

  it('当前答案与请求原文有任何差异时忽略在途估分', async () => {
    let finish!: (value: unknown) => void
    stub({}, { gradeFn: () => new Promise(resolve => { finish = resolve }) })
    const s = useCet6Store()
    await s.openExam(EXAM.id, 'practice')
    s.setText('q-writing', 'old answer')
    await s.flush()
    s.record.submitted = true
    const pending = s.gradeSubjective({ questionId: 'q-writing', kind: 'writing', prompt: 'p', answer: 'old answer' })
    s.record.answers['q-writing'] = 'old answer '
    finish({ ok: true, grade: { score: 12, comment: 'old', at: 1 } })
    expect(await pending).toBe(false)
    expect(s.record.aiGrades).toBeUndefined()
  })
})
