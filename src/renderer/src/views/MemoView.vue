<script setup lang="ts">
/**
 * 大肥鱼备忘录（P3 ②）：左栏列表（分类 chips + 搜索 + 条目）+ 右栏编辑器。
 *
 * 【这一屏的判断都不在这儿】搜索 / 筛选 / 摘要在 `lib/memo-search.ts`，
 * 增删改与 64KB 拦截在 `stores/memo.ts`（两边都有单测）。这里只负责画与转发 ——
 * `views/` 不在 vitest 的 include 范围内，写在这儿的判断**永远不会有测试**
 * （收藏页那份抬头记过同一条教训）。
 *
 * 【列表顺序】最近新建的排最上面（`memo.add` 用 unshift，store 里那条注释）。
 * 搜索只筛不改序：搜出来的顺序和列表一致，否则用户会以为搜出了别的东西。
 */
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMemoStore } from '../stores/memo'
import { useContentStore } from '../stores/content'
import { useQuizStore } from '../stores/quiz'
import { prepareMarkdownExportFiles } from '../lib/markdown-export'
import { toast } from '../components/base/toast'
import { MEMO_KIND_ALL, memoSummary, searchMemo, type MemoKindFilter } from '../lib/memo-search'
import { ALGO_COURSE, EMPTY, MEMO, TITLE, MARKDOWN_EXPORT } from '../lib/copy'
import { isRemote } from '../lib/asset-base'

// 手机浏览器里没有「导出 Markdown」（系统对话框通道不在远程白名单里）
const remote = isRemote()
import { lessonNoteTitle } from '../lib/course-navigation'
import { utf8Bytes, type MemoKind } from '../../../shared/types'
import MiIcon from '../components/base/MiIcon.vue'
import MiButton from '../components/base/MiButton.vue'
import MiEmpty from '../components/base/MiEmpty.vue'
import MiInput from '../components/base/MiInput.vue'

const memo = useMemoStore()
const content = useContentStore()
const route = useRoute()
const router = useRouter()

/** 搜索词与分类档（都只是这一屏的界面状态，不进 memo.json） */
const query = ref('')
const kind = ref<MemoKindFilter>(MEMO_KIND_ALL)

const rows = computed(() => searchMemo(memo.items, query.value, kind.value))

/**
 * 左栏三档。顺序 = 由宽到窄（全部 → 两种分类），
 * 和收藏页筛选器、侧栏那些「全部在最前」的地方保持一致。
 */
const CHIPS: { value: MemoKindFilter; label: string }[] = [
  { value: MEMO_KIND_ALL, label: MEMO.KIND_ALL },
  { value: 'code', label: MEMO.KIND_CODE },
  { value: 'knowledge', label: MEMO.KIND_KNOWLEDGE }
]

function kindLabel(k: MemoKind): string {
  return k === 'code' ? MEMO.KIND_CODE : MEMO.KIND_KNOWLEDGE
}


const quiz = useQuizStore()
const exporting = ref(false)

async function exportAllMarkdown(): Promise<void> {
  if (exporting.value) return
  if (!quiz.wrongbookLoaded) {
    await quiz.loadWrongbook()
  }

  const files = prepareMarkdownExportFiles({
    memos: memo.items,
    wrongEntries: quiz.wrongbook,
    questionLookup: (lid, qid) => content.getQuestion(lid, qid) ?? undefined
  })

  if (files.length === 0) {
    toast(MARKDOWN_EXPORT.EMPTY, 'warn')
    return
  }

  exporting.value = true
  try {
    const res = await window.miai.exportMarkdown(files)
    if (!res.ok) {
      if ('canceled' in res && res.canceled) {
        toast(MARKDOWN_EXPORT.CANCELED, 'info')
      } else if ('error' in res && res.error) {
        toast(MARKDOWN_EXPORT.FAILED(res.error), 'error')
      }
    } else {
      toast(MARKDOWN_EXPORT.SUCCESS(res.exportedCount, res.dir), 'success')
    }
  } catch (err: any) {
    toast(MARKDOWN_EXPORT.FAILED(err?.message || String(err)), 'error')
  } finally {
    exporting.value = false
  }
}

const selectedId = ref<string | null>(null)
const selected = computed(() => (selectedId.value ? (memo.itemOf(selectedId.value) ?? null) : null))

/** 编辑区根节点（极端[2] 的滚入视野用） */
const editRef = ref<HTMLElement | null>(null)

/**
 * 选中一条 + 把编辑区拉进视野（极端[2]，2026-10-16）。
 *
 * 【为什么点一下还要滚】中栏拖窄 + 高缩放（复核现场：导航 384 / 内容 433 /
 * 右栏 383 + 160%）时，右侧编辑区会整块落在可视区外 —— 左列选中条变了、
 * 右边什么都没有，纯鼠标用户看到的就是「点了没反应」。复核查出的救生通道是
 * **键盘焦点一进编辑区，浏览器就会把它滚进来**；这里把这同一件事做成点击
 * 行为的一部分（纯鼠标用户没有那条通道）。
 *
 * block/inline 都用 nearest：已经看得见时**一点都不动** —— 宽布局下这条
 * 路径必须是无感的，别给正常用户添一次无谓的滚动。
 */
function pick(id: string): void {
  selectedId.value = id
  void nextTick(() => editRef.value?.scrollIntoView({ block: 'nearest', inline: 'nearest' }))
}

/**
 * 选中的那条还在不在。
 *
 * 【为什么只认「在不在 store 里」，不认「在不在当前筛选里」】搜索/筛选一变，
 * 被筛掉的那条**不能**被顶掉：用户可能正一边搜着、一边在右边改那一条
 * （改着改着它从搜索词里掉出去了）—— 那时把编辑器切到别人身上，
 * 他手里正在打的那段字等于被抢走了。只有真被删了（store 里都没了）才换人。
 */
watch(rows, (list) => {
  if (selectedId.value && memo.itemOf(selectedId.value)) return
  selectedId.value = list[0]?.id ?? null
})

/** 空态分两种：还没记过 / 记了但这档里没有（和收藏页同一条分法，别合并） */
const emptyState = computed(() =>
  memo.items.length === 0 ? EMPTY.MEMO_EMPTY : EMPTY.MEMO_FILTERED_EMPTY
)

/**
 * 「新建备忘」用哪个分类：当前档位不是「全部」就用它；是「全部」时默认
 * **知识性备忘**（一句话的知识比整段代码更常记；放错了也就是在编辑器里点一下
 * 另一个分类，不是要重写内容的事）。
 */
function create(): void {
  const it = memo.add(kind.value === MEMO_KIND_ALL ? 'knowledge' : kind.value)
  pick(it.id)
}

watch([() => route.path, () => route.query.lesson, () => memo.loaded], ([path, id, loaded]) => {
  if (path !== '/memo' || !loaded || typeof id !== 'string') return
  const lesson = content.lessonOf(id)
  if (lesson) {
    const item = memo.add('knowledge')
    memo.setTitle(item.id, lessonNoteTitle(lesson))
    kind.value = MEMO_KIND_ALL
    query.value = ''
    pick(item.id)
  }
  const { lesson: _lesson, ...remainingQuery } = route.query
  void router.replace({ path: route.path, query: remainingQuery })
}, { immediate: true })

/**
 * 删除（V1-32，2026-10-16 主人裁定「删掉确定吗，用户直接删就行了」）：
 * 点「删除」就删，不再弹确认框。备忘是随手记的一句话 —— 弹窗挡的那一下
 * 比误删的代价还大，误删了重打一句就是了。删完的落点逻辑保持不变。
 *
 * 【400ms 冷却（2026-10-17 夜间批）】不带确认框的代价得有人接住：删除后
 * 选中行跳到**下一条**、按钮原地不动，一次双击的第二下就会静默删掉一条
 * 用户没看过、也没点过的备忘。删完这 400ms 内的点击一律不认（时间戳而不是
 * disabled+定时器：这个页面不为它多养一个要清理的 timer）。
 * V1-32 裁掉的是「弹窗挡一下」，不是「双击连删两条」。
 */
let deleteCooldownUntil = 0

function deleteSelected(): void {
  if (Date.now() < deleteCooldownUntil) return
  const it = selected.value
  if (!it) return
  deleteCooldownUntil = Date.now() + 400
  // 先把"删完之后选谁"算出来：同一条位置的**下一条**（没有就上一条）——
  // 删完直接跳回最上面那条，连删几条时会来回跳得让人找不着北
  const i = rows.value.findIndex((r) => r.id === it.id)
  memo.remove(it.id)
  const rest = rows.value
  selectedId.value =
    rest.length === 0 ? null : (rest[Math.min(Math.max(i, 0), rest.length - 1)]?.id ?? null)
}

function onTitle(v: string): void {
  const it = selected.value
  if (it) memo.setTitle(it.id, v)
}

/**
 * 正文输入。
 *
 * 【存不进去时为什么要把输入框打回上一次的样子】store 拒绝超长（64KB，
 * 并且已经出声弹了一句）。但 DOM 里那段超长的字是**用户刚打进去的**，
 * Vue 在值没变时不会去改它 —— 留着的话，界面上是一段"存不进去的正文"，
 * 而磁盘上那份没有它：正是「界面挺对、重启没了」那个最坏的形状。
 * 所以这里换一次 key，把 textarea 整个重建，让它显示 store 里那一份。
 * （这是**打回**，不是截断：用户手上那段还在自己的剪贴板里，一个字没被我们改。）
 */
const bodyTick = ref(0)
const bodyKey = computed(() => `${selected.value?.id ?? 'none'}#${bodyTick.value}`)
function onBody(v: string): void {
  const it = selected.value
  if (!it) return
  if (!memo.setBody(it.id, v)) bodyTick.value++
}

/** 右栏底部的字节计数（主进程写口量的是同一个数：UTF-8 字节） */
const bodyKb = computed(() => (utf8Bytes(selected.value?.body ?? '') / 1024).toFixed(1))
</script>

<template>
  <div class="memo-page">
    <div class="pg-head memo-head">
      <h1 class="page-title pg-title">{{ TITLE.MEMO }}</h1>
    </div>

    <!-- loaded gate：没读完之前不画列表，否则会先显示一次「还没有笔记」 -->
    <template v-if="memo.loaded">
      <div v-if="memo.items.length === 0" class="memo-blank">
        <MiEmpty v-bind="EMPTY.MEMO_EMPTY" sub-text="">
          <MiButton variant="primary" icon="plus" @click="create">{{ MEMO.NEW }}</MiButton>
        </MiEmpty>
      </div>

      <div v-else class="memo-grid">
        <aside class="memo-side">
          <div class="memo-tools">
            <label class="pg-search">
              <MiIcon name="search" :size="14" />
              <input v-model="query" type="search" :aria-label="MEMO.SEARCH_PH" :placeholder="MEMO.SEARCH_PH" />
            </label>
            <button v-if="!remote" type="button" class="icon-btn" :title="MARKDOWN_EXPORT.BTN_LABEL" :aria-label="MARKDOWN_EXPORT.BTN_LABEL" :disabled="exporting" @click="exportAllMarkdown"><MiIcon name="download" /></button>
            <MiButton class="icon-only" variant="primary" icon="plus" :title="MEMO.NEW" :aria-label="MEMO.NEW" @click="create" />
          </div>
          <div class="pg-chips">
            <button
              v-for="c in CHIPS"
              :key="c.value"
              type="button"
              class="pg-chip"
              :class="{ active: kind === c.value }"
              :aria-pressed="kind === c.value"
              @click="kind = c.value"
            >
              {{ c.label }}
            </button>
          </div>

          <div v-if="rows.length > 0" class="memo-list" v-auto-animate>
            <button
              v-for="row in rows"
              :key="row.id"
              type="button"
              class="memo-row"
              :class="{ active: row.id === selectedId }"
              @click="pick(row.id)"
            >
              <MiIcon :name="row.kind === 'code' ? 'code' : 'lightbulb'" :size="14" />
              <span class="memo-row-body">
                <span class="memo-row-title">{{ row.title || MEMO.TITLE_PH }}</span>
                <span class="memo-row-sub">{{ memoSummary(row) || MEMO.BODY_PH }}</span>
              </span>
            </button>
          </div>
          <MiEmpty v-else v-bind="emptyState" sub-text="" size="s" />
        </aside>

        <div class="memo-main">
          <div v-if="selected" ref="editRef" class="memo-edit">
            <div class="memo-edit-head">
              <MiInput :model-value="selected.title" :placeholder="MEMO.TITLE_PH" :aria-label="MEMO.TITLE_PH" width="100%" @update:model-value="onTitle" />
              <button type="button" class="icon-btn" :class="{ active: selected.kind === 'code' }" :title="MEMO.KIND_CODE" :aria-label="MEMO.KIND_CODE" :aria-pressed="selected.kind === 'code'" @click="memo.setKind(selected.id, 'code')"><MiIcon name="code" /></button>
              <button type="button" class="icon-btn" :class="{ active: selected.kind === 'knowledge' }" :title="MEMO.KIND_KNOWLEDGE" :aria-label="MEMO.KIND_KNOWLEDGE" :aria-pressed="selected.kind === 'knowledge'" @click="memo.setKind(selected.id, 'knowledge')"><MiIcon name="lightbulb" /></button>
              <button type="button" class="icon-btn danger" :title="MEMO.DELETE" :aria-label="MEMO.DELETE" @click="deleteSelected"><MiIcon name="trash" /></button>
            </div>
            <MiInput :key="bodyKey" :model-value="selected.body" :placeholder="MEMO.BODY_PH" :aria-label="MEMO.BODY_PH" multiline :rows="18" width="100%" @update:model-value="onBody" />
            <span class="memo-size">{{ MEMO.SIZE(bodyKb) }}</span>
          </div>
          <MiEmpty v-else v-bind="EMPTY.MEMO_EMPTY" sub-text="" size="s" />
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.memo-page { display: flex; flex-direction: column; gap: var(--mi-sp-4); }
.memo-blank { padding-top: 40px; }
.memo-grid { display: grid; grid-template-columns: 270px minmax(0, 1fr); gap: var(--mi-sp-8); align-items: start; }
.memo-side { display: flex; flex-direction: column; gap: var(--mi-sp-2); min-width: 0; }
.memo-tools { display: flex; align-items: center; gap: var(--mi-sp-1); }
.memo-list { display: flex; flex-direction: column; gap: 1px; overflow-y: auto; max-height: calc(100vh - 250px); }
.memo-row { display: flex; gap: var(--mi-sp-2); width: 100%; padding: var(--mi-sp-2) var(--mi-sp-3); border: 0; border-radius: var(--radius-lg, 8px); background: transparent; color: var(--mi-text-3); text-align: left; cursor: pointer; font-family: var(--mi-font-family); box-sizing: border-box; }
.memo-row:hover { background: var(--cds-fill-ghost-hover); }
.memo-row.active { background: var(--mi-blue-light); }
.memo-row > .mi-icon { margin-top: 2px; }
.memo-row-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.memo-row-title { font-size: var(--mi-fs-label); font-weight: 500; color: var(--mi-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.memo-row-sub { font-size: var(--mi-fs-caption); color: var(--mi-text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.memo-main { min-width: 0; max-width: 760px; }
.memo-edit { display: flex; flex-direction: column; gap: var(--mi-sp-2); }
.memo-edit-head { display: flex; align-items: center; gap: 2px; }
.memo-edit-head > :first-child { flex: 1; min-width: 0; margin-right: var(--mi-sp-2); }
.memo-size { align-self: flex-end; font-size: var(--mi-fs-caption); color: var(--mi-text-3); }
@media (max-width: 860px) { .memo-grid { grid-template-columns: 1fr; } .memo-list { max-height: 200px; } }
</style>
