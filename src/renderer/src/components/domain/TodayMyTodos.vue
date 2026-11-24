<script setup lang="ts">
/**
 * 「今天」页「我的待办」：用户手写的待办 + 任务组排到今天的建议 + 之前没做完的。
 * 行操作：勾选完成（带来源的同步到任务组步骤）、点标题改名、上移 / 下移、改到明天、删除。
 */
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTodayTodosStore } from '../../stores/today-todos'
import { useStudyStore } from '../../stores/study'
import { TODO_COPY as T } from '../../lib/copy'
import { today } from '../../lib/day-clock'
import { relativeDayLabel } from '../../../../shared/today'
import type { TodoItem } from '../../../../shared/today-todo'
import MiIcon from '../base/MiIcon.vue'
import MiButton from '../base/MiButton.vue'

const todos = useTodayTodosStore()
const study = useStudyStore()
const router = useRouter()

const draft = ref('')
const editing = ref<string | null>(null)
const editText = ref('')
const editInput = ref<HTMLInputElement | null>(null)

onMounted(() => { if (!todos.loaded) void todos.load() })
// 自动加入：待办、任务组都载入后，以及跨零点换天时各跑一次
watch([() => todos.loaded, () => study.plans.length, today], ([ok]) => { if (ok) void todos.runAuto() }, { immediate: true })

const items = computed(() => {
  const list = todos.view.today
  return [...list.filter((i) => !todos.isDone(i)), ...list.filter((i) => todos.isDone(i))]
})
const doneCount = computed(() => todos.view.today.filter((i) => todos.isDone(i)).length)
const openCount = computed(() => items.value.length - doneCount.value)

async function submit(): Promise<void> {
  const t = draft.value.trim()
  if (!t) return
  draft.value = ''
  await todos.add(t)
}

async function startEdit(i: TodoItem): Promise<void> {
  editing.value = i.id
  editText.value = i.title
  await nextTick()
  editInput.value?.focus()
  editInput.value?.select()
}
async function finishEdit(i: TodoItem, save: boolean): Promise<void> {
  if (editing.value !== i.id) return
  editing.value = null
  if (save && editText.value.trim() && editText.value.trim() !== i.title) await todos.rename(i, editText.value)
}

function openPlan(planId: string): void {
  void router.push({ path: '/study', query: { tab: 'tasks', plan: planId } })
}
const dayLabel = (day: string): string => relativeDayLabel(day, today.value)
</script>

<template>
  <section class="mt" data-section="my-todos">
    <h2 class="mt-sec">
      {{ T.TITLE }}
      <span v-if="items.length">{{ T.doneCount(doneCount, items.length) }}</span>
    </h2>

    <form class="mt-add" @submit.prevent="submit">
      <MiIcon name="plus" :size="16" />
      <input v-model="draft" class="mt-add-input" maxlength="200" :placeholder="T.ADD_PLACEHOLDER" :aria-label="T.ADD_PLACEHOLDER" />
      <MiButton v-if="draft.trim()" size="sm" variant="primary" type="submit">{{ T.ADD }}</MiButton>
    </form>

    <ul v-if="items.length" class="mt-list">
      <li v-for="(i, n) in items" :key="i.id" class="pg-row mt-item" :class="{ done: todos.isDone(i) }" :data-todo="i.id">
        <label class="mt-check-wrap">
          <input type="checkbox" class="mt-check" :checked="todos.isDone(i)" :aria-label="T.DONE_LABEL(i.title)" @change="todos.toggle(i)" />
          <span class="mt-box" aria-hidden="true" />
        </label>
        <input
          v-if="editing === i.id"
          ref="editInput"
          v-model="editText"
          class="mt-edit"
          maxlength="200"
          :aria-label="T.RENAME"
          @keydown.enter.prevent="finishEdit(i, true)"
          @keydown.esc.prevent="finishEdit(i, false)"
          @blur="finishEdit(i, true)"
        />
        <button v-else type="button" class="mt-title" :title="T.RENAME" @click="startEdit(i)">{{ i.title }}</button>
        <button v-if="i.source" type="button" class="mt-chip" :title="T.OPEN_PLAN" @click="openPlan(i.source.planId)">{{ i.source.planTitle }}</button>
        <div class="pg-row-actions reveal">
          <template v-if="!todos.isDone(i)">
            <button type="button" class="icon-btn" :title="T.MOVE_UP" :aria-label="T.MOVE_UP" :disabled="n === 0" @click="todos.move(i, -1)"><MiIcon name="arrow-up" :size="14" /></button>
            <button type="button" class="icon-btn" :title="T.MOVE_DOWN" :aria-label="T.MOVE_DOWN" :disabled="n === openCount - 1" @click="todos.move(i, 1)"><MiIcon name="arrow-down" :size="14" /></button>
            <button type="button" class="icon-btn" :title="T.TOMORROW" :aria-label="T.TOMORROW" @click="todos.moveToTomorrow(i)"><MiIcon name="arrow-right" :size="14" /></button>
          </template>
          <button type="button" class="icon-btn danger" :title="T.DELETE" :aria-label="T.DELETE" @click="todos.remove(i)"><MiIcon name="trash" :size="14" /></button>
        </div>
      </li>
    </ul>
    <p v-else class="mt-empty">{{ T.EMPTY }}</p>

    <!-- 计划建议 -->
    <div v-if="todos.suggestions.length" class="mt-sub">
      <h3 class="mt-sub-title">{{ T.SUGGEST_TITLE }}</h3>
      <ul class="mt-list">
        <li v-for="s in todos.suggestions" :key="`${s.planId}:${s.taskId}`" class="pg-row mt-item mt-suggest">
          <MiIcon name="lightbulb" :size="16" class="mt-lead" />
          <span class="mt-title static">{{ s.taskTitle }}</span>
          <button type="button" class="mt-chip" :title="T.OPEN_PLAN" @click="openPlan(s.planId)">{{ s.planTitle }}</button>
          <span v-if="s.day < today" class="mt-day">{{ dayLabel(s.day) }}</span>
          <MiButton size="sm" variant="ghost" @click="todos.skip(s)">{{ T.SKIP }}</MiButton>
          <MiButton size="sm" icon="plus" @click="todos.accept(s)">{{ T.ACCEPT }}</MiButton>
        </li>
      </ul>
    </div>

    <!-- 之前没做完 -->
    <div v-if="todos.view.overdue.length" class="mt-sub">
      <h3 class="mt-sub-title">{{ T.OVERDUE_TITLE }}</h3>
      <ul class="mt-list">
        <li v-for="i in todos.view.overdue" :key="i.id" class="pg-row mt-item">
          <label class="mt-check-wrap">
            <input type="checkbox" class="mt-check" :checked="false" :aria-label="T.DONE_LABEL(i.title)" @change="todos.toggle(i)" />
            <span class="mt-box" aria-hidden="true" />
          </label>
          <span class="mt-title static">{{ i.title }}</span>
          <span class="mt-day">{{ dayLabel(i.day) }}</span>
          <MiButton size="sm" variant="ghost" @click="todos.remove(i)">{{ T.DELETE }}</MiButton>
          <MiButton size="sm" @click="todos.moveToToday(i)">{{ T.TO_TODAY }}</MiButton>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
/* 与「今天」页 .t-sec 同一套（那个是 TodayView 的 scoped 样式，这里吃不到） */
.mt-sec { display: flex; align-items: center; justify-content: space-between; margin: 0 0 var(--mi-sp-3); font-size: var(--mi-fs-section); font-weight: 500; line-height: var(--mi-lh-caption); color: var(--mi-text); }
.mt-sec span { font-size: var(--mi-fs-caption); font-weight: 400; color: var(--mi-text-3); font-variant-numeric: tabular-nums; }
.mt-add { display: flex; align-items: center; gap: var(--mi-sp-2); height: 44px; padding: 0 var(--mi-sp-2) 0 var(--mi-sp-3); border: 1px dashed var(--mi-border-control); border-radius: var(--mi-radius-input); color: var(--mi-text-3); transition: border-color var(--mi-dur-fast) var(--mi-ease); }
.mt-add:focus-within { border-style: solid; border-color: var(--mi-blue-deep); color: var(--mi-text-2); }
.mt-add-input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font: inherit; font-size: var(--mi-fs-body); color: var(--mi-text); }
.mt-add-input::placeholder { color: var(--mi-text-3); }

.mt-list { margin: var(--mi-sp-2) 0 0; padding: 0; list-style: none; }
.mt-item { gap: var(--mi-sp-2); min-height: 44px; }
.mt-check-wrap { position: relative; display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 28px; height: 28px; cursor: pointer; }
.mt-check { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; clip-path: inset(50%); cursor: pointer; }
.mt-box { box-sizing: border-box; position: relative; width: 18px; height: 18px; border-radius: 5px; border: 1.5px solid var(--mi-border-control); transition: background-color var(--mi-dur-fast) var(--mi-ease), border-color var(--mi-dur-fast) var(--mi-ease), transform 120ms var(--mi-ease-out); }
.mt-check:focus-visible + .mt-box { outline: 2px solid var(--mi-blue-deep); outline-offset: 2px; }
.mt-check:active + .mt-box { transform: scale(0.88); }
.done .mt-box { background: var(--mi-blue-deep); border-color: var(--mi-blue-deep); }
.done .mt-box::after { content: ''; position: absolute; left: 5px; top: 1.5px; width: 4px; height: 9px; border: solid var(--mi-btn-primary-text); border-width: 0 1.5px 1.5px 0; transform: rotate(45deg); }
.mt-title { flex: 1; min-width: 0; padding: 4px 0; border: 0; background: transparent; color: var(--mi-text); font: inherit; font-size: var(--mi-fs-body); text-align: left; overflow-wrap: anywhere; cursor: text; transition: color var(--mi-dur-fast) var(--mi-ease); }
.mt-title.static { cursor: default; }
.done .mt-title { color: var(--mi-text-3); text-decoration: line-through; }
.mt-edit { flex: 1; min-width: 0; padding: 4px 6px; border: 1px solid var(--mi-blue-deep); border-radius: 6px; outline: 0; background: var(--mi-card); font: inherit; font-size: var(--mi-fs-body); color: var(--mi-text); }
.mt-chip { flex-shrink: 1; max-width: 40%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding: 2px 8px; border: 0; border-radius: 999px; background: var(--mi-blue-light); color: var(--mi-blue-ink); font: inherit; font-size: var(--mi-fs-caption); cursor: pointer; }
.mt-chip:hover { text-decoration: underline; }
.mt-chip:focus-visible, .mt-title:focus-visible { outline: 2px solid var(--mi-blue-deep); outline-offset: 1px; }
.mt-day { flex-shrink: 0; color: var(--mi-warn-deep); font-size: var(--mi-fs-caption); }
.mt-lead { flex-shrink: 0; width: 28px; color: var(--mi-warn-deep); }
.mt-empty { margin: var(--mi-sp-3) 0 0; font-size: var(--mi-fs-label); color: var(--mi-text-3); }
.mt-sub { margin-top: 20px; }
.mt-sub-title { margin: 0; font-size: var(--mi-fs-label); font-weight: 500; color: var(--mi-text-2); }
/* 触控：按钮放大到 40px；窄屏把操作换到第二行，不挤任务组标签 */
@media (pointer: coarse) {
  .mt-item .icon-btn { width: 40px; height: 40px; }
}
@media (max-width: 560px) {
  .mt-item { flex-wrap: wrap; }
  .mt-chip { max-width: 45%; }
  .mt-item .pg-row-actions { width: 100%; justify-content: flex-end; }
}
</style>
