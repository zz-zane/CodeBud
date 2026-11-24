/**
 * 六级生词本（docs/27 §8.3）：列表镜像主进程的 cet6-vocab.json（主进程是唯一写方）。
 * 删除走「先隐藏、5 秒后真删」的撤销窗口（IPC 没有恢复口）；离开页面时立刻提交。
 */
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { VOCAB_LIMITS, vocabKey, type Cet6LookupResult, type Cet6VocabEntry, type Cet6VocabGrade, type Cet6VocabInput } from '../../../shared/cet6-vocab'
import { toIpc } from '../lib/ipc-safe'
import { toast } from '../components/base/toast'
import { CET6 } from '../lib/copy'

export const VOCAB_UNDO_MS = 5000

export const useCet6VocabStore = defineStore('cet6-vocab', () => {
  const all = ref<Cet6VocabEntry[]>([])
  const loaded = ref(false)
  const hidden = ref<Set<string>>(new Set())
  const timers = new Map<string, ReturnType<typeof setTimeout>>()

  const entries = computed(() => all.value.filter((e) => !hidden.value.has(e.id)))

  async function load(): Promise<void> {
    try {
      all.value = await window.miai.cet6.vocab.list()
      loaded.value = true
    } catch (err) {
      console.error('[cet6-vocab] list failed', err)
    }
  }

  function find(text: string): Cet6VocabEntry | undefined {
    const key = vocabKey(text)
    return all.value.find((e) => vocabKey(e.text) === key)
  }

  /** 加入生词本；已存在不重复加。返回 false = 没加上（已提示） */
  async function add(input: Cet6VocabInput): Promise<boolean> {
    if (!find(input.text) && all.value.length >= VOCAB_LIMITS.entries) {
      toast(CET6.VOCAB_FULL, 'warn')
      return false
    }
    try {
      all.value = await window.miai.cet6.vocab.add(toIpc(input))
      return true
    } catch (err) {
      console.error('[cet6-vocab] add failed', err)
      toast(CET6.VOCAB_ADD_FAILED, 'error')
      return false
    }
  }

  /** 查询释义（不加入生词本） */
  async function lookup(input: Cet6VocabInput): Promise<Cet6LookupResult> {
    let res: Cet6LookupResult
    try {
      res = await window.miai.cet6.vocab.lookup(toIpc(input))
    } catch (err) {
      console.error('[cet6-vocab] lookup failed', err)
      return { ok: false, reason: 'network' }
    }
    // 查释义不会加入生词本；只有已在本子里的词才同步刷新后的释义
    if (res.ok) {
      const at = all.value.findIndex((e) => e.id === res.entry.id)
      if (at >= 0) all.value = all.value.map((e, i) => (i === at ? res.entry : e))
    }
    return res
  }

  async function setMastered(id: string, mastered: boolean): Promise<void> {
    try {
      all.value = await window.miai.cet6.vocab.update(id, { mastered })
    } catch (err) {
      console.error('[cet6-vocab] update failed', err)
      toast(CET6.VOCAB_UPDATE_FAILED, 'error')
    }
  }

  /** 翻卡自评，主进程按今天排下次到期 */
  async function grade(id: string, g: Cet6VocabGrade): Promise<void> {
    try {
      all.value = await window.miai.cet6.vocab.update(id, { grade: g })
    } catch (err) {
      console.error('[cet6-vocab] grade failed', err)
      toast(CET6.VOCAB_UPDATE_FAILED, 'error')
    }
  }

  /** 立刻真删（「撤销加入」用） */
  async function removeNow(ids: string[]): Promise<void> {
    try {
      all.value = await window.miai.cet6.vocab.remove(ids)
    } catch (err) {
      console.error('[cet6-vocab] remove failed', err)
      toast(CET6.VOCAB_UPDATE_FAILED, 'error')
    }
  }

  async function commit(id: string): Promise<void> {
    const timer = timers.get(id)
    if (timer === undefined) return
    clearTimeout(timer)
    timers.delete(id)
    await removeNow([id])
    const next = new Set(hidden.value)
    next.delete(id)
    hidden.value = next
  }

  /** 删除：先隐藏，toast 里可撤销，窗口过后真删 */
  function removeWithUndo(entry: Cet6VocabEntry): void {
    hidden.value = new Set(hidden.value).add(entry.id)
    timers.set(entry.id, setTimeout(() => void commit(entry.id), VOCAB_UNDO_MS + 200))
    toast(CET6.vocabRemoved, 'info', VOCAB_UNDO_MS, {
      label: CET6.UNDO,
      run: () => {
        const t = timers.get(entry.id)
        if (t !== undefined) clearTimeout(t)
        timers.delete(entry.id)
        const next = new Set(hidden.value)
        next.delete(entry.id)
        hidden.value = next
      }
    })
  }

  /** 离开页面：把还在撤销窗口里的删除立即提交 */
  async function flushPending(): Promise<void> {
    await Promise.all([...timers.keys()].map((id) => commit(id)))
  }

  return { entries, loaded, load, find, add, lookup, setMastered, grade, removeNow, removeWithUndo, flushPending }
})
