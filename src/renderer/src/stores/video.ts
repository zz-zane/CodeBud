import { defineStore } from 'pinia'
import { ref, toRaw } from 'vue'
import { validateVideo, type ExplainerVideo, type VideoOutline, type VideoVerifyPrompt } from '../../../shared/video'
import { createClientId } from '../lib/client-id'
import { decideNativeRun } from '../lib/native-confirm'
import { VIDEO_UI } from '../lib/copy'
import { toast } from '../components/base/toast'

export const useVideoStore = defineStore('video', () => {
  const videos = ref<ExplainerVideo[]>([])
  const current = ref<ExplainerVideo | null>(null)
  const minimized = ref(false)
  const dialogOpen = ref(false)
  const question = ref('')
  const excerpt = ref('')
  const lessonId = ref<string | undefined>()
  const outline = ref<VideoOutline | null>(null)
  const loading = ref(false)
  const error = ref('')
  const verification = ref<VideoVerifyPrompt | null>(null)
  const avoidAnalogy = ref('')
  let requestId = ''
  let unsubscribe: (() => void) | undefined

  function init(): void {
    if (unsubscribe || window.miai.isRemote) return
    unsubscribe = window.miai.video.onVerifyPrompt((prompt) => {
      if (prompt.requestId === requestId && dialogOpen.value) verification.value = prompt
      else void window.miai.video.answerVerify(prompt.confirmationId, null)
    })
  }

  async function refresh(): Promise<void> { videos.value = await window.miai.video.list() }
  function open(input: { question?: string; excerpt?: string; lessonId?: string; avoid?: string } = {}): void {
    if (requestId) void window.miai.video.cancel(requestId)
    requestId = ''; loading.value = false
    question.value = input.question ?? ''
    excerpt.value = Array.from(input.excerpt ?? '').slice(0, 2000).join('')
    lessonId.value = input.lessonId
    avoidAnalogy.value = input.avoid ?? ''
    outline.value = null; error.value = ''; verification.value = null; dialogOpen.value = true
  }
  function play(video: ExplainerVideo): void {
    const errors = validateVideo(video)
    if (errors.length) { toast(errors.join('；'), 'error'); return }
    minimized.value = false; current.value = video
  }
  async function closeDialog(): Promise<void> {
    dialogOpen.value = false
    const id = requestId
    requestId = ''; loading.value = false
    if (id) await window.miai.video.cancel(id)
    verification.value = null
  }
  async function makeOutline(avoid?: string): Promise<void> {
    if (loading.value || !question.value.trim()) return
    loading.value = true; error.value = ''; requestId = createClientId()
    const id = requestId
    try {
      const result = await window.miai.video.outline({ requestId: id, question: question.value.trim(), excerpt: excerpt.value, lessonId: lessonId.value, avoid: (avoid ?? avoidAnalogy.value) || undefined })
      if (!dialogOpen.value || requestId !== id) return
      if (result.ok) outline.value = result.data
      else error.value = result.error
    } catch (err) { if (requestId === id) error.value = err instanceof Error ? err.message : String(err) }
    finally { if (requestId === id) { loading.value = false; requestId = '' } }
  }
  async function generate(): Promise<void> {
    if (window.miai.isRemote) { error.value = VIDEO_UI.PHONE_GENERATE; return }
    if (loading.value || !outline.value) return
    loading.value = true; error.value = ''; requestId = createClientId()
    const id = requestId
    try {
      const result = await window.miai.video.generate({ requestId: id, question: question.value.trim(), excerpt: excerpt.value, lessonId: lessonId.value, outline: structuredClone(toRaw(outline.value)) })
      if (!dialogOpen.value || requestId !== id) return
      if (result.ok) { videos.value = [...videos.value, result.data]; dialogOpen.value = false; play(result.data) }
      else error.value = result.error
    } catch (err) { if (requestId === id) error.value = err instanceof Error ? err.message : String(err) }
    finally { if (requestId === id) { loading.value = false; verification.value = null; requestId = '' } }
  }
  async function answerVerification(accept: boolean): Promise<void> {
    const prompt = verification.value
    if (!prompt) return
    if (!accept) { verification.value = null; await window.miai.video.answerVerify(prompt.confirmationId, null); return }
    const choice = await decideNativeRun()
    verification.value = null
    await window.miai.video.answerVerify(prompt.confirmationId, choice)
  }
  async function remove(id: string): Promise<void> {
    const result = await window.miai.video.delete(id)
    if (result.ok) videos.value = videos.value.filter((video) => video.id !== id)
  }
  return { videos, current, minimized, dialogOpen, question, excerpt, lessonId, outline, loading, error, verification,
    init, refresh, open, play, closeDialog, makeOutline, generate, answerVerification, remove }
})
