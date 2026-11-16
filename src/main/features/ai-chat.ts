import * as fs from 'fs'
import * as path from 'path'
import { handle } from '../ipc'
import { IPC } from '../../shared/ipc-channels'
import { STUDY_TEXT } from '../../shared/study-copy'
import { ensureMainSession, STUDY_MAIN_SESSION_ID, studyContext } from '../../shared/study-companion'
import { recordStudyUsage } from '../study/usage'
import { applyStudyActions, STUDY_ACTION_INSTRUCTIONS } from '../study/actions'
import { runMathViaMcp } from '../study/math'
import { runStudyAsyncActions } from '../study/async-actions'
import { AI_APP } from '../../shared/copy'
import { createJsonStore } from '../store/json-store'
import { normalizePractice } from '../store/practice-merge'
import { lessonMastery } from '../../shared/mastery'
import { validChatExtras } from '../ai/chat-request'
import { buildAssistantSystemPrompt, buildStudentUserPrompt } from '../../shared/ai-assistant-prompt'
import { showEffortForModel } from '../../shared/ai-model-capabilities'
import type { AiChatSendPayload, AiChatSession } from '../../shared/types'
import type { MainFeature } from '../context'

export const aiChatFeature: MainFeature = {
  name: 'ai-chat',
  register(ctx) {
    const { readConfig, storageDir, studyMathPath } = ctx
    const { store: studyStore, connections: studyConnections, harness: nativeHarness, lessonIds: studyLessonIds, generateLearningPlan } = ctx.study

    const aiSessionsStore = createJsonStore<AiChatSession[]>(storageDir, 'ai-sessions.json')
    function writeChatSessions(sessions: AiChatSession[]): void {
      aiSessionsStore.write(sessions)
      ctx.notifyChatSessionsChanged()
    }
    function readChatSessions(): AiChatSession[] {
      const data = aiSessionsStore.read()
      if (data === null && ['ai-sessions.json', 'ai-sessions.json.bak'].some(file => fs.existsSync(path.join(storageDir, file)))) throw new Error(STUDY_TEXT.CHAT_DATA_UNREADABLE)
      return data ?? []
    }

    const activeChatControllers = new Map<string, AbortController>()

    handle(IPC.aiSessionsGet, () => {
      const data = readChatSessions()
      const sessions = ensureMainSession(data ?? [])
      if (!data?.some(s => s.id === sessions[0].id && s.title === sessions[0].title)) {
        writeChatSessions(sessions)
      }
      return sessions
    })

    handle(IPC.aiSessionsSave, (_e, sessions: AiChatSession[]) => {
      if (Array.isArray(sessions)) {
        writeChatSessions(ensureMainSession(sessions, readChatSessions()))
        return { ok: true }
      }
      return { ok: false }
    })

    handle(IPC.aiChatCancel, (_e, sessionId: string) => {
      const ac = activeChatControllers.get(sessionId)
      if (ac) {
        ac.abort()
        return { ok: true }
      }
      return { ok: false }
    })

    handle(IPC.aiChatSend, async (event, payload: AiChatSendPayload) => {
      const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!payload || !validChatExtras(payload.reasoningEffort, payload.attachments)) throw new Error('Invalid chat extras')
      if ((payload.sessionId !== STUDY_MAIN_SESSION_ID && !uuid.test(payload.sessionId)) || !uuid.test(payload.turnId) || !uuid.test(payload.cliSessionId) || typeof payload.isResume !== 'boolean' || typeof payload.userMessage !== 'string' || (!payload.userMessage.trim() && !payload.attachments?.length) || payload.userMessage.length > 100000 || (payload.contextTags !== undefined && (!Array.isArray(payload.contextTags) || payload.contextTags.length > 4 || payload.contextTags.some(t => !t || typeof t.content !== 'string' || t.content.length > 100000 || typeof t.title !== 'string' || !['lesson','code','error','selection','memory'].includes(t.type))))) throw new Error('Invalid chat request')
      if ((payload.tutoringAction !== undefined && !['direct', 'hint', 'approach', 'explain', 'diagnose', 'feynman', 'visualize', 'solve'].includes(payload.tutoringAction)) || (payload.references !== undefined && (!Array.isArray(payload.references) || payload.references.length > 3 || payload.references.some(r => !r || typeof r.lessonId !== 'string' || r.lessonId.length > 100 || typeof r.title !== 'string' || r.title.length > 200 || typeof r.excerpt !== 'string' || !r.excerpt || r.excerpt.length > 200)))) throw new Error('Invalid tutoring context')
      if (activeChatControllers.has(payload.sessionId)) throw new Error('A turn is already active for this session')
      const ac = new AbortController()
      activeChatControllers.set(payload.sessionId, ac)
      const emit = (data: Record<string, unknown>) => {
        if (!event.sender.isDestroyed()) event.sender.send(IPC.aiChatStream, { ...data, sessionId: payload.sessionId, turnId: payload.turnId })
      }
      try {
        const cfg = readConfig()
        const learningState = studyStore.read()
        const currentMastery = (state: ReturnType<typeof studyStore.read>) => {
          const lessonId = state.position?.lessonId
          if (!lessonId) return null
          const { file } = normalizePractice(ctx.stores.practice.read(), ctx.device().installId)
          return { lessonId, ...lessonMastery(file.history, lessonId) }
        }
        const prompt = studyContext(learningState, payload.userMessage, currentMastery(learningState)) + STUDY_TEXT.SESSION_CONTEXT(payload.sessionId === STUDY_MAIN_SESSION_ID ? STUDY_TEXT.MAIN_HINT : STUDY_TEXT.TOPIC_HINT) + buildStudentUserPrompt(payload.userMessage, payload.contextTags, payload.references, payload.tutoringAction, showEffortForModel(cfg.ai.model || 'deepseek-chat') ? payload.reasoningEffort : undefined, payload.attachments)
        const completeTurn = async (text: string) => {
          const enriched = await runStudyAsyncActions({ text, sessionId: payload.sessionId,
            calculate: input => runMathViaMcp(input, studyMathPath, storageDir),
            createPlan: input => generateLearningPlan(input, ac.signal)
          })
          if (ac.signal.aborted) return
          const applied = applyStudyActions({ store: studyStore, text: enriched, userMessage: payload.userMessage, sessionId: payload.sessionId, turnId: payload.turnId, isLesson: id => studyLessonIds.has(id), createChat: session => {
            const sessions = ensureMainSession(readChatSessions())
            if (!sessions.some(existing => existing.id === session.id)) writeChatSessions([...sessions, session])
          } })
          // Answer one requested topic in this turn; further topics stay available in history.
          const topic = applied.createdSessions.find(session => session.messages[0]?.role === 'user')
          if (topic && !ac.signal.aborted) {
            const topicState = studyStore.read()
            const topicPrompt = studyContext(topicState, topic.messages[0].content, currentMastery(topicState)) + STUDY_TEXT.TOPIC_READ_ONLY + topic.messages[0].content
            topic.cliSessionId = topic.id
            try {
              let answer: string
              if (learningState.activeConnectionId) {
                const response = await studyConnections.prompt(topic.id, buildAssistantSystemPrompt() + '\n' + topicPrompt, ac.signal, () => {})
                answer = response.text
                if (response.usage) recordStudyUsage(studyStore, { ...response.usage, id: `${payload.turnId}-topic`, at: Date.now(), provider: learningState.connections.find(connection => connection.id === learningState.activeConnectionId)?.kind ?? 'acp', model: 'ACP', sessionId: topic.id, source: 'acp-prompt-result' })
              } else {
                let round = 0
                const response = await nativeHarness.runTurn({ sessionId: topic.id, prompt: topicPrompt, signal: ac.signal, onUsage: usage => recordStudyUsage(studyStore, { ...usage, id: `${payload.turnId}-topic-${round++}`, at: Date.now(), provider: cfg.ai.provider ?? 'custom', model: cfg.ai.model, sessionId: topic.id, source: 'provider-sse' }) })
                if (!response.ok) throw new Error(response.reason)
                answer = response.data.text
              }
              const checked = applyStudyActions({ store: studyStore, text: answer, userMessage: topic.messages[0].content, sessionId: topic.id, turnId: `${payload.turnId}-topic`, isLesson: id => studyLessonIds.has(id), createChat: () => {} })
              topic.messages.push({ id: crypto.randomUUID(), role: 'assistant', content: checked.text, createdAt: Date.now() })
              topic.cliSessionReady = true
            } catch { topic.messages.push({ id: crypto.randomUUID(), role: 'assistant', content: '', error: STUDY_TEXT.TOPIC_ANSWER_FAILED, createdAt: Date.now() }) }
            topic.updatedAt = Date.now()
            const sessions = ensureMainSession(readChatSessions())
            const index = sessions.findIndex(session => session.id === topic.id)
            if (index >= 0) { sessions[index] = topic; writeChatSessions(sessions) }
          }
          if (ac.signal.aborted) return
          if (!learningState.activeConnectionId) nativeHarness.replaceLastAssistantMessage(payload.cliSessionId, applied.text)
          // Persist before notifying the sender: a phone may close before it can save the reply.
          const sessions = ensureMainSession(readChatSessions())
          const session = sessions.find(item => item.id === payload.sessionId)
          if (session) {
            const message = { id: payload.turnId, role: 'assistant' as const, content: applied.text, studyActions: applied.actions, createdAt: Date.now() }
            const existing = session.messages.find(item => item.id === message.id)
            if (existing) Object.assign(existing, message)
            else session.messages.push(message)
            session.cliSessionId = payload.cliSessionId
            session.cliSessionReady = true
            session.updatedAt = message.createdAt
            writeChatSessions(sessions)
          }
          emit({ type: 'done', fullText: applied.text, studyActions: applied.actions, createdSessions: applied.createdSessions })
        }
        if (learningState.activeConnectionId) {
          const connection = learningState.connections.find(item => item.id === learningState.activeConnectionId)
          const saved = readChatSessions().find(session => session.id === payload.sessionId)?.messages ?? []
          const recent = studyConnections.hasSession(payload.sessionId) ? '' : STUDY_TEXT.RECENT_HISTORY_INTRO + JSON.stringify(saved.slice(0, -1).slice(-12).map(message => ({ role: message.role, content: message.content.slice(0, 2000) }))).replace(/</g, '\\u003c') + '</recent_conversation>\n'
          let result: Awaited<ReturnType<typeof studyConnections.prompt>>
          // Connection failures (not signed in, quota, process exit, timeout) carry a specific message for the chat.
          try { result = await studyConnections.prompt(payload.sessionId, buildAssistantSystemPrompt() + STUDY_ACTION_INSTRUCTIONS + recent + '\n' + prompt, ac.signal, text => { if (!ac.signal.aborted) emit({ type: 'chunk', text }) }) }
          catch (error) { if (ac.signal.aborted) throw error; emit({ type: 'error', error: error instanceof Error && error.message ? error.message : AI_APP.ERR_PROCESS_ABORTED }); return }
          if (result.usage) recordStudyUsage(studyStore, { ...result.usage, id: payload.turnId, at: Date.now(), provider: connection?.kind ?? 'acp', model: connection?.label ?? 'ACP', sessionId: payload.sessionId, source: 'acp-prompt-result' })
          if (!ac.signal.aborted) await completeTurn(result.text)
          return
        }
        if (!cfg.ai.apiKey?.trim()) { emit({ type: 'error', error: AI_APP.ERR_KEY_REQUIRED }); return }
        if (ac.signal.aborted) { emit({ type: 'error', error: 'canceled' }); return }
        if (payload.isResume && nativeHarness.getSessionHistory(payload.cliSessionId).length === 0) {
          const saved = readChatSessions().find(session => session.id === payload.sessionId)
          const messages = saved?.messages ?? []
          const history = messages.at(-1)?.role === 'user' && messages.at(-1)?.content === payload.userMessage ? messages.slice(0, -1) : messages
          nativeHarness.restoreSession(payload.cliSessionId, history.filter(message => message.content && !message.error).slice(-12).map(message => ({ role: message.role, content: message.content })))
        }
        let usageRound = 0
        const result = await nativeHarness.runTurn({
          sessionId: payload.cliSessionId,
          isResume: payload.isResume,
          prompt,
          signal: ac.signal,
          onUsage: usage => recordStudyUsage(studyStore, { ...usage, id: `${payload.turnId}-${usageRound++}`, at: Date.now(), provider: cfg.ai.provider ?? 'custom', model: cfg.ai.model, sessionId: payload.sessionId, source: 'provider-sse' }),
          onChunk: (text) => { if (!ac.signal.aborted) emit({ type: 'chunk', text }) }
        })
        if (result.ok && !ac.signal.aborted) await completeTurn(result.data.text)
        else emit({ type: 'error', error: result.ok ? 'canceled' : result.reason })
      } catch {
        emit({ type: 'error', error: AI_APP.ERR_PROCESS_ABORTED })
      } finally {
        if (activeChatControllers.get(payload.sessionId) === ac) activeChatControllers.delete(payload.sessionId)
      }
    })
  }
}
