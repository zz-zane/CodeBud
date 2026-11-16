import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { UpdateSnapshot } from '../../../shared/update'

export const useUpdateStore = defineStore('update', () => {
  const snapshot = ref<UpdateSnapshot>({
    version: '0.2.0',
    status: { state: 'idle' },
    manual: false
  })
  const dismissed = ref(false)
  let initialized = false

  function isRemote(): boolean {
    return typeof window !== 'undefined' && Boolean(window.miai?.isRemote)
  }

  function applySnapshot(next: UpdateSnapshot): void {
    const prev = snapshot.value.status
    snapshot.value = next
    if (next.status.state === 'ready' && (prev.state !== 'ready' || prev.version !== next.status.version)) {
      dismissed.value = false
    }
  }

  async function init(): Promise<void> {
    if (initialized || isRemote() || typeof window === 'undefined' || !window.miai?.update) return
    initialized = true
    window.miai.update.onStatus((next) => applySnapshot(next))
    try {
      applySnapshot(await window.miai.update.getStatus())
    } catch {
      /* ignore initial status failure */
    }
  }

  async function check(): Promise<void> {
    if (isRemote() || typeof window === 'undefined' || !window.miai?.update) return
    try {
      applySnapshot(await window.miai.update.check())
    } catch {
      /* handled via status */
    }
  }

  async function install(): Promise<void> {
    if (isRemote() || typeof window === 'undefined' || !window.miai?.update) return
    await window.miai.update.install()
  }

  function dismissBanner(): void {
    dismissed.value = true
  }

  const readyVersion = computed(() =>
    snapshot.value.status.state === 'ready' ? snapshot.value.status.version : ''
  )

  const showBanner = computed(
    () => !isRemote() && snapshot.value.status.state === 'ready' && !dismissed.value
  )

  return { snapshot, dismissed, readyVersion, showBanner, init, check, install, dismissBanner }
})
