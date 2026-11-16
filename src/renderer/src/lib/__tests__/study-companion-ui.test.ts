import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useStudyStore, STUDY_MAIN_SESSION_ID } from '../../stores/study'
import { STUDY_COPY } from '../study-copy'
import type { StudySnapshot, StudyApi } from '../../../../shared/study-companion'

describe('Study Companion UI Store & Logic', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('window', {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('exports constant STUDY_MAIN_SESSION_ID as "study-main"', () => {
    expect(STUDY_MAIN_SESSION_ID).toBe('study-main')
  })

  it('reports backend unavailable truthfully when window.miai.study is missing', async () => {
    const store = useStudyStore()
    expect(store.isInitialized).toBe(false)
    await store.init()
    expect(store.error).toBe(STUDY_COPY.STATUS.BACKEND_UNAVAILABLE)
  })

  it('handles snapshot state loading correctly when API is available', async () => {
    const mockSnapshot: StudySnapshot = {
      version: 2,
      memory: [
        { id: 'mem-1', text: '偏好使用 Python 讲解二叉树', source: '主会话', refs: ['user'], updatedAt: 1700000000000 }
      ],
      notes: [
        {
          id: 'note-1',
          title: '二叉树基础',
          body: '参考 [[平衡二叉树]] 章节与 [[AVL树]]。',
          tags: ['算法', '数据结构'],
          format: 'markdown',
          updatedAt: 1700000001000
        },
        {
          id: 'note-2',
          title: '平衡二叉树',
          body: '二叉搜索树的自平衡优化。',
          tags: ['算法'],
          format: 'markdown',
          updatedAt: 1700000002000
        }
      ],
      materials: [
        {
          id: 'mat-1',
          name: '离散数学教材.txt',
          kind: 'txt',
          charCount: 15000,
          status: 'ready',
          createdAt: 1700000003000
        }
      ],
      plans: [
        {
          id: 'plan-1',
          materialId: 'mat-1',
          title: '离散数学第1周计划',
          source: 'manual',
          draft: false,
          tasks: [
            { id: 't-1', title: '阅读第1章', description: '第一章基础', status: 'done', lessonId: 'intro-1' },
            { id: 't-2', title: '阅读第2章', description: '第二章核心', status: 'doing', lessonId: 'intro-2' },
            { id: 't-3', title: '练习题集A', description: '习题练习', status: 'todo' }
          ],
          createdAt: 1700000004000
        }
      ],
      position: {
        route: '/lesson/intro-2',
        lessonId: 'intro-2',
        lessonTitle: '关系与函数',
        learnedCount: 5,
        totalLessons: 20,
        updatedAt: 1700000005000
      },
      connections: [
        {
          id: 'conn-1',
          kind: 'claude',
          label: 'Claude Code CLI',
          command: 'claude',
          args: [],
          status: 'ready'
        }
      ],
      activeConnectionId: 'conn-1'
    }

    const mockApi: Partial<StudyApi> = {
      getState: async () => mockSnapshot
    }
    vi.stubGlobal('window', { miai: { study: mockApi } })

    const store = useStudyStore()
    await store.init()

    expect(store.isInitialized).toBe(true)
    expect(store.memories.length).toBe(1)
    expect(store.memories[0].text).toBe('偏好使用 Python 讲解二叉树')

    // allTags computation
    expect(store.allTags).toEqual(['数据结构', '算法'])

    // backlinksMap computation: note-1 links to note-2 ('平衡二叉树')
    const backlinks = store.backlinksMap.get('note-2')
    expect(backlinks).toBeDefined()
    expect(backlinks?.length).toBe(1)
    expect(backlinks?.[0].id).toBe('note-1')

    // allTasks flattened computation
    expect(store.allTasks.length).toBe(3)
    expect(store.allTasks[0].planId).toBe('plan-1')
    expect(store.allTasks[0].planTitle).toBe('离散数学第1周计划')

    // nextTask should prioritize the task with status 'doing' (t-2)
    expect(store.nextTask?.id).toBe('t-2')
    expect(store.nextTask?.title).toBe('阅读第2章')
  })

  it('computes nextTask as first todo when none are doing, and null when all are done', () => {
    const store = useStudyStore()
    store.snapshot = {
      version: 2,
      memory: [],
      notes: [],
      materials: [],
      plans: [
        {
          id: 'p1',
          title: 'Plan A',
          materialId: 'mat-1',
          source: 'ai',
          draft: false,
          tasks: [
            { id: 't-1', title: 'Task 1', description: 'desc 1', status: 'done' },
            { id: 't-2', title: 'Task 2', description: 'desc 2', status: 'todo' },
            { id: 't-3', title: 'Task 3', description: 'desc 3', status: 'todo' }
          ],
          createdAt: 1000
        }
      ],
      position: null,
      connections: [],
      activeConnectionId: null
    }

    expect(store.nextTask?.id).toBe('t-2')

    // Mark all as done
    store.snapshot!.plans[0].tasks[1].status = 'done'
    store.snapshot!.plans[0].tasks[2].status = 'done'
    expect(store.nextTask).toBeNull()
  })

  it('strictly computes token totals following T3 contracts without fabricating pricing or displaying null as 0', () => {
    const store = useStudyStore()
    store.usage = {
      records: [
        {
          id: 'u-1',
          at: 1000,
          provider: 'anthropic',
          model: 'claude-3-7-sonnet',
          sessionId: 'study-main',
          inputTokens: 420,
          cachedInputTokens: 300,
          outputTokens: 80,
          totalTokens: 500,
          source: 'cli'
        },
        {
          id: 'u-2',
          at: 2000,
          provider: 'openai',
          model: 'gpt-4o',
          sessionId: 'topic-math',
          inputTokens: 50,
          cachedInputTokens: null,
          outputTokens: 25,
          totalTokens: 75,
          source: 'api'
        }
      ],
      quotas: [
        {
          provider: 'anthropic',
          label: 'Claude',
          unit: 'tokens',
          source: 'cli',
          updatedAt: 1000,
          remaining: null // should NOT be converted to 0
        }
      ]
    }

    const totals = store.tokenTotals
    expect(totals.uncachedInput).toBe(170) // (420 - 300) + 50
    expect(totals.cachedInput).toBe(300)   // 300 + 0
    expect(totals.output).toBe(105)        // 80 + 25
    expect(totals.total).toBe(575)         // 500 + 75

    // Verify quota remaining null is preserved
    expect(store.usage!.quotas[0]?.remaining).toBeNull()
  })

  it('supports debounced position sync', async () => {
    let callCount = 0
    let lastPos: unknown = null
    const mockApi: Partial<StudyApi> = {
      updatePosition: async (pos) => {
        callCount++
        lastPos = pos
        return { ok: true, data: undefined }
      }
    }
    vi.stubGlobal('window', { miai: { study: mockApi } })

    const store = useStudyStore()
    const p1 = store.updatePosition(
      { route: '/learn', lessonId: 'l1', learnedCount: 1, totalLessons: 10, updatedAt: 1 },
      50
    )
    const p2 = store.updatePosition(
      { route: '/lesson/l2', lessonId: 'l2', learnedCount: 2, totalLessons: 10, updatedAt: 2 },
      50
    )

    await Promise.all([p1, p2])
    expect(callCount).toBe(1)
    expect((lastPos as { lessonId: string }).lessonId).toBe('l2')
  })

  it('does not add cached input twice when a provider omits total tokens', () => {
    const store = useStudyStore()
    store.usage = { records: [{ id: 'u', at: 1, provider: 'test', model: 'test', sessionId: 'study-main',
      inputTokens: 100, cachedInputTokens: 60, outputTokens: 20, totalTokens: null, source: 'api' }], quotas: [] }
    expect(store.tokenTotals).toEqual({ uncachedInput: 40, cachedInput: 60, output: 20, total: 120 })
  })

  it('restores archived HTML through saveNote and clears the selected disconnected transport', async () => {
    const note = { id: 'n', title: 'HTML lesson', body: '<button>1</button>', tags: [], format: 'html' as const, archived: true, updatedAt: 1 }
    const save = vi.fn(async input => ({ ok: true, data: { ...input, archived: false, updatedAt: 2 } }))
    vi.stubGlobal('window', { miai: { study: { saveNote: save, disconnect: async () => ({ ok: true }) } } })
    const store = useStudyStore()
    store.snapshot = { version: 2, memory: [], notes: [note], materials: [], plans: [], position: null,
      connections: [{ id: 'c', kind: 'custom', label: 'ACP', command: 'node', args: [], status: 'ready' }], activeConnectionId: 'c' }
    expect((await store.unarchiveNote('n')).ok).toBe(true)
    expect(save.mock.calls[0][0].format).toBe('html')
    expect(store.notes[0].archived).toBe(false)
    await store.disconnect('c')
    expect(store.activeConnectionId).toBeNull()
  })

  it('excludes draft plans from allTasks and supports confirmPlan and discardPlan', async () => {
    const confirmPlanApi = vi.fn(async (input) => ({
      ok: true as const,
      data: {
        id: input.planId,
        materialId: 'm-1',
        title: input.title,
        source: 'ai' as const,
        draft: false,
        tasks: input.tasks.map((t: { id: string; title: string; description: string }) => ({
          ...t,
          status: 'todo' as const,
          sourceRef: '第 1 节'
        })),
        createdAt: 100
      }
    }))
    const discardPlanApi = vi.fn(async () => ({ ok: true as const, data: undefined }))
    vi.stubGlobal('window', {
      miai: { study: { confirmPlan: confirmPlanApi, discardPlan: discardPlanApi } }
    })

    const store = useStudyStore()
    store.snapshot = {
      version: 2,
      memory: [],
      notes: [],
      materials: [],
      plans: [
        {
          id: 'draft-1',
          materialId: 'm-1',
          title: '草稿计划',
          source: 'ai',
          draft: true,
          tasks: [
            { id: 't1', title: '任务1', description: '说明1', status: 'todo', sourceRef: '第 1 节' },
            { id: 't2', title: '任务2', description: '说明2', status: 'todo', sourceRef: '第 2 节' }
          ],
          createdAt: 100
        },
        {
          id: 'draft-2',
          materialId: 'm-1',
          title: '待放弃草稿',
          source: 'ai',
          draft: true,
          tasks: [{ id: 't3', title: '任务3', description: '说明3', status: 'todo' }],
          createdAt: 101
        }
      ],
      position: null,
      connections: [],
      activeConnectionId: null
    }

    expect(store.allTasks).toEqual([])
    const confirmRes = await store.confirmPlan({
      planId: 'draft-1',
      title: '正式计划',
      tasks: [{ id: 't1', title: '任务1（改）', description: '说明1' }]
    })
    expect(confirmRes.ok).toBe(true)
    expect(store.allTasks.map((t) => t.id)).toEqual(['t1'])

    const discardRes = await store.discardPlan('draft-2')
    expect(discardRes.ok).toBe(true)
    expect(store.plans.map((p) => p.id)).toEqual(['draft-1'])
  })
})
