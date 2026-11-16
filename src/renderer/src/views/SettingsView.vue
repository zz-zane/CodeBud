<script setup lang="ts">
/**
 * 设置的**内容区**（v1-lite 纯工程设置与环境检测）。
 * 2026-10-28：五类配置原样保留，但不再自带页标题与顶部 MiTabs ——
 * 分类选择交给 SettingsDialog.vue 的左栏，本组件只按 `card` 渲染对应一组设置。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { useUpdateStore } from '../stores/update'
import { useZoomStore } from '../stores/zoom'
import { useAiAssistantStore } from '../stores/ai-assistant'
import { SETTINGS } from '../lib/copy'
import { UPDATE_SHARED } from '../../../shared/copy'
import { STUDY_COPY } from '../lib/study-copy'
import ProviderList from '../components/domain/ProviderList.vue'
import { sendsKeyInPlainText } from '../lib/api-url-safety'
import { LANG_LABEL } from '../lib/labels'
import { REVIEW_STRATEGIES } from '../../../shared/review-schedule'
import {
  VIDEO_NARRATION_ENABLED_KEY,
  VIDEO_NARRATION_RATE_KEY,
  VIDEO_NARRATION_VOICE_KEY,
  chineseVoices,
  readVideoPreference,
  writeVideoPreference
} from '../lib/video-narrator'
import type { LangOfCode, AiProtocol, AiProviderPreset, ExplainMode, ReviewStrategy } from '../../../shared/types'
import type { SettingsCard } from '../stores/settings-dialog'
import MiSwitch from '../components/base/MiSwitch.vue'
import MiButton from '../components/base/MiButton.vue'
import MiHint from '../components/base/MiHint.vue'
import MiIcon from '../components/base/MiIcon.vue'

const props = defineProps<{ card: SettingsCard }>()

const settings = useSettingsStore()
const update = useUpdateStore()
const zoom = useZoomStore()
const aiStore = useAiAssistantStore()

const RELEASES_URL = 'https://github.com/zz-zane/CodeBud/releases'
const autoUpdateOn = computed(() => settings.config.update?.auto !== false)

function setAutoUpdate(auto: boolean): void {
  void settings.update({ update: { auto } })
}

function formatCheckedAt(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const hhmm = `${hh}:${mm}`
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  return sameDay ? SETTINGS.updateTodayTime(hhmm) : SETTINGS.updateDateTime(d.getMonth() + 1, d.getDate(), hhmm)
}

const nativeRunOn = computed({
  get: () => settings.config.nativeRunEnabled,
  set: (val: boolean) => {
    void settings.update({ nativeRunEnabled: val })
  }
})

const reviewOn = computed({
  get: () => settings.config.reviewEnabled,
  set: (val: boolean) => {
    void settings.update({ reviewEnabled: val })
  }
})

const favWrongOn = computed({
  get: () => settings.config.favWrongToBook,
  set: (val: boolean) => {
    void settings.update({ favWrongToBook: val })
  }
})

const explainMode = computed<ExplainMode>(() => settings.config.learning?.explainMode ?? 'text')
const reviewStrategy = computed<ReviewStrategy>(() => settings.config.learning?.reviewStrategy ?? 'standard')
const strategyDaysHint = computed(() => SETTINGS.reviewStrategyDaysHint(REVIEW_STRATEGIES[reviewStrategy.value].join(' / ')))

function setExplainMode(mode: ExplainMode): void {
  void settings.update({
    learning: {
      explainMode: mode,
      reviewStrategy: reviewStrategy.value
    }
  })
}

function setReviewStrategy(strategy: ReviewStrategy): void {
  void settings.update({
    learning: {
      explainMode: explainMode.value,
      reviewStrategy: strategy
    }
  })
}

const NARRATOR_RATES = [0.75, 1, 1.25, 1.5] as const

const narratorEnabled = ref(readVideoPreference(VIDEO_NARRATION_ENABLED_KEY) !== 'false')
const narratorVoiceUri = ref(readVideoPreference(VIDEO_NARRATION_VOICE_KEY) ?? '')
const parsedRate = Number(readVideoPreference(VIDEO_NARRATION_RATE_KEY))
const narratorRate = ref<number>((NARRATOR_RATES as readonly number[]).includes(parsedRate) ? parsedRate : 1)
const zhVoices = ref<SpeechSynthesisVoice[]>([])
const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.speechSynthesis?.getVoices === 'function'

function refreshVoices(): void {
  zhVoices.value = speechSupported ? chineseVoices() : []
}

function setNarratorEnabled(enabled: boolean): void {
  narratorEnabled.value = enabled
  writeVideoPreference(VIDEO_NARRATION_ENABLED_KEY, String(enabled))
}

function onNarratorVoiceChange(e: Event): void {
  const val = (e.target as HTMLSelectElement).value
  narratorVoiceUri.value = val
  writeVideoPreference(VIDEO_NARRATION_VOICE_KEY, val)
}

function setNarratorRate(rate: number): void {
  narratorRate.value = rate
  writeVideoPreference(VIDEO_NARRATION_RATE_KEY, String(rate))
}

function testNarratorVoice(): void {
  if (!speechSupported || typeof SpeechSynthesisUtterance === 'undefined') return
  try {
    window.speechSynthesis.cancel()
    const utter = new SpeechSynthesisUtterance(SETTINGS.NARRATOR_TEST_SAMPLE)
    utter.lang = 'zh-CN'
    utter.rate = narratorRate.value
    const picked = narratorVoiceUri.value
      ? zhVoices.value.find((v) => v.voiceURI === narratorVoiceUri.value) ?? zhVoices.value[0]
      : zhVoices.value[0]
    if (picked) utter.voice = picked
    window.speechSynthesis.speak(utter)
  } catch {
    // ignore speech synthesis errors on unsupported environments
  }
}

onMounted(() => {
  refreshVoices()
  if (speechSupported) {
    window.speechSynthesis.addEventListener?.('voiceschanged', refreshVoices)
  }
})

onBeforeUnmount(() => {
  if (speechSupported) {
    window.speechSynthesis.removeEventListener?.('voiceschanged', refreshVoices)
  }
})

const envLangs: LangOfCode[] = ['c', 'cpp', 'java', 'python']

function onZoomChange(e: Event): void {
  const target = e.target as HTMLInputElement
  zoom.set(Number(target.value))
}

function onTimeoutChange(e: Event): void {
  const target = e.target as HTMLInputElement
  const v = Math.max(3, Math.min(60, Number(target.value) || 10))
  void settings.update({ runTimeoutSec: v })
}

// ---- AI 助教配置响应式状态 ----
const aiProtocol = ref<AiProtocol>('openai')
const aiProvider = ref<AiProviderPreset>('deepseek')
const aiBaseUrl = ref('')
const aiModel = ref('')
const apiKeyInput = ref('')

watch(
  () => settings.config.ai,
  (ai) => {
    if (!ai) return
    aiProtocol.value = ai.protocol || 'openai'
    aiProvider.value = ai.provider || 'deepseek'
    aiBaseUrl.value = ai.baseUrl || ''
    aiModel.value = ai.model || ''
  },
  { immediate: true, deep: true }
)

const presets: { key: AiProviderPreset; label: string }[] = [
  { key: 'deepseek', label: SETTINGS.AI_PRESET_DEEPSEEK },
  { key: 'openai', label: SETTINGS.AI_PRESET_OPENAI },
  { key: 'anthropic', label: SETTINGS.AI_PRESET_ANTHROPIC },
  { key: 'custom', label: SETTINGS.AI_PRESET_CUSTOM }
]

async function applyPreset(presetKey: AiProviderPreset): Promise<void> {
  aiProvider.value = presetKey
  if (presetKey === 'deepseek') {
    aiProtocol.value = 'openai'
    aiBaseUrl.value = 'https://api.deepseek.com'
    aiModel.value = 'deepseek-chat'
  } else if (presetKey === 'openai') {
    aiProtocol.value = 'openai'
    aiBaseUrl.value = 'https://api.openai.com/v1'
    aiModel.value = 'gpt-4o-mini'
  } else if (presetKey === 'anthropic') {
    aiProtocol.value = 'anthropic'
    aiBaseUrl.value = 'https://api.anthropic.com'
    aiModel.value = 'claude-3-5-sonnet-20241022'
  }
  await saveAiConfig()
}

async function saveAiConfig(): Promise<void> {
  await settings.updateAi({
    protocol: aiProtocol.value,
    provider: aiProvider.value,
    baseUrl: aiBaseUrl.value.trim(),
    model: aiModel.value.trim()
  })
}

function onProtocolChange(): void {
  void saveAiConfig()
}

async function saveApiKey(): Promise<void> {
  const key = apiKeyInput.value.trim()
  if (!key) return
  await settings.updateAi({
    protocol: aiProtocol.value,
    provider: aiProvider.value,
    baseUrl: aiBaseUrl.value.trim(),
    model: aiModel.value.trim(),
    apiKey: key
  })
  settings.markKeySaved()
  apiKeyInput.value = ''
}

async function clearApiKey(): Promise<void> {
  await settings.clearAiKey()
  apiKeyInput.value = ''
}

const testingConnection = ref(false)
const testResult = ref<{ ok: boolean; msg: string } | null>(null)

async function testAiConnection(): Promise<void> {
  testingConnection.value = true
  testResult.value = null
  try {
    if (apiKeyInput.value.trim()) {
      await saveApiKey()
    }
    const res = await window.miai.aiTestConnection()
    if (res.ok) {
      testResult.value = { ok: true, msg: SETTINGS.AI_TEST_OK(res.data.model) }
    } else {
      testResult.value = { ok: false, msg: res.reason || SETTINGS.AI_TEST_UNEXPECTED }
    }
  } catch (err: any) {
    testResult.value = { ok: false, msg: err?.message || SETTINGS.AI_TEST_UNEXPECTED }
  } finally {
    testingConnection.value = false
  }
}

onMounted(() => {
  void settings.ensureEnvCache()
})
</script>

<template>
  <div class="settings-view">
    <!-- 1. 外观配置 -->
    <div v-if="props.card === 'appearance'" class="settings-panel">
      <div class="card">
        <div class="row column">
          <div class="row-info">
            <span class="row-label">{{ SETTINGS.LABEL_ZOOM }}</span>
          </div>
          <div class="slider-row">
            <input
              type="range"
              min="80"
              max="150"
              step="5"
              :value="zoom.percent"
              :aria-label="SETTINGS.LABEL_ZOOM"
              class="zoom-slider"
              @input="onZoomChange"
            />
            <span class="zoom-value">{{ zoom.percent }}%</span>
            <MiButton size="sm" variant="secondary" :disabled="zoom.percent === 100" @click="zoom.reset()">
              {{ SETTINGS.ZOOM_RESET_BTN }}
            </MiButton>
          </div>
        </div>
      </div>
    </div>

    <!-- 2. 编辑器与运行配置 -->
    <div v-else-if="props.card === 'editor'" class="settings-panel">
      <div class="card">
        <div class="row">
          <div class="row-info">
            <span class="row-label">{{ SETTINGS.LABEL_NATIVE_RUN }}<MiHint :text="SETTINGS.NATIVE_RUN_HINT" /></span>
          </div>
          <MiSwitch v-model="nativeRunOn" :aria-label="SETTINGS.LABEL_NATIVE_RUN" />
        </div>

        <div class="divider" />

        <div class="row">
          <div class="row-info">
            <span class="row-label">{{ SETTINGS.LABEL_RUN_TIMEOUT }}<MiHint :text="SETTINGS.TIMEOUT_HINT" /></span>
          </div>
          <div class="number-input-wrap">
            <input
              type="number"
              min="3"
              max="60"
              :value="settings.config.runTimeoutSec"
              :aria-label="SETTINGS.LABEL_RUN_TIMEOUT"
              class="num-input"
              @change="onTimeoutChange"
            />
            <span class="unit-text">{{ SETTINGS.RUNNER_TIMEOUT_UNIT }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 3. 学习与复习配置 -->
    <div v-else-if="props.card === 'study'" class="settings-panel">
      <div class="card">
        <div class="row">
          <div class="row-info">
            <span class="row-label">{{ SETTINGS.LABEL_REVIEW_REMINDER }}</span>
          </div>
          <MiSwitch v-model="reviewOn" :aria-label="SETTINGS.LABEL_REVIEW_REMINDER" />
        </div>

        <div class="divider" />

        <div class="row">
          <div class="row-info">
            <span class="row-label">{{ SETTINGS.LABEL_FAV_WRONG_TO_BOOK }}<MiHint :text="SETTINGS.FAV_WRONG_TO_BOOK_HINT" /></span>
          </div>
          <MiSwitch v-model="favWrongOn" :aria-label="SETTINGS.LABEL_FAV_WRONG_TO_BOOK" />
        </div>
      </div>

      <div class="divider" />

      <div class="card">
        <div class="card-head-row">
          <div class="card-title">{{ SETTINGS.LEARNING_CARD_TITLE }}</div>
        </div>

        <div class="row">
          <div class="row-info">
            <span class="row-label">{{ SETTINGS.EXPLAIN_MODE_LABEL }}</span>
          </div>
          <div class="seg-group" role="group" :aria-label="SETTINGS.EXPLAIN_MODE_LABEL">
            <button
              type="button"
              class="seg-btn"
              :class="{ active: explainMode === 'text' }"
              data-setting="explain-text"
              @click="setExplainMode('text')"
            >
              {{ SETTINGS.EXPLAIN_MODE_TEXT }}
            </button>
            <button
              type="button"
              class="seg-btn"
              :class="{ active: explainMode === 'video' }"
              data-setting="explain-video"
              @click="setExplainMode('video')"
            >
              {{ SETTINGS.EXPLAIN_MODE_VIDEO }}
            </button>
          </div>
        </div>

        <div class="divider" />

        <div class="row">
          <div class="row-info">
            <span class="row-label">{{ SETTINGS.REVIEW_STRATEGY_LABEL }}</span>
            <p class="hint" data-testid="strategy-days-hint">{{ strategyDaysHint }}</p>
          </div>
          <div class="seg-group" role="group" :aria-label="SETTINGS.REVIEW_STRATEGY_LABEL">
            <button
              type="button"
              class="seg-btn"
              :class="{ active: reviewStrategy === 'standard' }"
              data-setting="strategy-standard"
              @click="setReviewStrategy('standard')"
            >
              {{ SETTINGS.REVIEW_STRATEGY_STANDARD }}
            </button>
            <button
              type="button"
              class="seg-btn"
              :class="{ active: reviewStrategy === 'sprint' }"
              data-setting="strategy-sprint"
              @click="setReviewStrategy('sprint')"
            >
              {{ SETTINGS.REVIEW_STRATEGY_SPRINT }}
            </button>
          </div>
        </div>
      </div>

      <div class="divider" />

      <div class="card">
        <div class="card-head-row">
          <div class="card-title">{{ SETTINGS.NARRATOR_CARD_TITLE }}</div>
          <span class="device-only-badge">{{ SETTINGS.NARRATOR_DEVICE_ONLY }}</span>
        </div>

        <div class="row">
          <div class="row-info">
            <span class="row-label">{{ SETTINGS.NARRATOR_ENABLED_LABEL }}</span>
          </div>
          <div class="seg-group" role="group" :aria-label="SETTINGS.NARRATOR_ENABLED_LABEL">
            <button
              type="button"
              class="seg-btn"
              :class="{ active: narratorEnabled }"
              data-setting="narrator-on"
              @click="setNarratorEnabled(true)"
            >
              {{ SETTINGS.NARRATOR_ON }}
            </button>
            <button
              type="button"
              class="seg-btn"
              :class="{ active: !narratorEnabled }"
              data-setting="narrator-off"
              @click="setNarratorEnabled(false)"
            >
              {{ SETTINGS.NARRATOR_OFF }}
            </button>
          </div>
        </div>

        <div class="divider" />

        <div class="row">
          <div class="row-info">
            <span class="row-label">{{ SETTINGS.NARRATOR_VOICE_LABEL }}</span>
          </div>
          <div class="voice-controls">
            <select
              class="select-input voice-select"
              :value="narratorVoiceUri"
              :disabled="zhVoices.length === 0"
              :aria-label="SETTINGS.NARRATOR_VOICE_LABEL"
              @change="onNarratorVoiceChange"
            >
              <option value="">{{ SETTINGS.NARRATOR_VOICE_AUTO }}</option>
              <option v-for="v in zhVoices" :key="v.voiceURI" :value="v.voiceURI">{{ v.name }}</option>
            </select>
            <MiButton
              variant="secondary"
              size="sm"
              :disabled="!speechSupported || zhVoices.length === 0"
              @click="testNarratorVoice"
            >
              {{ SETTINGS.NARRATOR_TEST_BTN }}
            </MiButton>
          </div>
        </div>

        <div class="divider" />

        <div class="row">
          <div class="row-info">
            <span class="row-label">{{ SETTINGS.NARRATOR_RATE_LABEL }}</span>
          </div>
          <div class="seg-group" role="group" :aria-label="SETTINGS.NARRATOR_RATE_LABEL">
            <button
              v-for="r in NARRATOR_RATES"
              :key="r"
              type="button"
              class="seg-btn"
              :class="{ active: narratorRate === r }"
              :data-rate="r"
              @click="setNarratorRate(r)"
            >
              {{ r === 1 ? '1.0×' : `${r}×` }}
            </button>
          </div>
        </div>

        <p v-if="zhVoices.length === 0" class="narrator-info-banner" data-testid="no-zh-voice-note">
          <MiIcon name="info" :size="14" />
          <span>{{ SETTINGS.NARRATOR_NO_ZH_VOICE }}</span>
        </p>
      </div>
    </div>

    <!-- 4. 环境检测 -->
    <div v-else-if="props.card === 'env'" class="settings-panel">
      <div class="card">
        <div class="card-head-row">
          <div>
            <h2 class="card-title">{{ SETTINGS.ENV_CARD_TITLE }}</h2>
          </div>
          <MiButton
            variant="secondary"
            size="sm"
            :loading="settings.detecting"
            @click="settings.detectEnv()"
          >
            {{ settings.detecting ? SETTINGS.ENV_CHECKING : SETTINGS.ENV_RECHECK }}
          </MiButton>
        </div>

        <div class="env-grid">
          <div v-for="lang in envLangs" :key="lang" class="env-card-item">
            <div class="env-item-head">
              <span class="env-lang-name">{{ LANG_LABEL[lang] }}</span>
              <span
                class="env-status-badge"
                :class="settings.config.envCache?.report?.[lang]?.found ? 'is-found' : 'is-missing'"
              >
                {{ settings.config.envCache?.report?.[lang]?.found ? SETTINGS.ENV_INSTALLED : SETTINGS.ENV_MISSING }}
              </span>
            </div>

            <div v-if="settings.config.envCache?.report?.[lang]?.found" class="env-details">
              <div v-if="settings.config.envCache?.report?.[lang]?.path" class="detail-row">
                <span class="detail-label">{{ SETTINGS.ENV_PATH_LABEL }}:</span>
                <span class="detail-val path-val">{{ settings.config.envCache?.report?.[lang]?.path }}</span>
              </div>
              <div v-if="settings.config.envCache?.report?.[lang]?.version" class="detail-row">
                <span class="detail-label">{{ SETTINGS.ENV_VER_LABEL }}:</span>
                <span class="detail-val">{{ settings.config.envCache?.report?.[lang]?.version }}</span>
              </div>
            </div>
            <div v-else class="env-empty-hint">
              {{ SETTINGS.ENV_FALLBACK_HINT }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 5. AI 助教配置 -->
    <div v-else-if="props.card === 'ai'" class="settings-panel">
      <!-- 5.0 Provider：谁来回答（内置 API / Antigravity / 其他 ACP） -->
      <div class="card">
        <div class="card-head-row">
          <h2 class="card-title">{{ STUDY_COPY.PROVIDER.TITLE }}</h2>
        </div>
        <ProviderList />
      </div>

      <!-- 5.1 上游模型服务与协议配置 -->
      <div class="card">
        <div class="card-head-row">
          <div>
            <h2 class="card-title">{{ SETTINGS.AI_CONFIG_TITLE }}</h2>
          </div>
          <span
            class="ai-key-badge"
            :class="settings.config.ai.hasKey ? 'is-configured' : 'is-empty'"
          >
            {{ settings.config.ai.hasKey ? SETTINGS.AI_KEY_CONFIGURED : SETTINGS.AI_KEY_NOT_CONFIGURED }}
          </span>
        </div>

        <!-- 预设选择器 -->
        <div class="form-row">
          <label class="form-label">{{ SETTINGS.AI_PRESET_LABEL }}</label>
          <div class="preset-buttons">
            <button
              v-for="p in presets"
              :key="p.key"
              type="button"
              class="preset-chip"
              :class="{ active: aiProvider === p.key }"
              @click="applyPreset(p.key)"
            >
              {{ p.label }}
            </button>
          </div>
        </div>

        <div class="divider" />

        <!-- 协议与模型配置 -->
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">{{ SETTINGS.AI_PROTOCOL_LABEL }}</label>
            <select
              v-model="aiProtocol"
              class="select-input"
              @change="onProtocolChange"
            >
              <option value="openai">{{ SETTINGS.AI_PROTOCOL_OPENAI }}</option>
              <option value="anthropic">{{ SETTINGS.AI_PROTOCOL_ANTHROPIC }}</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">{{ SETTINGS.AI_MODEL_LABEL }}</label>
            <input
              v-model="aiModel"
              type="text"
              class="text-input"
              :placeholder="SETTINGS.AI_MODEL_HINT"
              @blur="saveAiConfig"
            />
          </div>
        </div>

        <div class="form-group" style="margin-top: 12px;">
          <label class="form-label">{{ SETTINGS.AI_BASE_URL_LABEL }}</label>
          <input
            v-model="aiBaseUrl"
            type="text"
            class="text-input"
            :placeholder="SETTINGS.AI_BASE_URL_HINT"
            @blur="saveAiConfig"
          />
          <p v-if="sendsKeyInPlainText(aiBaseUrl)" class="hint hint-warn" role="alert">{{ SETTINGS.AI_BASE_URL_PLAINTEXT_WARN }}</p>
        </div>

        <div class="divider" />

        <!-- API Key 安全存储 -->
        <div class="form-group">
          <label class="form-label">{{ SETTINGS.AI_API_KEY_LABEL }}<MiHint :text="SETTINGS.AI_API_KEY_HINT" /></label>
          <div class="key-input-row">
            <input
              v-model="apiKeyInput"
              type="password"
              class="text-input"
              :placeholder="settings.config.ai.hasKey ? SETTINGS.AI_KEY_SAVED_HINT : SETTINGS.AI_KEY_INPUT_PLACEHOLDER"
            />
            <MiButton
              variant="primary"
              size="sm"
              :disabled="!apiKeyInput.trim()"
              @click="saveApiKey"
            >
              {{ SETTINGS.AI_KEY_SAVE_BTN }}
            </MiButton>
            <MiButton
              v-if="settings.config.ai.hasKey"
              variant="secondary"
              size="sm"
              @click="clearApiKey"
            >
              {{ SETTINGS.AI_CLEAR_KEY_BTN }}
            </MiButton>
          </div>
          <p v-if="settings.config.ai.keyError" class="hint" role="alert">{{ SETTINGS.AI_KEY_STORAGE_ERROR }}</p>
        </div>

        <div class="divider" />

        <!-- 连接测试 -->
        <div class="test-row">
          <MiButton
            variant="secondary"
            size="sm"
            :loading="testingConnection"
            :disabled="!settings.config.ai.hasKey && !apiKeyInput.trim()"
            @click="testAiConnection"
          >
            {{ testingConnection ? SETTINGS.AI_TEST_TESTING : SETTINGS.AI_TEST_BTN }}
          </MiButton>
          <span
            v-if="testResult"
            class="test-result-msg"
            :class="{ 'is-ok': testResult.ok, 'is-fail': !testResult.ok }"
          >
            {{ testResult.msg }}
          </span>
        </div>
      </div>

    </div>

    <!-- 6. 关于与更新 -->
    <div v-else-if="props.card === 'about'" class="settings-panel">
      <div class="card">
        <h2 class="card-title">{{ SETTINGS.ABOUT_CARD_TITLE }}</h2>

        <div class="row">
          <div class="row-info update-row-info">
            <span class="row-label">{{ SETTINGS.aboutVersion(update.snapshot.version) }}</span>
            <div v-if="update.snapshot.status.state === 'downloading'" class="update-progress-row">
              <div class="update-meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" :aria-valuenow="update.snapshot.status.percent">
                <i :style="{ width: update.snapshot.status.percent + '%' }" />
              </div>
              <span class="hint">{{ SETTINGS.updateDownloading(update.snapshot.status.version, update.snapshot.status.percent) }}</span>
            </div>
            <span v-else-if="update.snapshot.status.state === 'ready'" class="update-status-ok">
              {{ SETTINGS.updateReady(update.snapshot.status.version) }}
            </span>
            <span v-else-if="update.snapshot.status.state === 'error' && update.snapshot.manual" class="update-status-err">
              {{ SETTINGS.updateErr(update.snapshot.status.message || UPDATE_SHARED.UNKNOWN_ERROR) }}
            </span>
            <span v-else-if="update.snapshot.status.state === 'latest'" class="hint">
              {{ SETTINGS.updateLatest(formatCheckedAt(update.snapshot.status.checkedAt)) }}
            </span>
            <span v-else-if="update.snapshot.status.state === 'checking'" class="hint">
              {{ SETTINGS.UPDATE_CHECKING }}
            </span>
            <span v-else-if="update.snapshot.status.state === 'unsupported'" class="hint">
              {{ update.snapshot.status.reason === 'dev' ? SETTINGS.UPDATE_DEV_MODE : SETTINGS.UPDATE_PLATFORM_UNSUPPORTED }}
            </span>
            <span v-else class="hint">
              {{ SETTINGS.UPDATE_IDLE_HINT }}
            </span>
          </div>
          <div class="update-actions">
            <a :href="RELEASES_URL" target="_blank" rel="noopener noreferrer" class="update-release-link">
              {{ SETTINGS.UPDATE_RELEASE_NOTES }}
            </a>
            <MiButton
              v-if="update.snapshot.status.state === 'ready'"
              variant="primary"
              size="sm"
              @click="update.install()"
            >
              {{ SETTINGS.UPDATE_RESTART_BTN }}
            </MiButton>
            <MiButton
              v-else-if="update.snapshot.status.state === 'error' && update.snapshot.manual"
              variant="secondary"
              size="sm"
              @click="update.check()"
            >
              {{ SETTINGS.UPDATE_RETRY_BTN }}
            </MiButton>
            <MiButton
              v-else
              variant="secondary"
              size="sm"
              :disabled="update.snapshot.status.state === 'checking' || update.snapshot.status.state === 'downloading'"
              @click="update.check()"
            >
              {{ SETTINGS.UPDATE_CHECK_BTN }}
            </MiButton>
          </div>
        </div>

        <div class="divider" />

        <div class="row">
          <div class="row-info update-row-info">
            <span class="row-label">{{ SETTINGS.UPDATE_AUTO_LABEL }}</span>
            <span class="hint">{{ SETTINGS.UPDATE_AUTO_HINT }}</span>
          </div>
          <div class="seg-group" role="group" :aria-label="SETTINGS.UPDATE_AUTO_LABEL">
            <button
              type="button"
              class="seg-btn"
              :class="{ active: autoUpdateOn }"
              data-setting="update-auto-on"
              @click="setAutoUpdate(true)"
            >
              {{ SETTINGS.UPDATE_AUTO_ON }}
            </button>
            <button
              type="button"
              class="seg-btn"
              :class="{ active: !autoUpdateOn }"
              data-setting="update-auto-off"
              @click="setAutoUpdate(false)"
            >
              {{ SETTINGS.UPDATE_AUTO_OFF }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-view {
  width: 100%;
  padding-bottom: var(--mi-sp-2);
}
.settings-panel {
  display: flex;
  flex-direction: column;
  gap: var(--mi-sp-4);
}
/* 面板本身已经是一张大卡：内容区不再套第二层边框卡，改成分节（标题 + 行 + 分隔线） */
.card {
  background: transparent;
  border: 0;
  padding: 0;
}
.card-head-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--mi-sp-4);
  margin-bottom: var(--mi-sp-4);
}
.card-title {
  font-size: var(--mi-fs-read);
  font-weight: 500;
  color: var(--mi-text);
  margin-bottom: var(--mi-sp-1);
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--mi-sp-6);
  padding: var(--mi-sp-3) 0;
}
.row.column {
  flex-direction: column;
  align-items: flex-start;
  gap: var(--mi-sp-3);
}
.row-info {
  flex: 1;
}
.row-label {
  font-size: var(--mi-fs-body);
  font-weight: 500;
  color: var(--mi-text);
}
.hint {
  font-size: var(--mi-fs-label);
  color: var(--mi-text-3);
  margin-top: var(--mi-sp-1);
  line-height: 1.5;
}
.hint-warn {
  color: var(--mi-warn-deep);
}
.divider {
  height: 1px;
  background: var(--mi-border);
  margin: var(--mi-sp-4) 0;
  opacity: 0.6;
}
.slider-row {
  display: flex;
  align-items: center;
  gap: var(--mi-sp-4);
  width: 100%;
}
.zoom-slider {
  flex: 1;
  accent-color: var(--mi-blue-deep);
}
.zoom-value {
  font-family: var(--mi-code);
  font-size: var(--mi-fs-label);
  color: var(--mi-text-2);
  width: 45px;
  text-align: right;
}
.number-input-wrap {
  display: flex;
  align-items: center;
  gap: var(--mi-sp-2);
}
.num-input {
  width: 70px;
  padding: var(--mi-sp-2) var(--mi-sp-3);
  border: 1px solid var(--mi-border);
  border-radius: var(--mi-radius-sm);
  background: var(--mi-bg);
  color: var(--mi-text);
  font-size: var(--mi-fs-body);
}
.unit-text {
  font-size: var(--mi-fs-label);
  color: var(--mi-text-2);
}
.env-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--mi-sp-3);
}
.env-card-item {
  background: var(--mi-bg);
  border: 1px solid var(--mi-border);
  border-radius: var(--mi-radius-sm);
  padding: var(--mi-sp-3) var(--mi-sp-4);
  display: flex;
  flex-direction: column;
  gap: var(--mi-sp-2);
}
.env-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.env-lang-name {
  font-weight: 500;
  font-size: var(--mi-fs-body);
  color: var(--mi-text);
}
.env-status-badge {
  font-size: var(--mi-fs-caption);
  padding: 2px var(--mi-sp-2);
  border-radius: 10px;
  font-weight: 500;
}
.env-status-badge.is-found {
  background: var(--mi-success-fill);
  color: var(--mi-success);
}
.env-status-badge.is-missing {
  background: color-mix(in srgb, var(--mi-text-3) 15%, transparent);
  color: var(--mi-text-3);
}
.env-details {
  font-size: var(--mi-fs-caption);
  color: var(--mi-text-2);
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.detail-row {
  display: flex;
  gap: var(--mi-sp-2);
}
.detail-label {
  color: var(--mi-text-3);
  flex-shrink: 0;
}
.detail-val {
  word-break: break-all;
}
.path-val {
  font-family: var(--mi-code);
  font-size: var(--mi-fs-caption);
}
.env-empty-hint {
  font-size: var(--mi-fs-caption);
  color: var(--mi-text-3);
}

/* AI 助教配置样式 */
.ai-key-badge {
  font-size: var(--mi-fs-caption);
  padding: 2px var(--mi-sp-2);
  border-radius: 10px;
  font-weight: 500;
}
.ai-key-badge.is-configured {
  background: var(--mi-success-fill);
  color: var(--mi-success);
}
.ai-key-badge.is-empty {
  background: color-mix(in srgb, var(--mi-text-3) 15%, transparent);
  color: var(--mi-text-3);
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: var(--mi-sp-2);
}
.form-label {
  font-size: var(--mi-fs-body);
  font-weight: 500;
  color: var(--mi-text);
}
.preset-buttons {
  display: flex;
  gap: var(--mi-sp-2);
  flex-wrap: wrap;
}
.preset-chip {
  padding: var(--mi-sp-2) var(--mi-sp-4);
  border: 1px solid var(--mi-border);
  border-radius: var(--mi-radius-sm);
  background: var(--mi-bg);
  color: var(--mi-text-2);
  font-size: var(--mi-fs-label);
  cursor: pointer;
  transition: all var(--mi-dur) var(--mi-ease);
}
.preset-chip:hover {
  background: var(--mi-card);
  color: var(--mi-text);
}
.preset-chip.active {
  background: var(--mi-card);
  color: var(--mi-text);
  border-color: var(--mi-text);
  font-weight: 500;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--mi-sp-4);
}
.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--mi-sp-2);
}
.text-input,
.select-input {
  width: 100%;
  box-sizing: border-box;
  padding: var(--mi-sp-2) var(--mi-sp-3);
  border: 1px solid var(--mi-border);
  border-radius: var(--mi-radius-sm);
  background: var(--mi-bg);
  color: var(--mi-text);
  font-size: var(--mi-fs-body);
  transition: border-color var(--mi-dur);
}
.text-input:focus,
.select-input:focus {
  outline: none;
  border-color: var(--mi-text-2);
}
.key-input-row {
  display: flex;
  align-items: center;
  gap: var(--mi-sp-2);
}
.test-row {
  display: flex;
  align-items: center;
  gap: var(--mi-sp-4);
}
.test-result-msg {
  font-size: var(--mi-fs-label);
}
.test-result-msg.is-ok {
  color: var(--mi-success);
}
.test-result-msg.is-fail {
  color: var(--mi-error);
}
.seg-group {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  border-radius: var(--mi-radius-ctl);
  background: var(--mi-blue-light);
  border: 1px solid var(--mi-border);
}
.seg-btn {
  padding: 4px var(--mi-sp-3);
  border: 0;
  border-radius: var(--mi-radius-sm);
  background: transparent;
  color: var(--mi-text-2);
  font-family: var(--mi-font-family);
  font-size: var(--mi-fs-label);
  cursor: pointer;
  transition: background var(--mi-dur-fast) ease, color var(--mi-dur-fast) ease;
}
.seg-btn:hover {
  color: var(--mi-text);
}
.seg-btn.active {
  background: var(--mi-card);
  color: var(--mi-text);
  font-weight: 500;
  box-shadow: var(--mi-shadow);
}
.device-only-badge {
  font-size: var(--mi-fs-caption);
  color: var(--mi-text-3);
  padding: 2px var(--mi-sp-2);
  border-radius: var(--mi-radius-ctl);
  background: var(--mi-blue-light);
}
.voice-controls {
  display: flex;
  align-items: center;
  gap: var(--mi-sp-2);
}
.voice-select {
  min-width: 180px;
}
.narrator-info-banner {
  display: flex;
  align-items: center;
  gap: var(--mi-sp-2);
  margin-top: var(--mi-sp-3);
  padding: var(--mi-sp-2) var(--mi-sp-3);
  border-radius: var(--mi-radius-ctl);
  background: var(--mi-blue-light);
  color: var(--mi-text-2);
  font-size: var(--mi-fs-caption);
  line-height: 1.5;
}
.update-progress-row {
  display: flex;
  align-items: center;
  gap: var(--mi-sp-2);
  margin-top: var(--mi-sp-1);
}
.update-row-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.update-meter {
  height: 6px;
  width: 160px;
  border-radius: 3px;
  background: var(--mi-blue);
  overflow: hidden;
}
.update-meter i {
  display: block;
  height: 100%;
  background: var(--mi-blue-deep);
}
.update-status-ok {
  font-size: var(--mi-fs-caption);
  color: var(--mi-success-deep);
}
.update-status-err {
  font-size: var(--mi-fs-caption);
  color: var(--mi-error-deep);
}
.update-actions {
  display: flex;
  align-items: center;
  gap: var(--mi-sp-2);
  flex-shrink: 0;
}
.update-release-link {
  display: inline-flex;
  align-items: center;
  height: var(--mi-ctl-sm);
  padding: 0 var(--mi-sp-3);
  border-radius: var(--mi-radius-sm);
  font-size: var(--mi-fs-caption);
  color: var(--mi-blue-ink);
  text-decoration: none;
  white-space: nowrap;
}
.update-release-link:hover {
  background: var(--mi-blue-light);
}
</style>
