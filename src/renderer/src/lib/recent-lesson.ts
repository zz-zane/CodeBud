import { ref } from 'vue'

const KEY = 'miai.recent-lesson.v1'

export function createRecentLesson(valid: (id: string) => boolean, storage: () => Pick<Storage, 'getItem' | 'setItem'> = () => localStorage) {
  const id = ref<string | null>(null)
  try {
    const saved = storage().getItem(KEY)
    if (saved && valid(saved)) id.value = saved
  } catch { /* storage can be unavailable */ }
  function record(next: string) {
    if (!valid(next)) return
    id.value = next
    try { storage().setItem(KEY, next) } catch { /* retain the in-memory value */ }
  }
  return { id, record }
}
