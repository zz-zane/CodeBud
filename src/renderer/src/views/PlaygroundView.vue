<script setup lang="ts">
/**
 * 练习场：自己写代码、点运行、看结果。
 *
 * 【为什么要放一排示例按钮】
 * 零基础用户点进来面对一个空白编辑器，卡住的地方不是「不会写语法」，
 * 是「根本不知道该写什么」。盯着光标闪十秒，然后关掉软件。
 * 所以给三个按钮：点一下代码就填好了，再点「运行」立刻有结果。
 * 第一口吃到了，才有第二口。
 *
 * 【页面高度为什么撑满而不是让整页滚】
 * 输出区的行数完全不可控（用户可能 print 一百行）。要是让整个页面滚，
 * 「运行」按钮会随着输出变长被顶出屏幕——用户想再跑一次还得先滚回去找。
 * 所以页面本身不滚，只有编辑器内部和输出区内部各自滚，按钮永远在。
 */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useContentStore } from '../stores/content'
import { useRunnerStore } from '../stores/runner'
import { SAMPLES } from '../../../shared/samples'
import { SAMPLE_UI } from '../../../shared/copy'
import { NAV, RUNNER_UI } from '../lib/copy'
import MiButton from '../components/base/MiButton.vue'
import MiModal from '../components/base/MiModal.vue'
import RunnerPanel from '../components/domain/RunnerPanel.vue'
import type { CodeSample } from '../../../shared/samples'

const runner = useRunnerStore()

// 待确认的覆盖操作：用户点了示例按钮，但编辑器里已经有他写的东西
const pending = ref<CodeSample | null>(null)
const askOpen = ref(false)

const route = useRoute()
const router = useRouter()
const content = useContentStore()

const fromLessonId = computed(() => {
  const q = route.query.fromLesson
  return typeof q === 'string' && q ? q : null
})

const fromLessonTitle = computed(() => {
  if (!fromLessonId.value) return ''
  return content.titleOf(fromLessonId.value) ?? fromLessonId.value
})

function backToLesson() {
  if (fromLessonId.value) {
    void router.push(`/lesson/${fromLessonId.value}`)
  }
}

/** 真正把示例填进编辑器 */
function applySample(s: CodeSample) {
  const run = s.byLang[runner.lang]
  runner.setCode(runner.lang, run.code)
  // setCode 会把输入框清空，所以要在它之后设——顺序反了就白设了
  runner.stdin = run.stdin ?? ''
}

function useSample(s: CodeSample) {
  // 编辑器里已经有东西、而且和要填的不一样 → 先问一声
  // （一样的话就是重复点同一个按钮，直接重填即可，别拿弹窗烦人）
  const current = runner.code.trim()
  if (current.length > 0 && runner.code !== s.byLang[runner.lang].code) {
    pending.value = s
    askOpen.value = true
    return
  }
  applySample(s)
}

function confirmOverwrite() {
  if (pending.value) applySample(pending.value)
  askOpen.value = false
  pending.value = null
}

/** 取消就安静地关掉。不弹提示：「先不要」本来就是这个按钮上的字，
 *  再把它当提示弹一遍，等于对着用户复述他自己刚点的按钮。 */
function cancelOverwrite() {
  askOpen.value = false
  pending.value = null
}
</script>

<template>
  <div class="playground-page">
    <button
      v-if="fromLessonId"
      type="button"
      class="back-to-lesson-btn"
      @click="backToLesson"
    >
      {{ NAV.backToLesson(fromLessonTitle) }}
    </button>
    <div class="pg-head playground-head">
      <h1 class="page-title pg-title">{{ NAV.PLAYGROUND }}</h1>
      <div class="pg-chips" role="group" :aria-label="RUNNER_UI.SAMPLES_TITLE">
        <button
          v-for="s in SAMPLES"
          :key="s.key"
          type="button"
          class="pg-chip"
          :title="SAMPLE_UI[s.key].hint"
          :disabled="runner.running"
          @click="useSample(s)"
        >
          {{ SAMPLE_UI[s.key].label }}
        </button>
      </div>
    </div>

    <div class="panel-slot">
      <RunnerPanel />
    </div>

    <MiModal v-model:visible="askOpen" :title="RUNNER_UI.OVERWRITE_TITLE" :width="380">
      <p class="ask-text">{{ RUNNER_UI.OVERWRITE_BODY }}</p>
      <template #footer>
        <MiButton variant="ghost" @click="cancelOverwrite">{{ RUNNER_UI.OVERWRITE_CANCEL }}</MiButton>
        <MiButton variant="danger" @click="confirmOverwrite">{{ RUNNER_UI.OVERWRITE_OK }}</MiButton>
      </template>
    </MiModal>
  </div>
</template>

<style scoped>
.back-to-lesson-btn {
  display: inline-flex;
  align-items: center;
  margin-bottom: var(--mi-sp-3);
  padding: var(--mi-sp-1) var(--mi-sp-2);
  border: 0;
  border-radius: var(--mi-radius-sm);
  background: transparent;
  color: var(--mi-blue-ink);
  font: inherit;
  font-size: var(--mi-fs-label);
  cursor: pointer;
  transition: background var(--mi-dur-fast) var(--mi-ease);
}
.back-to-lesson-btn:hover {
  background: var(--mi-blue-light);
  text-decoration: underline;
}
.playground-page {
  display: flex;
  flex-direction: column;
  /* 撑满可视区，页面本身不滚（见文件头说明） */
  height: 100%;
  min-height: 0;
  max-width: var(--mi-page-max);
  margin: 0 auto;
}

.page-title {
  font-family: var(--mi-font-title);
  font-size: var(--mi-fs-title);
  margin-bottom: var(--mi-sp-4);
  flex-shrink: 0;
}

.samples {
  flex-shrink: 0;
  margin-bottom: var(--mi-sp-3);
  padding: var(--mi-sp-3) var(--mi-sp-3);
  border-radius: var(--mi-radius-sm);
  background: var(--mi-blue-light);
}
.samples-title {
  display: block;
  margin-bottom: var(--mi-sp-2);
  font-size: var(--mi-fs-caption);
  color: var(--mi-text-2);
}
.sample-btns {
  display: flex;
  flex-wrap: wrap;
  gap: var(--mi-sp-2);
}

.panel-slot {
  flex: 1;
  /* min-height:0 不能省：flex 子项默认 min-height:auto，
     内容一高就把页面顶出去，下面的输出区被挤没 */
  min-height: 0;
}

.ask-text {
  margin: 0;
  font-size: var(--mi-fs-label);
  line-height: 1.8;
  color: var(--mi-text);
}
.playground-head { margin-bottom: var(--mi-sp-3); flex-shrink: 0; }
</style>
