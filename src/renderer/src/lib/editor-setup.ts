/**
 * 代码编辑器的**配置层**：用什么语法、长什么样、有哪些公共能力，
 * 外加两条「组件里那点薄逻辑」的纯函数版（内容替换、焦点归还）。
 *
 * 【为什么和 CodeEditor.vue 分开】
 * 本项目的单测跑在纯 node 环境（无 DOM），而挂载 `EditorView` 必须有 DOM。
 * 把配置抽出来，语法映射和配色就能被机器验证；组件本身只剩
 * 「挂载 + 把改动同步回 v-model」这点薄逻辑，看一遍就不会错。
 *
 * 【配色与正文代码块的关系】
 * 这里定的色值应当与 `styles/md.css` 里课文代码块的 hljs 配色保持一致——
 * 用户在课文里看到的蓝绿紫，进了练习场还是那套颜色，认知不用重新建立。
 * （M3-01 的遗留问题已经补完，md.css 现在有 hljs 配色了，两边是同一套值，
 *   由 code-color.test.ts 直接 import 下面那份清单来盯着，见该文件。）
 */

import type { Extension } from '@codemirror/state'
import { EditorState } from '@codemirror/state'
import {
  EditorView,
  crosshairCursor,
  drawSelection,
  dropCursor,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  highlightTrailingWhitespace,
  keymap,
  lineNumbers,
  rectangularSelection
} from '@codemirror/view'
import { HighlightStyle, bracketMatching, foldGutter, foldKeymap, indentOnInput, syntaxHighlighting } from '@codemirror/language'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { tags } from '@lezer/highlight'
import { cpp } from '@codemirror/lang-cpp'
import { java } from '@codemirror/lang-java'
import { python } from '@codemirror/lang-python'
import { LANG_OF_CODE } from '../../../shared/types'
import type { LangOfCode } from '../../../shared/types'

// ──────────────────────────────────────────────────────────── 语法

/**
 * 编辑器支持的语言，直接引用 shared 的那份唯一真源。
 *
 * 这里**故意不再自己写一遍**。以前是手写的四个字符串，靠一条单测
 * 盯着它和 LANG_DISPLAY 对得上；但「两份列表 + 一条测试」不如
 * 「一份列表」可靠——测试会在 CI 里抓到漂移，却拦不住有人在本地
 * 图省事只改一处。引用过来，漂移这件事从源头就不存在了。
 * （真正的风险仍是「语言加了但没配语法」，那由 languageExtension 的
 * never 穷尽检查兜着，漏了直接编译不过。）
 */
export const EDITOR_LANGS: readonly LangOfCode[] = LANG_OF_CODE

/** 语言 → CodeMirror 语法扩展 */
export function languageExtension(lang: LangOfCode): Extension {
  switch (lang) {
    // 没有独立的 C 语法包（@codemirror/lang-cpp 只导出 cpp）。
    // 不影响使用：C 是 C++ 的子集，关键字、注释、字符串的着色完全一致。
    case 'c':
    case 'cpp':
      return cpp()
    case 'java':
      return java()
    case 'python':
      return python()
    default: {
      // 穷尽性检查：LangOfCode 加了新语言而这里没跟上，编译期就会红。
      // 消息用英文——这是给开发者看的崩溃信息，不是面向用户的文案（同 main 进程惯例）。
      const never: never = lang
      throw new Error(`no syntax highlighting configured for lang: ${String(never)}`)
    }
  }
}

// ──────────────────────────────────────────────────────────── 编辑体验

/**
 * 与语言无关的固定扩展。**不含语法扩展**——语法要能中途换，
 * 由组件用 `Compartment` 单独装，换语言时不必重建整个编辑器
 * （重建会丢掉撤销历史，用户刚写的代码一换语言就撤不回来了）。
 *
 * @param onDocChanged 文档变化回调。只在**用户真的敲了东西**时触发，
 *                     程序自己改内容（如载入示例代码）不会回调——
 *                     不这么分，双向绑定会自己咬自己尾巴，陷入死循环。
 */
export function baseEditorExtensions(onDocChanged: (doc: string) => void): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightSpecialChars(),
    // 折叠功能对初学长代码有用，但默认收起会让人以为「代码不见了」，只留箭头
    foldGutter({ openText: '▾', closedText: '▸' }),
    history(),
    // 闪烁节奏沿用 1500ms（比默认 1200ms 稍慢），与光标形状无关，未改。
    drawSelection({ cursorBlinkRate: 1500 }),
    dropCursor(),
    EditorState.allowMultipleSelections.of(true),
    indentOnInput(),
    bracketMatching(),
    // 自动补右括号。零基础用户忘写 `}` 是第一大错，补上能省掉大量挫败感。
    // CodeMirror 自带「再打一次右括号就跳过」的处理，不会写出 `}}`。
    closeBrackets(),
    rectangularSelection(),
    crosshairCursor(),
    highlightActiveLine(),
    // 行尾多余空格看不见，但交作业时会被打回，标出来
    highlightTrailingWhitespace(),
    // 长行折行显示。不折的话，一行长代码会顶出一条横向滚动条，
    // 新手根本想不到要往右拖，只会觉得「后面被截掉了」。
    EditorView.lineWrapping,
    keymap.of([
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...historyKeymap,
      ...foldKeymap,
      indentWithTab
    ]),
    EditorView.updateListener.of((u) => {
      if (u.docChanged) onDocChanged(u.state.doc.toString())
    })
  ]
}

// ──────────────────────────────────────────────────────────── 外部改内容

/** CodeMirror 的替换指令：把 `[from, to)` 换成 `insert` */
export interface DocChange {
  from: number
  to: number
  insert: string
}

/**
 * 把「旧文本 → 新文本」算成**尽量小的一次替换**，而不是整篇重写。
 *
 * 【为什么不能整篇重写 —— 2026-09-13 主人报的「光标乱跳」】
 * CodeMirror 对每次替换都会把**光标和选区按位置映射**过去，落点取决于
 * 光标落在替换段的哪个位置。整篇重写（from:0, to:全文）时实测结果：
 *
 *   光标在文首      0   → 0    （碰巧没事，看不出来）
 *   光标在**文档中间** 9   → **0**  ← 被甩回文首，这就是「跳」
 *   光标在文末      35  → 35   （碰巧没事：位置正好等于 to）
 *   选区 0..9          → 塌缩成 0        （选区整个没了）
 *   选区 20..32        → 变成「文末→文首」的反向选区
 *
 * 规律是「位置 ≥ to 的才活得下来」。而人写代码时光标**绝大多数时候在
 * 文档中间**（正在敲的那一行），所以这一跳是常态、不是偶发。
 * 换成最小替换后，只有真正变了的那一小段会被动，光标只要不在那一段里
 * 就原地不动（在里面也会被合理地推到改动之后，不会乱飞）。
 * （上面那张表是实测的，钉在 editor-setup.test.ts 的「最小替换」那组里，
 *   改这里之前先去跑一遍那组测试。）
 *
 * 实现就是最朴素的「掐掉公共前缀和公共后缀」——不需要真正的 diff：
 * 我们只要求「没变的别动」，不需要「改动最少」，前缀后缀足够覆盖
 * 实际会遇到的场景（补一个字符、改一行、尾部追加）。
 */
export function minimalChange(oldText: string, newText: string): DocChange {
  const oldLen = oldText.length
  const newLen = newText.length

  // 公共前缀
  let prefix = 0
  const maxPrefix = Math.min(oldLen, newLen)
  while (prefix < maxPrefix && oldText.charCodeAt(prefix) === newText.charCodeAt(prefix)) prefix++

  // 公共后缀（不能伸进前缀里，否则两边会重叠着数同一段）
  let suffix = 0
  const maxSuffix = Math.min(oldLen, newLen) - prefix
  while (suffix < maxSuffix && oldText.charCodeAt(oldLen - 1 - suffix) === newText.charCodeAt(newLen - 1 - suffix)) {
    suffix++
  }

  // 别把 emoji 这类字符从中间切开：CodeMirror 的位置是 UTF-16 码元，
  // 切在高低代理之间会把它拆成两个半个字符（显示成乱码方块）。
  // 代价只是改动段多含一个字符，不心疼。
  if (prefix > 0 && isLowSurrogate(newText.charCodeAt(prefix))) prefix--
  if (suffix > 0 && isHighSurrogate(oldText.charCodeAt(oldLen - suffix))) suffix--

  return { from: prefix, to: oldLen - suffix, insert: newText.slice(prefix, newLen - suffix) }
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff
}

// ──────────────────────────────────────────────────────────── 焦点

/** 用户此刻正把光标放在哪儿 —— 从 document.activeElement 上取下来的那两个字段 */
export interface ActiveTarget {
  /** 标签名，大写，如 `BODY` / `INPUT` / `BUTTON`。取不到时传空串 */
  tagName: string
  /** 是不是一个可编辑区域（contenteditable） */
  editable: boolean
}

/**
 * 跑完了，该不该把焦点**抢**回编辑器？
 *
 * 【为什么需要这条规则 —— 2026-09-13 已确认的真实缺陷】
 * 点「运行」后编译器会把编辑器整个切成只读（contentEditable 从 true 变 false），
 * 浏览器在这一刻会把焦点踢出去，落在 `<body>` 上。跑完解锁时焦点**不会自动回来**，
 * 于是主人跑完代码顺手按 Ctrl+A，CodeMirror 根本收不到键盘事件 ——
 * 表现就是「全选没反应」。所以要主动还回去。
 *
 * 【为什么不能无条件抢】
 * 跑得快的时候（比如 Hello World 几毫秒就跑完），主人可能已经点进了输入框
 * 在敲这次的输入，或者点进了设置页的文本框。这时候把焦点抢走，是**在人家
 * 打字打到一半时把光标抽走**——比不还焦点还恶劣。所以规则是：
 * 只有当焦点**没落在任何一个能打字的地方**时才还。
 *
 * 注意 `editable` 那条同样重要：编辑器自己要是还留着焦点（CodeMirror 有时候
 * 不会丢），再 focus() 一次会把用户刚拖出来的选区给清掉。
 */
export function shouldRestoreFocus(active: ActiveTarget | null): boolean {
  if (!active) return true
  // 原生输入控件：用户在打字，别碰
  if (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT') return false
  // 任何 contenteditable（含编辑器自己）：用户已经在一个可编辑的地方了，别动
  if (active.editable) return false
  return true
}

// ──────────────────────────────────────────────────────────── 外观

/**
 * 主题的样式表本体。单独导出**只为可测**——
 * `EditorView.theme()` 的返回值是个不透明对象，单测没法检查里面写了什么，
 * 而「`.cm-content` 必须把 user-select 改回 text」这种事一旦漏掉，
 * 表现是「编辑器里选不中字、复制粘贴全废」，不报错、要人来点才发现。
 */
export const miEditorThemeSpec = {
  '&': {
    height: '100%',
    fontSize: '13px',
    fontFamily: 'var(--mi-code)',
    color: 'var(--mi-text)',
    backgroundColor: 'var(--mi-bg)'
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-scroller': { fontFamily: 'var(--mi-code)', lineHeight: '1.7', overflow: 'auto' },
  '.cm-content': {
    padding: '10px 0',
    // ⚠️ tokens.css 给 body 设了 user-select:none（防止界面文字被误选），
    // 不在这里改回来的话，编辑器里的代码**一个字都选不中**——复制粘贴全废。
    userSelect: 'text',
    WebkitUserSelect: 'text'
  },
  '.cm-gutters': {
    backgroundColor: 'var(--mi-card)',
    color: 'var(--mi-text-3)',
    border: 'none',
    borderRight: '1px solid var(--mi-border)'
  },
  '.cm-activeLine': { backgroundColor: 'var(--mi-blue-light)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--mi-blue-light)', color: 'var(--mi-text-2)' },
  /*
   * 插入符 = 标准细竖线（2026-10-28 主人要求改回普通光标）。
   *
   * 基础主题给这两个类的是 `border-left: 1.2px solid black`；这里换成 1.5px
   * 的令牌色（跟随浅/暗主题），并把之前那条小鱼干背景图清成 none。
   * 负 marginLeft 是半个边宽，让竖线正好骑在字符边界上，不偏左一位。
   *
   * `.cm-dropCursor` 是拖拽文本时跟着鼠标的落点指示器，与插入符同款，两处一致。
   */
  '.cm-cursor, .cm-dropCursor': {
    borderLeft: '1.5px solid var(--mi-text)',
    marginLeft: '-0.75px',
    background: 'none'
  },
  /* 闪烁走 CodeMirror 默认的 cm-blink（普通编辑器的硬切闪灭），不再自定义呼吸。 */
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'var(--mi-blue)'
  },
  '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': {
    backgroundColor: 'var(--mi-blue-light)',
    outline: '1px solid var(--mi-blue-deep)'
  },
  '.cm-foldPlaceholder': { backgroundColor: 'var(--mi-blue-light)', border: 'none', color: 'var(--mi-text-2)' }
} as const

/**
 * 编辑器主题（应用只有浅色，2026-11-13 起）。色值一律走 tokens.css 的 CSS 变量，
 * 改配色只改令牌 —— spec 里没有一个颜色字面量（有一条单测钉着这件事）。
 */
export const miEditorTheme = (): Extension => EditorView.theme(miEditorThemeSpec)

/**
 * 语法着色。柔和、低饱和，与 docs/04「避免工业感、极客感」一致——
 * 高饱和的 IDE 默认配色（亮红亮绿）在浅蓝底上会显得刺眼。
 *
 * 写成 `[标签名, 色值]` 的扁平清单是为了可测：单测直接读这份数组做断言，
 * 而不是去正则扒 `HighlightStyle.define()` 的返回值（那玩意儿同样不透明）。
 *
 * ── 2026-09-14：整套往深里压了一档 ───────────────────────────────
 * 【为什么】原来这 8 个色是按**白底**挑的，压在代码块底 (--mi-code-bg #eaf1f9)
 * 上全都不达标：字符串 2.96、数字 2.55、注释 2.13、关键字 3.85……全在 4.5 线下。
 * 主人在验收时点了出来：「代码语法配色，既然对比度偏低，请一并统一修复。」
 *
 * 【怎么压的】**沿各自的色相往深里走，停在刚好过线的地方**——
 * 色相一个都没变，所以「紫的是关键字、绿的是字符串、橙的是数字」这套直觉
 * 原封不动，只是颜色深了一档。取色按**代码块底**算（一个语法色会压在
 * 代码块 / 编辑器白 / 当前行高亮三种底上，代码块那个最暗），过了它就全过。
 *
 * 唯一的例外是**运算符：它特意多深一档（按 6.0 取，其余按 4.5）**。
 * 原因很实际——注释和运算符原本是一深一浅两支灰（#9aa8b8 / #6b7a8c），
 * 可两条都压到 4.5 之后会**落到同一个明度上**（都是 L≈0.44、色相差 1°），
 * 那就成了同一个颜色，代码里「这是注释」和「这是加号」会分不出来。
 * 让运算符多深一档把这层关系恢复回来（方向也和改之前一致：注释比运算符浅）。
 *
 * 【怎么验】改完做过两件事：① 8 个色两两查「会不会撞」——判据是
 * **色相接近 且 明度接近 且 饱和度也接近**（三条同时成立才算撞；
 * 只看对比度是错的，那量的只是明暗差，紫和绿同明度照样一眼分得开）；
 * ② 在真窗口里把每一处的实测值读回来。取色脚本见 `<workspace>/_fix-colors.mjs`（不随仓库分发）。
 *
 * 【改配色时的连带改动】这份清单是**唯一真源**，md.css 和测试都跟着它走：
 * 色值改了这里，md.css 里那 8 组规则要同步（`npm test` 会红着提醒你），
 * 测试那份是 import 不是复印件。
 *
 */
export const MI_TOKEN_COLORS: readonly { tag: string; color: string }[] = [
  // 注释里那个数字 = 压在代码块底 #eaf1f9 上的对比度
  { tag: 'keyword', color: '#8b47b5' }, // 5.03
  { tag: 'string', color: '#257b54' }, // 4.57
  { tag: 'number', color: '#9a6024' }, // 4.51
  { tag: 'comment', color: '#5d6f84' }, // 4.53
  { tag: 'function', color: '#296fb6' }, // 4.54
  { tag: 'variableName', color: '#2d3a4a' }, // 10.11
  { tag: 'typeName', color: '#0d797b' }, // 4.55
  { tag: 'propertyName', color: '#296fb6' }, // 与 function 同色（故意的）
  { tag: 'operator', color: '#505b69' }, // 6.07 —— 特意和注释拉开
  { tag: 'meta', color: '#5d6f84' } // 与 comment 同色（#include 整条当注释看）
  // 压在编辑器「当前行高亮」#e6f1fd 上还要再低一点点（最狠 4.51），已经算进去了。
] as const

/** 标签名 → 色值，供上面的清单和 HighlightStyle 共用，避免两处各写一遍 */
const colorOf = (name: string): string => {
  const hit = MI_TOKEN_COLORS.find((c) => c.tag === name)
  if (!hit) throw new Error(`unknown token color: ${name}`)
  return hit.color
}

export const miHighlightStyle = (): Extension =>
  syntaxHighlighting(
    HighlightStyle.define([
      { tag: tags.keyword, color: colorOf('keyword') },
      { tag: [tags.string, tags.special(tags.string)], color: colorOf('string') },
      { tag: [tags.number, tags.bool, tags.null], color: colorOf('number') },
      {
        tag: [tags.comment, tags.lineComment, tags.blockComment],
        color: colorOf('comment'),
        fontStyle: 'italic'
      },
      { tag: [tags.function(tags.variableName), tags.labelName], color: colorOf('function') },
      { tag: [tags.definition(tags.variableName), tags.variableName], color: colorOf('variableName') },
      { tag: [tags.typeName, tags.className, tags.namespace], color: colorOf('typeName') },
      { tag: [tags.propertyName, tags.attributeName], color: colorOf('propertyName') },
      { tag: [tags.operator, tags.punctuation, tags.bracket], color: colorOf('operator') },
      { tag: tags.meta, color: colorOf('meta') }
    ])
  )
