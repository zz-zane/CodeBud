<script setup lang="ts">
/**
 * 聊天框底栏的 Provider 选择器 + 随 Provider 变化的选项（docs/30 §1.3）。
 * 内置 API：模型名（点开去设置）+ 模型支持时的思考程度；Antigravity：模型族 + 强度；其他 ACP：无选项。
 * 手机端（isRemote）全部是只读标签；生成中全部禁用。
 */
import { computed, watch } from 'vue'
import { useStudyStore } from '../../stores/study'
import { useSettingsStore } from '../../stores/settings'
import { useSettingsDialogStore } from '../../stores/settings-dialog'
import { useAiAssistantStore } from '../../stores/ai-assistant'
import { toast } from '../base/toast'
import MiPopMenu, { type PopMenuItem } from '../base/MiPopMenu.vue'
import { STUDY_COPY } from '../../lib/study-copy'
import { isRemote } from '../../lib/asset-base'
import { REASONING_EFFORT_LABELS, REASONING_EFFORT_ORDER, showEffortForModel } from '../../lib/composer-types'
import { buildProviderList, composerOptionSet, currentProvider, providerChipMode } from '../../../../shared/provider-list'
import { currentAgySelection, groupAgyModels, joinAgyModelId, pickAgyModelId, strengthsOf, type AgyStrength } from '../../../../shared/agy-models'
import type { ReasoningEffort } from '../../../../shared/types'

const study = useStudyStore()
const settings = useSettingsStore()
const settingsDialog = useSettingsDialogStore()
const ai = useAiAssistantStore()
const P = STUDY_COPY.PROVIDER
const remote = isRemote()
const MANAGE = '__manage'

const providers = computed(() => buildProviderList({ connections: study.connections, activeConnectionId: study.activeConnectionId, builtinLabel: P.BUILTIN, builtinReady: settings.config.ai.hasKey })
  .map(item => ({ ...item, status: item.id && study.busyConnections[item.id] ? 'connecting' as const : item.status })))
const current = computed(() => currentProvider(providers.value))
const mode = computed(() => providerChipMode({ isRemote: remote, providerCount: providers.value.length }))
const optionSet = computed(() => composerOptionSet(current.value))
const connection = computed(() => study.connections.find(c => c.id === current.value.id))
const locked = computed(() => ai.isStreaming)

const providerItems = computed<PopMenuItem[]>(() => [
  ...providers.value.map(p => ({ key: p.id ?? '', label: p.label, checked: p.current, status: p.status, disabled: !p.selectable })),
  { key: MANAGE, label: P.MANAGE }
])

async function onProvider(key: string): Promise<void> {
  if (key === MANAGE) { settingsDialog.openSettings('ai'); return }
  const res = await study.switchProvider(key === '' ? null : key)
  if (!res.ok) toast(P.SWITCH_FAILED(res.error), 'error')
}

// ── 内置 API ──
const builtinModel = computed(() => settings.config.ai.model.trim() || P.BUILTIN_UNSET)
const showEffort = computed(() => optionSet.value === 'builtin' && showEffortForModel(settings.config.ai.model))
const effortItems = computed<PopMenuItem[]>(() => REASONING_EFFORT_ORDER.map(level => ({ key: level, label: REASONING_EFFORT_LABELS[level].label, checked: ai.reasoningEffort === level })))
const effortText = computed(() => `${P.EFFORT} ${REASONING_EFFORT_LABELS[ai.reasoningEffort].label}`)

// ── Antigravity：模型族 + 强度 ──
watch(() => [optionSet.value, connection.value?.id] as const, ([set, id]) => { if (!remote && set === 'antigravity' && id) void study.ensureModels(id) }, { immediate: true })
const models = computed(() => (connection.value ? study.modelsByConnection[connection.value.id] : undefined) ?? [])
const selection = computed(() => currentAgySelection(models.value, connection.value?.model))
const families = computed(() => groupAgyModels(models.value))
const modelText = computed(() => selection.value.family?.name ?? connection.value?.model ?? P.MODEL_DEFAULT)
const modelItems = computed<PopMenuItem[]>(() => families.value.map(f => ({ key: f.family, label: f.name, checked: f.family === selection.value.family?.family })))
const strengths = computed(() => strengthsOf(selection.value.family))
const STRENGTH_TEXT: Record<AgyStrength, string> = { low: P.STRENGTH_LOW, medium: P.STRENGTH_MEDIUM, high: P.STRENGTH_HIGH }
const strengthItems = computed<PopMenuItem[]>(() => strengths.value.map(s => ({ key: s, label: STRENGTH_TEXT[s], checked: s === selection.value.strength })))
const strengthTitle = computed(() => `${P.STRENGTH}：${selection.value.strength ? STRENGTH_TEXT[selection.value.strength] : P.MODEL_DEFAULT}`)
const level = computed(() => (selection.value.strength ? AGY_LEVEL[selection.value.strength] : 0))
const AGY_LEVEL: Record<AgyStrength, number> = { low: 1, medium: 2, high: 3 }

async function applyModel(id: string): Promise<void> {
  if (!connection.value) return
  const res = await study.setConnectionModel(connection.value.id, id)
  if (!res.ok) toast(P.MODEL_FAILED(res.error), 'error')
}
function onFamily(key: string): void {
  const family = families.value.find(f => f.family === key)
  if (family) void applyModel(pickAgyModelId(family, selection.value.strength))
}
function onStrength(key: string): void {
  const family = selection.value.family
  if (family) void applyModel(family.variants[key as AgyStrength] ?? joinAgyModelId(family.family, key as AgyStrength))
}
</script>

<template>
  <div class="pbar">
    <!-- Provider 芯片 -->
    <MiPopMenu v-if="mode === 'menu'" :items="providerItems" :label="P.CHIP_SWITCH" :title="`${P.CHIP_LABEL}：${current.label}`" :disabled="locked" trigger-class="model-chip" @select="onProvider">
      <span v-if="current.id" class="pb-dot" :class="current.status" aria-hidden="true" />
      <span class="pm-label">{{ current.label }}</span>
    </MiPopMenu>
    <span v-else class="pb-static model-chip" :title="`${P.CHIP_LABEL}：${current.label}`">
      <span v-if="current.id" class="pb-dot" :class="current.status" aria-hidden="true" />
      <span class="pm-label">{{ current.label }}</span>
    </span>

    <!-- 内置 API -->
    <template v-if="optionSet === 'builtin'">
      <span v-if="remote" class="pb-static model-chip" :title="builtinModel"><span class="pm-label">{{ builtinModel }}</span></span>
      <button v-else type="button" class="pb-btn model-chip" :title="builtinModel" :aria-label="P.MODEL_OPEN_SETTINGS" :disabled="locked" @click="settingsDialog.openSettings('ai')"><span class="pm-label">{{ builtinModel }}</span></button>
      <MiPopMenu v-if="showEffort && !remote" :items="effortItems" :label="P.EFFORT" :title="effortText" :disabled="locked" trigger-class="model-chip" @select="(key: string) => (ai.reasoningEffort = key as ReasoningEffort)">
        <span class="pm-label">{{ effortText }}</span>
      </MiPopMenu>
    </template>

    <!-- Antigravity -->
    <template v-else-if="optionSet === 'antigravity'">
      <MiPopMenu v-if="!remote && modelItems.length" :items="modelItems" :label="P.MODEL" :title="`${P.MODEL}：${modelText}`" :disabled="locked" trigger-class="model-chip" @select="onFamily">
        <span class="pm-label">{{ modelText }}</span>
      </MiPopMenu>
      <span v-else class="pb-static model-chip" :title="modelText"><span class="pm-label">{{ modelText }}</span></span>
      <MiPopMenu v-if="!remote && strengthItems.length" :items="strengthItems" :label="strengthTitle" :disabled="locked" trigger-class="model-chip" icon @select="onStrength">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="14" width="4" height="6" rx="1" :class="{ off: level < 1 }" />
          <rect x="10" y="9" width="4" height="11" rx="1" :class="{ off: level < 2 }" />
          <rect x="16" y="4" width="4" height="16" rx="1" :class="{ off: level < 3 }" />
        </svg>
      </MiPopMenu>
    </template>
  </div>
</template>

<style scoped>
.pbar { display: flex; align-items: center; gap: 2px; min-width: 0; flex: 0 1 auto; }
.pb-static, .pb-btn { display: inline-flex; align-items: center; gap: var(--mi-sp-2); min-width: 0; max-width: 14em; padding: var(--mi-sp-1) var(--mi-sp-2); border: 0; border-radius: 6px; background: transparent; color: var(--mi-text-3); font: inherit; font-size: var(--mi-fs-label); line-height: 1; white-space: nowrap; }
.pb-btn { cursor: pointer; }
.pb-btn:hover:not(:disabled) { background: var(--cds-fill-ghost-hover); color: var(--mi-text); }
.pb-btn:disabled { cursor: default; }
.pb-btn:focus-visible { outline: 2px solid var(--mi-text); outline-offset: 2px; }
.pm-label { overflow: hidden; text-overflow: ellipsis; }
.pb-dot { width: 6px; height: 6px; flex: 0 0 auto; border-radius: 50%; background: var(--mi-text-3); }
.pb-dot.ready { background: var(--mi-success-deep); }
.pb-dot.connecting { background: var(--mi-warn-deep); }
.pb-dot.error { background: var(--mi-error-deep); }
svg rect { fill: currentColor; }
svg rect.off { fill: var(--mi-border-control); }
</style>
