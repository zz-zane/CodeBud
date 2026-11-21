import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type {
  StudySnapshot,
  StudyMemory,
  StudyNote,
  StudyMaterial,
  StudyTask,
  StudyPlan,
  StudyPosition,
  StudyConnection,
  StudyUsage,
  StudyUsageRecord,
  StudyQuota,
  StudyResult,
  StudyApi,
  StudyTaskEdit
} from '../../../shared/study-companion'
import { STUDY_COPY } from '../lib/study-copy'
import { CURRENT_STUDY_VERSION } from '../../../shared/study-companion'
import { DATA_STORE } from '../../../shared/copy'

export type {
  StudySnapshot,
  StudyMemory,
  StudyNote,
  StudyMaterial,
  StudyTask,
  StudyPlan,
  StudyPosition,
  StudyConnection,
  StudyUsage,
  StudyUsageRecord,
  StudyQuota,
  StudyResult,
  StudyApi
}

export type StudyTabKey = 'memory' | 'knowledge' | 'materials' | 'tasks' | 'connections' | 'usage' | 'math'

export { STUDY_MAIN_SESSION_ID } from '../../../shared/study-companion'

export const useStudyStore = defineStore('study', () => {
  const snapshot = ref<StudySnapshot | null>(null)
  const usage = ref<StudyUsage | null>(null)
  const mathResult = ref<{ output: string; plots: string[] } | null>(null)
  const isLoading = ref<boolean>(false)
  const error = ref<string | null>(null)
  const activeTab = ref<StudyTabKey>('memory')

  const selectedNoteId = ref<string | null>(null)
  const selectedMaterialId = ref<string | null>(null)
  const showArchivedNotes = ref<boolean>(false)

  const isInitialized = computed(() => snapshot.value !== null)

  // 检测真实 window.miai.study 可用能力
  const studyApi = computed<Partial<StudyApi> | null>(() => {
    if (typeof window !== 'undefined' && (window as unknown as { miai?: { study?: Partial<StudyApi> } }).miai?.study) {
      return (window as unknown as { miai: { study: Partial<StudyApi> } }).miai.study
    }
    return null
  })

  const isMethodAvailable = (name: keyof StudyApi): boolean => {
    return Boolean(studyApi.value && typeof studyApi.value[name] === 'function')
  }

  // 基础数据访问器
  const memories = computed<StudyMemory[]>(() => snapshot.value?.memory ?? [])
  const notes = computed<StudyNote[]>(() => snapshot.value?.notes ?? [])
  const materials = computed<StudyMaterial[]>(() => snapshot.value?.materials ?? [])
  const plans = computed<StudyPlan[]>(() => snapshot.value?.plans ?? [])
  const position = computed<StudyPosition | null>(() => snapshot.value?.position ?? null)
  const connections = computed<StudyConnection[]>(() => snapshot.value?.connections ?? [])
  const activeConnectionId = computed<string | null>(() => snapshot.value?.activeConnectionId ?? null)

  const activeNotes = computed<StudyNote[]>(() => notes.value.filter((n) => !n.archived))
  const archivedNotes = computed<StudyNote[]>(() => notes.value.filter((n) => Boolean(n.archived)))
  const displayedNotes = computed<StudyNote[]>(() => (showArchivedNotes.value ? notes.value : activeNotes.value))

  const selectedNote = computed<StudyNote | null>(() => {
    if (!selectedNoteId.value) return null
    return notes.value.find((n) => n.id === selectedNoteId.value) ?? null
  })

  const selectedMaterial = computed<StudyMaterial | null>(() => {
    if (!selectedMaterialId.value) return null
    return materials.value.find((m) => m.id === selectedMaterialId.value) ?? null
  })

  // 知识库全局 Tag 汇总
  const allTags = computed<string[]>(() => {
    const set = new Set<string>()
    for (const note of notes.value) {
      if (Array.isArray(note.tags)) {
        for (const tag of note.tags) {
          if (tag && tag.trim()) set.add(tag.trim())
        }
      }
    }
    return Array.from(set).sort()
  })

  // 提取知识库所有 Wiki 引用与反向链接 (Backlinks)
  // 匹配 [[NoteTitle]] 或 [[NoteId]]
  const backlinksMap = computed<Map<string, StudyNote[]>>(() => {
    const map = new Map<string, StudyNote[]>()
    const titleToId = new Map<string, string>()
    for (const note of notes.value) {
      titleToId.set(note.title.toLowerCase().trim(), note.id)
    }

    for (const note of notes.value) {
      if (!note.body) continue
      const wikiRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g
      let match: RegExpExecArray | null
      while ((match = wikiRegex.exec(note.body)) !== null) {
        const target = match[1].trim().toLowerCase()
        const targetId = titleToId.get(target) || match[1].trim()
        if (targetId && targetId !== note.id) {
          const list = map.get(targetId) ?? []
          if (!list.some((existing) => existing.id === note.id)) {
            list.push(note)
          }
          map.set(targetId, list)
        }
      }
    }
    return map
  })

  // 所有已确认计划扁平任务列表（草稿不进今天页 / 待办计数）
  const allTasks = computed<Array<StudyTask & { planId: string; planTitle: string }>>(() => {
    const out: Array<StudyTask & { planId: string; planTitle: string }> = []
    for (const plan of plans.value) {
      if (plan.draft) continue
      if (Array.isArray(plan.tasks)) {
        for (const task of plan.tasks) {
          out.push({
            ...task,
            planId: plan.id,
            planTitle: plan.title
          })
        }
      }
    }
    return out
  })

  // 下一个待办或进行中任务
  const nextTask = computed<Array<StudyTask & { planId: string; planTitle: string }>[0] | null>(() => {
    const doing = allTasks.value.find((t) => t.status === 'doing')
    if (doing) return doing
    return allTasks.value.find((t) => t.status === 'todo') ?? null
  })

  // Token 汇总 (严格遵循 T3 合约逻辑：cached 与 uncached 分开，总量包含 uncached+cached+output，不重复计算)
  const tokenTotals = computed(() => {
    const records = usage.value?.records ?? []
    let uncachedInput = 0
    let cachedInput = 0
    let output = 0
    let total = 0

    for (const r of records) {
      if (typeof r.inputTokens === 'number') uncachedInput += Math.max(0, r.inputTokens - (r.cachedInputTokens ?? 0))
      if (typeof r.cachedInputTokens === 'number') cachedInput += r.cachedInputTokens
      if (typeof r.outputTokens === 'number') output += r.outputTokens
      if (typeof r.totalTokens === 'number') {
        total += r.totalTokens
      } else {
        if (r.inputTokens !== null && r.outputTokens !== null) total += r.inputTokens + r.outputTokens
      }
    }

    return {
      uncachedInput,
      cachedInput,
      output,
      total
    }
  })

  // ---------------------------------------------------- Store 操作方法

  /**
   * 初始化并拉取最新状态（真实 IPC 调用）
   */
  async function init(): Promise<void> {
    if (!studyApi.value?.getState) {
      error.value = STUDY_COPY.STATUS.BACKEND_UNAVAILABLE
      return
    }
    isLoading.value = true
    error.value = null
    try {
      const snap = await studyApi.value.getState()
      snapshot.value = snap
      if (snap.version > CURRENT_STUDY_VERSION) error.value = DATA_STORE.NEWER_VERSION
    } catch (err) {
      error.value = (err as Error)?.message || STUDY_COPY.STATUS.LOAD_FAILED
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 保存持久记忆
   */
  async function saveMemory(input: { id?: string; text: string; source?: string }): Promise<StudyResult<StudyMemory>> {
    if (!studyApi.value?.saveMemory) {
      return { ok: false, error: STUDY_COPY.STATUS.PENDING_BACKEND }
    }
    try {
      const res = await studyApi.value.saveMemory(input)
      if (res.ok && res.data) {
        if (!snapshot.value) {
          snapshot.value = {
            version: 2,
            memory: [res.data],
            notes: [],
            materials: [],
            plans: [],
            position: null,
            connections: [],
            activeConnectionId: null
          }
        } else {
          const idx = snapshot.value.memory.findIndex((m) => m.id === res.data.id)
          if (idx !== -1) {
            snapshot.value.memory[idx] = res.data
          } else {
            snapshot.value.memory.push(res.data)
          }
        }
      }
      return res
    } catch (err) {
      return { ok: false, error: (err as Error)?.message || 'saveMemory error' }
    }
  }

  /**
   * 遗忘持久记忆
   */
  async function forgetMemory(id: string): Promise<StudyResult<void>> {
    if (!studyApi.value?.forgetMemory) {
      return { ok: false, error: STUDY_COPY.STATUS.PENDING_BACKEND }
    }
    try {
      const res = await studyApi.value.forgetMemory(id)
      if (res.ok && snapshot.value) {
        snapshot.value.memory = snapshot.value.memory.filter((m) => m.id !== id)
      }
      return res
    } catch (err) {
      return { ok: false, error: (err as Error)?.message || 'forgetMemory error' }
    }
  }

  /**
   * 同步当前学习位置（静默同步，失败不阻塞，支持 debounceMs）
   */
  let positionSyncTimer: ReturnType<typeof setTimeout> | null = null
  let pendingPositionResolve: ((res: StudyResult<void>) => void) | null = null

  async function updatePosition(pos: StudyPosition, debounceMs = 0): Promise<StudyResult<void>> {
    if (debounceMs > 0) {
      if (positionSyncTimer) {
        clearTimeout(positionSyncTimer)
        positionSyncTimer = null
      }
      if (pendingPositionResolve) {
        pendingPositionResolve({ ok: true, data: undefined })
        pendingPositionResolve = null
      }
      return new Promise((resolve) => {
        pendingPositionResolve = resolve
        positionSyncTimer = setTimeout(async () => {
          positionSyncTimer = null
          pendingPositionResolve = null
          const res = await updatePosition(pos, 0)
          resolve(res)
        }, debounceMs)
      })
    }
    if (!studyApi.value?.updatePosition) {
      return { ok: false, error: STUDY_COPY.STATUS.PENDING_BACKEND }
    }
    try {
      const res = await studyApi.value.updatePosition(pos)
      if (res.ok && snapshot.value) {
        snapshot.value.position = pos
      }
      return res
    } catch (err) {
      return { ok: false, error: (err as Error)?.message || 'updatePosition error' }
    }
  }

  /**
   * 保存知识库笔记（待后端阶段接通，当前诚实报告）
   */
  async function saveNote(input: {
    id?: string
    title: string
    body: string
    tags?: string[]
    format?: 'markdown' | 'html'
  }): Promise<StudyResult<StudyNote>> {
    if (!studyApi.value?.saveNote) {
      return { ok: false, error: STUDY_COPY.STATUS.PENDING_BACKEND }
    }
    try {
      const res = await studyApi.value.saveNote(input)
      if (res.ok && res.data && snapshot.value) {
        const idx = snapshot.value.notes.findIndex((n) => n.id === res.data.id)
        if (idx !== -1) snapshot.value.notes[idx] = res.data
        else snapshot.value.notes.push(res.data)
      }
      return res
    } catch (err) {
      return { ok: false, error: (err as Error)?.message || 'saveNote error' }
    }
  }

  /**
   * 归档知识库笔记
   */
  async function archiveNote(id: string): Promise<StudyResult<void>> {
    if (!studyApi.value?.archiveNote) {
      return { ok: false, error: STUDY_COPY.STATUS.PENDING_BACKEND }
    }
    try {
      const res = await studyApi.value.archiveNote(id)
      if (res.ok && snapshot.value) {
        const target = snapshot.value.notes.find((n) => n.id === id)
        if (target) target.archived = true
      }
      return res
    } catch (err) {
      return { ok: false, error: (err as Error)?.message || 'archiveNote error' }
    }
  }

  async function unarchiveNote(id: string): Promise<StudyResult<void>> {
    const note = notes.value.find(n => n.id === id)
    if (!note) return { ok: false, error: STUDY_COPY.STATUS.LOAD_FAILED }
    const res = await saveNote({ id: note.id, title: note.title, body: note.body, tags: [...note.tags], format: note.format })
    return res.ok ? { ok: true, data: undefined } : res
  }

  /**
   * 导入教材
   */
  async function importMaterials(): Promise<StudyResult<StudyMaterial[]>> {
    if (!studyApi.value?.importMaterials) {
      return { ok: false, error: STUDY_COPY.STATUS.PENDING_BACKEND }
    }
    try {
      const res = await studyApi.value.importMaterials()
      if (res.ok && Array.isArray(res.data) && snapshot.value) {
        snapshot.value.materials.push(...res.data)
      }
      return res
    } catch (err) {
      return { ok: false, error: (err as Error)?.message || 'importMaterials error' }
    }
  }

  /**
   * 读取教材正文
   */
  async function readMaterial(id: string): Promise<StudyResult<{ text: string }>> {
    if (!studyApi.value?.readMaterial) {
      return { ok: false, error: STUDY_COPY.STATUS.PENDING_BACKEND }
    }
    try {
      return await studyApi.value.readMaterial(id)
    } catch (err) {
      return { ok: false, error: (err as Error)?.message || 'readMaterial error' }
    }
  }

  /**
   * 根据教材生成自适应计划
   */
  async function generatePlan(input: { materialId: string; goal: string }): Promise<StudyResult<StudyPlan>> {
    if (!studyApi.value?.generatePlan) {
      return { ok: false, error: STUDY_COPY.STATUS.PENDING_BACKEND }
    }
    try {
      const res = await studyApi.value.generatePlan(input)
      if (res.ok && res.data && snapshot.value) {
        snapshot.value.plans.push(res.data)
      }
      return res
    } catch (err) {
      return { ok: false, error: (err as Error)?.message || 'generatePlan error' }
    }
  }

  /**
   * 确认草稿计划（可编辑标题、任务标题/说明、删减任务，sourceRef 不可改）
   */
  async function confirmPlan(input: { planId: string; title: string; tasks: Array<{ id: string; title: string; description: string }> }): Promise<StudyResult<StudyPlan>> {
    if (!studyApi.value?.confirmPlan) {
      return { ok: false, error: STUDY_COPY.STATUS.PENDING_BACKEND }
    }
    try {
      const res = await studyApi.value.confirmPlan(input)
      if (res.ok && res.data && snapshot.value) {
        const index = snapshot.value.plans.findIndex((p) => p.id === res.data.id)
        if (index >= 0) snapshot.value.plans[index] = res.data
        else snapshot.value.plans.push(res.data)
      }
      return res
    } catch (err) {
      return { ok: false, error: (err as Error)?.message || 'confirmPlan error' }
    }
  }

  /**
   * 放弃草稿计划
   */
  async function discardPlan(planId: string): Promise<StudyResult<void>> {
    if (!studyApi.value?.discardPlan) {
      return { ok: false, error: STUDY_COPY.STATUS.PENDING_BACKEND }
    }
    try {
      const res = await studyApi.value.discardPlan(planId)
      if (res.ok && snapshot.value) {
        snapshot.value.plans = snapshot.value.plans.filter((p) => p.id !== planId)
      }
      return res
    } catch (err) {
      return { ok: false, error: (err as Error)?.message || 'discardPlan error' }
    }
  }

  /** 任务增删改：成功后整份重载快照（任务组可能新增 / 删除，局部打补丁容易漏） */
  async function editTasks(input: StudyTaskEdit): Promise<StudyResult<StudyPlan | null>> {
    if (!studyApi.value?.editTasks) return { ok: false, error: STUDY_COPY.STATUS.PENDING_BACKEND }
    try {
      const res = await studyApi.value.editTasks(input)
      if (res.ok) await init()
      return res
    } catch (err) {
      return { ok: false, error: (err as Error)?.message || 'editTasks error' }
    }
  }

  /**
   * 切换任务进度状态
   */
  async function setTaskStatus(
    inputOrPlanId: { planId: string; taskId: string; status: 'todo' | 'doing' | 'done' } | string,
    taskId?: string,
    status?: 'todo' | 'doing' | 'done'
  ): Promise<StudyResult<void>> {
    const input =
      typeof inputOrPlanId === 'string'
        ? { planId: inputOrPlanId, taskId: taskId!, status: status! }
        : inputOrPlanId

    if (!studyApi.value?.setTaskStatus) {
      return { ok: false, error: STUDY_COPY.STATUS.PENDING_BACKEND }
    }
    try {
      const res = await studyApi.value.setTaskStatus(input)
      if (res.ok && snapshot.value) {
        const plan = snapshot.value.plans.find((p) => p.id === input.planId)
        const task = plan?.tasks.find((t) => t.id === input.taskId)
        if (task) task.status = input.status
      }
      return res
    } catch (err) {
      return { ok: false, error: (err as Error)?.message || 'setTaskStatus error' }
    }
  }

  /**
   * 保存连接配置
   */
  async function saveConnection(input: {
    id?: string
    kind: StudyConnection['kind']
    label: string
    command: string
    args: string[]
    model?: string
  }): Promise<StudyResult<StudyConnection>> {
    if (!studyApi.value?.saveConnection) {
      return { ok: false, error: STUDY_COPY.STATUS.PENDING_BACKEND }
    }
    try {
      const res = await studyApi.value.saveConnection(input)
      if (res.ok && res.data && snapshot.value) {
        const idx = snapshot.value.connections.findIndex((c) => c.id === res.data.id)
        if (idx !== -1) snapshot.value.connections[idx] = res.data
        else snapshot.value.connections.push(res.data)
      }
      return res
    } catch (err) {
      return { ok: false, error: (err as Error)?.message || 'saveConnection error' }
    }
  }

  async function detectAgent(): Promise<StudyResult<string | null>> {
    if (!studyApi.value?.detectAgent) return { ok: false, error: STUDY_COPY.STATUS.PENDING_BACKEND }
    try { return await studyApi.value.detectAgent() } catch (err) { return { ok: false, error: (err as Error)?.message || 'detectAgent error' } }
  }

  async function listModels(command: string): Promise<StudyResult<Array<{ id: string; name: string }>>> {
    if (!studyApi.value?.listModels) return { ok: false, error: STUDY_COPY.STATUS.PENDING_BACKEND }
    try { return await studyApi.value.listModels(command) } catch (err) { return { ok: false, error: (err as Error)?.message || 'listModels error' } }
  }

  /**
   * 启动连接
   */
  async function connect(id: string): Promise<StudyResult<StudyConnection>> {
    if (!studyApi.value?.connect) {
      return { ok: false, error: STUDY_COPY.STATUS.PENDING_BACKEND }
    }
    try {
      const res = await studyApi.value.connect(id)
      if (res.ok && res.data && snapshot.value) {
        const idx = snapshot.value.connections.findIndex((c) => c.id === res.data.id)
        if (idx !== -1) snapshot.value.connections[idx] = res.data
      }
      return res
    } catch (err) {
      return { ok: false, error: (err as Error)?.message || 'connect error' }
    }
  }

  /**
   * 协商认证
   */
  async function authenticate(
    inputOrConnId: { connectionId: string; methodId: string } | string,
    methodId?: string
  ): Promise<StudyResult<StudyConnection>> {
    const input =
      typeof inputOrConnId === 'string'
        ? { connectionId: inputOrConnId, methodId: methodId! }
        : inputOrConnId

    if (!studyApi.value?.authenticate) {
      return { ok: false, error: STUDY_COPY.STATUS.PENDING_BACKEND }
    }
    try {
      const res = await studyApi.value.authenticate(input)
      if (res.ok && res.data && snapshot.value) {
        const idx = snapshot.value.connections.findIndex((c) => c.id === res.data.id)
        if (idx !== -1) snapshot.value.connections[idx] = res.data
      }
      return res
    } catch (err) {
      return { ok: false, error: (err as Error)?.message || 'authenticate error' }
    }
  }

  /**
   * 断开连接
   */
  async function disconnect(id: string): Promise<StudyResult<void>> {
    if (!studyApi.value?.disconnect) {
      return { ok: false, error: STUDY_COPY.STATUS.PENDING_BACKEND }
    }
    try {
      const res = await studyApi.value.disconnect(id)
      if (res.ok && snapshot.value) {
        const conn = snapshot.value.connections.find((c) => c.id === id)
        if (conn) conn.status = 'disconnected'
        if (snapshot.value.activeConnectionId === id) snapshot.value.activeConnectionId = null
      }
      return res
    } catch (err) {
      return { ok: false, error: (err as Error)?.message || 'disconnect error' }
    }
  }

  /**
   * 激活连接 (null 为原生配置)
   */
  async function selectConnection(id: string | null): Promise<StudyResult<void>> {
    if (!studyApi.value?.selectConnection) {
      return { ok: false, error: STUDY_COPY.STATUS.PENDING_BACKEND }
    }
    try {
      const res = await studyApi.value.selectConnection(id)
      if (res.ok && snapshot.value) {
        snapshot.value.activeConnectionId = id
      }
      return res
    } catch (err) {
      return { ok: false, error: (err as Error)?.message || 'selectConnection error' }
    }
  }

  /**
   * 获取用量统计
   */
  async function getUsage(refresh = false): Promise<StudyResult<StudyUsage>> {
    if (!studyApi.value?.getUsage) {
      return { ok: false, error: STUDY_COPY.STATUS.PENDING_BACKEND }
    }
    try {
      const res = await studyApi.value.getUsage(refresh)
      if (res.ok && res.data) {
        usage.value = res.data
      }
      return res
    } catch (err) {
      return { ok: false, error: (err as Error)?.message || 'getUsage error' }
    }
  }

  /**
   * 执行 GNU Octave 数学脚本
   */
  async function runMath(
    inputOrScript: { script: string; plot?: boolean } | string,
    plot?: boolean
  ): Promise<StudyResult<{ output: string; plots: string[] }>> {
    const input =
      typeof inputOrScript === 'string'
        ? { script: inputOrScript, plot: Boolean(plot) }
        : inputOrScript

    if (!studyApi.value?.runMath) {
      return { ok: false, error: STUDY_COPY.STATUS.PENDING_BACKEND }
    }
    try {
      const res = await studyApi.value.runMath(input)
      if (res.ok && res.data) {
        mathResult.value = res.data
      }
      return res
    } catch (err) {
      return { ok: false, error: (err as Error)?.message || 'runMath error' }
    }
  }

  /**
   * 导出知识库
   */
  async function exportVault(): Promise<StudyResult<{ path: string } | null>> {
    if (!studyApi.value?.exportVault) {
      return { ok: false, error: STUDY_COPY.STATUS.PENDING_BACKEND }
    }
    try {
      return await studyApi.value.exportVault()
    } catch (err) {
      return { ok: false, error: (err as Error)?.message || 'exportVault error' }
    }
  }

  // ---------------------------------------------------- Provider（docs/30 §1）

  const busyConnections = ref<Record<string, boolean>>({})
  const modelsByConnection = ref<Record<string, Array<{ id: string; name: string }>>>({})
  const modelsFailed = ref<Record<string, boolean>>({})
  const modelsPending = new Set<string>()

  /** 失败后拉一次最新状态，让圆点与错误原因跟主进程一致（不动 isLoading） */
  async function refreshState(): Promise<void> {
    try { if (studyApi.value?.getState) snapshot.value = await studyApi.value.getState() } catch { /* 保留旧快照 */ }
  }

  async function connectProvider(id: string): Promise<StudyResult<StudyConnection>> {
    busyConnections.value = { ...busyConnections.value, [id]: true }
    try {
      const res = await connect(id)
      if (!res.ok) await refreshState()
      return res
    } finally {
      const { [id]: _done, ...rest } = busyConnections.value
      busyConnections.value = rest
    }
  }

  /** 设为当前 Provider（null = 内置 API）；未连接的先连接，连接失败则选择不变 */
  async function switchProvider(id: string | null): Promise<StudyResult<void>> {
    if (id !== null) {
      const target = connections.value.find((c) => c.id === id)
      if (!target) return { ok: false, error: STUDY_COPY.PROVIDER.MISSING }
      if (target.status !== 'ready') {
        const res = await connectProvider(id)
        if (!res.ok) return res
      }
    }
    const res = await selectConnection(id)
    if (!res.ok) await refreshState()
    return res
  }

  /**
   * 设置里 Antigravity 那一行的开关。开 = 检测 agy → 新建或复用 `acp` 连接 → 连接；关 = 断开并保留配置。
   * 检测不到时可带 manualPath（用户手填的 agy.exe 路径）。
   */
  async function setAntigravityEnabled(on: boolean, manualPath?: string): Promise<StudyResult<void>> {
    const existing = connections.value.find((c) => c.kind === 'antigravity')
    if (!on) return existing ? disconnect(existing.id) : { ok: true, data: undefined }
    let target = existing
    if (!target) {
      let command = manualPath?.trim() ?? ''
      if (!command) {
        const found = await detectAgent()
        if (!found.ok) return found
        if (!found.data) return { ok: false, error: STUDY_COPY.PROVIDER.AGY_MISSING }
        command = found.data
      }
      const saved = await saveConnection({ kind: 'antigravity', label: STUDY_COPY.PROVIDER.AGY_NAME, command, args: ['acp'] })
      if (!saved.ok) return saved
      target = saved.data
    }
    const res = await connectProvider(target.id)
    return res.ok ? { ok: true, data: undefined } : res
  }

  /** 某个 Antigravity 连接的模型列表；每个连接在本次运行里只查一次，失败也记住（界面退回显示已存的模型 id） */
  async function ensureModels(id: string): Promise<void> {
    if (modelsByConnection.value[id] || modelsFailed.value[id] || modelsPending.has(id)) return
    const target = connections.value.find((c) => c.id === id)
    if (!target || target.kind !== 'antigravity' || !target.command) return
    modelsPending.add(id)
    try {
      const res = await listModels(target.command)
      if (res.ok) modelsByConnection.value = { ...modelsByConnection.value, [id]: res.data }
      else modelsFailed.value = { ...modelsFailed.value, [id]: true }
    } finally { modelsPending.delete(id) }
  }

  /** 选模型：落到连接上，并即时作用到已连接的会话 */
  async function setConnectionModel(connectionId: string, model: string): Promise<StudyResult<StudyConnection>> {
    if (!studyApi.value?.setModel) return { ok: false, error: STUDY_COPY.STATUS.PENDING_BACKEND }
    try {
      const res = await studyApi.value.setModel({ connectionId, model })
      if (res.ok && snapshot.value) {
        const row = snapshot.value.connections.find((c) => c.id === connectionId)
        if (row) row.model = res.data.model
      }
      return res
    } catch (err) {
      return { ok: false, error: (err as Error)?.message || 'setModel error' }
    }
  }

  async function removeConnection(id: string): Promise<StudyResult<void>> {
    if (!studyApi.value?.removeConnection) return { ok: false, error: STUDY_COPY.STATUS.PENDING_BACKEND }
    try {
      const res = await studyApi.value.removeConnection(id)
      if (res.ok && snapshot.value) {
        snapshot.value.connections = snapshot.value.connections.filter((c) => c.id !== id)
        if (snapshot.value.activeConnectionId === id) snapshot.value.activeConnectionId = null
      }
      return res
    } catch (err) {
      return { ok: false, error: (err as Error)?.message || 'removeConnection error' }
    }
  }

  return {
    snapshot,
    usage,
    mathResult,
    isLoading,
    loading: isLoading,
    error,
    activeTab,
    selectedNoteId,
    selectedMaterialId,
    showArchivedNotes,
    isMethodAvailable,
    isInitialized,

    memories,
    memory: memories,
    notes,
    materials,
    plans,
    position,
    connections,
    activeConnectionId,
    activeNotes,
    archivedNotes,
    displayedNotes,
    selectedNote,
    selectedMaterial,
    allTags,
    tags: allTags,
    backlinksMap,
    allTasks,
    nextTask,
    tokenTotals,

    init,
    loadSnapshot: init,
    saveMemory,
    forgetMemory,
    updatePosition,
    syncPosition: updatePosition,
    saveNote,
    archiveNote,
    unarchiveNote,
    importMaterials,
    readMaterial,
    generatePlan,
    confirmPlan,
    discardPlan,
    setTaskStatus,
    editTasks,
    saveConnection,
    detectAgent,
    listModels,
    connect,
    authenticate,
    disconnect,
    selectConnection,
    busyConnections,
    modelsByConnection,
    modelsFailed,
    refreshState,
    connectProvider,
    switchProvider,
    setAntigravityEnabled,
    ensureModels,
    setConnectionModel,
    removeConnection,
    getUsage,
    fetchUsage: getUsage,
    runMath,
    exportVault
  }
})
