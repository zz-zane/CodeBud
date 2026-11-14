<script setup lang="ts">
/**
 * 收藏页（学习闭环 §6）：左筛选栏 + 右列表 + 吸底多选工具条。
 *
 * 【这一屏的每一句判断都不在这儿】筛选、排序、计数、元信息解析、能不能开练，
 * 全部在 `lib/favorites-view.ts`（有单测）与 `stores/favorites.ts`（有单测）。
 * 这里只负责画，以及把用户的动作转给那两个地方 ——
 * views/ 不在 vitest 的 include 范围内，写在这儿的判断**永远不会有测试**
 * （错题本那边的 `canRedo` 就是这个教训，收藏这边不再重复）。
 *
 * 【两个同名不同义的「收藏」】这一页是**两种**收藏的家：
 *   · 「收藏的题目」——题目级（`favorites.json`），下面那张卡；
 *   · 「收藏的课」——课级（`profile.favorites`），上面那张卡（V1-23 ② 新开）。
 * 题目分区的小标题写全「收藏的题目」，和课程分区一起把这层分野说出来，
 * 见 copy.ts 的 TITLE.FAVORITES 注释（大标题已退回「⭐ 收藏」）。
 */
import { computed, nextTick, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useContentStore } from '../stores/content'
import { useFavoritesStore } from '../stores/favorites'
import { useProgressStore } from '../stores/progress'
import MiIcon from '../components/base/MiIcon.vue'
import MiButton from '../components/base/MiButton.vue'
import MiCheckbox from '../components/base/MiCheckbox.vue'
import MiEmpty from '../components/base/MiEmpty.vue'
import MiInput from '../components/base/MiInput.vue'
import MiModal from '../components/base/MiModal.vue'
import MiRichText from '../components/base/MiRichText.vue'
import MiSelect from '../components/base/MiSelect.vue'
import {
  ALGO_COURSE,
  DIFFICULTY_DISPLAY,
  EMPTY,
  FAVORITES,
  PRACTICE,
  TITLE,
  TOAST,
  TYPE_DISPLAY
} from '../lib/copy'
import { LANG_LABEL } from '../lib/labels'
import { toast } from '../components/base/toast'
import { useFavoriteStarter } from '../lib/favorite-practice'
import { useLessonOpener } from '../lib/openLesson'
import {
  FAV_ALL,
  FAV_ALL_SELECTION,
  FAV_OTHER_SOURCE,
  FAV_SOURCE_ORDER,
  FAV_UNGROUPED,
  canPracticeFavorite,
  countByFolder,
  countBySource,
  filterFavorites,
  filterOptions,
  itemSource,
  makeMetaResolver,
  resolveFavoriteQuestion,
  sortFavorites,
  type FavoriteMeta,
  type FavoritesSelection,
  type FavoriteQuestionDeps
} from '../lib/favorites-view'
import { indexByKey } from '../../../shared/question-index'
import { isAiKey } from '../../../shared/question-key'
import { localDateKeyOf } from '../../../shared/dates'
import type {
  Difficulty,
  FavoriteFolder,
  FavoriteItem,
  Lang,
  Question,
  QuestionType
} from '../../../shared/types'

const content = useContentStore()
const fav = useFavoritesStore()
const progress = useProgressStore()
const { startFavorites } = useFavoriteStarter()
const { openLesson } = useLessonOpener()

/**
 * 「收藏的课」的数据源（V1-23 ②）：课级收藏 = profile.favorites（课 id 数组，
 * 顺序 = 收藏顺序）。在课程分区出现之前，这些 id 落盘后**没有任何列表页消费**——
 * 用户收藏一节课，全 app 找不回来。这里补上那个家。
 *
 * 找不到出处的条目照实显示、不悄悄吞掉（同 unknownHidden 的原则：收藏是
 * 用户自己的东西）。点行进课文页走 useLessonOpener（draft/locked 有统一拦截）。
 */
const courseFavs = computed(() =>
  progress.profile.favorites.map((id) => {
    const l = content.lessonOf(id)
    return { id, title: l?.title ?? id, missing: !l, isAlgo: !!l && (l.category === 'algo' || l.id.startsWith('algo-')), chapter: l?.chapterTitle }
  })
)

const sel = reactive<FavoritesSelection>({ ...FAV_ALL_SELECTION })

/** 右列（列表本体）。挤压态下选完筛选把它拉回视野用 —— 见 pickFolder。 */
const mainRef = ref<HTMLElement | null>(null)

/**
 * 选文件夹 = 换右列内容。中栏拖窄 + 高缩放时内容盒会窄过「220px 筛选列 + 16px
 * 间距」，右列整块落到 .content 的裁剪框外（复核现场 384/433/383 + 160%，
 * 与备忘录编辑区同一族）。选中后把右列滚进视野 —— 备忘录那边用的是同一条
 * 救生通道（block/inline 都 nearest：本就看得见时一点都不动）。
 */
function pickFolder(v: string): void {
  sel.folder = v
  void nextTick(() => mainRef.value?.scrollIntoView({ block: 'nearest', inline: 'nearest' }))
}

/**
 * 全局键 → 索引条目。建**一次** Map，之后每行 O(1)；
 * 直接在 4023 条的数组上 find 是每行一次线性扫（见 shared/question-index.ts 的 indexByKey）。
 */
const byKey = computed(() => indexByKey(content.questionIndex))

/** 内置题去内容包按「课号 + 题号」找。找不到返回 null（内容改版把题移走了） */
function findBuiltIn(lessonId: string, qid: string): Question | null {
  return content.getQuestion(lessonId, qid)
}

/**
 * 「这条收藏对应的题在哪」只问这一件事。
 * 行内显示题干、行内「单题练习」、多选开卷三处**共用同一个对象** ——
 * 各建一份的话，「列表里看得见、点练习却跳过它」这类不一致迟早会出现。
 */
const questionDeps: FavoriteQuestionDeps = { findBuiltIn }

/** 一条收藏的语言/题型/难度。查不出出处的返回 null（由 filterFavorites 统一记账） */
const metaOf = computed(() =>
  makeMetaResolver({
    indexOf: (key) => byKey.value.get(key),
    lessonOf: (id) => content.lessonOf(id)
  })
)

const view = computed(() => filterFavorites(fav.items, sel, metaOf.value))
const shown = computed(() => sortFavorites(view.value.shown))

/** 每个文件夹有几条 / 未分组几条（左栏的计数） */
const folderCounts = computed(() => countByFolder(fav.items))

// ---------------------------------------------------------------- 筛选器选项

/**
 * 元信息取得到的那些收藏。四个筛选项里语言/难度/题型三维**从这份里现算** ——
 * 「我收藏里真有的取值」才列出来，不摆一堆点了才知道是空的档。
 * （最下面那个 `keep` 参数保证：真出现"选出 0 条"的一刻，选中的那档也还在。）
 */
const knownMetas = computed(() =>
  fav.items
    .map((it) => metaOf.value(it))
    .filter((m): m is FavoriteMeta => m !== null)
)

/**
 * 语言那一维在**题库里**可能出现的全部取值（顺序照 labels.ts 的键序）。
 * 不按收藏现算：语言一共五个，少列一个的代价是"我把 Python 的题都取消收藏之后，
 * 那一档就没了"，而题库里有 Python 这件事并没有变。
 */
const LANG_ORDER: string[] = [...Object.keys(LANG_LABEL), 'algo']
const DIFF_ORDER = Object.keys(DIFFICULTY_DISPLAY) as Difficulty[]
const TYPE_ORDER = Object.keys(TYPE_DISPLAY) as QuestionType[]

const langOptions = computed(() =>
  filterOptions(
    knownMetas.value.map((m) => m.lang as string),
    LANG_ORDER as string[],
    (v) => (v === 'algo' ? ALGO_COURSE.CAT_NAV : (LANG_LABEL[v as Lang] ?? v)),
    FAVORITES.ALL_LANG,
    sel.lang
  )
)
const diffOptions = computed(() =>
  filterOptions(
    knownMetas.value.map((m) => m.difficulty as string),
    DIFF_ORDER as string[],
    (v) => DIFFICULTY_DISPLAY[v as Difficulty] ?? v,
    FAVORITES.ALL_DIFFICULTY,
    sel.difficulty
  )
)
const typeOptions = computed(() =>
  filterOptions(
    knownMetas.value.map((m) => m.type as string),
    TYPE_ORDER as string[],
    (v) => TYPE_DISPLAY[v as QuestionType] ?? v,
    FAVORITES.ALL_TYPE,
    sel.type
  )
)
/** 来源那一维**从收藏自己身上数**：落盘里有什么值就有什么档（认不出的原样显示） */
const sourceOptions = computed(() =>
  filterOptions(
    Object.keys(countBySource(fav.items)),
    FAV_SOURCE_ORDER,
    (v) => PRACTICE.sourceLabel(v),
    FAVORITES.ALL_SOURCE,
    sel.source
  )
)

/*
 * MiSelect 只会吐回 `string`，而这三个维度的取值域是收窄的联合类型。
 * 不写 v-model 而写这四个 setter：转换只在这一处，模板那边看不懂类型也不会写歪。
 * 真写进了域外的值也不至于出事 —— filterFavorites 拿它当"没一条匹配"，
 * 而选项列表里有 `keep` 兜着，用户随时能退回去。
 */
function setLang(v: string): void {
  sel.lang = v as FavoritesSelection['lang']
}
function setDifficulty(v: string): void {
  sel.difficulty = v as FavoritesSelection['difficulty']
}
function setType(v: string): void {
  sel.type = v as FavoritesSelection['type']
}
function setSource(v: string): void {
  sel.source = v
}

// ---------------------------------------------------------------- 列表

/** 一行要显示的全部东西。**一趟算完**，模板里不再逐个字段现算（见 questionDeps 的注释） */
interface FavRow {
  item: FavoriteItem
  stem: string
  lessonTitle: string
  meta: FavoriteMeta | null
  source: string
  added: string
  ai: boolean
  canPractice: boolean
  isAlgo: boolean
}

const rows = computed<FavRow[]>(() =>
  shown.value.map((it) => ({
    item: it,
    // 题找不回本体时如实说"已被移走"，不显示一个空白行
    stem: resolveFavoriteQuestion(it, questionDeps)?.stem ?? PRACTICE.MISSING_STEM,
    lessonTitle: content.lessonOf(it.lessonId)?.title ?? '',
    meta: metaOf.value(it),
    source: itemSource(it),
    added: localDateKeyOf(it.addedAt) ?? '',
    ai: isAiKey(it.key),
    canPractice: canPracticeFavorite(it, questionDeps),
    isAlgo: content.lessonOf(it.lessonId)?.category === 'algo' || it.lessonId.startsWith('algo-')
  }))
)

function sourceLabelOf(row: FavRow): string {
  // 落盘时没带 source 的老条目：归进「其他」那一档（types.ts 里那段选填的理由）
  return row.source === FAV_OTHER_SOURCE ? FAVORITES.OTHER_SOURCE : PRACTICE.sourceLabel(row.source)
}

/**
 * 一条都还没有 vs 筛完了是空的 —— 两种空态**两句话**。
 * 混用的话，用户在筛选器上点一下会以为自己的收藏全没了（copy.ts 里那段）。
 * `fav.loaded` 之前什么都不显示：读盘要几十毫秒，先当真地报"还没收藏过"
 * 会闪一下假空态（`stores/favorites.ts` 的 loaded 就是为这个存在的）。
 */
const emptyState = computed(() =>
  fav.items.length === 0 ? EMPTY.FAVORITES_EMPTY : EMPTY.FAVORITES_FILTERED_EMPTY
)

/** 空态按钮的去处（V1-52 ④：去学一节课，练习里就能遇见 ⭐） */
const router = useRouter()

// ---------------------------------------------------------------- 勾选

const selected = ref<Set<string>>(new Set())

function setSelected(key: string, on: boolean): void {
  const next = new Set(selected.value)
  if (on) next.add(key)
  else next.delete(key)
  selected.value = next
}

/**
 * 选中的那些 —— **从 store 的 items 里现滤**，不是拿 selected 直接数。
 * 取消收藏、挪走、删文件夹之后，勾过的键可能已经不在列表里了；
 * 直接数的话工具条会一直报着"已选 3 道"，而屏幕上一条勾中的都没有。
 */
const selectedItems = computed(() => fav.items.filter((i) => selected.value.has(i.key)))

/** 列表在别处被改过之后，把勾选里已经看不见的那些摘掉（挪走 / 删文件夹之后调） */
function syncSelection(): void {
  const visible = new Set(rows.value.map((r) => r.item.key))
  selected.value = new Set([...selected.value].filter((k) => visible.has(k)))
}

const allSelected = computed(
  () => rows.value.length > 0 && rows.value.every((r) => selected.value.has(r.item.key))
)

function toggleSelectAll(): void {
  selected.value = allSelected.value
    ? new Set()
    : new Set(rows.value.map((r) => r.item.key))
}

// ---------------------------------------------------------------- 动作

/**
 * 单题练习 / 多选开卷。**都走收藏练习启动器**：它负责挑出能练的、
 * 跳过挑战题与找不到的题、并如实报告跳过了几道（见 lib/favorite-practice.ts）。
 * 返回 0 表示一道都没开成（它自己会说为什么），这时别清勾选 ——
 * 用户还得接着从这几条里挑。
 */
function practice(items: readonly FavoriteItem[]): void {
  if (startFavorites(items) === 0) return
  selected.value = new Set()
}

/**
 * 删除冷却到什么时刻（2026-10-17 夜间批）。双击的「取消收藏」第二下会落在
 * **下一行**的同名按钮上（行在 180ms 的退场动画后上移补位，按钮原地不动）
 * —— 用户没看过、也没点过的那一条会被静默删掉。删完这 400ms 内的点击
 * 一律不认（用时间戳而不是 disabled+定时器：不给这个页面再添一个要清理的 timer）。
 */
let removeCooldownUntil = 0

function removeOne(it: FavoriteItem): void {
  if (Date.now() < removeCooldownUntil) return
  removeCooldownUntil = Date.now() + 400
  // 走 removeMany 而不是 toggle(key, null)：批量口对"这条已经不在了"是安全的
  // （数不到就不动、也不出声），而 toggle 会当成一次**收藏**去做。
  fav.removeMany([it.key])
}

function removeSelected(): void {
  fav.removeMany([...selectedItems.value].map((i) => i.key))
  selected.value = new Set()
}

// ---------------------------------------------------------------- 笔记

const noteEditing = ref<string | null>(null)
const noteDraft = ref('')

function startNote(it: FavoriteItem): void {
  noteEditing.value = it.key
  noteDraft.value = it.note ?? ''
}

function saveNote(key: string): void {
  fav.setNote(key, noteDraft.value)
  noteEditing.value = null
}

// ---------------------------------------------------------------- 文件夹

const createVisible = ref(false)
const folderName = ref('')
const renameTarget = ref<FavoriteFolder | null>(null)
const deleteTarget = ref<FavoriteFolder | null>(null)

function openCreate(): void {
  folderName.value = ''
  createVisible.value = true
}

function confirmCreate(): void {
  const f = fav.createFolder(folderName.value)
  if (!f) {
    // 空名不受理（store 的规矩），但用户得知道为什么没建出来
    toast(TOAST.FOLDER_NAME_EMPTY, 'warn')
    return
  }
  createVisible.value = false
  // 建完直接筛到它：用户建文件夹通常就是要把东西挪进去
  sel.folder = f.id
}

function openRename(f: FavoriteFolder): void {
  folderName.value = f.name
  renameTarget.value = f
}

function confirmRename(): void {
  const f = renameTarget.value
  if (!f) return
  if (!fav.renameFolder(f.id, folderName.value)) {
    toast(TOAST.FOLDER_NAME_EMPTY, 'warn')
    return
  }
  renameTarget.value = null
}

function openDelete(f: FavoriteFolder): void {
  deleteTarget.value = f
}

function confirmDelete(): void {
  const f = deleteTarget.value
  if (!f) return
  fav.deleteFolder(f.id)
  // 正在按这个文件夹筛的话，筛子必须跟着撤 —— 那一档随着文件一起从栏里消失了，
  // 留着它列表会空着，而用户找不到自己刚点过哪儿
  if (sel.folder === f.id) sel.folder = FAV_ALL
  deleteTarget.value = null
  syncSelection()
}

// ---------------------------------------------------------------- 移动到文件夹

const moveVisible = ref(false)
const moveKeys = ref<string[]>([])
const moveTarget = ref<string>(FAV_UNGROUPED)

/** 「未分组」不是文件夹，用 FAV_UNGROUPED 当它的哨兵值（文件夹 id 是 `folder-…`，撞不上） */
const moveOptions = computed(() => [
  { value: FAV_UNGROUPED, label: FAVORITES.MOVE_UNGROUPED },
  ...fav.folders.map((f) => ({ value: f.id, label: f.name }))
])

function openMove(keys: readonly string[]): void {
  if (fav.folders.length === 0) return
  moveKeys.value = [...keys]
  moveTarget.value = FAV_UNGROUPED
  moveVisible.value = true
}

function confirmMove(): void {
  fav.moveTo(moveKeys.value, moveTarget.value === FAV_UNGROUPED ? null : moveTarget.value)
  moveVisible.value = false
  // 挪进别的文件夹之后，这些条目在当前这一档里多半就看不见了
  syncSelection()
}
</script>

<template>
  <div class="favorites-page pg">
    <div class="pg-head favorites-head">
      <h1 class="page-title pg-title">{{ TITLE.FAVORITES }}</h1>
    </div>

    <template v-if="fav.loaded">
      <div class="fav-bar">
        <div class="pg-chips" role="group" :aria-label="FAVORITES.FILTER_FOLDER">
          <button type="button" class="pg-chip" :class="{ active: sel.folder === FAV_ALL }" :aria-pressed="sel.folder === FAV_ALL" @click="pickFolder(FAV_ALL)">
            {{ FAVORITES.ALL }}<span class="pg-count">{{ fav.items.length }}</span>
          </button>
          <button type="button" class="pg-chip" :class="{ active: sel.folder === FAV_UNGROUPED }" :aria-pressed="sel.folder === FAV_UNGROUPED" @click="pickFolder(FAV_UNGROUPED)">
            {{ FAVORITES.UNGROUPED }}<span class="pg-count">{{ folderCounts.ungrouped }}</span>
          </button>
          <template v-for="f in fav.folders" :key="f.id">
            <button type="button" class="pg-chip" :class="{ active: sel.folder === f.id }" :aria-pressed="sel.folder === f.id" @click="pickFolder(f.id)">
              <MiIcon name="folder" :size="14" />{{ f.name }}<span class="pg-count">{{ folderCounts.byId[f.id] ?? 0 }}</span>
            </button>
            <template v-if="sel.folder === f.id">
              <button type="button" class="icon-btn" :title="FAVORITES.FOLDER_RENAME" :aria-label="FAVORITES.FOLDER_RENAME" @click="openRename(f)"><MiIcon name="pencil" :size="14" /></button>
              <button type="button" class="icon-btn danger" :title="FAVORITES.FOLDER_DELETE" :aria-label="FAVORITES.FOLDER_DELETE" @click="openDelete(f)"><MiIcon name="trash" :size="14" /></button>
            </template>
          </template>
          <button type="button" class="icon-btn" :title="FAVORITES.NEW_FOLDER" :aria-label="FAVORITES.NEW_FOLDER" @click="openCreate"><MiIcon name="folder-plus" /></button>
        </div>
        <div v-if="fav.items.length > 0" class="fav-filters">
          <MiSelect :model-value="sel.lang" :options="langOptions" :aria-label="FAVORITES.FILTER_LANG" @update:model-value="setLang" />
          <MiSelect :model-value="sel.difficulty" :options="diffOptions" :aria-label="FAVORITES.FILTER_DIFFICULTY" @update:model-value="setDifficulty" />
          <MiSelect :model-value="sel.type" :options="typeOptions" :aria-label="FAVORITES.FILTER_TYPE" @update:model-value="setType" />
          <MiSelect :model-value="sel.source" :options="sourceOptions" :aria-label="FAVORITES.FILTER_SOURCE" @update:model-value="setSource" />
        </div>
      </div>

      <div ref="mainRef" class="fav-main">
        <!-- progress.loaded 之前不渲染：档案没读回来时 favorites 是空数组，会闪一句假话 -->
        <section v-if="progress.loaded && courseFavs.length > 0" class="pg-section">
          <h2 class="pg-section-title"><MiIcon name="book" :size="14" />{{ FAVORITES.COURSE_TITLE }}<span class="pg-count">{{ courseFavs.length }}</span></h2>
          <div class="pg-rows">
            <button v-for="c in courseFavs" :key="c.id" type="button" class="pg-row fav-course-item" @click="openLesson(c.id)">
              <span class="fav-course-name">{{ c.title }}</span>
              <span v-if="c.isAlgo && c.chapter" class="pg-meta">{{ c.chapter }}</span>
              <span v-if="c.missing" class="pg-meta">{{ FAVORITES.COURSE_MISSING }}</span>
              <MiIcon class="row-chevron" name="chevron-right" :size="14" />
            </button>
          </div>
        </section>

        <section class="pg-section">
          <h2 v-if="rows.length > 0" class="pg-section-title fav-q-title">
            <MiIcon name="list-checks" :size="14" />{{ FAVORITES.QUESTIONS_TITLE }}<span class="pg-count">{{ rows.length }}</span>
            <button type="button" class="fav-select-all" @click="toggleSelectAll">{{ allSelected ? FAVORITES.clearSelection : FAVORITES.selectAll }}</button>
          </h2>

          <!-- 被筛选挡住的条目必须说出来：收藏不能悄悄变少（lib/favorites-view.ts） -->
          <div v-if="view.hiddenUnknown > 0" class="pg-meta fav-unknown">
            <span class="pg-meta-item"><MiIcon name="info" :size="13" />{{ FAVORITES.unknownHidden(view.hiddenUnknown) }}</span>
          </div>

          <div v-if="rows.length > 0" class="pg-rows" v-auto-animate>
            <div v-for="row in rows" :key="row.item.key" class="pg-row fav-item">
              <MiCheckbox :model-value="selected.has(row.item.key)" @update:model-value="(v) => setSelected(row.item.key, v)" />
              <div class="pg-row-main">
                <div class="fav-stem"><MiRichText :text="row.stem" /></div>
                <div class="pg-meta">
                  <button v-if="row.isAlgo && row.lessonTitle" type="button" class="fav-lesson-link pg-meta-item" @click="openLesson(row.item.lessonId)"><MiIcon name="book" :size="12" />{{ row.lessonTitle }}</button>
                  <span v-else-if="row.lessonTitle" class="pg-meta-item"><MiIcon name="book" :size="12" />{{ row.lessonTitle }}</span>
                  <span v-if="row.ai" class="pg-meta-item" :title="PRACTICE.AI_ENTRY_TAG"><MiIcon name="sparkles" :size="12" />AI</span>
                  <span v-if="row.meta">{{ TYPE_DISPLAY[row.meta.type] }}</span>
                  <span v-if="row.meta">{{ DIFFICULTY_DISPLAY[row.meta.difficulty] }}</span>
                  <span>{{ sourceLabelOf(row) }}</span>
                  <span v-if="row.added">{{ FAVORITES.addedAt(row.added) }}</span>
                </div>

                <div v-if="noteEditing === row.item.key" class="fav-note-edit">
                  <MiInput v-model="noteDraft" multiline :rows="2" :placeholder="FAVORITES.NOTE_PLACEHOLDER" />
                  <div class="pg-actions">
                    <MiButton size="sm" variant="primary" @click="saveNote(row.item.key)">{{ FAVORITES.NOTE_SAVE }}</MiButton>
                    <MiButton size="sm" variant="ghost" @click="noteEditing = null">{{ FAVORITES.NOTE_CANCEL }}</MiButton>
                  </div>
                </div>
                <button v-else-if="row.item.note" type="button" class="fav-note" @click="startNote(row.item)">{{ row.item.note }}</button>
              </div>

              <div class="pg-row-actions reveal">
                <!-- 挑战题不给「单题练习」：它按规格只在阶段 / 整门 / 每日挑战里出 -->
                <button v-if="row.canPractice" type="button" class="icon-btn" :title="FAVORITES.ACTION_PRACTICE" :aria-label="FAVORITES.ACTION_PRACTICE" @click="practice([row.item])"><MiIcon name="play" /></button>
                <button v-if="!row.item.note" type="button" class="icon-btn" :title="FAVORITES.NOTE_EMPTY" :aria-label="FAVORITES.NOTE_EMPTY" @click="startNote(row.item)"><MiIcon name="note" /></button>
                <!-- 一个文件夹都没有时不摆「移动到…」：移进移出都没有去处 -->
                <button v-if="fav.folders.length > 0" type="button" class="icon-btn" :title="FAVORITES.ACTION_MOVE" :aria-label="FAVORITES.ACTION_MOVE" @click="openMove([row.item.key])"><MiIcon name="folder" /></button>
                <button type="button" class="icon-btn danger" :title="FAVORITES.ACTION_UNFAV" :aria-label="FAVORITES.ACTION_UNFAV" @click="removeOne(row.item)"><MiIcon name="star" filled /></button>
              </div>
            </div>
          </div>
          <!-- 按钮只在真的没收藏过时给：筛选后为空的出路是换筛选器 -->
          <MiEmpty v-else v-bind="emptyState">
            <MiButton v-if="fav.items.length === 0" variant="primary" icon="book" @click="router.push('/courses')">{{ FAVORITES.EMPTY_GO_LEARN }}</MiButton>
          </MiEmpty>
        </section>

        <div v-if="selectedItems.length > 0" class="fav-toolbar">
          <span class="fav-toolbar-n">{{ FAVORITES.selected(selectedItems.length) }}</span>
          <MiButton variant="primary" size="sm" icon="play" @click="practice(selectedItems)">{{ FAVORITES.SELECTED_PRACTICE }}</MiButton>
          <MiButton v-if="fav.folders.length > 0" class="icon-only" variant="secondary" size="sm" icon="folder" :title="FAVORITES.SELECTED_MOVE" :aria-label="FAVORITES.SELECTED_MOVE" @click="openMove(selectedItems.map((i) => i.key))" />
          <MiButton class="icon-only" variant="ghost" size="sm" icon="trash" :title="FAVORITES.SELECTED_REMOVE" :aria-label="FAVORITES.SELECTED_REMOVE" @click="removeSelected" />
          <button type="button" class="icon-btn" :title="FAVORITES.clearSelection" :aria-label="FAVORITES.clearSelection" @click="selected = new Set()"><MiIcon name="x" :size="14" /></button>
        </div>
      </div>
    </template>

    <MiModal v-model:visible="createVisible" :title="FAVORITES.NEW_FOLDER">
      <MiInput v-model="folderName" :placeholder="FAVORITES.FOLDER_NAME_PLACEHOLDER" />
      <template #footer>
        <MiButton variant="secondary" @click="createVisible = false">
          {{ FAVORITES.FOLDER_CANCEL }}
        </MiButton>
        <MiButton variant="primary" @click="confirmCreate">
          {{ FAVORITES.FOLDER_CREATE }}
        </MiButton>
      </template>
    </MiModal>

    <MiModal
      :visible="renameTarget !== null"
      :title="FAVORITES.FOLDER_RENAME"
      @update:visible="renameTarget = null"
    >
      <MiInput v-model="folderName" :placeholder="FAVORITES.FOLDER_NAME_PLACEHOLDER" />
      <template #footer>
        <MiButton variant="secondary" @click="renameTarget = null">
          {{ FAVORITES.FOLDER_CANCEL }}
        </MiButton>
        <MiButton variant="primary" @click="confirmRename">
          {{ FAVORITES.FOLDER_CREATE }}
        </MiButton>
      </template>
    </MiModal>

    <MiModal
      :visible="deleteTarget !== null"
      :title="FAVORITES.folderDeleteTitle(deleteTarget?.name ?? '')"
      @update:visible="deleteTarget = null"
    >
      <p class="fav-del-body">
        {{ FAVORITES.folderDeleteBody(deleteTarget ? (folderCounts.byId[deleteTarget.id] ?? 0) : 0) }}
      </p>
      <template #footer>
        <MiButton variant="secondary" @click="deleteTarget = null">
          {{ FAVORITES.FOLDER_CANCEL }}
        </MiButton>
        <MiButton variant="danger" @click="confirmDelete">
          {{ FAVORITES.folderDeleteOk }}
        </MiButton>
      </template>
    </MiModal>

    <MiModal v-model:visible="moveVisible" :title="FAVORITES.moveTitle">
      <MiSelect v-model="moveTarget" :options="moveOptions" />
      <template #footer>
        <MiButton variant="secondary" @click="moveVisible = false">
          {{ FAVORITES.MOVE_CANCEL }}
        </MiButton>
        <MiButton variant="primary" @click="confirmMove">
          {{ FAVORITES.MOVE_OK }}
        </MiButton>
      </template>
    </MiModal>
  </div>
</template>

<style scoped>
.fav-bar { display: flex; flex-direction: column; gap: var(--mi-sp-3); }
.fav-filters { display: flex; flex-wrap: wrap; gap: var(--mi-sp-2); }
.fav-main { display: flex; flex-direction: column; gap: var(--mi-sp-6); min-width: 0; }
.fav-course-item { width: 100%; background: transparent; border-inline: 0; border-top: 0; text-align: left; cursor: pointer; font-family: var(--mi-font-family); }
.fav-course-item:last-child { border-bottom: 0; }
.fav-course-item:hover .fav-course-name { color: var(--mi-blue-deep); }
.fav-course-name { flex: 1; min-width: 0; font-size: var(--mi-fs-body); color: var(--mi-text); }
.row-chevron { color: var(--mi-text-3); }
.fav-q-title { min-height: 24px; }
.fav-select-all { margin-left: auto; padding: 0; border: 0; background: transparent; font: var(--mi-fs-caption) var(--mi-font-family); color: var(--mi-text-3); cursor: pointer; }
.fav-select-all:hover { color: var(--mi-text); }
.fav-unknown { padding-block: var(--mi-sp-1); }
.fav-stem { font-size: var(--mi-fs-body); line-height: 1.55; color: var(--mi-text); word-break: break-word; }
.fav-lesson-link { padding: 0; border: 0; background: transparent; color: var(--mi-blue-deep); font: inherit; cursor: pointer; }
.fav-note { padding: 0; border: 0; background: transparent; text-align: left; font: var(--mi-fs-label)/var(--mi-lh-label) var(--mi-font-family); color: var(--mi-text-2); cursor: pointer; white-space: pre-wrap; word-break: break-word; }
.fav-note-edit { display: flex; flex-direction: column; gap: var(--mi-sp-2); }
.fav-toolbar { position: sticky; bottom: 12px; align-self: center; display: flex; align-items: center; gap: var(--mi-sp-2); padding: var(--mi-sp-2) var(--mi-sp-3); border: 1px solid var(--mi-border); border-radius: var(--radius-xl, 12px); background: var(--mi-bg); box-shadow: var(--cds-shadow-sm); }
.fav-toolbar-n { padding-inline: var(--mi-sp-1); font-size: var(--mi-fs-label); color: var(--mi-text-2); }
.fav-del-body { margin: 0; font-size: var(--mi-fs-body); line-height: 1.6; color: var(--mi-text-2); }
</style>
