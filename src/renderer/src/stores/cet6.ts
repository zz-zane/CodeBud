/**
 * 六级真题（docs/27）：清单、当前试卷、作答状态。
 *
 * 试卷与附图走 miai-cet6://data（不能 fetch public 目录：生产环境是 file://）。
 * 作答记录整份存在主进程 cet6.json：改动后 400ms 防抖落盘；切卷 / 离开路由 / beforeunload 立即写。
 * 保存失败只弹 toast，内存里的作答不丢。
 */
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { emptyRecord, examRemaining, type Cet6Exam, type Cet6MediaStatus, type Cet6Meta, type Cet6Mode, type Cet6Record } from '../../../shared/cet6'
import { toIpc } from '../lib/ipc-safe'
import { toast } from '../components/base/toast'
import { CET6 } from '../lib/copy'
import { assetBase } from '../lib/asset-base'
import { useProgressStore } from './progress'
import { DATA_STORE } from '../../../shared/copy'

export const CET6_SAVE_DEBOUNCE_MS = 400

export const useCet6Store = defineStore('cet6', () => {
  const metas = ref<Cet6Meta[]>([])
  const catalogError = ref('')
  const catalogLoaded = ref(false)
  const records = ref<Record<string, Cet6Record>>({})
  const media = ref<Cet6MediaStatus>({ root: null, ok: false })

  const exam = ref<Cet6Exam | null>(null)
  const examError = ref('')
  const loading = ref(false)
  const record = ref<Cet6Record>(emptyRecord())
  const marks = ref<Set<string>>(new Set())
  const lastMode = ref<Cet6Mode>('practice')
  const grading = ref<Record<string, boolean>>({})
  const gradeError = ref<Record<string, string>>({})
  /** 做题页是否挂载（由 Cet6ExamView 开关）；考试锁只在做题页存在时生效 */
  const examPageActive = ref(false)

  let loadRequest = 0
  let attemptRevision = 0
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  /** 考试锁（docs/27 §8.1）：考试模式、未交卷、做题页挂载中。App.vue / AiContextMenu / 选词工具条读它 */
  const examLock = computed(() => examPageActive.value && exam.value !== null && record.value.mode === 'exam' && !record.value.submitted)
  const remaining = computed(() => examRemaining(record.value.seconds))

  const submittedCount = computed(() => Object.values(records.value).filter((r) => r.submitted).length)

  async function loadCatalog(): Promise<void> {
    try {
      const resp = await fetch(`${assetBase().cet6}data/index.json`)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const list = (await resp.json()) as Cet6Meta[]
      metas.value = [...list].sort((a, b) => b.year - a.year || b.month - a.month || a.set - b.set)
      catalogError.value = ''
    } catch (err) {
      catalogError.value = CET6.catalogFailed(err instanceof Error ? err.message : String(err))
    } finally {
      catalogLoaded.value = true
    }
  }

  async function loadState(): Promise<void> {
    try {
      const s = await window.miai.cet6.getState()
      records.value = s.records
      media.value = s.media
      lastMode.value = s.lastMode
      if (s.readOnlyNewer) toast(DATA_STORE.NEWER_VERSION, 'warn', 8000)
    } catch (err) {
      console.error('[cet6] getState failed', err)
      if (err instanceof Error && err.message.includes(DATA_STORE.NEWER_VERSION)) toast(DATA_STORE.NEWER_VERSION, 'error', 8000)
      else if (err instanceof Error && err.message.includes(DATA_STORE.UNREADABLE)) toast(DATA_STORE.UNREADABLE, 'error', 8000)
    }
  }

  async function pickMediaRoot(): Promise<void> {
    media.value = await window.miai.cet6.pickMediaRoot()
  }

  async function setLastMode(mode: Cet6Mode): Promise<void> {
    const prev = lastMode.value
    lastMode.value = mode
    try {
      await window.miai.cet6.setLastMode(mode)
    } catch (err) {
      lastMode.value = prev
      console.error('[cet6] setLastMode failed', err)
      if (err instanceof Error && err.message.includes(DATA_STORE.NEWER_VERSION)) toast(DATA_STORE.NEWER_VERSION, 'error', 8000)
    }
  }

  function snapshot(): Cet6Record {
    const out: Cet6Record = { answers: { ...record.value.answers }, marks: [...marks.value], submitted: record.value.submitted, seconds: record.value.seconds, mode: record.value.mode }
    if (record.value.aiGrades) out.aiGrades = { ...record.value.aiGrades }
    return out
  }

  /** 立刻写当前卷（切卷、离开路由、beforeunload、交卷） */
  async function flush(): Promise<void> {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    const cur = exam.value
    if (!cur) return
    const snap = snapshot()
    records.value = { ...records.value, [cur.id]: snap }
    try {
      await window.miai.cet6.saveRecord(cur.id, toIpc(snap))
    } catch (err) {
      console.error('[cet6] save failed', err)
      toast(err instanceof Error && err.message.includes(DATA_STORE.NEWER_VERSION) ? DATA_STORE.NEWER_VERSION : CET6.SAVE_FAILED, 'error')
    }
  }

  function scheduleSave(): void {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => void flush(), CET6_SAVE_DEBOUNCE_MS)
  }

  /** `mode` 只对没有记录的新卷生效；已有记录按它自己的模式继续 */
  async function openExam(id: string, mode: Cet6Mode = lastMode.value): Promise<void> {
    await flush()
    const request = ++loadRequest
    loading.value = true
    examError.value = ''
    const meta = metas.value.find((m) => m.id === id)
    try {
      const resp = await fetch(`${assetBase().cet6}data/${meta ? meta.file : `exams/${id}.json`}`)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = (await resp.json()) as Cet6Exam
      // 快速切卷时，较晚回来的旧响应不能盖掉用户最后选的那套
      if (request !== loadRequest) return
      const saved = records.value[id] ?? emptyRecord(mode)
      record.value = { ...saved, answers: { ...saved.answers }, aiGrades: saved.aiGrades ? { ...saved.aiGrades } : undefined }
      marks.value = new Set(saved.marks)
      grading.value = {}
      gradeError.value = {}
      exam.value = data
    } catch (err) {
      if (request === loadRequest) {
        exam.value = null
        examError.value = CET6.examFailed(id, err instanceof Error ? err.message : String(err))
      }
    } finally {
      if (request === loadRequest) loading.value = false
    }
  }

  /** 先作废在途请求再落盘；落盘期间若又打开了别的卷（loadRequest 变了），不能把它清掉 */
  async function closeExam(): Promise<void> {
    const mine = ++loadRequest
    await flush()
    if (mine === loadRequest) exam.value = null
  }

  /** 单选 / 选词 / 匹配：再点同一项清除 */
  function toggleAnswer(qid: string, key: string): void {
    if (record.value.submitted) return
    const next = { ...record.value.answers }
    if (next[qid] === key) delete next[qid]
    else next[qid] = key
    record.value = { ...record.value, answers: next }
    scheduleSave()
  }

  function setText(qid: string, text: string): void {
    if (record.value.submitted) return
    record.value = { ...record.value, answers: { ...record.value.answers, [qid]: text } }
    scheduleSave()
  }

  function toggleMark(qid: string): void {
    const next = new Set(marks.value)
    if (next.has(qid)) next.delete(qid)
    else next.add(qid)
    marks.value = next
    scheduleSave()
  }

  function tick(): void {
    record.value = { ...record.value, seconds: record.value.seconds + 1 }
  }

  async function submit(): Promise<void> {
    record.value = { ...record.value, submitted: true }
    await flush()
    // 交一套六级卷 = 今天学过了（docs/31 §2.1）；失败不影响交卷
    void useProgressStore().markStudiedToday()
  }

  /** 清除记录重做；主进程失败则保持原状 */
  async function reset(mode: Cet6Mode = 'practice'): Promise<boolean> {
    const cur = exam.value
    if (!cur) return false
    attemptRevision++
    try {
      await window.miai.cet6.resetRecord(cur.id)
    } catch (err) {
      console.error('[cet6] reset failed', err)
      toast(CET6.RESET_FAILED, 'error')
      return false
    }
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    const { [cur.id]: _gone, ...rest } = records.value
    void _gone
    records.value = rest
    record.value = emptyRecord(mode)
    marks.value = new Set()
    grading.value = {}
    gradeError.value = {}
    return true
  }

  async function gradeSubjective(input: {
    questionId: string
    kind: 'writing' | 'translation'
    prompt: string
    answer: string
  }): Promise<boolean> {
    const cur = exam.value
    if (!cur) return false
    const { questionId } = input
    const revision = attemptRevision
    const answer = input.answer
    grading.value = { ...grading.value, [questionId]: true }
    const nextErr = { ...gradeError.value }
    delete nextErr[questionId]
    gradeError.value = nextErr
    try {
      const res = await window.miai.cet6.gradeSubjective({
        examId: cur.id,
        questionId,
        kind: input.kind,
        prompt: input.prompt,
        answer
      })
      if (revision !== attemptRevision || exam.value?.id !== cur.id || !record.value.submitted || record.value.answers[questionId] !== answer) return false
      if (!res.ok) {
        gradeError.value = { ...gradeError.value, [questionId]: CET6.GRADE_FAILED }
        return false
      }
      if (exam.value?.id !== cur.id) return true
      const nextGrades = { ...(record.value.aiGrades ?? {}), [questionId]: res.grade }
      const updated: Cet6Record = { ...record.value, aiGrades: nextGrades }
      record.value = updated
      records.value = { ...records.value, [cur.id]: { ...updated, answers: { ...updated.answers }, aiGrades: { ...nextGrades } } }
      return true
    } catch (err) {
      console.error('[cet6] gradeSubjective failed', err)
      gradeError.value = { ...gradeError.value, [questionId]: CET6.GRADE_FAILED }
      return false
    } finally {
      const nextGrading = { ...grading.value }
      delete nextGrading[questionId]
      grading.value = nextGrading
    }
  }

  return {
    metas, catalogError, catalogLoaded, records, media, exam, examError, loading, record, marks, submittedCount,
    lastMode, examPageActive, examLock, remaining, grading, gradeError,
    loadCatalog, loadState, pickMediaRoot, setLastMode, flush, openExam, closeExam, toggleAnswer, setText, toggleMark, tick, submit, reset, gradeSubjective
  }
})
