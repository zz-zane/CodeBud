<script setup lang="ts">
/**
 * 题目（右栏）：一次一题。选词填空 = 三列词库；段落匹配 = 字母键盘 + 陈述列表；
 * 仔细阅读 = 选项整行可点；写作 / 翻译 = 输入框 + 词数。解析与参考范文只在 submitted 后才渲染。
 */
import { computed } from 'vue'
import { CET6 } from '../../lib/copy'
import {
  answerKeys,
  countWords,
  isRight,
  isScored,
  normalizedAnswer,
  type Cet6Question,
  type Cet6Section
} from '../../../../shared/cet6'
import Cet6Review from './Cet6Review.vue'

const props = defineProps<{
  section: Cet6Section
  q: Cet6Question | null
  screenQs: Cet6Question[]
  answers: Record<string, string>
  submitted: boolean
}>()

const emit = defineEmits<{
  choose: [q: Cet6Question, key: string]
  goTo: [q: Cet6Question]
  text: [q: Cet6Question, value: string]
}>()

const subjective = computed(() => (props.section.questions || []).find((x) => x.kind === 'essay' || x.kind === 'translation') ?? null)

const used = computed(() => {
  const cur = props.q
  return new Set(props.screenQs.filter((x) => !cur || x.id !== cur.id).map((x) => props.answers[x.id]))
})

const keys = computed(() => (props.q?.kind === 'matching' ? answerKeys(props.section, props.q) : []))

function ctlClass(q: Cet6Question, key: string): Record<string, boolean> {
  const on = props.answers[q.id] === key
  const out: Record<string, boolean> = { on }
  if (props.submitted && q.answer) {
    if (key === normalizedAnswer(q)) out[isScored(q) ? 'right' : 'ref'] = true
    else if (on && isScored(q)) out.wrong = true
  }
  return out
}

function onInput(e: Event, q: Cet6Question): void {
  emit('text', q, (e.target as HTMLTextAreaElement).value)
}

function stmtClass(item: Cet6Question): Record<string, boolean> {
  const out: Record<string, boolean> = { current: item.id === props.q?.id }
  if (props.submitted && isScored(item)) out[isRight(item, props.answers[item.id]) ? 'right' : 'wrong'] = true
  return out
}

function twoUp(q: Cet6Question): boolean {
  const o = q.options || []
  return o.length === 4 && o.every((x) => x.text.length < 40)
}
</script>

<template>
  <div class="cet6-panel" :class="{ subjective: !!subjective }">
    <!-- 写作 / 翻译 -->
    <template v-if="subjective">
      <div class="cet6-area" :class="{ done: submitted }">
        <h3 class="cet6-area-title">{{ CET6.ANSWER_AREA }}</h3>
        <textarea
          class="cet6-ruled"
          :data-input="subjective.kind"
          :aria-label="subjective.kind === 'essay' ? CET6.ESSAY_LABEL : CET6.TRANSLATION_LABEL"
          :placeholder="subjective.kind === 'essay' ? CET6.ESSAY_PLACEHOLDER : CET6.TRANSLATION_PLACEHOLDER"
          lang="en"
          :spellcheck="false"
          :value="answers[subjective.id] || ''"
          :readonly="submitted"
          @input="onInput($event, subjective)"
        />
        <div class="cet6-area-foot">
          <span>{{ CET6.wordCount(countWords(answers[subjective.id] || '')) }}</span>
          <span v-if="subjective.kind === 'essay'">{{ CET6.ESSAY_HINT }}</span>
        </div>
      </div>
      <div v-if="submitted" class="cet6-reference" lang="en">
        <h3>{{ subjective.kind === 'essay' ? CET6.REF_ESSAY : CET6.REF_TRANSLATION }}</h3>
        {{ subjective.answer || CET6.NO_REF }}
      </div>
    </template>

    <!-- 选词填空 -->
    <template v-else-if="q && q.kind === 'word-bank'">
      <div class="cet6-bank">
        <button
          v-for="opt in q.options || []"
          :key="opt.key"
          type="button"
          class="cet6-bank-word"
          :class="{ ...ctlClass(q, opt.key), used: used.has(opt.key) }"
          :data-q="q.id"
          :data-key="opt.key"
          :aria-pressed="answers[q.id] === opt.key"
          :disabled="submitted || q.unanswerable === true"
          @click="emit('choose', q, opt.key)"
        >
          <span class="cet6-bank-key">{{ opt.key }}</span><span>{{ opt.text }}</span>
        </button>
      </div>
      <Cet6Review v-if="submitted" :q="q" :given="answers[q.id]" open />
    </template>

    <!-- 段落匹配 -->
    <template v-else-if="q && q.kind === 'matching'">
      <div class="cet6-pad">
        <button
          v-for="k in keys"
          :key="k"
          type="button"
          class="cet6-letter"
          :class="ctlClass(q, k)"
          :data-q="q.id"
          :data-key="k"
          :aria-pressed="answers[q.id] === k"
          :aria-label="CET6.pickLetter(q.number, k)"
          :disabled="submitted || q.unanswerable === true"
          @click="emit('choose', q, k)"
        >
          {{ k }}
        </button>
      </div>
      <template v-for="item in screenQs" :key="item.id">
        <button type="button" class="cet6-stmt" :class="stmtClass(item)" :data-stmt="item.id" @click="emit('goTo', item)">
          <span class="cet6-stmt-no">{{ item.number }}.</span>
          <span class="cet6-stmt-text">{{ item.stem }}</span>
          <span class="cet6-stmt-pick">{{ answers[item.id] || '' }}</span>
        </button>
        <Cet6Review v-if="submitted && item.id === q.id" :q="q" :given="answers[q.id]" open />
      </template>
    </template>

    <!-- 仔细阅读 -->
    <template v-else-if="q">
      <div class="cet6-q">
        <span class="cet6-qno">{{ q.number }}.</span>
        <div v-if="q.stem" class="cet6-qstem">{{ q.stem }}</div>
        <div class="cet6-options" :class="{ 'two-up': twoUp(q) }">
          <button
            v-for="opt in q.options || []"
            :key="opt.key"
            type="button"
            class="cet6-option"
            :class="ctlClass(q, opt.key)"
            :data-q="q.id"
            :data-key="opt.key"
            :aria-pressed="answers[q.id] === opt.key"
            :disabled="submitted || q.unanswerable === true"
            :title="q.unanswerable === true ? CET6.UNANSWERABLE_TIP : undefined"
            @click="emit('choose', q, opt.key)"
          >
            <span class="cet6-option-key">{{ opt.key }})</span><span>{{ opt.text }}</span>
          </button>
        </div>
        <Cet6Review v-if="submitted" :q="q" :given="answers[q.id]" open />
      </div>
    </template>
  </div>
</template>

<style scoped>
.cet6-panel { font-family: var(--mi-font-serif); color: var(--mi-text); line-height: 1.7; }
.cet6-qno { font-family: var(--mi-font-family); font-weight: 500; margin-right: var(--mi-sp-2); }
.cet6-qstem { margin: 2px 0 var(--mi-sp-3); }
.cet6-options { display: flex; flex-direction: column; gap: var(--mi-sp-1); }
.cet6-options.two-up { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.cet6-option, .cet6-bank-word, .cet6-letter, .cet6-stmt { border: 1px solid transparent; border-radius: var(--radius-lg, 8px); background: transparent; color: var(--mi-text); font: inherit; cursor: pointer; }
.cet6-option { display: flex; gap: var(--mi-sp-2); width: 100%; padding: var(--mi-sp-2) var(--mi-sp-3); text-align: left; }
.cet6-option-key, .cet6-bank-key { font-family: var(--mi-font-family); font-weight: 500; flex-shrink: 0; }
.cet6-option:hover:not(:disabled), .cet6-bank-word:hover:not(:disabled), .cet6-letter:hover:not(:disabled), .cet6-stmt:hover { background: var(--cds-fill-ghost-hover); }
.cet6-option:disabled, .cet6-bank-word:disabled, .cet6-letter:disabled { cursor: default; }
.cet6-option:focus-visible, .cet6-bank-word:focus-visible, .cet6-letter:focus-visible, .cet6-stmt:focus-visible { outline: 2px solid var(--mi-blue-deep); outline-offset: 1px; }
.on { background: var(--mi-blue-light); border-color: var(--mi-blue-deep); }
.right { background: var(--mi-success-fill); border-color: var(--mi-success-deep); color: var(--mi-success-deep); }
.wrong { background: var(--mi-error-fill); border-color: var(--mi-error-deep); color: var(--mi-error-deep); }
.ref { border-style: dashed; border-color: var(--mi-success-deep); }

.cet6-bank { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--mi-sp-1) var(--mi-sp-2); }
.cet6-bank-word { display: flex; gap: var(--mi-sp-2); padding: var(--mi-sp-2) var(--mi-sp-3); text-align: left; }
.cet6-bank-word.used:not(.on) { color: var(--mi-text-3); text-decoration: line-through; }

.cet6-pad { display: grid; grid-template-columns: repeat(auto-fill, minmax(36px, 1fr)); gap: var(--mi-sp-1); margin-bottom: var(--mi-sp-3); }
.cet6-letter { height: var(--mi-ctl); font-family: var(--mi-font-family); font-weight: 500; }
.cet6-stmt { display: flex; gap: var(--mi-sp-2); width: 100%; padding: var(--mi-sp-2) var(--mi-sp-2); text-align: left; border-color: transparent; }
.cet6-stmt.current { background: var(--mi-blue-light); }
.cet6-stmt.right { background: var(--mi-success-fill); }
.cet6-stmt.wrong { background: var(--mi-error-fill); }
.cet6-stmt-no { font-family: var(--mi-font-family); font-weight: 500; flex-shrink: 0; }
.cet6-stmt-text { flex: 1; min-width: 0; }
.cet6-stmt-pick { font-family: var(--mi-font-family); font-weight: 500; color: var(--mi-blue-deep); }

.cet6-panel.subjective { display: flex; flex-direction: column; min-height: 100%; }
.cet6-area { display: flex; flex-direction: column; flex: 1 0 auto; gap: var(--mi-sp-2); }
.cet6-area.done { flex: 0 0 auto; }
.cet6-area-title { margin: 0; font-family: var(--mi-font-family); font-size: var(--mi-fs-caption); font-weight: 500; color: var(--mi-text-2); }
.cet6-ruled { display: block; flex: 1; width: 100%; min-height: 320px; box-sizing: border-box; padding: var(--mi-sp-4); border: 1px solid var(--mi-border-control); border-radius: var(--radius-lg, 8px); outline: none; resize: none; background: var(--mi-card); color: var(--mi-text); font: inherit; line-height: 1.8; }
.cet6-ruled:focus { border-color: var(--mi-blue-deep); }
.cet6-ruled::placeholder { color: var(--mi-text-3); }
.cet6-area.done .cet6-ruled { border-style: dashed; }
.cet6-area-foot { display: flex; justify-content: space-between; gap: var(--mi-sp-2); font-family: var(--mi-font-family); font-size: var(--mi-fs-caption); color: var(--mi-text-3); font-variant-numeric: tabular-nums; }
.cet6-reference { margin-top: var(--mi-sp-6); padding-top: var(--mi-sp-3); border-top: 1px solid var(--mi-border); white-space: pre-wrap; color: var(--mi-text-2); }
.cet6-reference h3 { margin: 0 0 var(--mi-sp-2); font-family: var(--mi-font-family); font-size: var(--mi-fs-label); font-weight: 500; }
</style>
