<script setup lang="ts">
/**
 * 设置面板「手机连接」页（docs/29 §3.4，只在桌面端显示）。
 * 状态全部来自主进程（window.miai.remoteAdmin）：开关、端口、监听错误、配对码、已配对设备、本机地址。
 * 地址列表只在服务开着时由主进程枚举网卡，这里不缓存、不写盘。
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import MiButton from '../base/MiButton.vue'
import MiIcon from '../base/MiIcon.vue'
import MiInput from '../base/MiInput.vue'
import MiSwitch from '../base/MiSwitch.vue'
import { toast } from '../base/toast'
import { REMOTE } from '../../lib/copy'
import type { RemoteErrorCode, RemoteStatus } from '../../../../shared/remote-auth'
import { MAX_REMOTE_PORT, MIN_REMOTE_PORT } from '../../../../shared/config-schema'

const REFRESH_MS = 3000

const status = ref<RemoteStatus | null>(null)
const loadError = ref(false)
const portText = ref('')
const portError = ref(false)
const confirmingRevokeAll = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

function adopt(s: RemoteStatus): void {
  const first = status.value === null
  status.value = s
  if (first) portText.value = String(s.port)
}

async function refresh(): Promise<void> {
  try {
    adopt(await window.miai.remoteAdmin.getStatus())
    loadError.value = false
  } catch {
    loadError.value = true
  }
}

async function act(fn: () => Promise<RemoteStatus>): Promise<void> {
  try {
    adopt(await fn())
    loadError.value = false
  } catch {
    loadError.value = true
  }
}

onMounted(() => {
  void refresh()
  // 配对成功会换码，手机打开页面会更新最新登录：定时拉取状态。
  timer = setInterval(() => void refresh(), REFRESH_MS)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

const enabled = computed(() => status.value?.enabled === true)

function setEnabled(v: boolean): void {
  void act(() => window.miai.remoteAdmin.setEnabled(v))
}

function applyPort(): void {
  const n = Number(portText.value.trim())
  if (!Number.isInteger(n) || n < MIN_REMOTE_PORT || n > MAX_REMOTE_PORT) {
    portError.value = true
    return
  }
  portError.value = false
  void act(() => window.miai.remoteAdmin.setPort(n))
}

const ERROR_TEXT: Record<RemoteErrorCode, string> = {
  'port-in-use': REMOTE.ERROR_PORT_IN_USE,
  permission: REMOTE.ERROR_PERMISSION,
  'listen-failed': REMOTE.ERROR_LISTEN_FAILED,
  'no-renderer': REMOTE.ERROR_NO_RENDERER
}

const errorText = computed(() => {
  const e = status.value?.error
  if (!e) return ''
  return ERROR_TEXT[e.code] + (e.detail ? REMOTE.errorDetail(e.detail) : '')
})

function urlOf(address: string): string {
  return `http://${address}:${status.value?.port ?? ''}`
}

async function copy(address: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(urlOf(address))
    toast(REMOTE.COPIED, 'success')
  } catch {
    toast(REMOTE.COPY_FAILED, 'error')
  }
}

const fmt = (ms: number): string => new Date(ms).toLocaleString('zh-CN')
const lockedText = computed(() => {
  const until = status.value?.lockedUntil ?? 0
  return until > Date.now() ? REMOTE.LOCKED(new Date(until).toLocaleTimeString('zh-CN')) : ''
})

function regenerate(): void {
  void act(() => window.miai.remoteAdmin.regenerateCode())
}

function revokeDevice(id: string): void {
  void act(() => window.miai.remoteAdmin.revokeDevice(id))
}

function revokeAll(): void {
  confirmingRevokeAll.value = false
  void act(() => window.miai.remoteAdmin.revokeAll())
}
</script>

<template>
  <div class="remote-page">
    <h2 class="remote-title">{{ REMOTE.TITLE }}</h2>
    <p class="remote-hint">{{ REMOTE.INTRO }}</p>

    <p v-if="loadError" class="mi-alert-error" role="alert">{{ REMOTE.LOAD_FAILED }}</p>

    <template v-if="status">
      <div class="remote-row">
        <span class="remote-label">{{ REMOTE.ENABLE_LABEL }}</span>
        <MiSwitch :model-value="enabled" :aria-label="REMOTE.ENABLE_LABEL" @update:model-value="setEnabled" />
      </div>

      <div class="remote-row">
        <label class="remote-label" for="remote-port">{{ REMOTE.PORT_LABEL }}</label>
        <div class="remote-port">
          <MiInput id="remote-port" v-model="portText" type="number" width="110px" @enter="applyPort" />
          <MiButton size="sm" variant="secondary" @click="applyPort">{{ REMOTE.PORT_APPLY }}</MiButton>
        </div>
      </div>
      <p v-if="portError" class="mi-alert-error" role="alert">{{ REMOTE.PORT_INVALID }}</p>

      <p v-if="errorText" class="mi-alert-error" role="alert">{{ errorText }}</p>

      <template v-if="status.running">
        <h3 class="remote-sub">{{ REMOTE.ADDRESSES_TITLE }}</h3>
        <p v-if="status.addresses.length === 0" class="remote-hint">{{ REMOTE.ADDRESSES_EMPTY }}</p>
        <ul v-else class="remote-list">
          <li v-for="a in status.addresses" :key="a.name + a.address" class="remote-item">
            <div class="remote-item-main">
              <code class="remote-url">{{ urlOf(a.address) }}</code>
              <span class="remote-tag">{{ a.overlay ? REMOTE.ADDRESS_OVERLAY : REMOTE.ADDRESS_LAN }}</span>
            </div>
            <button type="button" class="icon-btn" :title="REMOTE.COPY_ADDRESS" :aria-label="REMOTE.COPY_ADDRESS" @click="copy(a.address)">
              <MiIcon name="link" :size="15" />
            </button>
          </li>
        </ul>

        <h3 class="remote-sub">{{ REMOTE.PAIRING_TITLE }}</h3>
        <div class="remote-code-row">
          <code class="remote-code" aria-live="polite">{{ status.pairingCode ?? REMOTE.PAIRING_NONE }}</code>
          <button type="button" class="icon-btn" :title="REMOTE.PAIRING_REGENERATE" :aria-label="REMOTE.PAIRING_REGENERATE" @click="regenerate">
            <MiIcon name="refresh" :size="15" />
          </button>
        </div>
        <p class="remote-hint">{{ REMOTE.PAIRING_HINT }}</p>
        <p v-if="lockedText" class="mi-alert-error" role="status">{{ lockedText }}</p>
      </template>

      <h3 class="remote-sub">{{ REMOTE.LATEST_LOGIN_TITLE }}</h3>
      <div v-if="status.latestLogin" class="remote-item" data-latest-login>
        <div class="remote-item-main">
          <span class="remote-device">{{ REMOTE.LOGIN_DEVICE }}：{{ REMOTE.deviceLabel(status.latestLogin.name, status.latestLogin.deviceId.slice(0, 6)) }}</span>
          <span class="remote-hint">{{ REMOTE.LOGIN_TIME }}：{{ fmt(status.latestLogin.at) }}</span>
        </div>
      </div>
      <p v-else class="remote-hint">{{ REMOTE.LATEST_LOGIN_EMPTY }}</p>

      <h3 class="remote-sub">{{ REMOTE.DEVICES_TITLE }}</h3>
      <p class="remote-hint">{{ REMOTE.DEVICES_HINT }}</p>
      <p v-if="status.devices.length === 0" class="remote-hint">{{ REMOTE.DEVICES_EMPTY }}</p>
      <ul v-else class="remote-list">
        <li v-for="d in status.devices" :key="d.id" class="remote-item">
          <div class="remote-item-main">
            <span class="remote-device">{{ REMOTE.deviceLabel(d.name, d.id.slice(0, 6)) }}</span>
            <span class="remote-hint">{{ REMOTE.devicePaired(fmt(d.pairedAt)) }}</span>
          </div>
          <button type="button" class="icon-btn" :title="REMOTE.revokeDevice(REMOTE.deviceLabel(d.name, d.id.slice(0, 6)))" :aria-label="REMOTE.revokeDevice(REMOTE.deviceLabel(d.name, d.id.slice(0, 6)))" @click="revokeDevice(d.id)">
            <MiIcon name="trash" :size="15" />
          </button>
        </li>
      </ul>
      <div v-if="status.devices.length > 0" class="remote-revoke-all">
        <MiButton v-if="!confirmingRevokeAll" size="sm" variant="danger" @click="confirmingRevokeAll = true">{{ REMOTE.REVOKE_ALL }}</MiButton>
        <template v-else>
          <span class="remote-hint">{{ REMOTE.REVOKE_ALL_CONFIRM }}</span>
          <MiButton size="sm" variant="danger" @click="revokeAll">{{ REMOTE.CONFIRM }}</MiButton>
          <MiButton size="sm" variant="ghost" @click="confirmingRevokeAll = false">{{ REMOTE.CANCEL }}</MiButton>
        </template>
      </div>

      <h3 class="remote-sub">{{ REMOTE.HOWTO_TITLE }}</h3>
      <ul class="remote-howto">
        <li>{{ REMOTE.HOWTO_WIFI }}</li>
        <li>{{ REMOTE.HOWTO_AWAY }}</li>
        <li>{{ REMOTE.HOWTO_PLAIN }}</li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.remote-page { display: flex; flex-direction: column; gap: var(--mi-sp-3); }
.remote-title { font-size: var(--mi-fs-read); font-weight: 500; color: var(--mi-text); margin: 0; }
.remote-sub { font-size: var(--mi-fs-body); font-weight: 500; color: var(--mi-text); margin: var(--mi-sp-4) 0 0; }
.remote-hint { font-size: var(--mi-fs-label); color: var(--mi-text-3); margin: 0; }
.remote-row { display: flex; align-items: center; justify-content: space-between; gap: var(--mi-sp-6); padding: var(--mi-sp-2) 0; }
.remote-label { font-size: var(--mi-fs-body); color: var(--mi-text); }
.remote-port { display: flex; align-items: center; gap: var(--mi-sp-2); }
.remote-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--mi-sp-2); }
.remote-item { display: flex; align-items: center; justify-content: space-between; gap: var(--mi-sp-3); padding: var(--mi-sp-2) var(--mi-sp-3); border: 1px solid var(--mi-border); border-radius: var(--mi-radius-sm); background: var(--mi-bg); }
.remote-item-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.remote-url { font-size: var(--mi-fs-body); color: var(--mi-text); word-break: break-all; }
.remote-tag { font-size: var(--mi-fs-caption); color: var(--mi-text-3); }
.remote-device { font-size: var(--mi-fs-body); color: var(--mi-text); }
.remote-code-row { display: flex; align-items: center; gap: var(--mi-sp-2); }
.remote-code { font-size: var(--mi-fs-hero); letter-spacing: 0.3em; color: var(--mi-text); }
.remote-revoke-all { display: flex; align-items: center; gap: var(--mi-sp-2); flex-wrap: wrap; }
.remote-howto { margin: 0; padding-left: var(--mi-sp-4); font-size: var(--mi-fs-label); color: var(--mi-text-2); display: flex; flex-direction: column; gap: var(--mi-sp-2); }
</style>
