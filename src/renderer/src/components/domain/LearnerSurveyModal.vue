<script setup lang="ts">
/**
 * 基础调研：第一次打开 app 时问学员已经学过什么、想怎么学，存成一条以「【学习背景】」开头的长期记忆。
 * 已有这条记忆时就地更新（saveMemory 带 id），不会越存越多。
 * 2026-11-23 按 frontend-ui-polish 重排：单选 / 多选外观分开、已学过按组、讲解速度用分段滑块、底部预览要存的那一行。
 */
import { computed, ref, watch } from 'vue'
import { useStudyStore } from '../../stores/study'
import { STUDY_COPY } from '../../lib/study-copy'
import { toast } from '../base/toast'
import MiModal from '../base/MiModal.vue'
import MiButton from '../base/MiButton.vue'
import MiInput from '../base/MiInput.vue'
import MiIcon from '../base/MiIcon.vue'
import {
  isLearnerMemory, learnerMemoryText, LEARNER_KNOWN_GROUPS, LEARNER_MEMORY_PREFIX, LEARNER_PACE_TEXT, LEARNER_STYLE_TEXT, LEARNER_ZERO,
  type LearnerPace, type LearnerStyle
} from '../../../../shared/learner-profile'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ 'update:visible': [v: boolean]; done: [saved: boolean] }>()

const L = STUDY_COPY.LEARNER
const study = useStudyStore()

const known = ref<string[]>([])
const style = ref<LearnerStyle>('analogy-first')
const pace = ref<LearnerPace>('normal')
const goal = ref('')
const saving = ref(false)
const error = ref<string | null>(null)

const existing = computed(() => study.memories.find((m) => isLearnerMemory(m.text)) ?? null)

// 每次打开都从空白开始；「零基础」与其他选项互斥
watch(() => props.visible, (v) => { if (v) { error.value = null } })
function toggleKnown(option: string): void {
  if (option === LEARNER_ZERO) { known.value = known.value.includes(LEARNER_ZERO) ? [] : [LEARNER_ZERO]; return }
  const rest = known.value.filter((k) => k !== LEARNER_ZERO)
  known.value = rest.includes(option) ? rest.filter((k) => k !== option) : [...rest, option]
}

function close(saved: boolean): void {
  emit('update:visible', false)
  emit('done', saved)
}

const answers = computed(() => ({ known: known.value, style: style.value, pace: pace.value, goal: goal.value }))

async function save(): Promise<void> {
  saving.value = true
  error.value = null
  const res = await study.saveMemory({ id: existing.value?.id, text: learnerMemoryText(answers.value), source: L.TITLE })
  saving.value = false
  if (!res.ok) { error.value = res.error; return }
  toast(L.SAVED, 'success')
  close(true)
}

const styles = Object.entries(LEARNER_STYLE_TEXT) as Array<[LearnerStyle, string]>
const paces = Object.entries(LEARNER_PACE_TEXT) as Array<[LearnerPace, string]>
const paceIndex = computed(() => Math.max(0, paces.findIndex(([k]) => k === pace.value)))
// 底部预览：就是存进记忆的那一行，去掉固定前缀
const preview = computed(() => (known.value.length ? learnerMemoryText(answers.value).slice(LEARNER_MEMORY_PREFIX.length) : ''))
</script>

<template>
  <MiModal :visible="visible" :title="L.TITLE" :width="600" @update:visible="(v) => { if (!v) close(false) }">
    <div class="ls">
      <p class="ls-intro">{{ L.INTRO }}</p>

      <fieldset class="ls-q">
        <legend class="ls-legend">{{ L.Q_KNOWN }}<span class="ls-aside">{{ L.MULTI }}</span></legend>
        <div class="ls-chips">
          <button
            type="button"
            class="ls-chip"
            :class="{ on: known.includes(LEARNER_ZERO) }"
            :aria-pressed="known.includes(LEARNER_ZERO)"
            @click="toggleKnown(LEARNER_ZERO)"
          ><MiIcon v-if="known.includes(LEARNER_ZERO)" name="check" :size="14" />{{ LEARNER_ZERO }}</button>
        </div>
        <div v-for="g in LEARNER_KNOWN_GROUPS" :key="g.label" class="ls-group">
          <span class="ls-group-label">{{ g.label }}</span>
          <div class="ls-chips">
            <button
              v-for="o in g.items"
              :key="o"
              type="button"
              class="ls-chip"
              :class="{ on: known.includes(o) }"
              :aria-pressed="known.includes(o)"
              @click="toggleKnown(o)"
            ><MiIcon v-if="known.includes(o)" name="check" :size="14" />{{ o }}</button>
          </div>
        </div>
      </fieldset>

      <fieldset class="ls-q">
        <legend class="ls-legend">{{ L.Q_STYLE }}</legend>
        <div class="ls-cards">
          <label v-for="[k, label] in styles" :key="k" class="ls-card" :class="{ on: style === k }">
            <input v-model="style" type="radio" name="ls-style" :value="k" class="ls-radio" />
            <span class="ls-card-title">{{ label }}</span>
            <span class="ls-card-hint">{{ L.STYLE_HINT[k] }}</span>
          </label>
        </div>
      </fieldset>

      <fieldset class="ls-q ls-pace">
        <legend class="ls-legend">{{ L.Q_PACE }}</legend>
        <div class="ls-seg" :style="{ '--n': paces.length, '--i': paceIndex }">
          <span class="ls-seg-thumb" aria-hidden="true" />
          <label v-for="[k, label] in paces" :key="k" class="ls-seg-opt" :class="{ on: pace === k }">
            <input v-model="pace" type="radio" name="ls-pace" :value="k" class="ls-radio" />{{ label }}
          </label>
        </div>
      </fieldset>

      <label class="ls-q">
        <span class="ls-legend">{{ L.Q_GOAL }}<span class="ls-aside">{{ L.OPTIONAL }}</span></span>
        <MiInput v-model="goal" maxlength="60" :placeholder="L.GOAL_PLACEHOLDER" />
      </label>

      <div v-if="preview" class="ls-preview" aria-live="polite">
        <span class="ls-preview-label">{{ L.PREVIEW }}</span>
        <span class="ls-preview-text">{{ preview }}</span>
      </div>

      <p v-if="error" class="ls-error" role="alert">{{ error }}</p>
    </div>
    <template #footer>
      <span v-if="known.length === 0" class="ls-need">{{ L.NEED_KNOWN }}</span>
      <MiButton variant="ghost" :disabled="saving" @click="close(false)">{{ L.SKIP }}</MiButton>
      <MiButton variant="primary" :disabled="saving || known.length === 0" @click="save">{{ L.SAVE }}</MiButton>
    </template>
  </MiModal>
</template>

<style scoped>
.ls { display: flex; flex-direction: column; gap: 20px; }
.ls-intro { margin: 0; color: var(--mi-text-2); font-size: var(--mi-fs-label); line-height: 1.6; text-wrap: pretty; }
.ls-q { display: flex; flex-direction: column; gap: var(--mi-sp-2); min-width: 0; margin: 0; padding: 0; border: 0; }
.ls-legend { display: flex; align-items: baseline; gap: var(--mi-sp-2); padding: 0; margin-bottom: var(--mi-sp-1); font-size: var(--mi-fs-body); font-weight: 500; color: var(--mi-text); }
.ls-aside { color: var(--mi-text-3); font-size: var(--mi-fs-caption); font-weight: 400; }

/* 已学过：零基础单独一行，其余按组，组名对齐成一列 */
.ls-group { display: grid; grid-template-columns: 5.5em minmax(0, 1fr); align-items: start; gap: var(--mi-sp-2); }
.ls-group-label { padding-top: 6px; color: var(--mi-text-3); font-size: var(--mi-fs-caption); }
.ls-chips { display: flex; flex-wrap: wrap; gap: var(--mi-sp-2); }
.ls-chip {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 5px var(--mi-sp-3); border: 1px solid var(--mi-border); border-radius: 999px;
  background: var(--mi-card); color: var(--mi-text-2); font: inherit; font-size: var(--mi-fs-label);
  cursor: pointer; user-select: none;
  transition: background-color var(--mi-dur-fast) var(--mi-ease), border-color var(--mi-dur-fast) var(--mi-ease), color var(--mi-dur-fast) var(--mi-ease), transform 60ms var(--mi-ease-out);
}
.ls-chip:hover { border-color: var(--mi-border-control); color: var(--mi-text); }
.ls-chip:active { transform: scale(0.96); }
.ls-chip.on { padding-left: 9px; border-color: var(--mi-blue-deep); background: var(--mi-blue-light); color: var(--mi-blue-ink); }
.ls-chip:focus-visible { outline: 2px solid var(--mi-border-control); outline-offset: 2px; }

/* 学习方式：三张单选卡，每张一行说明实际会怎么讲 */
.ls-cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--mi-sp-2); }
.ls-card {
  position: relative; display: flex; flex-direction: column; gap: 4px;
  padding: 10px var(--mi-sp-3); border: 1px solid var(--mi-border); border-radius: 10px;
  background: var(--mi-card); cursor: pointer;
  transition: border-color var(--mi-dur-fast) var(--mi-ease), background-color var(--mi-dur-fast) var(--mi-ease), box-shadow var(--mi-dur-fast) var(--mi-ease);
}
.ls-card:hover { border-color: var(--mi-border-control); }
.ls-card.on { border-color: var(--mi-blue-deep); background: var(--mi-blue-light); box-shadow: inset 0 0 0 1px var(--mi-blue-deep); }
.ls-card:has(.ls-radio:focus-visible) { outline: 2px solid var(--mi-border-control); outline-offset: 2px; }
.ls-card-title { font-size: var(--mi-fs-label); font-weight: 500; color: var(--mi-text); }
.ls-card.on .ls-card-title { color: var(--mi-blue-ink); }
.ls-card-hint { font-size: var(--mi-fs-caption); line-height: 1.5; color: var(--mi-text-3); text-wrap: pretty; }

/* 讲解速度：等宽分段 + 滑块；滑块位置按选项数和下标算，上下左右 2px 等距 */
.ls-pace { flex-direction: row; flex-wrap: wrap; align-items: center; justify-content: space-between; }
.ls-pace .ls-legend { float: left; margin: 0; }
.ls-seg { position: relative; display: grid; grid-template-columns: repeat(var(--n), minmax(0, 1fr)); padding: 2px; border-radius: 999px; background: var(--mi-border); }
.ls-seg-thumb {
  position: absolute; top: 2px; bottom: 2px; left: 2px; width: calc((100% - 4px) / var(--n));
  border-radius: 999px; background: var(--mi-card); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
  transform: translateX(calc(100% * var(--i)));
  transition: transform var(--mi-dur-fast) cubic-bezier(.32, .72, 0, 1);
}
.ls-seg-opt { position: relative; min-width: 5.5em; padding: 4px var(--mi-sp-3); border-radius: 999px; text-align: center; font-size: var(--mi-fs-label); color: var(--mi-text-2); cursor: pointer; user-select: none; transition: color var(--mi-dur-fast) var(--mi-ease); }
.ls-seg-opt.on { color: var(--mi-text); font-weight: 500; }
.ls-seg-opt:has(.ls-radio:focus-visible) { outline: 2px solid var(--mi-border-control); outline-offset: 1px; }

/* 预览：存进记忆的那一行原文 */
.ls-preview { display: flex; flex-direction: column; gap: 2px; padding: var(--mi-sp-2) var(--mi-sp-3); border-left: 2px solid var(--mi-blue-deep); border-radius: 0 6px 6px 0; background: var(--mi-blue-light); }
.ls-preview-label { font-size: var(--mi-fs-caption); color: var(--mi-blue-ink); }
.ls-preview-text { font-size: var(--mi-fs-label); line-height: 1.6; color: var(--mi-text); overflow-wrap: anywhere; }

.ls-radio { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); }
.ls-error { margin: 0; color: var(--mi-error-deep); font-size: var(--mi-fs-label); }
.ls-need { margin-right: auto; color: var(--mi-text-3); font-size: var(--mi-fs-caption); }

@media (max-width: 560px) {
  .ls-cards { grid-template-columns: minmax(0, 1fr); }
  .ls-group { grid-template-columns: minmax(0, 1fr); gap: 4px; }
  .ls-group-label { padding-top: 0; }
}
</style>
