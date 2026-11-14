<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useRunnerStore } from '../../stores/runner'
import { toast } from '../base/toast'
import { isRemote } from '../../lib/asset-base'
import { LANG_LABEL } from '../../lib/labels'
import { CODE_BLOCK, COMPARE, TOAST } from '../../lib/copy'
import { hasRunnableEntry, type CompareBlock } from '../../lib/md'
import type { LangOfCode } from '../../../../shared/types'

// M3-02：四语言对比网格（compare 块渲染组件，列头带 复制/运行试试）
// P1-6：入门课里默认折叠，标成「拓展」
const props = withDefaults(
  defineProps<{
    blocks: CompareBlock[]
    readOnly?: boolean
    defaultCollapsed?: boolean
  }>(),
  { readOnly: false, defaultCollapsed: false }
)

const collapsed = ref(props.defaultCollapsed)

function toggleCollapse() {
  collapsed.value = !collapsed.value
}

const runner = useRunnerStore()
const remote = isRemote() // 手机上不显示运行入口（docs/29 §3.5）
const router = useRouter()
const copiedKey = ref<string | null>(null)

async function copyCode(text: string, key?: string) {
  let ok = false
  try {
    await navigator.clipboard.writeText(text)
    ok = true
  } catch {
    // 旧式回退：file:// 等环境 clipboard API 不可用时用 execCommand
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      ok = document.execCommand('copy')
      document.body.removeChild(ta)
    } catch {
      ok = false
    }
  }
  if (ok) {
    toast(TOAST.CODE_COPIED, 'success')
    if (key) {
      copiedKey.value = key
      setTimeout(() => {
        if (copiedKey.value === key) copiedKey.value = null
      }, 1500)
    }
  } else {
    toast(TOAST.COPY_FAILED, 'error')
  }
}

/**
 * 「运行试试」：把这一列的代码装进练习场，然后跳过去。
 *
 * 【为什么要跳页，而不是就地弹个窗口跑】
 * 就地方便，但结果只活在那一个小浮层里——用户看完就没了，也没法改一行再跑，
 * 而「改一行再跑」正是学编程最重要的那个动作。跳到练习场，代码就在编辑器里，
 * 想怎么折腾都行。
 *
 * 【为什么先 toast 再跳】
 * 跳页之后画面整个变了，用户容易以为自己点错了。这句提示立刻告诉他
 * 「是我把你带过来的，代码已经放好了」，并且说清了下一步该点「运行」。
 * toast 挂在全局（App.vue 的 MiToast），不会因为换页被切掉。
 */
function runTry(lang: string, code: string) {
  if (lang !== 'c' && lang !== 'cpp' && lang !== 'java' && lang !== 'python') return
  runner.setCode(lang as LangOfCode, code)
  const autoRun = hasRunnableEntry(lang as LangOfCode, code) && !runner.running
  toast(autoRun ? TOAST.CODE_AUTO_RUN : TOAST.CODE_SENT_TO_PLAYGROUND, 'success')
  void router.push('/playground').then(() => { if (autoRun) void runner.run() })
}
</script>

<template>
  <div class="compare-section" :class="{ 'is-collapsed': collapsed }">
    <div
      class="compare-head"
      :class="{ 'is-toggleable': props.defaultCollapsed }"
      @click="props.defaultCollapsed ? toggleCollapse() : undefined"
    >
      <div class="compare-title">
        {{ props.defaultCollapsed ? COMPARE.TITLE_EXT : COMPARE.TITLE }}
      </div>
      <button
        v-if="props.defaultCollapsed"
        type="button"
        class="compare-toggle-btn"
        :aria-expanded="!collapsed"
        @click.stop="toggleCollapse"
      >
        {{ collapsed ? COMPARE.EXPAND : COMPARE.COLLAPSE }}
      </button>
    </div>
    <div v-show="!collapsed" v-for="(b, bi) in props.blocks" :key="bi" class="compare-grid">
      <div v-for="lang in b.langs" :key="lang" class="compare-col">
        <div class="compare-col-head">
          <span class="compare-col-lang">{{ lang }}</span>
          <div class="compare-col-actions">
            <button
              type="button"
              class="compare-copy-btn"
              :class="{ copied: copiedKey === `${bi}-${lang}` }"
              :title="CODE_BLOCK.COPY"
              :aria-label="CODE_BLOCK.COPY"
              @click="copyCode(b.code[lang], `${bi}-${lang}`)"
            >
              <svg v-if="copiedKey !== `${bi}-${lang}`" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
              <svg v-else viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </button>
            <button v-if="!props.readOnly && !remote" type="button" class="compare-run-btn" @click="runTry(lang, b.code[lang])">{{ CODE_BLOCK.RUN }}</button>
          </div>
        </div>
        <pre>{{ b.code[lang] }}</pre>
      </div>
    </div>
  </div>
</template>

<style scoped>
.compare-section {
  margin: var(--mi-sp-6) 0;
}
.compare-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--mi-sp-3);
}
.compare-head.is-toggleable {
  cursor: pointer;
  user-select: none;
}
.compare-title {
  font-family: var(--mi-font-title);
  font-size: var(--mi-fs-read);
  font-weight: 500;
  margin: 0;
}
.compare-toggle-btn {
  font-family: var(--mi-font-family);
  font-size: var(--mi-fs-caption);
  padding: 3px var(--mi-sp-3);
  border: 1px solid var(--mi-border);
  border-radius: var(--mi-radius-sm);
  background: var(--mi-card);
  color: var(--mi-text-2);
  cursor: pointer;
  transition:
    background var(--mi-dur-fast) var(--mi-ease),
    color var(--mi-dur-fast) var(--mi-ease);
}
.compare-toggle-btn:hover {
  background: var(--mi-blue-light);
  color: var(--mi-text);
}
.compare-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--mi-sp-3);
  margin-bottom: var(--mi-sp-3);
}
.compare-col {
  border: 1px solid var(--mi-border);
  border-radius: var(--mi-radius-sm);
  overflow: hidden;
  background: var(--mi-code-bg);
}
.compare-col-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--mi-sp-1) var(--mi-sp-3);
  background: var(--mi-card);
  border-bottom: 1px solid var(--mi-border);
}
.compare-col-lang {
  font-family: var(--mi-code);
  font-size: var(--mi-fs-caption);
  font-weight: 500;
  color: var(--mi-blue-ink);
  text-transform: uppercase;
}
.compare-col-actions {
  display: flex;
  align-items: center;
  gap: var(--mi-sp-1);
}
.compare-col-actions button {
  font-family: var(--mi-font-family);
  font-size: var(--mi-fs-caption);
  padding: 2px var(--mi-sp-2);
  border: 1px solid var(--mi-border);
  border-radius: 999px;
  background: var(--mi-bg);
  color: var(--mi-text-2);
  cursor: var(--mi-cursor, pointer);
  transition:
    background var(--mi-dur-fast) var(--mi-ease),
    color var(--mi-dur-fast) var(--mi-ease);
}
.compare-col-actions button:hover {
  background: var(--mi-blue-light);
  color: var(--mi-text);
}
.compare-col-actions .compare-copy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--mi-radius-sm);
  background: transparent;
  color: var(--mi-text-3);
}
.compare-col-actions .compare-copy-btn:hover {
  background: var(--mi-card);
  border-color: var(--mi-border);
  color: var(--mi-text);
}
.compare-col-actions .compare-copy-btn:focus-visible {
  outline: 2px solid var(--mi-blue-deep);
  outline-offset: 1px;
}
.compare-col-actions .compare-copy-btn.copied {
  color: var(--mi-success, #10b981);
}
.compare-col pre {
  margin: 0;
  padding: var(--mi-sp-3) var(--mi-sp-3);
  font-family: var(--mi-code);
  font-size: var(--mi-fs-caption);
  line-height: 1.7;
  overflow-x: auto;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}
</style>
