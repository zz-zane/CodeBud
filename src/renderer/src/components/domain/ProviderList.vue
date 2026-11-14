<script setup lang="ts">
/**
 * Provider 列表（docs/30 §1.2）：设置 → AI 助教 与 学习空间「模型」页签共用的同一个组件。
 * 内置 API 一行 + 固定的 Antigravity 一行（开关 = 检测 → 建连接 → 连接）+ 其他 ACP 连接；
 * 单选圆点 = 设为当前 Provider；添加 / 编辑 / 删除 / 连接 / 断开 / 登录都在这里。
 */
import { computed, onMounted, ref } from 'vue'
import { useStudyStore, type StudyConnection } from '../../stores/study'
import { useSettingsStore } from '../../stores/settings'
import { STUDY_COPY } from '../../lib/study-copy'
import { buildProviderList, findAntigravity, type ProviderItem, type ProviderStatus } from '../../../../shared/provider-list'
import MiIcon from '../base/MiIcon.vue'
import MiButton from '../base/MiButton.vue'
import MiHint from '../base/MiHint.vue'
import MiSwitch from '../base/MiSwitch.vue'
import { toast } from '../base/toast'

const study = useStudyStore()
const settings = useSettingsStore()
const P = STUDY_COPY.PROVIDER
const C = STUDY_COPY.CONNECTIONS

const error = ref<string | null>(null)
const working = ref(false)
const manualPath = ref('')
const agyMissing = ref(false)
const confirmDelete = ref<string | null>(null)

onMounted(() => { if (!study.isInitialized) void study.loadSnapshot() })

const list = computed(() => buildProviderList({ connections: study.connections, activeConnectionId: study.activeConnectionId, builtinLabel: P.BUILTIN, builtinReady: settings.config.ai.hasKey })
  .map(item => ({ ...item, status: item.id && study.busyConnections[item.id] ? 'connecting' as ProviderStatus : item.status })))
const builtin = computed(() => list.value[0])
const agy = computed(() => findAntigravity(study.connections))
const agyItem = computed(() => list.value.find(item => item.id !== null && item.id === agy.value?.id))
const others = computed(() => list.value.filter(item => item.id !== null && item.id !== agy.value?.id))
const connectionOf = (item: ProviderItem): StudyConnection | undefined => study.connections.find(c => c.id === item.id)

const STATUS_TEXT: Record<ProviderStatus, string> = { ready: P.STATUS_READY, connecting: P.STATUS_CONNECTING, error: P.STATUS_ERROR, disconnected: P.STATUS_OFF }
const agyOn = computed(() => !!agyItem.value && (agyItem.value.status === 'ready' || agyItem.value.status === 'connecting'))

function fail(reason: string): void { error.value = reason }

async function toggleAgy(on: boolean): Promise<void> {
  error.value = null
  agyMissing.value = false
  const res = await study.setAntigravityEnabled(on, manualPath.value)
  if (!res.ok) {
    if (res.error === P.AGY_MISSING) agyMissing.value = true
    else fail(res.error)
  }
}

/** 切换失败后单选框要退回原样：浏览器已经把组里原来那颗取消了，换 key 让它们按状态重画 */
const radioKey = ref(0)
async function select(item: ProviderItem): Promise<void> {
  error.value = null
  const res = await study.switchProvider(item.id)
  if (!res.ok) { radioKey.value++; toast(P.SWITCH_FAILED(res.error), 'error'); fail(res.error) }
}

async function run(action: () => Promise<{ ok: boolean; error?: string }>): Promise<void> {
  working.value = true
  error.value = null
  const res = await action()
  working.value = false
  if (!res.ok && res.error) fail(res.error)
}
const connectRow = (item: ProviderItem): Promise<void> => run(() => study.connectProvider(item.id!))
const disconnectRow = (item: ProviderItem): Promise<void> => run(() => study.disconnect(item.id!))
const authRow = (item: ProviderItem, methodId: string): Promise<void> => run(() => study.authenticate(item.id!, methodId))
async function removeRow(item: ProviderItem): Promise<void> {
  if (confirmDelete.value !== item.id) { confirmDelete.value = item.id; return }
  confirmDelete.value = null
  await run(() => study.removeConnection(item.id!))
}

// ── 添加 / 编辑表单 ──
const formOpen = ref(false)
const editingId = ref<string | null>(null)
const kind = ref<StudyConnection['kind']>('claude')
const label = ref('')
const command = ref('')
const args = ref('[]')
const model = ref('')
const formModels = ref<Array<{ id: string; name: string }>>([])
const agyStatus = ref<'idle' | 'detecting' | 'found' | 'missing'>('idle')
const modelListFailed = ref(false)

async function detectForForm(): Promise<void> {
  agyStatus.value = 'detecting'
  modelListFailed.value = false
  formModels.value = []
  const found = await study.detectAgent()
  if (kind.value !== 'antigravity') return
  if (!found.ok || !found.data) { agyStatus.value = 'missing'; return }
  command.value = found.data
  agyStatus.value = 'found'
  await loadFormModels(found.data)
}
async function loadFormModels(path: string): Promise<void> {
  const res = await study.listModels(path)
  if (kind.value !== 'antigravity') return
  if (res.ok) formModels.value = res.data
  else modelListFailed.value = true
}
function onKindChange(): void {
  const names = { claude: C.KIND_CLAUDE, codex: C.KIND_CODEX, antigravity: C.KIND_ANTIGRAVITY, custom: C.KIND_CUSTOM }
  label.value = names[kind.value]
  command.value = ''
  args.value = kind.value === 'antigravity' ? '["acp"]' : '[]'
  model.value = ''
  agyStatus.value = 'idle'
  formModels.value = []
  if (kind.value === 'antigravity') void detectForForm()
}
function startAdd(): void {
  editingId.value = null
  kind.value = 'claude'
  formOpen.value = true
  onKindChange()
}
function startEdit(item: ProviderItem): void {
  const c = connectionOf(item)
  if (!c) return
  editingId.value = c.id
  kind.value = c.kind
  label.value = c.label
  command.value = c.command
  args.value = JSON.stringify(c.args)
  model.value = c.model ?? ''
  agyStatus.value = 'idle'
  formModels.value = []
  modelListFailed.value = false
  formOpen.value = true
  error.value = null
  if (c.kind === 'antigravity' && c.command) void loadFormModels(c.command)
}
async function submit(): Promise<void> {
  if (!label.value.trim() || !command.value.trim()) { fail(C.FILL_REQUIRED); return }
  let argList: string[]
  try {
    const parsed: unknown = JSON.parse(args.value || '[]')
    if (!Array.isArray(parsed) || !parsed.every(a => typeof a === 'string')) throw new Error()
    argList = parsed
  } catch { fail(C.ARGS_INVALID); return }
  working.value = true
  error.value = null
  const res = await study.saveConnection({ ...(editingId.value ? { id: editingId.value } : {}), kind: kind.value, label: label.value.trim(), command: command.value.trim(), args: argList, ...(model.value.trim() ? { model: model.value.trim() } : {}) })
  working.value = false
  if (!res.ok) { fail(res.error); return }
  formOpen.value = false
  if (kind.value === 'antigravity' && !editingId.value) await run(() => study.connectProvider(res.data.id))
}
</script>

<template>
  <div class="pl">
    <div v-if="error" class="pl-alert" role="alert">
      <span>{{ error }}</span>
      <button type="button" class="pl-icon-btn" :title="STUDY_COPY.COMMON.CLOSE" :aria-label="STUDY_COPY.COMMON.CLOSE" @click="error = null"><MiIcon name="x" :size="16" /></button>
    </div>

    <ul :key="radioKey" class="pl-rows" role="radiogroup" :aria-label="P.TITLE">
      <!-- 内置 API -->
      <li class="pl-row" :class="{ current: builtin.current }">
        <input type="radio" name="provider-current" class="pl-radio" :checked="builtin.current" :aria-label="`${P.USE}：${builtin.label}`" :title="P.USE" @change="select(builtin)" />
        <div class="pl-main">
          <span class="pl-name">{{ builtin.label }}</span>
          <span class="pl-desc">{{ settings.config.ai.model.trim() || P.BUILTIN_UNSET }}</span>
        </div>
        <span v-if="builtin.current" class="pl-badge">{{ P.IN_USE }}</span>
      </li>

      <!-- Antigravity（固定一行） -->
      <li class="pl-row" :class="{ current: agyItem?.current }">
        <input type="radio" name="provider-current" class="pl-radio" :checked="!!agyItem?.current" :disabled="!agyItem || !agyItem.selectable" :aria-label="`${P.USE}：${P.AGY_NAME}`" :title="P.USE" @change="agyItem && select(agyItem)" />
        <div class="pl-main">
          <span class="pl-name">{{ P.AGY_NAME }}</span>
        </div>
        <span v-if="agyItem?.current" class="pl-badge">{{ P.IN_USE }}</span>
        <span class="pl-dot" :class="agyItem?.status ?? 'disconnected'" role="img" :title="agyItem?.error || STATUS_TEXT[agyItem?.status ?? 'disconnected']" :aria-label="STATUS_TEXT[agyItem?.status ?? 'disconnected']" />
        <template v-if="agyItem">
          <button type="button" class="pl-icon-btn" :title="P.EDIT" :aria-label="P.EDIT" @click="startEdit(agyItem)"><MiIcon name="pencil" :size="16" /></button>
          <button type="button" class="pl-icon-btn" :class="{ danger: confirmDelete === agyItem.id }" :title="confirmDelete === agyItem.id ? P.DELETE_CONFIRM : P.DELETE" :aria-label="confirmDelete === agyItem.id ? P.DELETE_CONFIRM : P.DELETE" @click="removeRow(agyItem)" @blur="confirmDelete = null"><MiIcon name="trash" :size="16" /></button>
        </template>
        <MiSwitch :model-value="agyOn" :aria-label="P.AGY_SWITCH" :disabled="agyItem?.status === 'connecting'" @update:model-value="toggleAgy" />
      </li>
      <li v-if="agyItem?.error && agyItem.status === 'error'" class="pl-sub pl-error" role="status">{{ agyItem.error }}</li>
      <li v-if="agyMissing" class="pl-sub pl-missing" role="status">
        <span>{{ P.AGY_MISSING }}</span>
        <span class="pl-path">
          <input v-model="manualPath" type="text" class="pl-input" :placeholder="P.AGY_PATH_PLACEHOLDER" :aria-label="P.AGY_PATH_PLACEHOLDER" @keydown.enter="toggleAgy(true)" />
          <MiButton variant="secondary" size="sm" :disabled="!manualPath.trim()" @click="toggleAgy(true)">{{ P.AGY_PATH_APPLY }}</MiButton>
        </span>
      </li>

      <!-- 其他 ACP 连接 -->
      <template v-for="item in others" :key="item.id ?? 'builtin'">
        <li class="pl-row" :class="{ current: item.current }">
          <input type="radio" name="provider-current" class="pl-radio" :checked="item.current" :disabled="!item.selectable" :aria-label="`${P.USE}：${item.label}`" :title="P.USE" @change="select(item)" />
          <div class="pl-main">
            <span class="pl-name">{{ item.label }}</span>
            <code class="pl-desc" :title="`${connectionOf(item)?.command} ${connectionOf(item)?.args.join(' ')}`">{{ connectionOf(item)?.command }} {{ connectionOf(item)?.args.join(' ') }}</code>
          </div>
          <span v-if="item.current" class="pl-badge">{{ P.IN_USE }}</span>
          <span class="pl-dot" :class="item.status" role="img" :title="item.error || STATUS_TEXT[item.status]" :aria-label="STATUS_TEXT[item.status]" />
          <MiButton v-if="item.status === 'disconnected' || item.status === 'error'" variant="secondary" size="sm" icon="plug" :disabled="working" @click="connectRow(item)">{{ C.CONNECT_BTN }}</MiButton>
          <MiButton v-else variant="secondary" size="sm" :disabled="working || item.status === 'connecting'" @click="disconnectRow(item)">{{ C.DISCONNECT_BTN }}</MiButton>
          <button type="button" class="pl-icon-btn" :title="P.EDIT" :aria-label="P.EDIT" @click="startEdit(item)"><MiIcon name="pencil" :size="16" /></button>
          <button type="button" class="pl-icon-btn" :class="{ danger: confirmDelete === item.id }" :title="confirmDelete === item.id ? P.DELETE_CONFIRM : P.DELETE" :aria-label="confirmDelete === item.id ? P.DELETE_CONFIRM : P.DELETE" @click="removeRow(item)" @blur="confirmDelete = null"><MiIcon name="trash" :size="16" /></button>
        </li>
        <li v-if="item.error && item.status === 'error'" class="pl-sub pl-error" role="status">{{ item.error }}</li>
        <li v-if="connectionOf(item)?.authMethods?.length" class="pl-sub pl-auth">
          <span>{{ C.AUTH_REQUIRED_PREFIX }}</span>
          <MiButton v-for="m in connectionOf(item)!.authMethods" :key="m.id" variant="secondary" size="sm" icon="external" :disabled="working" @click="authRow(item, m.id)">{{ m.name }}</MiButton>
        </li>
      </template>
    </ul>

    <div v-if="formOpen" class="pl-form">
      <div class="pl-grid">
        <label class="pl-field"><span>{{ C.KIND_LABEL }}</span>
          <select v-model="kind" class="pl-input" :disabled="!!editingId" @change="onKindChange">
            <option value="claude">{{ C.KIND_CLAUDE }}</option>
            <option value="codex">{{ C.KIND_CODEX }}</option>
            <option value="antigravity">{{ C.KIND_ANTIGRAVITY }}</option>
            <option value="custom">{{ C.KIND_CUSTOM }}</option>
          </select>
        </label>
        <label class="pl-field"><span>{{ C.LABEL_LABEL }}</span><input v-model="label" type="text" class="pl-input" :placeholder="C.LABEL_PLACEHOLDER" /></label>
        <label class="pl-field"><span>{{ C.COMMAND_LABEL }}</span><input v-model="command" type="text" class="pl-input" :placeholder="C.COMMAND_PLACEHOLDER" /></label>
        <label class="pl-field"><span>{{ C.ARGS_LABEL }}</span><input v-model="args" type="text" class="pl-input" :placeholder="C.ARGS_PLACEHOLDER" /></label>
      </div>
      <label v-if="kind === 'antigravity'" class="pl-field"><span>{{ C.MODEL_LABEL }}</span>
        <input v-model="model" type="text" list="pl-model-list" class="pl-input" :placeholder="C.MODEL_PLACEHOLDER" />
        <datalist id="pl-model-list"><option v-for="m in formModels" :key="m.id" :value="m.id">{{ m.name }}</option></datalist>
      </label>
      <p v-if="kind === 'antigravity'" class="pl-note" :class="{ warn: agyStatus === 'missing' }" role="status">
        {{ agyStatus === 'detecting' ? C.AGY_DETECTING : agyStatus === 'found' ? C.AGY_FOUND : agyStatus === 'missing' ? C.AGY_NOT_FOUND : '' }}
        <template v-if="modelListFailed"> {{ C.MODEL_LOAD_FAILED }}</template>
      </p>
      <MiHint class="pl-info" :text="kind === 'antigravity' ? C.AGY_NOTE : C.UNSUPPORTED_NOTICE" />
      <div class="pl-actions">
        <MiButton variant="secondary" size="sm" :disabled="working" @click="formOpen = false">{{ STUDY_COPY.COMMON.CANCEL }}</MiButton>
        <MiButton variant="primary" size="sm" icon="check" :disabled="working" @click="submit">{{ kind === 'antigravity' && !editingId ? C.SAVE_AND_CONNECT : STUDY_COPY.COMMON.SAVE }}</MiButton>
      </div>
    </div>
    <div v-else class="pl-add">
      <button type="button" class="pl-icon-btn pl-add-btn" :title="P.ADD" :aria-label="P.ADD" @click="startAdd"><MiIcon name="plus" :size="16" /></button>
    </div>
  </div>
</template>

<style scoped>
.pl { display: flex; flex-direction: column; gap: var(--mi-sp-3); min-width: 0; }
.pl-alert { display: flex; align-items: center; justify-content: space-between; gap: var(--mi-sp-2); padding: var(--mi-sp-2) var(--mi-sp-3); border: 1px solid var(--mi-error-deep); border-radius: 6px; color: var(--mi-error-deep); font-size: var(--mi-fs-label); }
.pl-rows { margin: 0; padding: 0; list-style: none; border: 1px solid var(--mi-border); border-radius: 10px; background: var(--mi-card); overflow: hidden; }
.pl-row { display: flex; align-items: center; gap: var(--mi-sp-3); min-height: 44px; padding: var(--mi-sp-2) var(--mi-sp-3); box-sizing: border-box; }
.pl-row + .pl-row, .pl-sub { border-top: 1px solid var(--mi-border); }
.pl-sub + .pl-row { border-top: 1px solid var(--mi-border); }
.pl-radio { margin: 0; width: 16px; height: 16px; flex: 0 0 auto; accent-color: var(--mi-blue-deep); cursor: pointer; }
.pl-radio:disabled { cursor: default; }
.pl-main { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.pl-name { font-size: var(--mi-fs-body); font-weight: 500; color: var(--mi-text); }
.pl-desc { font-size: var(--mi-fs-caption); color: var(--mi-text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; background: transparent; padding: 0; }
.pl-badge { flex: 0 0 auto; font-size: var(--mi-fs-caption); color: var(--mi-blue-deep); }
.pl-dot { width: 8px; height: 8px; flex: 0 0 auto; border-radius: 50%; background: var(--mi-text-3); }
.pl-dot.ready { background: var(--mi-success-deep); }
.pl-dot.connecting { background: var(--mi-warn-deep); }
.pl-dot.error { background: var(--mi-error-deep); }
.pl-sub { display: flex; align-items: center; flex-wrap: wrap; gap: var(--mi-sp-2); padding: var(--mi-sp-2) var(--mi-sp-3) var(--mi-sp-2) 40px; font-size: var(--mi-fs-caption); color: var(--mi-text-2); }
.pl-error { color: var(--mi-error-deep); word-break: break-word; }
.pl-missing { flex-direction: column; align-items: flex-start; }
.pl-path { display: flex; gap: var(--mi-sp-2); align-items: center; width: 100%; }
.pl-icon-btn { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 6px; background: transparent; color: var(--mi-text-2); cursor: pointer; }
.pl-icon-btn:hover { background: var(--cds-fill-ghost-hover); color: var(--mi-text); }
.pl-icon-btn.danger { color: var(--mi-error-deep); }
.pl-icon-btn:focus-visible, .pl-radio:focus-visible { outline: 2px solid var(--mi-text); outline-offset: 2px; }
.pl-add { display: flex; justify-content: flex-end; }
.pl-add-btn { border: 1px solid var(--mi-border-control); }
.pl-form { display: flex; flex-direction: column; gap: var(--mi-sp-3); padding-top: var(--mi-sp-3); border-top: 1px solid var(--mi-border); }
.pl-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--mi-sp-3); }
.pl-field { display: flex; flex-direction: column; gap: var(--mi-sp-2); font-size: var(--mi-fs-label); color: var(--mi-text-2); }
.pl-input { box-sizing: border-box; flex: 1; min-width: 0; height: 32px; padding: 0 var(--mi-sp-3); border: 1px solid var(--mi-border-control); border-radius: 6px; background: var(--mi-bg); color: var(--mi-text); font: var(--mi-fs-label) var(--mi-font-family); outline: none; }
.pl-input:focus { border-color: var(--mi-blue-deep); }
.pl-note { margin: 0; font-size: var(--mi-fs-caption); line-height: 1.5; color: var(--mi-text-3); }
.pl-note.warn { color: var(--mi-error-deep); }
.pl-actions { display: flex; justify-content: flex-end; gap: var(--mi-sp-2); }
</style>
