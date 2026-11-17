import { defineStore } from 'pinia'
import { nextTick, ref } from 'vue'
import { validateMigratedVideo, validateVideo, type ExplainerVideo, type VideoGenerationInput, type VideoProgress, type VideoVerifyPrompt } from '../../../shared/video'
import { createClientId } from '../lib/client-id'
import { decideNativeRun } from '../lib/native-confirm'
import { VIDEO_UI } from '../lib/copy'
import { toast } from '../components/base/toast'
import { useAiAssistantStore } from './ai-assistant'

type Input = Omit<VideoGenerationInput, 'requestId'>
export const useVideoStore = defineStore('video', () => {
  const videos = ref<ExplainerVideo[]>([]), current = ref<ExplainerVideo | null>(null)
  const minimized = ref(false), currentStep = ref(1), totalSteps = ref(0)
  const loading = ref(false), error = ref(''), progress = ref<VideoProgress | null>(null)
  const modeRequested = ref(false)
  const dialogOpen = ref(false)
  const verification = ref<VideoVerifyPrompt | null>(null)
  const generationSession = ref(''), lastInput = ref<Input | null>(null)
  let requestId = '', unsubscribe: (() => void) | undefined, unsubscribeProgress: (() => void) | undefined

  function init(): void {
    if (unsubscribe || window.miai.isRemote) return
    unsubscribe = window.miai.video.onVerifyPrompt(prompt => {
      if (prompt.requestId === requestId) verification.value = prompt
      else void window.miai.video.answerVerify(prompt.confirmationId, null)
    })
    unsubscribeProgress = window.miai.video.onProgress(event => { if (event.requestId === requestId) progress.value = event })
  }
  function forLibrary(video: ExplainerVideo): ExplainerVideo {
    return { ...video, scenes: video.acts.map(act => ({ kind: 'memory' as const, title: act.title, steps: act.steps.map(step => ({ say: step.say, cells: [], arrows: [] })) })),
      checks: video.acts.flatMap(act => act.steps.flatMap(step => step.ask ? [{ ...step.ask, explanation: step.ask.why }] : [])) }
  }
  async function refresh(): Promise<void> { videos.value = (await window.miai.video.list()).map(forLibrary) }
  function play(video: ExplainerVideo): void {
    const errors = (video as ExplainerVideo & { migratedFrom?: number }).migratedFrom === 1 ? validateMigratedVideo(video) : validateVideo(video)
    if (errors.length) { toast(errors.join('；'), 'error'); return }
    minimized.value = false; current.value = video
  }
  async function generate(input: Input): Promise<void> {
    if (window.miai.isRemote) { error.value = VIDEO_UI.PHONE_GENERATE; return }
    if (loading.value || !input.question.trim()) return
    const ai = useAiAssistantStore()
    ai.isOpen = true; ai.activeTab = 'chat'
    loading.value = true
    try { await ai.init() } catch (err) { loading.value = false; error.value = err instanceof Error ? err.message : String(err); return }
    if (!ai.currentSession) ai.newSession()
    const session = ai.currentSession!
    generationSession.value = session.id; lastInput.value = input
    session.messages.push({ id: createClientId(), role: 'user', content: input.question, createdAt: Date.now() })
    session.updatedAt = Date.now(); void ai.saveSessions()
    init(); error.value = ''; requestId = createClientId()
    const id = requestId
    progress.value = { requestId: id, stage: 'judging', status: 'running' }
    try {
      const result = await window.miai.video.generate({ ...input, avoid: input.avoid ? [...input.avoid] : undefined, requestId: id })
      if (requestId !== id) return
      if (result.ok) {
        if (result.video.source === 'ai') {
          videos.value = [...videos.value.filter(v => v.id !== result.video.id), forLibrary(result.video)]
        }
        const target = ai.sessions.find(s => s.id === generationSession.value)
        if (target) { target.messages.push({ id: createClientId(), role: 'assistant', content: '```anim-card\n' + JSON.stringify({ videoId: result.video.id }) + '\n```', createdAt: Date.now() }); target.updatedAt = Date.now(); void ai.saveSessions() }
      } else {
        error.value = result.reason
        const target = ai.sessions.find(s => s.id === generationSession.value)
        if (target && result.fallback) { target.messages.push({ id: createClientId(), role: 'assistant', content: result.fallback, createdAt: Date.now() }); target.updatedAt = Date.now(); void ai.saveSessions() }
      }
    } catch (err) { if (requestId === id) error.value = err instanceof Error ? err.message : String(err) }
    finally { if (requestId === id) { loading.value = false; verification.value = null; requestId = '' } }
  }
  function open(input: { question?: string } & Partial<Omit<Input, 'question'>> = {}): void {
    const ai = useAiAssistantStore(); ai.isOpen = true; ai.activeTab = 'chat'
    dialogOpen.value = true; void nextTick(() => { dialogOpen.value = false })
    if (input.question?.trim()) void generate({ ...input, question: input.question })
    else { modeRequested.value = true; ai.draft = input.excerpt ?? ''; if (input.lessonId) ai.setLessonContext(input.lessonId) }
  }
  async function cancel(): Promise<void> { const id = requestId; if (id) await window.miai.video.cancel(id) }
  async function answerVerification(accept: boolean): Promise<void> {
    const prompt = verification.value
    if (!prompt) return
    const choice = accept ? await decideNativeRun() : null
    verification.value = null; await window.miai.video.answerVerify(prompt.confirmationId, choice)
  }
  async function remove(id: string): Promise<void> { const result = await window.miai.video.delete(id); if (result.ok) videos.value = videos.value.filter(video => video.id !== id) }
  return { videos, current, minimized, currentStep, totalSteps, dialogOpen, loading, error, modeRequested, progress, verification, generationSession, lastInput, init, refresh, open, play, generate, cancel, answerVerification, remove }
})
