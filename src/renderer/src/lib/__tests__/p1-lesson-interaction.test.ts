import { describe, expect, it } from 'vitest'
import { isIntroLesson, lessonNoteTitle } from '../course-navigation'
import { pickPrioritizedPaper } from '../practice-paper'
import type { Question } from '../../../../shared/types'

describe('P1-6: 入门课判定 isIntroLesson', () => {
  it('识别通用知识第1课为入门课', () => {
    expect(isIntroLesson({ id: 'common-01', stage: 0, title: '编程与程序' })).toBe(true)
  })

  it('识别第一阶段第1课为入门课', () => {
    expect(isIntroLesson({ id: 'python-stage1-01', stage: 1, title: '认识 Python 与第一个程序' })).toBe(true)
    expect(isIntroLesson({ id: 'c-s1-01-intro', stage: 1, title: 'Hello World' })).toBe(true)
    expect(isIntroLesson({ id: 'java-stage1-01', stage: 1, title: 'Java 入门与环境' })).toBe(true)
  })

  it('高阶段或非第1课不应被误判为入门课', () => {
    expect(isIntroLesson({ id: 'python-stage1-05', stage: 1, title: 'print 与 input' })).toBe(false)
    expect(isIntroLesson({ id: 'python-stage2-01', stage: 2, title: '面向对象基础' })).toBe(false)
    expect(isIntroLesson({ id: 'cpp-stage3-01', stage: 3, title: '模板与泛型' })).toBe(false)
    expect(isIntroLesson(null)).toBe(false)
  })
})

describe('P1-6: 随机练习按当前语言聚焦 pickPrioritizedPaper', () => {
  const dummyQ = (id: string): Question => ({
    id,
    type: 'choice',
    stem: `Question ${id}`,
    options: ['A', 'B', 'C', 'D'],
    answer: 0,
    explanation: 'Exp'
  })

  it('当正在学的语言题目充足时，全部抽取该语言题目', () => {
    const pool = [
      { lessonId: 'py-01', question: dummyQ('q1') },
      { lessonId: 'py-02', question: dummyQ('q2') },
      { lessonId: 'py-03', question: dummyQ('q3') },
      { lessonId: 'c-01', question: dummyQ('q4') },
      { lessonId: 'c-02', question: dummyQ('q5') }
    ]
    const langMap: Record<string, string> = {
      'py-01': 'python',
      'py-02': 'python',
      'py-03': 'python',
      'c-01': 'c',
      'c-02': 'c'
    }
    const picked = pickPrioritizedPaper(pool, 2, 'python', (id) => langMap[id], () => 0.5)
    expect(picked.length).toBe(2)
    expect(picked.every((p) => langMap[p.lessonId] === 'python')).toBe(true)
  })

  it('当正在学的语言题目不足时，优先抽取该语言后由其他语言补充凑满', () => {
    const pool = [
      { lessonId: 'py-01', question: dummyQ('q1') },
      { lessonId: 'c-01', question: dummyQ('q2') },
      { lessonId: 'c-02', question: dummyQ('q3') }
    ]
    const langMap: Record<string, string> = {
      'py-01': 'python',
      'c-01': 'c',
      'c-02': 'c'
    }
    const picked = pickPrioritizedPaper(pool, 2, 'python', (id) => langMap[id], () => 0.5)
    expect(picked.length).toBe(2)
    expect(langMap[picked[0].lessonId]).toBe('python')
    expect(langMap[picked[1].lessonId]).toBe('c')
  })
})

describe('P1-3: 随堂笔记「首字输入才创建」与自动关联', () => {
  it('标题格式化与 lessonNoteTitle 对齐', () => {
    const title = lessonNoteTitle({ id: 'python-stage1-01', title: '认识 Python', category: 'basics' })
    expect(title).toBe('【课程】认识 Python 学习笔记')
  })

  it('模拟首字输入才创建的幂等流程', () => {
    let createdItem: { id: string; title: string; body: string } | null = null
    const dummyAdd = (title: string) => {
      createdItem = { id: 'memo-123', title, body: '' }
      return createdItem
    }

    let noteDraft = ''
    let currentNoteId: string | null = null

    // 打开抽屉但未输入任何字符
    if (!currentNoteId && noteDraft.trim().length > 0) {
      currentNoteId = dummyAdd('【课程】测试 学习笔记').id
    }
    expect(createdItem).toBeNull()
    expect(currentNoteId).toBeNull()

    // 仅输入空白字符不应创建
    noteDraft = '   '
    if (!currentNoteId && noteDraft.trim().length > 0) {
      currentNoteId = dummyAdd('【课程】测试 学习笔记').id
    }
    expect(createdItem).toBeNull()

    // 输入第一个有效字符时创建
    noteDraft = '第'
    if (!currentNoteId && noteDraft.trim().length > 0) {
      currentNoteId = dummyAdd('【课程】测试 学习笔记').id
    }
    expect(createdItem).not.toBeNull()
    expect(currentNoteId).toBe('memo-123')

    // 继续输入不应重复创建
    noteDraft = '第一条笔记完成'
    const prevId = currentNoteId
    if (!currentNoteId && noteDraft.trim().length > 0) {
      currentNoteId = dummyAdd('【课程】测试 学习笔记 2').id
    }
    expect(currentNoteId).toBe(prevId)
  })
})

describe('P1-4: 首页继续学习取数优先级', () => {
  it('优先使用 recentLessonId，若无则降级到 history，再降级到 learned', () => {
    function pickRecentLesson(
      recentId: string | null,
      history: { lessonId: string }[],
      learned: string[],
      resolve: (id: string) => string | null
    ): string | null {
      if (recentId && resolve(recentId)) return resolve(recentId)
      if (history.length > 0) {
        const last = history[history.length - 1]
        const l = resolve(last.lessonId)
        if (l) return l
      }
      if (learned.length > 0) {
        const lastId = learned[learned.length - 1]
        const l = resolve(lastId)
        if (l) return l
      }
      return null
    }

    const resolver = (id: string) => `Lesson:${id}`

    // 1. 全部存在时，recentId 胜出
    expect(
      pickRecentLesson('py-03', [{ lessonId: 'py-02' }], ['py-01'], resolver)
    ).toBe('Lesson:py-03')

    // 2. recentId 为空时，history 末尾胜出
    expect(
      pickRecentLesson(null, [{ lessonId: 'py-01' }, { lessonId: 'py-02' }], ['py-00'], resolver)
    ).toBe('Lesson:py-02')

    // 3. history 为空时，learned 末尾胜出
    expect(
      pickRecentLesson(null, [], ['py-01', 'py-05'], resolver)
    ).toBe('Lesson:py-05')
  })
})
