<script setup lang="ts">
/**
 * 设置的**内容区**（v1-lite 纯工程设置与环境检测）。
 * 2026-10-28：五类配置原样保留，但不再自带页标题与顶部 MiTabs ——
 * 分类选择交给 SettingsDialog.vue 的左栏，本组件只按 `card` 渲染对应一组设置。
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { useZoomStore } from '../stores/zoom'
import { useAiAssistantStore } from '../stores/ai-assistant'
import { SETTINGS } from '../lib/copy'
import { STUDY_COPY } from '../lib/study-copy'
import ProviderList from '../components/domain/ProviderList.vue'
import { sendsKeyInPlainText } from '../lib/api-url-safety'
import { LANG_LABEL } from '../lib/labels'
import type { LangOfCode, AiProtocol, AiProviderPreset } from '../../../shared/types'
import type { SettingsCard } from '../stores/settings-dialog'
import MiSwitch from '../components/base/MiSwitch.vue'
import MiButton from '../components/base/MiButton.vue'
import MiHint from '../components/base/MiHint.vue'

const props = defineProps<{ card: SettingsCard }>()

const settings = useSettingsStore()
const zoom = useZoomStore()
const aiStore = useAiAssistantStore()

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
</style>
