<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useContentStore } from '../stores/content'
import { useProgressStore } from '../stores/progress'
import { useQuizStore } from '../stores/quiz'
import { useAiAssistantStore } from '../stores/ai-assistant'
import MiIcon from '../components/base/MiIcon.vue'
import MiButton from '../components/base/MiButton.vue'
import MiSelect from '../components/base/MiSelect.vue'
import MiTabs from '../components/base/MiTabs.vue'
import MiEmpty from '../components/base/MiEmpty.vue'
import MiProgressBar from '../components/base/MiProgressBar.vue'
import MiRichText from '../components/base/MiRichText.vue'
import MiModal from '../components/base/MiModal.vue'
import FavoriteStar from '../components/domain/FavoriteStar.vue'
import StagePaperDialog from '../components/domain/StagePaperDialog.vue'
import { toast } from '../components/base/toast'
import { isRemote } from '../lib/asset-base'
import { EMPTY, NAV, PAPER, PRACTICE, TITLE, TOAST, ALGO_COURSE, AI_ASSISTANT } from '../lib/copy'
import { LANG_LABEL, STAGE_LABEL } from '../lib/labels'
import { computeAlgoProgress, computePerLang } from '../lib/overview'
import { useStagePaperFlow } from '../lib/stage-practice'
import { useExtendStarter } from '../lib/extend'
import { usePracticeStarter } from '../lib/startPractice'
import { splitWrongbook } from '../lib/wrongbook-view'
import { buildPool, type PoolItem } from '../../../shared/challenge'
import { buildPaper } from '../../../shared/quiz-paper'
import { pickPrioritizedPaper } from '../lib/practice-paper'
import { questionKey } from '../../../shared/question-key'
import { isAiEntry, resolveWrongQuestion } from '../../../shared/wrongbook'
import { isChallenge } from '../../../shared/difficulty'
import { EXTEND_MAX } from '../../../shared/extend-paper'
import { localDateKeyOf } from '../../../shared/dates'
import { AI_WRONG_CAP } from '../../../shared/types'
import type { Question, WrongBookEntry } from '../../../shared/types'

// M4-04：练习页（单元练习入口说明 + 随机组卷，题数可配）
// M4-05：错题本页签（列表/重做/答对自动消除）
// 学习闭环 §5：错题本升级（三枚状态筛 / 行内动作 / 来源徽章 / 延展练习）
// 2026-10-01：「阶段练习」页签（阶段/整门综合练习的入口，从总览页搬来）
const router = useRouter()
const remote = isRemote() // 手机上没有练习场入口（runner:run 不在白名单）
const route = useRoute()
const content = useContentStore()
const progress = useProgressStore()
const quiz = useQuizStore()
const { startExtend } = useExtendStarter()
const { startLessonPractice } = usePracticeStarter()

const ai = useAiAssistantStore()

function diagnoseWrong(e: WrongBookEntry) {
  const info = entryInfo(e)
  // 1. 绑定该错题所属课程
  if (e.lessonId) {
    ai.setLessonContext(e.lessonId)
  }

  // 2. 构造题干、选项与解析上下文
  const q = info.question
  let wrongContent = info.stem
  if (q && 'options' in q && Array.isArray(q.options) && q.options.length) {
    wrongContent += AI_ASSISTANT.DIAGNOSE_OPTIONS_HEADER + q.options.map((opt: string, i: number) => `${String.fromCharCode(65 + i)}. ${opt}`).join('\n')
  }
  if (q && q.explanation) {
    wrongContent += AI_ASSISTANT.DIAGNOSE_EXPLANATION_HEADER + q.explanation
  }

  // 3. 挂载错题上下文标签
  ai.addContextTag({
    id: 'wrong-' + e.key,
    type: 'error',
    title: AI_ASSISTANT.DIAGNOSE_WRONG_TAG_TITLE(info.lessonTitle),
    content: wrongContent,
    removable: true
  })

  // 4. 设为 diagnose 错因诊断模式，预填草稿，并跳转到 /ai
  ai.tutoringAction = 'diagnose'
  ai.draft = AI_ASSISTANT.DIAGNOSE_WRONG_DRAFT(info.stem)
  void router.push('/ai')
}


/**
 * 页签归属。初始值认深链 `?tab=wrongbook`（结果页的「去错题本」带它跳过来，
 * V1-22 / V2-16）；人已经在场时的 query 变化由下面那个 watch 接住。
 */
const tab = ref(route.query.tab === 'wrongbook' ? 'wrongbook' : 'practice')
const paperSize = ref('10')

watch(() => route.query.lesson, (id) => {
  if (typeof id !== 'string' || !id) return
  if (quiz.session) { toast(PRACTICE.ACTIVE_SESSION, 'warn'); return }
  startLessonPractice(content.lessonOf(id))
}, { immediate: true })

// ---- 阶段练习页签（2026-10-01 从总览页搬来的入口）

/**
 * 每语言：已学/总数 + 各阶段完成度。和总览页同一份算式（`lib/overview.ts`，
 * 有单测钉住「一门语言一张卡」）—— 这里**不许自己数课**，数法写两遍就会漂移。
 */
const perLang = computed(() => [
  ...computePerLang(content.bundle.outline, content.bundle.lessons, progress.learnedSet),
  computeAlgoProgress(content.algoBundle.lessons, progress.learnedSet)
])

/** 确认框那一步的全部状态（组卷/开卷都在 `lib/stage-practice.ts`，这里只管摆按钮） */
const { pendingPaper, paperOpen, openPaper, startPaper } = useStagePaperFlow()

/**
 * 可抽题池：所有已解锁/已学、且有内容的课的全部题目。
 * 池子里的每一项都**带着宿主课 id**（`PoolItem`）——这是错题本能查回题干的前提，
 * 详见 shared/challenge.ts 开头那段。
 *
 * 【挑战题不进随机组卷】它们只在阶段综合练习 / 整门练习 / 每日挑战里出现
 * （主人规格）；判据在 shared/difficulty.ts，七个练习入口共用同一条。
 */
const pool = computed<PoolItem[]>(() =>
  buildPool(
    [...content.bundle.lessons, ...content.algoBundle.lessons],
    (id) => content.statusOf(id),
    (st) => st === 'open' || st === 'learned'
  ).filter((p) => !isChallenge(p.question))
)

/**
 * 池子空时的带路目标（V1-55，学 ReviewView 的池子空态）：第一门还没学的课。
 * 池子为什么空 = 一课都还没学，所以"去哪"的答案只有一个。
 */
const firstLearnable = computed(() => {
  const l = content.bundle.lessons.find((x) => content.statusOf(x.id) === 'open')
  return l ? { id: l.id, title: l.title } : null
})

function goLearn(): void {
  if (firstLearnable.value) router.push(`/lesson/${firstLearnable.value.id}`)
}

/**
 * 随机组卷。
 *
 * 用 `buildPaper` 而不是 `pickFromPool`：前者在"洗题取前 n"之外还多洗了
 * **每道题的选项顺序** —— 少了那一步，随机卷虽然题目每次不同，
 * 但每道选择题的正确答案仍然固定在第几位，做两轮就能靠"选第几个"蒙对。
 */


function startRandom() {
  if (pool.value.length === 0) {
    // V1-55 后按钮已禁用，这条成了兜底（键盘/将来入口到这儿也不许静默）
    toast(TOAST.NO_QUESTIONS_YET, 'warn')
    return
  }
  const picked = pickPrioritizedPaper(
    pool.value,
    Number(paperSize.value),
    content.activeLang,
    (id) => content.lessonOf(id)?.lang
  )
  // questions 和 keys 必须**同一次挑选**产生，不能用 map 各算一遍：
  // 两次挑选的随机结果不同，配对就会错位，错的题会记到别的题头上。
  const questions = picked.map((p) => p.question)
  const keys = picked.map((p) => questionKey(p.lessonId, p.question.id))
  quiz.startQuiz('random', '__random__', questions, keys)
  toast(TOAST.randomPaperReady(questions.length), 'success')
}

// ---- 错题本

/** 三枚状态筛：在库 / 已移除 / 漏洞（学习闭环 §10.1） */
type WrongFilter = 'active' | 'removed' | 'hole'
const filter = ref<WrongFilter>('active')

/**
 * 四组筛选（在库 / 已移除 / 漏洞 / 已毕业）从 `lib/wrongbook-view.ts` 拿 ——
 * 判据本身有单测（views/ 不在 vitest 的 include 里，写在这儿就永远没人守）。
 * ⚠️ 在库那条的 `!e.removed` 是学习闭环加的：软删的条目留在文件里（要留出恢复的路），
 * 少判这一个字段，删掉的题会继续躺在列表里 —— 用户点了「移除」看着它纹丝不动。
 */
const slices = computed(() => splitWrongbook(quiz.wrongbook))
const activeEntries = computed(() => slices.value.active)
const removedEntries = computed(() => slices.value.removed)
const holeEntries = computed(() => slices.value.hole)
const clearedCount = computed(() => slices.value.cleared.length)

const visibleEntries = computed(() =>
  filter.value === 'removed'
    ? removedEntries.value
    : filter.value === 'hole'
      ? holeEntries.value
      : activeEntries.value
)

const emptyState = computed(() =>
  filter.value === 'removed'
    ? EMPTY.WRONGBOOK_NO_REMOVED
    : filter.value === 'hole'
      ? EMPTY.WRONGBOOK_NO_HOLE
      : EMPTY.WRONGBOOK_EMPTY
)

/**
 * 「重做全部」作用的对象 = **当前筛选里在库的那些**：
 * 在库视图全都在库，漏洞视图就是插了旗的那批。
 * 已移除视图没有这个按钮（那一屏只有「恢复」——把删掉的东西重做一遍不是诉求）。
 */
const redoTargets = computed(() =>
  filter.value === 'hole' ? holeEntries.value : activeEntries.value
)

/** 去内容包里按「课号 + 题号」找内置题。找不到返回 null（题被移走了） */
function findBuiltIn(lessonId: string, qid: string): Question | null {
  return content.getQuestion(lessonId, qid)
}

/**
 * 错题条目 → 展示信息（课名 + 题干 + 题目本体）。
 *
 * 【为什么走 resolveWrongQuestion 而不是自己 find 一次】
 * 列表显示、点「重做」组卷、点 ⭐ 收藏，三处必须给出**同一个答案**。
 * 各写一遍的话，一处改了一处没改，表现就是「列表里有这道题、点重做却把它跳过了」——不报错。
 *
 * `question` 就是那一次解析的结果（找不到是 null），⭐ 直接拿它去收藏 ——
 * AI 题的收藏**必须带本体**，少了它 store 会当场拒绝并弹一句
 * （`stores/favorites.ts` 的 toggle），所以这里不能另找一道题顶上。
 */
function entryInfo(e: WrongBookEntry): {
  lessonTitle: string
  stem: string
  ai: boolean
  question: Question | null
} {
  const q = resolveWrongQuestion(e, findBuiltIn)
  const lesson = content.lessonOf(e.lessonId)
  return {
    lessonTitle: lesson?.title ?? e.lessonId,
    stem: q?.stem ?? PRACTICE.MISSING_STEM,
    // AI 题的课名是它的**宿主课**（「这题考的是哪一课」），不是「它属于这一课」。
    // 不标出来，用户会以为那道题是从那门课里出的，回头在课里翻不到
    ai: isAiEntry(e),
    question: q
  }
}

/**
 * 错题日期：显示它**在本地属于哪一天**。
 *
 * ⚠️ 原来写的是 `e.lastWrongAt.slice(0, 10)` —— `lastWrongAt` 存的是 **UTC** 时间戳，
 * 直接切前 10 位等于拿 UTC 的日期当本地日期用。本机东八区，晚上 20:00 之后
 * （UTC 还没翻页）错的题会显示成前一天；凌晨 0–8 点错的又会被算成昨天。
 * 日期基准的完整说明见 shared/dates.ts。
 */
function wrongDate(e: WrongBookEntry): string {
  return localDateKeyOf(e.lastWrongAt) ?? ''
}

/** 这条能不能单独重做：题找得到、而且不是挑战题（见 redoAll 的注释） */
function canRedo(e: WrongBookEntry): boolean {
  const q = resolveWrongQuestion(e, findBuiltIn)
  return q !== null && !isChallenge(q)
}

/**
 * canRedo 为假的两义拆开（V2-18）：挑战题（题在、只是不能单题重做）
 * vs 坏条目（题都找不到了）。
 *
 * 【为什么要拆】模板里原来只有「能重做 → 按钮；不能 → 什么都不摆」。
 * 坏条目的题干自己会显示「题目已被移走喵」，可挑战题那一行看起来和
 * 邻居一模一样、只是凭空少一颗按钮 —— 用户只能当成 bug 或怀疑按钮被吞了。
 * 拆开之后挑战题那行给一句说明并点名「延展练习」（那条路真的能走：
 * 同课/同标签的非挑战题，见 shared/extend-paper.ts 的过滤）。
 */
function isChallengeEntry(e: WrongBookEntry): boolean {
  const q = resolveWrongQuestion(e, findBuiltIn)
  return q !== null && isChallenge(q)
}

/**
 * 单条重做：只把这一道题放进会话，模式仍是 wrong（**答对即从错题本毕业**）。
 *
 * 【为什么不复用 redoAll 那条路】它攒的是"全部"，这里只有一条；
 * 但配对规矩一样 —— `{question, key}` 成对交给 buildPaper 洗
 * （洗选项顺序，顺便让 keys 跟着走）。
 */
function redoOne(e: WrongBookEntry) {
  const q = resolveWrongQuestion(e, findBuiltIn)
  if (!q || isChallenge(q)) return
  const paper = buildPaper([{ question: q, key: e.key }])
  quiz.startQuiz(
    'wrong',
    '__wrong__',
    paper.map((x) => x.question),
    paper.map((x) => x.key)
  )
  toast(TOAST.retryWrong(1), 'success')
}

/**
 * 重做（当前筛选里的）全部错题：questions + 原 key 一起进会话，答对即消除。
 *
 * 【为什么是「题 + 键」成对攒，而不是两个平行数组】
 * `buildPaper` 会把题目顺序洗掉。如果键还留在原来那个数组里，
 * 洗完之后 `keys[i]` 就不再是 `questions[i]` 的键了 —— 后果是
 * **答对的题消除不掉、答错的题记到别的题头上**，而且一声不吭。
 * 攒成 `{ question, key }` 之后，配对是结构上的事，洗牌没法只洗一半。
 *
 * 【错题重做尤其需要洗】
 * 这是同几道题**反复出现**的地方 —— 顺序和选项都不洗的话，
 * 第二遍就是纯背位置，错题本反而不起作用了。
 *
 * 【挑战题会被跳过】它们只在阶段综合练习 / 整门练习 / 每日挑战里出现
 * （主人规格）。每日挑战里答错的挑战题照常进错题本，但「重做全部」不发它们 ——
 * 挑战题的重做入口留给阶段卷那几条路。**行内不摆一个按不动的按钮**：
 * canRedo 为假的那些行干脆不显示「重做」。
 */
function redoAll() {
  const entries = redoTargets.value
  if (entries.length === 0) return
  const items: { question: Question; key: string }[] = []
  for (const e of entries) {
    // AI 题从条目自带的本体里取；内置题去内容包取。见 shared/wrongbook.ts
    const q = resolveWrongQuestion(e, findBuiltIn)
    if (q && !isChallenge(q)) items.push({ question: q, key: e.key })
  }
  if (items.length === 0) {
    toast(TOAST.WRONG_ENTRIES_BROKEN, 'warn')
    return
  }
  const paper = buildPaper(items)
  quiz.startQuiz(
    'wrong',
    '__wrong__',
    paper.map((x) => x.question),
    paper.map((x) => x.key)
  )
  toast(TOAST.retryWrong(paper.length), 'success')
}

// ---- 手动管理（软删 / 恢复 / 标漏洞）

/**
 * 软删一条。**不弹确认框** —— 能撤销的删除再弹框是纯噪音；
 * 换成 5 秒的撤销窗口（toast 上那枚按钮）。
 *
 * 【撤销为什么绑 key 而不是绑这条记录对象】撤销执行时列表可能已经重渲染过，
 * 记录对象早换了；key 才是身份（和错题本全项目一致）。
 */
async function removeOne(e: WrongBookEntry) {
  const ok = await quiz.patchWrongbook([{ key: e.key, patch: { removed: true } }])
  if (!ok) return
  toast(TOAST.WRONG_REMOVED, 'success', 5000, {
    label: TOAST.UNDO,
    run: () => void restoreEntry(e.key)
  })
}

/** 恢复（「已移除」里的按钮和撤销按钮共用这一个动作） */
async function restoreEntry(key: string) {
  const ok = await quiz.patchWrongbook([{ key, patch: { removed: false } }])
  if (ok) toast(TOAST.WRONG_RESTORED, 'success')
}

async function toggleHole(e: WrongBookEntry) {
  const want = !e.hole
  const ok = await quiz.patchWrongbook([{ key: e.key, patch: { hole: want } }])
  if (ok) toast(want ? TOAST.WRONG_HOLE_ON : TOAST.WRONG_HOLE_OFF, 'success')
}

// ---- 延展练习弹窗

const extendFor = ref<WrongBookEntry | null>(null)
const extendCount = ref('5')
/**
 * 正在组延展卷（静态池不够时要等 AI 补题，最长可到 180 秒）。
 *
 * 没有它的时候，用户点「开始」→ 弹窗立刻关掉 → 十几秒里界面毫无变化，
 * 唯一合理的解读就是「没点上」，于是再点一次。真正的保护在 lib/extend.ts 的
 * 模块级 in-flight 闸（那次连点不会毁掉会话），但让用户**看得见**在等，
 * 才是这条 UX 问题的正解。按钮转圈、选择器与取消一起冻住。
 */
const extendBusy = ref(false)
/** 弹窗开关跟着"有没有选中一行"走：打开=选中、关闭（Esc/遮罩/按钮）=清空 */
const extendVisible = computed({
  get: () => extendFor.value !== null,
  set: (v: boolean) => {
    if (!v) extendFor.value = null
  }
})
const extendDesc = computed(() =>
  extendFor.value ? PRACTICE.extendDesc(entryInfo(extendFor.value).lessonTitle) : ''
)
/** 1~10 道（EXTEND_MAX 是上限的唯一出处，池子不够时 extend 启动器会如实少出） */
const extendOptions = Array.from({ length: EXTEND_MAX }, (_, i) => ({
  value: String(i + 1),
  label: PRACTICE.extendCountOption(i + 1)
}))

function openExtend(e: WrongBookEntry) {
  extendFor.value = e
}

async function confirmExtend() {
  const e = extendFor.value
  // `extendBusy` 防的是同一张弹窗里的连点（Enter + 点击）；跨入口的连点由
  // lib/extend.ts 的模块级闸兜底
  if (!e || extendBusy.value) return
  extendBusy.value = true
  try {
    // 静态池不够时会等 AI 补题（lib/extend.ts）—— 等的时候弹窗留在原地转圈。
    // （原先先关弹窗再等：界面十几秒毫无变化，用户只会以为没点上。）
    await startExtend(e, Number(extendCount.value))
  } finally {
    extendBusy.value = false
    // **等它回来再关**：startQuiz 与这里在同一拍里完成，Vue 还没渲染，
    // 所以会话遮罩（QuizOverlay）和弹窗不会同时出现在屏幕上闪一下。
    extendFor.value = null
  }
}

// 切到错题本页签时刷新
watch(tab, (t) => {
  if (t === 'wrongbook') void quiz.loadWrongbook()
})
onMounted(() => {
  if (tab.value === 'wrongbook') void quiz.loadWrongbook()
})

/**
 * 深链落到错题本页签（V1-22 + V2-16）：结果页那颗「去错题本」带
 * `?tab=wrongbook` 跳过来（同总览页 `?card=`、设置页 `?at=` 的深链口径）。
 *
 * 【为什么要 watch 而不是只在初始化读一次】从结果页过来时练习页**可能
 * 已经在场上**（wrong 模式就是从这页开的局）—— 初始化那一次早跑完了，
 * 只读一次的写法在"人已经站在这一页"时是空的。
 * 之后 URL 里那个 tab 就留着不动了：用户手点页签切走由 ref 说了算，
 * 这里只在每次 query 真变成 wrongbook 时把 ref 拨过去。
 */
watch(
  () => route.query.tab,
  (t) => {
    if (t === 'wrongbook') tab.value = 'wrongbook'
  }
)
</script>

<template>
  <div class="practice-page pg">
    <div class="pg-head">
      <h1 class="page-title pg-title">{{ NAV.PRACTICE }}</h1>
      <MiTabs
        v-model="tab"
        :aria-label="NAV.PRACTICE"
        :tabs="[
          { key: 'practice', label: TITLE.TAB_PRACTICE, icon: 'code' },
          { key: 'wrongbook', label: TITLE.tabWrongbook(activeEntries.length), icon: 'flag' },
          { key: 'stage', label: TITLE.TAB_STAGE, icon: 'graduation' }
        ]"
      />
    </div>

    <div v-if="tab === 'practice'" class="pg-rows practice-list">
      <div v-if="!remote" class="pg-row">
        <MiIcon class="row-icon" name="code" :size="20" />
        <div class="pg-row-main">
          <div class="row-title">{{ PRACTICE.PLAYGROUND_CARD_TITLE }}</div>
          <div class="pg-meta">{{ PRACTICE.PLAYGROUND_CARD_DESC }}</div>
        </div>
        <MiButton variant="primary" icon="play" @click="router.push('/playground')">{{ PRACTICE.PLAYGROUND_CARD_BTN }}</MiButton>
      </div>

      <div class="pg-row">
        <MiIcon class="row-icon" name="shuffle" :size="20" />
        <div class="pg-row-main">
          <div class="row-title">{{ TITLE.RANDOM_CARD }}</div>
          <div class="pg-meta">{{ pool.length === 0 ? PRACTICE.POOL_EMPTY : PRACTICE.poolSize(pool.length) }}</div>
        </div>
        <MiButton
          v-if="pool.length === 0 && firstLearnable"
          variant="primary"
          class="random-go-learn"
          @click="goLearn"
        >
          {{ PRACTICE.GO_LEARN }}
        </MiButton>
        <div class="pg-actions">
          <MiSelect
            v-model="paperSize"
            :aria-label="TITLE.RANDOM_CARD"
            :options="[
              { value: '5', label: PRACTICE.questionCount(5) },
              { value: '10', label: PRACTICE.questionCount(10) },
              { value: '15', label: PRACTICE.questionCount(15) },
              { value: '20', label: PRACTICE.questionCount(20) }
            ]"
          />
          <MiButton variant="secondary" :disabled="pool.length === 0" @click="startRandom">
            {{ PRACTICE.RANDOM_START }}
          </MiButton>
        </div>
      </div>

      <div class="pg-row">
        <MiIcon class="row-icon" name="book" :size="20" />
        <div class="pg-row-main">
          <div class="row-title">{{ TITLE.UNIT_CARD }}</div>
          <div class="pg-meta">{{ PRACTICE.UNIT_HINT }}</div>
        </div>
        <MiButton variant="secondary" @click="router.push('/courses')">{{ PRACTICE.UNIT_GO }}</MiButton>
      </div>
    </div>

    <div v-else-if="tab === 'wrongbook'" class="wrongbook">
      <div class="pg-toolbar">
        <div class="pg-chips wrong-filters">
          <button type="button" class="pg-chip" :class="{ active: filter === 'active' }" :aria-pressed="filter === 'active'" @click="filter = 'active'">{{ PRACTICE.filterActive(activeEntries.length) }}</button>
          <button type="button" class="pg-chip" :class="{ active: filter === 'removed' }" :aria-pressed="filter === 'removed'" @click="filter = 'removed'">{{ PRACTICE.filterRemoved(removedEntries.length) }}</button>
          <button type="button" class="pg-chip" :class="{ active: filter === 'hole' }" :aria-pressed="filter === 'hole'" @click="filter = 'hole'">{{ PRACTICE.filterHole(holeEntries.length) }}</button>
          <span class="pg-meta-item wrong-note" :title="PRACTICE.WRONGBOOK_GRADUATE_ONLY" :aria-label="PRACTICE.WRONGBOOK_GRADUATE_ONLY" role="note">
            <MiIcon name="info" :size="13" />{{ PRACTICE.wrongbookDesc(clearedCount, AI_WRONG_CAP) }}
          </span>
        </div>
        <MiButton v-if="filter !== 'removed'" variant="primary" icon="repeat" :disabled="redoTargets.length === 0" @click="redoAll">
          {{ PRACTICE.RETRY_ALL }}
        </MiButton>
      </div>

      <div v-if="visibleEntries.length > 0" class="wrong-list pg-rows" v-auto-animate>
        <div v-for="e in visibleEntries" :key="e.key" class="wrong-item pg-row">
          <div class="pg-row-main">
            <div class="wrong-stem">
              <span v-if="e.hole" class="wrong-flag" role="img" :title="PRACTICE.HOLE_FLAG_TITLE" :aria-label="PRACTICE.HOLE_FLAG_TITLE"><MiIcon name="flag" :size="13" filled /></span>
              <MiRichText :text="entryInfo(e).stem" />
            </div>
            <div class="pg-meta">
              <span class="pg-meta-item"><MiIcon name="book" :size="12" />{{ entryInfo(e).lessonTitle }}</span>
              <span v-if="entryInfo(e).ai" class="pg-meta-item" :title="PRACTICE.AI_ENTRY_TAG"><MiIcon name="sparkles" :size="12" />AI</span>
              <span v-if="e.source">{{ PRACTICE.sourceLabel(e.source) }}</span>
              <span>{{ PRACTICE.wrongTimes(e.wrongCount) }}</span>
              <span>{{ wrongDate(e) }}</span>
            </div>
          </div>
          <div class="pg-row-actions reveal wrong-actions">
            <button v-if="filter === 'removed'" type="button" class="icon-btn" :title="PRACTICE.ACTION_RESTORE" :aria-label="PRACTICE.ACTION_RESTORE" @click="restoreEntry(e.key)"><MiIcon name="archive-restore" /></button>
            <template v-else>
              <button type="button" class="icon-btn" :class="{ active: e.hole }" :title="e.hole ? PRACTICE.ACTION_HOLE_OFF : PRACTICE.ACTION_HOLE_ON" :aria-label="e.hole ? PRACTICE.ACTION_HOLE_OFF : PRACTICE.ACTION_HOLE_ON" :aria-pressed="!!e.hole" @click="toggleHole(e)"><MiIcon name="flag" /></button>
              <button type="button" class="icon-btn" :title="PRACTICE.EXTEND_BTN" :aria-label="PRACTICE.EXTEND_BTN" @click="openExtend(e)"><MiIcon name="layers" /></button>
              <button type="button" class="icon-btn" :title="PRACTICE.DIAGNOSE_BTN" :aria-label="PRACTICE.DIAGNOSE_BTN" @click="diagnoseWrong(e)"><MiIcon name="sparkles" /></button>
              <FavoriteStar :q-key="e.key" :question="entryInfo(e).question" source="wrong" />
              <button type="button" class="icon-btn danger" :title="PRACTICE.ACTION_REMOVE" :aria-label="PRACTICE.ACTION_REMOVE" @click="removeOne(e)"><MiIcon name="trash" /></button>
            </template>
          </div>
          <template v-if="filter !== 'removed'">
            <MiButton v-if="canRedo(e)" size="sm" variant="secondary" icon="repeat" @click="redoOne(e)">{{ PRACTICE.RETRY_ONE }}</MiButton>
            <span v-else-if="isChallengeEntry(e)" class="icon-btn no-redo" role="img" :title="PRACTICE.NO_REDO_CHALLENGE" :aria-label="PRACTICE.NO_REDO_CHALLENGE"><MiIcon name="info" /></span>
          </template>
        </div>
      </div>
      <!-- 读档没过之前不画空态：错题本镜像初值是空数组，否则会闪一句假话 -->
      <MiEmpty v-else-if="quiz.wrongbookLoaded" v-bind="emptyState" />

      <MiModal v-model:visible="extendVisible" :title="PRACTICE.EXTEND_TITLE">
        <p class="extend-desc">{{ extendDesc }}</p>
        <div class="extend-row">
          <span class="extend-label">{{ PRACTICE.EXTEND_COUNT }}</span>
          <MiSelect v-model="extendCount" :options="extendOptions" :disabled="extendBusy" />
        </div>
        <template #footer>
          <MiButton variant="secondary" :disabled="extendBusy" @click="extendVisible = false">
            {{ PRACTICE.EXTEND_CANCEL }}
          </MiButton>
          <MiButton variant="primary" :loading="extendBusy" @click="confirmExtend">
            {{ PRACTICE.EXTEND_START }}
          </MiButton>
        </template>
      </MiModal>
    </div>

    <div v-else class="stage-panel">
      <section v-for="p in perLang" :key="p.lang" class="stage-course">
        <h2 class="pg-section-title stage-course-title">
          {{ p.lang === 'algo' ? ALGO_COURSE.CAT_NAV : LANG_LABEL[p.lang] }}
          <span class="pg-count">{{ p.percent }}%</span>
        </h2>
        <div v-for="s in p.stages" :key="s.stage" class="stage-row">
          <span class="stage-name">{{ STAGE_LABEL[s.stage] }}</span>
          <MiProgressBar :percent="s.percent" :height="5" />
          <span class="stage-count">{{ s.learned }}/{{ s.total }}</span>
          <!-- 空阶段的 missing 是 0，渲染出来会是「还差 0 课」，所以判 total > 0 而不是 done -->
          <template v-if="s.total > 0">
            <MiButton v-if="s.done" class="paper-go" variant="primary" size="sm" icon="graduation" @click="openPaper('stage', p.lang, s.stage)">{{ PAPER.STAGE_GO }}</MiButton>
            <span v-else class="paper-missing">{{ PAPER.missing(s.missing) }}</span>
          </template>
        </div>
        <div v-if="p.total > 0" class="stage-row lang-go-row">
          <span class="stage-name">{{ PAPER.LANG_TITLE }}</span>
          <span />
          <span />
          <MiButton v-if="p.done" class="paper-go" variant="primary" size="sm" icon="graduation" @click="openPaper('lang', p.lang)">{{ PAPER.LANG_GO }}</MiButton>
          <span v-else class="paper-missing">{{ PAPER.missing(p.missing) }}</span>
        </div>
      </section>

      <StagePaperDialog v-model:visible="paperOpen" :draft="pendingPaper" @start="startPaper" />
    </div>
  </div>
</template>

<style scoped>
.row-icon { color: var(--mi-text-3); }
.row-title { font-size: var(--mi-fs-body); font-weight: 500; color: var(--mi-text); }
.practice-list .pg-row { padding-block: var(--mi-sp-4); flex-wrap: wrap; }
.wrongbook { display: flex; flex-direction: column; gap: var(--mi-sp-3); }
.wrong-note { margin-left: var(--mi-sp-2); font-size: var(--mi-fs-caption); color: var(--mi-text-3); cursor: help; }
.wrong-stem { display: flex; gap: var(--mi-sp-2); font-size: var(--mi-fs-body); line-height: 1.55; color: var(--mi-text); min-width: 0; word-break: break-word; }
.wrong-flag { flex-shrink: 0; margin-top: var(--mi-sp-1); color: var(--mi-error-deep); }
.no-redo { cursor: help; color: var(--mi-text-3); }
.extend-desc { margin: 0 0 var(--mi-sp-3); font-size: var(--mi-fs-label); color: var(--mi-text-2); }
.extend-row { display: flex; align-items: center; gap: var(--mi-sp-3); font-size: var(--mi-fs-label); }
.extend-label { color: var(--mi-text-2); }
.stage-panel { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: var(--mi-sp-6) 36px; }
.stage-course-title { padding-bottom: var(--mi-sp-2); border-bottom: 1px solid var(--mi-border); justify-content: space-between; color: var(--mi-text); font-size: var(--mi-fs-body); }
.stage-row { display: grid; grid-template-columns: 84px minmax(0, 1fr) 44px 72px; align-items: center; gap: var(--mi-sp-3); min-height: 30px; font-size: var(--mi-fs-label); color: var(--mi-text-2); }
.stage-count { text-align: right; font-size: var(--mi-fs-caption); color: var(--mi-text-3); font-variant-numeric: tabular-nums; }
.stage-row .paper-go { justify-self: end; }
.paper-missing { justify-self: end; font-size: var(--mi-fs-caption); color: var(--mi-text-3); white-space: nowrap; }
.stage-course { min-width: 0; }
</style>
