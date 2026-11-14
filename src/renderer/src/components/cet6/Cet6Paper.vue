<script setup lang="ts">
/**
 * 试卷（左栏 / 听力全宽）。交卷前只渲染题面：答案、解析、听力原文、参考范文只在 submitted 后才进 DOM。
 * 阅读一次只印当前这一篇（block）；其余部分印整个 section。
 */
import { computed, reactive, ref } from 'vue'
import { CET6 } from '../../lib/copy'
import { assetBase } from '../../lib/asset-base'
import {
  blockHeading,
  englishLinesOnly,
  hasCjk,
  isRight,
  isScored,
  mediaUrl,
  normalizedAnswer,
  paragraphs,
  parseMatchingPassage,
  stemOf,
  transcriptInfo,
  withoutEmbeddedQuestions,
  type Cet6Block,
  type Cet6Meta,
  type Cet6Question,
  type Cet6Section
} from '../../../../shared/cet6'
import Cet6Review from './Cet6Review.vue'

const props = defineProps<{
  section: Cet6Section
  block: Cet6Block | null
  currentQ: Cet6Question | null
  answers: Record<string, string>
  submitted: boolean
  pickedLetter: string
  metas: Cet6Meta[]
}>()

const emit = defineEmits<{
  blank: [q: Cet6Question]
  para: [letter: string]
  choose: [q: Cet6Question, key: string]
  openShared: [id: string]
}>()

const isReading = computed(() => props.section.type === 'reading')
const isListening = computed(() => props.section.type === 'listening')
const sharedTarget = computed(() => props.metas.find((m) => m.id === props.section.sharedWithExamId))
const sharedTitle = computed(() => props.section.sharedWithTitle || props.section.sharedWithExamId || '')

const part = computed(() => {
  const t = props.section.type
  return { no: CET6.PART_NO[t], name: CET6.PART[t], minutes: CET6.PART_MINUTES[t] }
})

const directions = computed(() =>
  (props.section.directions || '').replace(/^\s*Directions\s*[:：]\s*/i, '').replace(/[\s_]+$/, '')
)

const figureSrc = computed(() => (props.section.figure?.src ? mediaUrl(props.section.figure.src, assetBase().cet6) : ''))

type Part = string | { blank: number }
interface Para { parts: Part[]; zh: boolean }
interface Passage {
  title: string
  matching: Array<{ letter: string; mark: string; text: string }> | null
  paras: Para[]
}

const compact = (s: string | undefined): string => (s || '').replace(/\s/g, '')

/** 一篇文章的可渲染结构；空 = 不印 */
function passageOf(block: Cet6Block): Passage | null {
  const section = props.section
  if (!block.text) return null
  if (section.type !== 'reading' && compact(section.directions).includes(compact(block.text))) return null
  const text = section.type === 'reading' ? withoutEmbeddedQuestions(block.text, section, block) : block.text
  const isMatching = (section.questions || []).some((q) => q.blockId === block.id && q.kind === 'matching')
  const parsed = isMatching ? parseMatchingPassage({ ...block, text }) : null
  if (parsed && parsed.items.length >= 5) return { title: parsed.title, matching: parsed.items, paras: [] }
  const paras = paragraphs(text).map((content): Para => {
    const parts: Part[] = []
    if (section.type === 'reading') {
      let offset = 0
      for (const m of content.matchAll(/__\((\d{2})\)__/g)) {
        parts.push(content.slice(offset, m.index))
        parts.push({ blank: Number(m[1]) })
        offset = (m.index as number) + m[0].length
      }
      parts.push(content.slice(offset))
    } else {
      parts.push(content)
    }
    return { parts, zh: section.type === 'translation' && hasCjk(content) }
  })
  return { title: '', matching: null, paras }
}

const readingPassage = computed(() => (isReading.value && props.block ? passageOf(props.block) : null))

interface BlockView {
  block: Cet6Block
  sectionHeading: string
  unit: string
  range: string
  passage: Passage | null
  questions: Cet6Question[]
}

/** 非阅读部分：整个 section 的各块，每次 section 变化才重算 */
const blockViews = computed<BlockView[]>(() => {
  if (isReading.value) return []
  let last = ''
  return (props.section.blocks || []).map((block) => {
    const heading = blockHeading(props.section, block)
    const questions = (props.section.questions || []).filter((q) => q.blockId === block.id)
    const showSection = heading.section && heading.section !== last ? heading.section : ''
    if (heading.section) last = heading.section
    let range = ''
    if (heading.unit && questions.length) {
      const nums = questions.map((q) => q.number)
      range = CET6.questionsRange(Math.min(...nums), Math.max(...nums), `${heading.unit.split(/\s+/)[0].toLowerCase()}`)
    }
    return {
      block,
      sectionHeading: showSection,
      unit: heading.unit,
      range,
      passage: isListening.value ? null : passageOf(block),
      questions
    }
  })
})

const hasAnyTranscript = computed(() =>
  (props.section.blocks || []).some((b) => transcriptInfo(b).text || b.translation)
)

// ---- 作答控件
function qByNumber(n: number): Cet6Question | undefined {
  return (props.section.questions || []).find((q) => q.number === n)
}

function chosenWord(q: Cet6Question): string {
  return (q.options || []).find((o) => o.key === props.answers[q.id])?.text ?? ''
}

function blankClass(q: Cet6Question | undefined): Record<string, boolean> {
  if (!q) return {}
  const on = props.currentQ?.id === q.id
  const out: Record<string, boolean> = { current: on, filled: !!props.answers[q.id] }
  if (props.submitted && isScored(q)) {
    const right = isRight(q, props.answers[q.id])
    out.right = right
    out.wrong = !right
  }
  return out
}

function optClass(q: Cet6Question, key: string): Record<string, boolean> {
  const on = props.answers[q.id] === key
  const out: Record<string, boolean> = { on }
  if (props.submitted && q.answer) {
    if (key === normalizedAnswer(q)) {
      out[isScored(q) ? 'right' : 'ref'] = true
    } else if (on && isScored(q)) out.wrong = true
  }
  return out
}

function cardClass(q: Cet6Question): Record<string, boolean> {
  const out: Record<string, boolean> = { current: props.currentQ?.id === q.id }
  if (props.submitted && isScored(q)) {
    const right = isRight(q, props.answers[q.id])
    out['is-right'] = right
    out['is-wrong'] = !right
  }
  return out
}

function twoUp(q: Cet6Question): boolean {
  const o = q.options || []
  return o.length === 4 && o.every((x) => x.text.length < 40)
}

// ---- 交卷后的听力原文
const allOpen = ref(false)
const englishOnly = reactive<Record<string, boolean>>({})
const asrOpen = reactive<Record<string, boolean>>({})

function shownText(block: Cet6Block): string {
  const info = transcriptInfo(block)
  return englishOnly[block.id] ? englishLinesOnly(info.text) : info.text
}

function transcriptTitle(block: Cet6Block): string {
  const info = transcriptInfo(block)
  return info.usesDraft ? CET6.TRANSCRIPT_DRAFT : info.needsReview ? CET6.TRANSCRIPT_DOUBT : CET6.TRANSCRIPT
}
</script>

<template>
  <div class="cet6-paper" :data-section="section.type">
    <!-- 阅读：只印当前这一篇 -->
    <template v-if="isReading">
      <div v-if="readingPassage" class="cet6-passage">
        <template v-if="readingPassage.matching">
          <h3 v-if="readingPassage.title" class="cet6-article-title">{{ readingPassage.title }}</h3>
          <p
            v-for="item in readingPassage.matching"
            :key="item.letter"
            class="cet6-labelled"
            :class="{ picked: pickedLetter === item.letter }"
            :data-para="item.letter"
          >
            <button type="button" class="cet6-marker" :aria-label="CET6.pickParagraph(item.letter)" @click="emit('para', item.letter)">
              {{ item.mark }}
            </button>
            {{ ' ' + item.text }}
          </p>
        </template>
        <template v-else>
          <p v-for="(p, i) in readingPassage.paras" :key="i">
            <template v-for="(part, j) in p.parts" :key="j">
              <template v-if="typeof part === 'string'">{{ part }}</template>
              <button
                v-else-if="qByNumber(part.blank)"
                type="button"
                class="cet6-blank"
                :class="blankClass(qByNumber(part.blank))"
                :id="`blank-${part.blank}`"
                :aria-label="CET6.questionNo(part.blank)"
                @click="emit('blank', qByNumber(part.blank)!)"
              >
                <b>{{ part.blank }}</b><span v-if="chosenWord(qByNumber(part.blank)!)" class="cet6-word">{{ chosenWord(qByNumber(part.blank)!) }}</span>
              </button>
              <template v-else>{{ part.blank }}</template>
            </template>
          </p>
        </template>
      </div>
    </template>

    <!-- 其它部分：整个 section -->
    <template v-else>
      <h2 class="cet6-part-title">{{ CET6.partTitle(part.no, part.name, part.minutes) }}</h2>

      <template v-if="isListening && section.sharedWithExamId">
        <p class="cet6-shared">{{ CET6.sharedNote(sharedTitle) }}</p>
        <button v-if="sharedTarget" type="button" class="pg-chip" @click="emit('openShared', sharedTarget.id)">
          {{ CET6.sharedGo(sharedTitle) }}
        </button>
      </template>

      <template v-else>
        <p v-if="directions" class="cet6-directions"><b>{{ CET6.DIRECTIONS }}</b> {{ directions }}</p>
        <figure v-if="figureSrc" class="cet6-figure">
          <img :src="figureSrc" :alt="section.figure?.alt || CET6.FIGURE_ALT" />
        </figure>

        <template v-if="submitted && isListening">
          <p v-if="!hasAnyTranscript" class="cet6-note">{{ CET6.TRANSCRIPT_NONE }}</p>
          <button v-else type="button" class="pg-chip" @click="allOpen = !allOpen">
            {{ allOpen ? CET6.TRANSCRIPT_COLLAPSE_ALL : CET6.TRANSCRIPT_EXPAND_ALL }}
          </button>
        </template>

        <template v-for="bv in blockViews" :key="bv.block.id">
          <h2 v-if="bv.sectionHeading" class="cet6-paper-section">{{ bv.sectionHeading }}</h2>
          <h3 v-if="bv.unit" class="cet6-paper-unit">{{ bv.unit }}</h3>
          <p v-if="bv.range" class="cet6-range">{{ bv.range }}</p>

          <div v-if="!isListening && bv.passage" class="cet6-passage">
            <p v-for="(p, i) in bv.passage.paras" :key="i" :class="{ zh: p.zh }" :lang="p.zh ? 'zh-CN' : undefined">
              <template v-for="(part, j) in p.parts" :key="j">{{ typeof part === 'string' ? part : part.blank }}</template>
            </p>
          </div>

          <template v-if="isListening">
            <div class="cet6-qgrid">
              <div v-for="q in bv.questions" :key="q.id" :id="`q-card-${q.id}`" class="cet6-q" :class="cardClass(q)">
                <span class="cet6-qno">{{ q.number }}.</span>
                <div v-if="stemOf(section, q, submitted)" class="cet6-qstem">{{ stemOf(section, q, submitted) }}</div>
                <div v-if="q.kind === 'single-choice'" class="cet6-options" :class="{ 'two-up': twoUp(q) }">
                  <button
                    v-for="opt in q.options || []"
                    :key="opt.key"
                    type="button"
                    class="cet6-option"
                    :class="optClass(q, opt.key)"
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
                <Cet6Review v-if="submitted" :q="q" :given="answers[q.id]" />
              </div>
            </div>

            <details
              v-if="submitted && (transcriptInfo(bv.block).text || bv.block.translation)"
              class="cet6-transcript"
              :open="allOpen"
            >
              <summary>{{ CET6.TRANSCRIPT_SUMMARY }}</summary>
              <template v-if="transcriptInfo(bv.block).text">
                <div class="cet6-transcript-title">{{ transcriptTitle(bv.block) }}</div>
                <button
                  v-if="!transcriptInfo(bv.block).usesDraft && transcriptInfo(bv.block).chineseCount >= 20"
                  type="button"
                  class="pg-chip"
                  @click="englishOnly[bv.block.id] = !englishOnly[bv.block.id]"
                >
                  {{ englishOnly[bv.block.id] ? CET6.FULL_TEXT : CET6.ENGLISH_ONLY }}
                </button>
                <div class="cet6-review-text">{{ shownText(bv.block) }}</div>
                <template v-if="!transcriptInfo(bv.block).usesDraft && (bv.block.asrDraft || '').trim()">
                  <button type="button" class="pg-chip" @click="asrOpen[bv.block.id] = !asrOpen[bv.block.id]">
                    {{ asrOpen[bv.block.id] ? CET6.ASR_HIDE : CET6.ASR_SHOW }}
                  </button>
                  <div v-if="asrOpen[bv.block.id]" class="cet6-review-text">{{ bv.block.asrDraft }}</div>
                </template>
              </template>
              <template v-if="bv.block.translation">
                <div class="cet6-transcript-title">{{ CET6.TRANSLATION_TITLE }}</div>
                <div class="cet6-review-text">{{ bv.block.translation }}</div>
              </template>
            </details>
          </template>
        </template>
      </template>
    </template>
  </div>
</template>

<style scoped>
.cet6-paper { font-family: var(--mi-font-serif); color: var(--mi-text); line-height: 1.75; }
.cet6-paper p { margin: 0 0 1em; }
.cet6-part-title { margin: 0 0 var(--mi-sp-3); font-size: 1.1em; font-weight: 500; }
.cet6-paper-section { margin: var(--mi-sp-6) 0 var(--mi-sp-2); font-size: 1.05em; font-weight: 500; }
.cet6-paper-unit { margin: var(--mi-sp-4) 0 var(--mi-sp-1); font-size: 1em; font-weight: 500; }
.cet6-range, .cet6-note, .cet6-shared { font-family: var(--mi-font-family); font-size: 0.85em; color: var(--mi-text-3); }
.cet6-directions b { font-weight: 500; }
.cet6-article-title { margin: 0 0 var(--mi-sp-3); font-size: 1.15em; font-weight: 500; text-align: center; }
.cet6-figure { margin: var(--mi-sp-3) 0; }
.cet6-figure img { max-width: 100%; border-radius: var(--radius-lg, 8px); }
.zh { font-family: var(--mi-font-family); }

.cet6-labelled.picked { background: var(--mi-blue-light); border-radius: var(--radius-lg, 8px); }
.cet6-marker, .cet6-blank { font: inherit; color: var(--mi-text); cursor: pointer; }
.cet6-marker { padding: 0 var(--mi-sp-1); border: 0; border-radius: var(--radius-lg, 8px); background: transparent; font-weight: 500; }
.cet6-marker:hover { background: var(--cds-fill-ghost-hover); }
.cet6-blank { display: inline-flex; align-items: baseline; gap: var(--mi-sp-1); min-width: 3.2em; padding: 0 var(--mi-sp-2); border: 0; border-bottom: 1px solid var(--mi-border-control); border-radius: 4px 4px 0 0; background: transparent; line-height: 1.4; }
.cet6-blank b { font-family: var(--mi-font-family); font-size: 0.8em; font-weight: 500; color: var(--mi-text-3); }
.cet6-word { font-style: italic; }
.cet6-blank:hover { background: var(--cds-fill-ghost-hover); }
.cet6-blank.current { background: var(--mi-blue-light); border-bottom-color: var(--mi-blue-deep); }
.cet6-blank.right { background: var(--mi-success-fill); color: var(--mi-success-deep); }
.cet6-blank.wrong { background: var(--mi-error-fill); color: var(--mi-error-deep); }
.cet6-marker:focus-visible, .cet6-blank:focus-visible, .cet6-option:focus-visible { outline: 2px solid var(--mi-blue-deep); outline-offset: 1px; }

.cet6-qgrid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--mi-sp-3) var(--mi-sp-8); margin: var(--mi-sp-2) 0 var(--mi-sp-4); }
.cet6-q { padding: var(--mi-sp-2); border-radius: var(--radius-lg, 8px); min-width: 0; }
.cet6-q.current { background: var(--mi-blue-light); }
.cet6-q.is-right { background: var(--mi-success-fill); }
.cet6-q.is-wrong { background: var(--mi-error-fill); }
.cet6-qno { font-family: var(--mi-font-family); font-weight: 500; margin-right: var(--mi-sp-2); }
.cet6-qstem { margin: 2px 0 var(--mi-sp-2); }
.cet6-options { display: flex; flex-direction: column; gap: 2px; }
.cet6-options.two-up { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.cet6-option { display: flex; gap: var(--mi-sp-2); padding: var(--mi-sp-1) var(--mi-sp-2); border: 1px solid transparent; border-radius: var(--radius-lg, 8px); background: transparent; color: var(--mi-text); font: inherit; text-align: left; cursor: pointer; }
.cet6-option:hover:not(:disabled) { background: var(--cds-fill-ghost-hover); }
.cet6-option:disabled { cursor: default; }
.cet6-option.on { background: var(--mi-blue-light); border-color: var(--mi-blue-deep); }
.cet6-option.right { background: var(--mi-success-fill); border-color: var(--mi-success-deep); color: var(--mi-success-deep); }
.cet6-option.wrong { background: var(--mi-error-fill); border-color: var(--mi-error-deep); color: var(--mi-error-deep); }
.cet6-option.ref { border-style: dashed; border-color: var(--mi-success-deep); }
.cet6-option-key { font-family: var(--mi-font-family); font-weight: 500; flex-shrink: 0; }

.cet6-transcript { margin: 0 0 var(--mi-sp-4); font-family: var(--mi-font-family); font-size: 0.9em; }
.cet6-transcript summary { cursor: pointer; color: var(--mi-text-2); }
.cet6-transcript-title { margin: var(--mi-sp-2) 0 var(--mi-sp-1); font-weight: 500; color: var(--mi-text-2); }
.cet6-review-text { white-space: pre-wrap; line-height: 1.7; color: var(--mi-text-2); }

@media (max-width: 1000px) { .cet6-qgrid { grid-template-columns: minmax(0, 1fr); } }
</style>
