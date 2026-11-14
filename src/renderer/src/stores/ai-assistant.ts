import { ensureMainSession, STUDY_MAIN_SESSION_ID } from '../../../shared/study-companion'
import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref } from 'vue'
import { AI_ASSISTANT } from '../lib/copy'
import { findCourseReferences } from '../lib/tutoring-search'
import { useContentStore } from './content'
import { useRunnerStore } from './runner'
import { useSettingsStore } from './settings'
import { showEffortForModel } from '../lib/composer-types'
import { createClientId } from '../lib/client-id'
import type { AiDraftAttachment } from '../lib/composer-types'
import type {
  AiChatAttachment,
  AiChatContextTag,
  AiChatMessage,
  AiChatSession,
  AiChatStreamEvent,
  ReasoningEffort,
  TutoringAction
} from '../../../shared/types'

export const useAiAssistantStore = defineStore('aiAssistant', () => {
  const isOpen = ref(false)
  const activeTab = ref<'chat' | 'history'>('chat')
  const sessions = ref<AiChatSession[]>([])
  const currentSessionId = ref<string>('')
  const contextTags = ref<AiChatContextTag[]>([])
  const tutoringAction = ref<TutoringAction>('direct')
  const reasoningEffort = ref<ReasoningEffort>('medium')
  /*
   * 【按会话存，不是全局一份】附件的缩略图是 object URL，挂在某个会话的草稿上。
   * 早先是全局单例 —— 在 A 会话挑了图，切到 B 会话那些图还跟着，
   * 成了「B 的草稿里出现 A 的文件」。现在 key 是会话 id，
   * 切走的会话保留自己的草稿（切回来还在），互不串。
   */
  const attachmentsBySession = new Map<string, AiDraftAttachment[]>()
  const pendingAttachments = ref<AiDraftAttachment[]>([])
  const isReadingAttachments = ref(false)

  /** 把某个会话的附件列表读进当前显示的那份引用 */
  function loadAttachmentsOf(sessionId: string) {
    pendingAttachments.value = sessionId ? [...(attachmentsBySession.get(sessionId) ?? [])] : []
  }
  /** 把当前显示的这份写回它所属的会话 */
  function stashAttachmentsOf(sessionId: string) {
    if (!sessionId) return
    if (pendingAttachments.value.length > 0) attachmentsBySession.set(sessionId, [...pendingAttachments.value])
    else attachmentsBySession.delete(sessionId)
  }
  /**
   * 彻底释放某会话的预览资源。**只在会话被删除 / 应用卸载时调用** ——
   * 光是切走不能释放：切回来还要用。不 revoke 的话，一个会话里换十次图
   * 就有十个 blob 一直占着内存。
   */
  function disposeAttachmentsOf(sessionId: string) {
    const list = attachmentsBySession.get(sessionId)
    if (!list) return
    for (const a of list) if (a.previewUrl) URL.revokeObjectURL(a.previewUrl)
    attachmentsBySession.delete(sessionId)
    if (sessionId === currentSessionId.value) pendingAttachments.value = []
  }
  const content = useContentStore()
  const runner = useRunnerStore()
  const settings = useSettingsStore()
  const isStreaming = ref(false)
  const streamingText = ref('')
  const errorMessage = ref<string | null>(null)

  /** 输入框草稿：两种聊天视图共用一份，切视图不丢；只在送出成功后清空（DESIGN §6.2） */
  const draft = ref('')
  /** 每个会话的滚动位置（仅内存；DESIGN §6.3）。非响应式：只在挂载/卸载时读写 */
  const scrollMemory = new Map<string, { top: number; pinned: boolean }>()
  /** 从 /ai 打开课程时记下的来路，课文页据此显示「回到 AI 对话」（DESIGN §5.1） */
  const returnTarget = ref<{ sessionId: string; title: string } | null>(null)
  /** /ai 学习上下文栏的手动开合；null = 按窗口宽度默认（仅内存，不进 config） */
  const railPref = ref<'open' | 'closed' | null>(null)

  let activeTurn: { id: string; sessionId: string } | null = null
  let initPromise: Promise<void> | null = null
  let historyLoaded = false
  let saves = Promise.resolve()
  let pendingSend: Promise<void> = Promise.resolve()
  let cancelBarrier: Promise<void> = Promise.resolve()
  let sendQueued = false
  let streamListenerCleanup: (() => void) | null = null
  let sessionsListenerCleanup: (() => void) | null = null
  let syncPromise: Promise<void> | null = null
  let syncRequested = false
  let localChanges = 0
  let disposed = false

  onScopeDispose(() => {
    disposed = true
    streamListenerCleanup?.()
    sessionsListenerCleanup?.()
  })

  function refreshSharedSessions(): void {
    if (disposed) return
    syncRequested = true
    if (!historyLoaded || syncPromise) return
    syncPromise = (async () => {
      while (syncRequested && !disposed) {
        syncRequested = false
        await saves.catch(() => {})
        const revision = localChanges
        const loaded = await window.miai.aiAssistant.getSessions()
        if (disposed) return
        // A local edit made while fetching must be saved before accepting a remote snapshot.
        if (revision !== localChanges || syncRequested) { syncRequested = true; continue }
        const existing = new Map(sessions.value.map(session => [session.id, session]))
        const next = ensureMainSession(normalizeSessions(loaded)).map(session => {
          const local = existing.get(session.id)
          return local ? Object.assign(local, session) : session
        })
        if (activeTurn && !next.some(session => session.id === activeTurn!.sessionId)) {
          const local = existing.get(activeTurn.sessionId)
          if (local) next.push(local)
        }
        sessions.value = next
        if (!next.some(session => session.id === currentSessionId.value)) currentSessionId.value = STUDY_MAIN_SESSION_ID
      }
    })().catch(() => {
      // Keep local history on failure; the next notification or reconnect will retry.
      syncRequested = false
    }).finally(() => {
      syncPromise = null
      if (syncRequested && !disposed) refreshSharedSessions()
    })
  }

  function upsertAssistantMessage(session: AiChatSession, message: AiChatMessage): void {
    const existing = session.messages.find(item => item.id === message.id)
    if (existing) Object.assign(existing, message)
    else session.messages.push(message)
  }

  const currentSession = computed(() => {
    return sessions.value.find((s) => s.id === currentSessionId.value) || null
  })

  const mainSession = computed(() => sessions.value.find(s => s.id === STUDY_MAIN_SESSION_ID) || null)
  function selectMainSession() { selectSession(STUDY_MAIN_SESSION_ID) }

  const currentMessages = computed(() => {
    return currentSession.value?.messages || []
  })

  /**
   * 幂等、single-flight（DESIGN §6.1，实施阻断）。
   *
   * 以前每个 AiPanel 挂载都会调一次：重读磁盘、整份覆盖 sessions、把 currentSessionId
   * 改回 loaded[0] —— 主界面与课内右栏一来一回就会被切走当前会话、冲掉串流状态。
   * 现在：并发调用共用同一个 promise，磁盘只读一次；载入后**不改**当前会话、草稿、
   * 标签和串流。内存里若已有会话（启动早期就新建/发送过），只把磁盘上没有的
   * 会话补进来 —— 不能直接丢弃磁盘结果，否则下一次 saveSessions 会用残缺列表覆盖历史。
   * 载入失败保留内存状态，并清空 initPromise 让下次可重试。
   */
  function init(): Promise<void> {
    if (!initPromise) {
      initPromise = loadOnce().catch((err) => {
        initPromise = null
        console.warn('[ai-assistant-store] init failed', err)
      })
    }
    return initPromise
  }

  /**
   * 历史会话英文标题归一：将历史遗留下来的旧字面量 'New session' 就地归一成
   * AI_ASSISTANT.DEFAULT_SESSION_TITLE（'新对话'），避免顶栏与会话列表仍显示英文。
   */
  function normalizeSessions(loaded: AiChatSession[]): AiChatSession[] {
    return loaded.map((s) => ({
      ...s,
      title: s.title === 'New session' ? AI_ASSISTANT.DEFAULT_SESSION_TITLE : s.title
    }))
  }

  async function loadOnce() {
    /*
     * 渲染进程新起时不可能有活着的流 —— 事件的监听是挂在本进程上的，
     * 上一次的串流随窗口一起没了。所以这里把标志复位，避免上一次异常退出
     * （主进程崩、窗口被重载、请求中途被系统掐断）留下的 true 一直挂着：
     * 那种状态下输入框会永远显示停止键，点了也没有 activeTurn 可取消。
     */
    isStreaming.value = false
    streamingText.value = ''
    activeTurn = null
    if (!window.miai?.aiAssistant) return
    if (!sessionsListenerCleanup) {
      sessionsListenerCleanup = window.miai.aiAssistant.onSessionsChanged?.(refreshSharedSessions) ?? null
    }
    const loaded = await window.miai.aiAssistant.getSessions()
    historyLoaded = true
    if (Array.isArray(loaded) && loaded.length > 0) {
      const normalized = ensureMainSession(normalizeSessions(loaded))
      if (sessions.value.length === 0) {
        sessions.value = normalized
        currentSessionId.value = STUDY_MAIN_SESSION_ID
      } else {
        const known = new Set(sessions.value.map((s) => s.id))
        sessions.value.push(...normalized.filter((s) => !known.has(s.id)))
      }
    } else if (sessions.value.length === 0) {
      sessions.value = ensureMainSession([])
      currentSessionId.value = STUDY_MAIN_SESSION_ID
    }

    if (!streamListenerCleanup) {
      streamListenerCleanup = window.miai.aiAssistant.onStream(handleStreamEvent)
    }
    if (syncRequested) refreshSharedSessions()
  }

  function handleStreamEvent(event: AiChatStreamEvent) {
    if (!activeTurn || event.turnId !== activeTurn.id || event.sessionId !== activeTurn.sessionId || event.sessionId !== currentSessionId.value) return

    if (event.type === 'chunk') {
      streamingText.value += event.text
    } else if (event.type === 'done') {
      const fullText = event.fullText || streamingText.value
      if (currentSession.value) {
        currentSession.value.cliSessionReady = true
        upsertAssistantMessage(currentSession.value, {
          id: activeTurn.id,
          role: 'assistant',
          content: fullText,
          studyActions: event.studyActions,
          createdAt: Date.now()
        })
        currentSession.value.updatedAt = Date.now()
        saveSessions()
      }
      for (const session of event.createdSessions ?? []) {
        if (!sessions.value.some(existing => existing.id === session.id)) sessions.value.push(session)
      }
      if (event.studyActions?.length) {
        window.dispatchEvent(new CustomEvent('miai-study-refresh'))
        const target = event.studyActions.find(action => action.ok && action.route)
        if (target?.route) window.dispatchEvent(new CustomEvent('miai-study-navigate', { detail: { route: target.route } }))
      }
      streamingText.value = ''
      isStreaming.value = false
      activeTurn = null
      errorMessage.value = null
    } else if (event.type === 'error') {
      if (currentSession.value && !currentSession.value.cliSessionReady) currentSession.value.cliSessionId = undefined
      activeTurn = null
      isStreaming.value = false
      errorMessage.value = event.error || AI_ASSISTANT.FAIL_GENERATE
      if (currentSession.value) {
        upsertAssistantMessage(currentSession.value, {
          id: event.turnId,
          role: 'assistant',
          content: streamingText.value ? streamingText.value + AI_ASSISTANT.STREAM_ABORTED : '',
          error: event.error,
          createdAt: Date.now()
        })
        currentSession.value.updatedAt = Date.now()
        saveSessions()
      }
      streamingText.value = ''
    }
  }

  function newSession() {
    void cancelStream()
    // 先把当前会话的附件存回去，再换到新会话（新会话的草稿是空的）
    stashAttachmentsOf(currentSessionId.value)
    const id = createClientId()
    const session: AiChatSession = {
      id,
      title: AI_ASSISTANT.DEFAULT_SESSION_TITLE,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: []
    }
    sessions.value.unshift(session)
    currentSessionId.value = id
    pendingAttachments.value = []
    streamingText.value = ''
    isStreaming.value = false
    errorMessage.value = null
    returnTarget.value = null
    saveSessions()
  }

  function selectSession(id: string) {
    if (id === currentSessionId.value) { activeTab.value = 'chat'; return }
    if (id !== currentSessionId.value) void cancelStream()
    // 附件跟着会话走：存回旧的、取出新的。不 revoke —— 切回来还要用。
    stashAttachmentsOf(currentSessionId.value)
    currentSessionId.value = id
    loadAttachmentsOf(id)
    streamingText.value = ''
    isStreaming.value = false
    errorMessage.value = null
    activeTab.value = 'chat'
  }

  function deleteSession(id: string) {
    if (id === STUDY_MAIN_SESSION_ID) return
    if (id === currentSessionId.value) void cancelStream()
    if (returnTarget.value?.sessionId === id) returnTarget.value = null
    scrollMemory.delete(id)
    // 会话没了，它的附件预览也就没用了 —— 这里才是该 revoke 的地方
    disposeAttachmentsOf(id)
    const idx = sessions.value.findIndex((s) => s.id === id)
    if (idx !== -1) {
      sessions.value.splice(idx, 1)
      if (currentSessionId.value === id) {
        if (sessions.value.length > 0) {
          currentSessionId.value = sessions.value[0].id
          // 换到了另一条会话：把它自己的附件草稿取出来，别留着已删会话的
          loadAttachmentsOf(currentSessionId.value)
        } else {
          newSession()
        }
      }
      saveSessions()
    }
  }

  async function saveSessions() {
    localChanges++
    saves = saves.catch(() => {}).then(async () => {
      await init()
      if (historyLoaded && window.miai?.aiAssistant) await window.miai.aiAssistant.saveSessions(JSON.parse(JSON.stringify(sessions.value)))
    })
    await saves
  }

  function addContextTag(tag: AiChatContextTag) {
    // 同 id（如同一次运行的 run-code-<fp>）或同类型同内容：不重复加
    const exists = contextTags.value.some(
      (t) => t.id === tag.id || (t.type === tag.type && t.content === tag.content)
    )
    if (exists) return
    // 最多 4 个；满了先挤掉最旧的非课程标签 —— 课程背景要一直保留（DESIGN §6.6）
    if (contextTags.value.length >= 4) {
      const victim = contextTags.value.findIndex((t) => t.type !== 'lesson')
      contextTags.value.splice(victim === -1 ? 0 : victim, 1)
    }
    contextTags.value.push(tag)
  }

  /**
   * 换课程背景：同时最多 1 个，换课直接替换（DESIGN §6.6）。
   * id 为 null、课不存在或还是 draft → 只移除，不加。
   */
  function setLessonContext(id: string | null) {
    contextTags.value = contextTags.value.filter((t) => t.type !== 'lesson')
    if (!id) return
    const lesson = content.lessonOf(id)
    if (!lesson || content.statusOf(id) === 'draft') return
    addContextTag({
      id: 'lesson-' + id,
      type: 'lesson',
      title: AI_ASSISTANT.currentLessonLabel(lesson.title),
      content: `${lesson.title}\n${lesson.body.slice(0, 1500)}`,
      removable: true
    })
  }

  /** 当前课程背景对应的 lessonId（标签 id 形如 lesson-<id>） */
  const lessonContextId = computed(() => {
    const tag = contextTags.value.find((t) => t.type === 'lesson')
    return tag ? tag.id.slice('lesson-'.length) : null
  })

  /**
   * 练习场真实运行失败 → 带上代码与报错（DESIGN §4.4）。只加标签，**不发送**。
   * 标签 id 绑运行指纹，同一次运行重复点不重复加。
   */
  function attachRunFailure(p: {
    fp: string
    langLabel: string
    code: string
    errorTitle?: string
    errorText: string
    lessonId?: string | null
  }) {
    if (p.lessonId) setLessonContext(p.lessonId)
    addContextTag({
      id: 'run-code-' + p.fp,
      type: 'code',
      title: AI_ASSISTANT.runCodeTagTitle(p.langLabel),
      content: clip(p.code, 4000),
      removable: true
    })
    addContextTag({
      id: 'run-error-' + p.fp,
      type: 'error',
      title: p.errorTitle?.trim() || AI_ASSISTANT.ERROR_TAG_TITLE,
      content: clip(p.errorText, 2000),
      removable: true
    })
  }

  function clearReturnTarget() {
    returnTarget.value = null
  }

  /** 从 /ai 打开课程或练习前调用：记下当前会话，课文页才知道回哪 */
  function markReturnTarget() {
    const s = currentSession.value
    if (s) returnTarget.value = { sessionId: s.id, title: s.title || AI_ASSISTANT.DEFAULT_SESSION_TITLE }
  }

  function removeContextTag(tagId: string) {
    contextTags.value = contextTags.value.filter((t) => t.id !== tagId)
  }

  function clearContextTags() {
    contextTags.value = []
  }

  async function sendMessage(text: string, tags?: AiChatContextTag[], onAccepted?: () => void, retryAttachments?: AiChatAttachment[]) {
    const trimmed = text.trim()
    const attachmentsSnapshot = (retryAttachments ?? pendingAttachments.value).map(({ id, name, size, kind, textContent }) => ({ id, name, size, kind, ...(textContent === undefined ? {} : { textContent }) }))
    if ((!trimmed && !attachmentsSnapshot.length) || isStreaming.value || sendQueued || isReadingAttachments.value) return
    const tagsSnapshot = (tags ?? contextTags.value).map(tag => ({ ...tag }))
    const effortChoice = reasoningEffort.value
    const actionSnapshot = tutoringAction.value
    const queuedSessionId = currentSessionId.value
    sendQueued = true
    try { await cancelBarrier } finally { sendQueued = false }
    if (isStreaming.value || currentSessionId.value !== queuedSessionId) return
    const effortSnapshot = showEffortForModel(settings.config.ai.model) ? effortChoice : undefined
    onAccepted?.()
    // 消息真的发出去了：草稿里的附件跟着消息走，清掉并释放预览
    if (!retryAttachments) clearAttachments(attachmentsSnapshot.map(a => a.id))

    if (!currentSession.value) {
      newSession()
    }

    const current = currentSession.value!
    // 如果是第一条提问，将标题更新为提问摘要
    if (current.messages.length === 0) {
      if (current.id !== STUDY_MAIN_SESSION_ID) current.title = trimmed.slice(0, 24) || AI_ASSISTANT.DEFAULT_QUESTION_TITLE
    }

    const query = [trimmed, ...tagsSnapshot.map(tag => tag.content.slice(0, 80))].join(' ')
    const lessonTag = tagsSnapshot.find((t) => t.type === 'lesson')
    const contextLessonId = lessonTag ? lessonTag.id.slice('lesson-'.length) : lessonContextId.value
    const contextLesson = contextLessonId ? content.lessonOf(contextLessonId) : undefined
    // activeLang 默认是 'common'，退化成不过滤会把别门语言混进推荐；用练习场当前语言兜底
    const searchLang = contextLesson?.lang ?? (content.activeLang !== 'common' ? content.activeLang : runner.lang)
    const references = findCourseReferences([...content.bundle.searchIndex, ...content.algoBundle.searchIndex], content.lessonOf, query, searchLang)
    const userMsg: AiChatMessage = {
      id: createClientId(),
      role: 'user',
      content: trimmed,
      createdAt: Date.now(),
      contextTags: tagsSnapshot.length > 0 ? tagsSnapshot : undefined,
      references,
      tutoringAction: actionSnapshot,
      reasoningEffort: effortSnapshot,
      attachments: attachmentsSnapshot.length ? attachmentsSnapshot : undefined
    }

    current.messages.push(userMsg)
    current.updatedAt = Date.now()

    const turn = { id: createClientId(), sessionId: current.id }
    activeTurn = turn
    current.cliSessionId ||= createClientId()
    isStreaming.value = true
    streamingText.value = ''
    errorMessage.value = null

    // 清理临时选区/报错标签，保留课程背景
    contextTags.value = contextTags.value.filter((t) => t.type === 'lesson' || !tagsSnapshot.some(sent => sent.id === t.id))

    try {
      await saveSessions()
      if (activeTurn !== turn) return
      if (window.miai?.aiAssistant) {
        pendingSend = window.miai.aiAssistant.send({
          turnId: turn.id, cliSessionId: current.cliSessionId!, isResume: !!current.cliSessionReady,
          sessionId: current.id,
          userMessage: trimmed,
          contextTags: tagsSnapshot,
          references,
          tutoringAction: userMsg.tutoringAction,
          reasoningEffort: userMsg.reasoningEffort,
          attachments: userMsg.attachments
        })
        await pendingSend
      }
    } catch {
      if (activeTurn === turn) { activeTurn = null; isStreaming.value = false; errorMessage.value = AI_ASSISTANT.FAIL_SEND_REQUEST }
    }
  }

  /**
   * 送出输入框草稿。只有真的被接受（非空、不在串流中）才清空草稿 ——
   * 串流中按 Enter 不会把用户刚打的下一句吞掉（DESIGN §4.5 / §6.2）。
   */
  function sendDraft(): boolean {
    const text = draft.value.trim()
    if ((!text && !pendingAttachments.value.length) || isStreaming.value || sendQueued || isReadingAttachments.value) return false
    const original = draft.value
    void sendMessage(text, undefined, () => { if (draft.value === original) draft.value = '' })
    return true
  }

  async function cancelStream() {
    const turn = activeTurn
    if (!turn) return
    activeTurn = null
    const session = sessions.value.find(s => s.id === turn.sessionId)
    if (session) {
      if (!session.cliSessionReady) session.cliSessionId = undefined
      upsertAssistantMessage(session, { id: turn.id, role: 'assistant', content: streamingText.value, error: 'canceled', createdAt: Date.now() })
      session.updatedAt = Date.now()
      void saveSessions()
    }
    isStreaming.value = false
    streamingText.value = ''
    cancelBarrier = Promise.allSettled([window.miai?.aiAssistant?.cancel(turn.sessionId), pendingSend]).then(() => {})
    await cancelBarrier
  }

  /** 加一个待发送附件。重复路径不重复加。 */
  function addAttachment(a: AiDraftAttachment) {
    // 草稿现在按会话存：写进当前会话那份，再刷新显示
    stashAttachmentsOf(currentSessionId.value)
    const cur = pendingAttachments.value
    if (cur.length >= 6 || cur.some((x) => (a.path && x.path === a.path) || x.name === a.name)) {
      // 没加进去就把刚建的预览资源还回去，否则它没人引用也永远不释放
      if (a.previewUrl) URL.revokeObjectURL(a.previewUrl)
      return
    }
    pendingAttachments.value = [...cur, a]
    stashAttachmentsOf(currentSessionId.value)
  }
  /** 移除附件。图片要顺手释放 object URL —— 见 lib/composer-types 的注释。 */
  function removeAttachment(id: string) {
    const target = pendingAttachments.value.find((x) => x.id === id)
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
    pendingAttachments.value = pendingAttachments.value.filter((x) => x.id !== id)
    stashAttachmentsOf(currentSessionId.value)
  }
  /**
   * 清空当前会话的附件并释放预览。
   * 送出成功后要调这个 —— 文件已经随消息进了历史，草稿里不该再挂着。
   */
  function clearAttachments(ids?: string[]) {
    const sent = ids ? new Set(ids) : null
    for (const a of pendingAttachments.value) if ((!sent || sent.has(a.id)) && a.previewUrl) URL.revokeObjectURL(a.previewUrl)
    pendingAttachments.value = sent ? pendingAttachments.value.filter(a => !sent.has(a.id)) : []
    stashAttachmentsOf(currentSessionId.value)
  }
  /** 应用卸载时统一清空所有会话的预览资源（否则 blob 会跟着进程活到最后） */
  function disposeAllAttachments() {
    for (const id of [...attachmentsBySession.keys()]) disposeAttachmentsOf(id)
    for (const a of pendingAttachments.value) if (a.previewUrl) URL.revokeObjectURL(a.previewUrl)
    pendingAttachments.value = []
  }

  async function retryLastMessage() {
    if (!currentSession.value || isStreaming.value || sendQueued) return
    const msgs = currentSession.value.messages
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') {
        const lastUser = msgs[i]
        // 恢复它的 tags
        contextTags.value = (lastUser.contextTags ?? []).map(tag => ({ ...tag }))
        tutoringAction.value = lastUser.tutoringAction ?? 'direct'
        reasoningEffort.value = lastUser.reasoningEffort ?? 'medium'
        await sendMessage(lastUser.content, undefined, undefined, lastUser.attachments ?? [])
        break
      }
    }
  }

  function openWithSelection(params: {
    text: string
    title?: string
    type?: 'code' | 'selection'
    action?: 'explain' | 'example' | 'ask'
    lessonId?: string
    lessonTitle?: string
    /** false = 只加标签、不打开课文右栏（在 /ai 或回 /ai 的路径上用；DESIGN §5.2） */
    openRail?: boolean
    deferSend?: boolean
  }) {
    if (params.openRail !== false) isOpen.value = true
    activeTab.value = 'chat'

    // 课程背景只保留 1 个：替换而不是累加
    if (params.lessonId) setLessonContext(params.lessonId)

    if (params.text && params.text.trim()) {
      addContextTag({
        id: createClientId(),
        type: params.type || 'selection',
        title: params.title || (params.type === 'code' ? AI_ASSISTANT.REF_CODE : AI_ASSISTANT.REF_SELECTION),
        content: params.text.trim(),
        removable: true
      })
    }

    const snapshot = contextTags.value.map(tag => ({ ...tag }))
    if (!params.deferSend && params.action === 'explain') {
      sendMessage(AI_ASSISTANT.PROMPT_EXPLAIN_REF)
    } else if (!params.deferSend && params.action === 'example') {
      sendMessage(AI_ASSISTANT.PROMPT_EXAMPLE_REF)
    }
    return snapshot
  }

  return {
    isOpen,
    activeTab,
    sessions,
    currentSessionId,
    currentSession,
    currentMessages,
    contextTags,
    tutoringAction,
    reasoningEffort,
    pendingAttachments,
    isReadingAttachments,
    addAttachment,
    removeAttachment,
    clearAttachments,
    disposeAllAttachments,
    isStreaming,
    streamingText,
    errorMessage,
    draft,
    scrollMemory,
    returnTarget,
    railPref,
    lessonContextId,
    init,
    newSession,
    selectSession,
    deleteSession,
    mainSession,
    selectMainSession,
    saveSessions,
    addContextTag,
    removeContextTag,
    clearContextTags,
    setLessonContext,
    attachRunFailure,
    markReturnTarget,
    clearReturnTarget,
    sendMessage,
    sendDraft,
    cancelStream,
    retryLastMessage,
    openWithSelection
  }
})

/** 超长截断，总长不超过 max（含截断后缀） */
function clip(text: string, max: number): string {
  const t = text ?? ''
  if (t.length <= max) return t
  const suffix = AI_ASSISTANT.TRUNCATED_SUFFIX
  return t.slice(0, max - suffix.length) + suffix
}
