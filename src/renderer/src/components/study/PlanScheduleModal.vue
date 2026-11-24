<script setup lang="ts">
/**
 * 任务组「排到每天」：选开始 / 目标日期、每周学习日、加到「今天」的方式，
 * 把未完成步骤按顺序平均摊到学习日上，先预览（可逐条改日期）再保存。存在 today-todos.json 的 schedules 里。
 */
import { computed, ref, watch } from 'vue'
import { useTodayTodosStore } from '../../stores/today-todos'
import { TODO_COPY as T } from '../../lib/copy'
import { today } from '../../lib/day-clock'
import { shiftDateKey, parseDateKey } from '../../../../shared/dates'
import { distribute, PLAN_MODES, studyDays, type PlanMode } from '../../../../shared/today-todo'
import type { StudyPlan } from '../../../../shared/study-companion'
import { toast } from '../base/toast'
import MiModal from '../base/MiModal.vue'
import MiButton from '../base/MiButton.vue'

const props = defineProps<{ plan: StudyPlan | null }>()
const emit = defineEmits<{ close: [] }>()
const todos = useTodayTodosStore()

const start = ref('')
const target = ref('')
const weekdays = ref<number[]>([])
const mode = ref<PlanMode>('suggest')
/** 用户在预览里手改过的日期 */
const overrides = ref<Record<string, string>>({})

const open = computed(() => props.plan !== null)
const existing = computed(() => (props.plan ? todos.scheduleOf(props.plan.id) : undefined))
const pending = computed(() => props.plan?.tasks.filter((t) => t.status !== 'done') ?? [])

watch(() => props.plan?.id, () => {
  const s = existing.value
  start.value = s?.start ?? today.value
  target.value = s?.target ?? shiftDateKey(today.value, 29) ?? today.value
  weekdays.value = s ? [...s.weekdays] : [0, 1, 2, 3, 4, 5, 6]
  mode.value = s?.mode ?? 'suggest'
  overrides.value = s ? { ...s.days } : {}
}, { immediate: true })
// 改了日期范围或学习日，之前手改的日期作废，重新平均分
watch([start, target, weekdays], (_n, o) => { if (o.every((x) => x !== undefined)) overrides.value = {} }, { deep: true })

const days = computed(() => (parseDateKey(start.value) && parseDateKey(target.value) ? studyDays(start.value, target.value, weekdays.value) : []))
const assigned = computed(() => ({ ...distribute(pending.value.map((t) => t.id), days.value), ...pickOverrides() }))
function pickOverrides(): Record<string, string> {
  const ids = new Set(pending.value.map((t) => t.id))
  return Object.fromEntries(Object.entries(overrides.value).filter(([k, v]) => ids.has(k) && parseDateKey(v)))
}

function toggleDay(d: number): void {
  weekdays.value = weekdays.value.includes(d) ? weekdays.value.filter((x) => x !== d) : [...weekdays.value, d].sort()
}
function setDay(taskId: string, v: string): void {
  if (parseDateKey(v)) overrides.value = { ...overrides.value, [taskId]: v }
}

const canSave = computed(() => !!props.plan && pending.value.length > 0 && days.value.length > 0)
async function save(): Promise<void> {
  if (!props.plan || !canSave.value) return
  await todos.setSchedule({ planId: props.plan.id, start: start.value, target: target.value, weekdays: [...weekdays.value], mode: mode.value, days: { ...assigned.value } })
  toast(T.SCHED_SAVED, 'success')
  emit('close')
}
async function unschedule(): Promise<void> {
  const s = existing.value
  if (s) await todos.setSchedule({ ...s, mode: 'off' })
  emit('close')
}
</script>

<template>
  <MiModal :visible="open" :title="plan ? T.schedTitle(plan.title) : ''" :width="620" @update:visible="(v) => { if (!v) emit('close') }">
    <div v-if="plan" class="ps">
      <p v-if="pending.length === 0" class="ps-note">{{ T.SCHED_ALL_DONE }}</p>
      <template v-else>
        <div class="ps-dates">
          <label class="ps-field"><span>{{ T.SCHED_START }}</span><input v-model="start" type="date" class="ps-date" /></label>
          <label class="ps-field"><span>{{ T.SCHED_TARGET }}</span><input v-model="target" type="date" class="ps-date" :min="start" /></label>
        </div>

        <fieldset class="ps-q">
          <legend>{{ T.SCHED_WEEKDAYS }}</legend>
          <div class="ps-week">
            <button
              v-for="d in [1, 2, 3, 4, 5, 6, 0]"
              :key="d"
              type="button"
              class="ps-wd"
              :class="{ on: weekdays.includes(d) }"
              :aria-pressed="weekdays.includes(d)"
              @click="toggleDay(d)"
            >{{ T.WEEKDAY_SHORT[d] }}</button>
          </div>
        </fieldset>

        <fieldset class="ps-q">
          <legend>{{ T.SCHED_MODE }}</legend>
          <div class="ps-modes">
            <label v-for="m in PLAN_MODES" :key="m" class="ps-mode" :class="{ on: mode === m }">
              <input v-model="mode" type="radio" name="ps-mode" :value="m" class="ps-radio" />
              <span class="ps-mode-title">{{ T.MODE[m] }}</span>
              <span class="ps-mode-hint">{{ T.MODE_HINT[m] }}</span>
            </label>
          </div>
        </fieldset>

        <div class="ps-q">
          <div class="ps-preview-head">
            <span class="ps-legend">{{ T.SCHED_PREVIEW }}</span>
            <span class="ps-meta">{{ days.length ? T.schedSummary(pending.length, days.length) : T.SCHED_NONE }}</span>
          </div>
          <ol v-if="days.length" class="ps-list">
            <li v-for="t in pending" :key="t.id" class="ps-item">
              <span class="ps-item-title">{{ t.title }}</span>
              <input type="date" class="ps-date sm" :value="assigned[t.id]" :aria-label="t.title" @change="setDay(t.id, ($event.target as HTMLInputElement).value)" />
            </li>
          </ol>
        </div>
      </template>
    </div>
    <template #footer>
      <MiButton v-if="existing && existing.mode !== 'off'" variant="ghost" class="ps-off" @click="unschedule">{{ T.SCHED_REMOVE }}</MiButton>
      <MiButton variant="ghost" @click="emit('close')">{{ T.SCHED_CANCEL }}</MiButton>
      <MiButton variant="primary" :disabled="!canSave" @click="save">{{ T.SCHED_SAVE }}</MiButton>
    </template>
  </MiModal>
</template>

<style scoped>
.ps { display: flex; flex-direction: column; gap: 18px; }
.ps-note { margin: 0; color: var(--mi-text-3); font-size: var(--mi-fs-label); }
.ps-dates { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--mi-sp-3); }
.ps-field { display: flex; flex-direction: column; gap: 4px; font-size: var(--mi-fs-label); color: var(--mi-text-2); }
.ps-date { box-sizing: border-box; height: 34px; padding: 0 var(--mi-sp-2); border: 1px solid var(--mi-border); border-radius: 8px; background: var(--mi-card); color: var(--mi-text); font: inherit; font-size: var(--mi-fs-body); }
.ps-date.sm { height: 28px; font-size: var(--mi-fs-label); }
.ps-date:focus-visible { outline: 2px solid var(--mi-blue-deep); outline-offset: 1px; }
.ps-q { display: flex; flex-direction: column; gap: var(--mi-sp-2); min-width: 0; margin: 0; padding: 0; border: 0; }
.ps-q legend, .ps-legend { padding: 0; margin-bottom: 4px; font-size: var(--mi-fs-body); font-weight: 500; color: var(--mi-text); }
.ps-week { display: flex; flex-wrap: wrap; gap: 6px; }
.ps-wd { width: 36px; height: 36px; border: 1px solid var(--mi-border); border-radius: 50%; background: var(--mi-card); color: var(--mi-text-2); font: inherit; font-size: var(--mi-fs-label); cursor: pointer; transition: background-color var(--mi-dur-fast) var(--mi-ease), border-color var(--mi-dur-fast) var(--mi-ease), color var(--mi-dur-fast) var(--mi-ease); }
.ps-wd.on { border-color: var(--mi-blue-deep); background: var(--mi-blue-deep); color: var(--mi-btn-primary-text); }
.ps-wd:focus-visible { outline: 2px solid var(--mi-border-control); outline-offset: 2px; }
.ps-modes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--mi-sp-2); }
.ps-mode { position: relative; display: flex; flex-direction: column; gap: 4px; padding: 10px var(--mi-sp-3); border: 1px solid var(--mi-border); border-radius: 10px; background: var(--mi-card); cursor: pointer; transition: border-color var(--mi-dur-fast) var(--mi-ease), background-color var(--mi-dur-fast) var(--mi-ease); }
.ps-mode:hover { border-color: var(--mi-border-control); }
.ps-mode.on { border-color: var(--mi-blue-deep); background: var(--mi-blue-light); box-shadow: inset 0 0 0 1px var(--mi-blue-deep); }
.ps-mode:has(.ps-radio:focus-visible) { outline: 2px solid var(--mi-border-control); outline-offset: 2px; }
.ps-mode-title { font-size: var(--mi-fs-label); font-weight: 500; color: var(--mi-text); }
.ps-mode.on .ps-mode-title { color: var(--mi-blue-ink); }
.ps-mode-hint { font-size: var(--mi-fs-caption); line-height: 1.5; color: var(--mi-text-3); }
.ps-radio { position: absolute; width: 1px; height: 1px; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); }
.ps-preview-head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--mi-sp-2); flex-wrap: wrap; }
.ps-meta { font-size: var(--mi-fs-caption); color: var(--mi-text-3); }
.ps-list { max-height: 240px; margin: 0; padding: 0 4px 0 0; overflow-y: auto; list-style: none; counter-reset: ps; }
.ps-item { display: flex; align-items: center; gap: var(--mi-sp-2); padding: 6px 0; border-bottom: 1px solid var(--mi-border); counter-increment: ps; }
.ps-item::before { content: counter(ps); width: 1.6em; flex-shrink: 0; color: var(--mi-text-3); font-size: var(--mi-fs-caption); font-variant-numeric: tabular-nums; }
.ps-item-title { flex: 1; min-width: 0; font-size: var(--mi-fs-label); overflow-wrap: anywhere; }
.ps-off { margin-right: auto; }
@media (max-width: 560px) {
  .ps-dates, .ps-modes { grid-template-columns: minmax(0, 1fr); }
}
</style>
