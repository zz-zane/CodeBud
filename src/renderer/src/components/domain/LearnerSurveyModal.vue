<script setup lang="ts">
/**
 * 基础调研：第一次打开 app 时问学员已经学过什么、想怎么学，存成一条以「【学习背景】」开头的长期记忆。
 * 已有这条记忆时就地更新（saveMemory 带 id），不会越存越多。
 */
import { computed, ref, watch } from 'vue'
import { useStudyStore } from '../../stores/study'
import { STUDY_COPY } from '../../lib/study-copy'
import { toast } from '../base/toast'
import MiModal from '../base/MiModal.vue'
import MiButton from '../base/MiButton.vue'
import {
  isLearnerMemory, learnerMemoryText, LEARNER_KNOWN_OPTIONS, LEARNER_PACE_TEXT, LEARNER_STYLE_TEXT, LEARNER_ZERO,
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

async function save(): Promise<void> {
  saving.value = true
  error.value = null
  const text = learnerMemoryText({ known: known.value, style: style.value, pace: pace.value, goal: goal.value })
  const res = await study.saveMemory({ id: existing.value?.id, text, source: L.TITLE })
  saving.value = false
  if (!res.ok) { error.value = res.error; return }
  toast(L.SAVED, 'success')
  close(true)
}

const styles = Object.entries(LEARNER_STYLE_TEXT) as Array<[LearnerStyle, string]>
const paces = Object.entries(LEARNER_PACE_TEXT) as Array<[LearnerPace, string]>
</script>

<template>
  <MiModal :visible="visible" :title="L.TITLE" :width="560" @update:visible="(v) => { if (!v) close(false) }">
    <div class="ls">
      <p class="ls-intro">{{ L.INTRO }}</p>

      <fieldset class="ls-q">
        <legend>{{ L.Q_KNOWN }}</legend>
        <div class="ls-chips">
          <button
            v-for="o in LEARNER_KNOWN_OPTIONS"
            :key="o"
            type="button"
            class="ls-chip"
            :class="{ on: known.includes(o) }"
            :aria-pressed="known.includes(o)"
            @click="toggleKnown(o)"
          >{{ o }}</button>
        </div>
      </fieldset>

      <fieldset class="ls-q">
        <legend>{{ L.Q_STYLE }}</legend>
        <div class="ls-chips">
          <label v-for="[k, label] in styles" :key="k" class="ls-chip" :class="{ on: style === k }">
            <input v-model="style" type="radio" name="ls-style" :value="k" class="ls-radio" />{{ label }}
          </label>
        </div>
      </fieldset>

      <fieldset class="ls-q">
        <legend>{{ L.Q_PACE }}</legend>
        <div class="ls-chips">
          <label v-for="[k, label] in paces" :key="k" class="ls-chip" :class="{ on: pace === k }">
            <input v-model="pace" type="radio" name="ls-pace" :value="k" class="ls-radio" />{{ label }}
          </label>
        </div>
      </fieldset>

      <label class="ls-q">
        <span class="ls-legend">{{ L.Q_GOAL }}</span>
        <input v-model="goal" class="mi-input" maxlength="60" :placeholder="L.GOAL_PLACEHOLDER" />
      </label>

      <p v-if="error" class="ls-error" role="alert">{{ error }}</p>
    </div>
    <template #footer>
      <MiButton variant="ghost" :disabled="saving" @click="close(false)">{{ L.SKIP }}</MiButton>
      <MiButton variant="primary" :disabled="saving || known.length === 0" @click="save">{{ L.SAVE }}</MiButton>
    </template>
  </MiModal>
</template>

<style scoped>
.ls { display: flex; flex-direction: column; gap: var(--mi-sp-4); }
.ls-intro { margin: 0; color: var(--mi-text-2); font-size: var(--mi-fs-label); line-height: 1.6; }
.ls-q { display: flex; flex-direction: column; gap: var(--mi-sp-2); margin: 0; padding: 0; border: 0; }
.ls-q legend, .ls-legend { padding: 0; margin-bottom: var(--mi-sp-1); font-size: var(--mi-fs-body); font-weight: 500; color: var(--mi-text); }
.ls-chips { display: flex; flex-wrap: wrap; gap: var(--mi-sp-2); }
.ls-chip {
  display: inline-flex; align-items: center; gap: var(--mi-sp-1);
  padding: 6px var(--mi-sp-3); border: 1px solid var(--mi-border); border-radius: 999px;
  background: var(--mi-card); color: var(--mi-text-2); font: inherit; font-size: var(--mi-fs-label);
  cursor: pointer; user-select: none;
  transition: background-color var(--mi-dur-fast) var(--mi-ease), border-color var(--mi-dur-fast) var(--mi-ease), color var(--mi-dur-fast) var(--mi-ease), transform var(--mi-dur-fast) var(--mi-ease-out);
}
.ls-chip:hover { border-color: var(--mi-border-control); color: var(--mi-text); }
.ls-chip:active { transform: scale(0.96); transition-duration: 60ms; }
.ls-chip.on { border-color: var(--mi-blue-deep); background: var(--mi-blue-light); color: var(--mi-blue-ink); }
.ls-chip:focus-within, .ls-chip:focus-visible { outline: 2px solid var(--mi-border-control); outline-offset: 1px; }
.ls-radio { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); }
.ls-error { margin: 0; color: var(--mi-error-deep); font-size: var(--mi-fs-label); }
</style>
