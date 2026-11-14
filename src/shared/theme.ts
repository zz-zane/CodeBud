/**
 * 原生层颜色常量（窗口底色、顶栏按钮符号色）。应用只有浅色主题（2026-11-13 起移除暗色）。
 *
 * 【为什么这个文件非存在不可】
 * `BrowserWindow` 的 `backgroundColor` 与 `titleBarOverlay.symbolColor` 是**原生层**的东西，
 * 由 Chromium / 系统在渲染进程还没来得及画之前直接刷上去。而主进程**读不到 CSS 变量**
 * —— `tokens.css` 里的 `--mi-text` 对它来说是一个不存在的字符串。
 *
 * 于是同一件事有了两个真源：CSS 一份、这里一份。**这是本项目最忌讳的形状**
 * （`md.ts:48-58` 记着一次真实事故就是「同一件事两个判据，出错了两边都不报」）。
 * 所以配了一条单测把两边钉死：`src/shared/__tests__/theme.test.ts` 会去读 CSS，
 * 把这两个值逐一抠出来逐字比对。**CSS 改了而这里没改，测试会红。**
 */

/**
 * 窗口底色 = 浅色的 `--mi-shell-canvas`（cds-adapter.css）。
 *
 * 【它到底在什么时候能被看见 —— 别指望它「防止白屏」】
 * 窗口是 `show: false` + `ready-to-show` 才显形的，所以**开屏那一下本来就看不见白屏**：
 * 等窗口显出来时，渲染进程早就把第一帧画完了。真正会用到它的是**调窗口大小的时候**：
 * 拖动边框变宽，新露出来的那一条区域在 Chromium 补上内容之前，是**由原生层直接刷底色的**。
 */
export const WINDOW_BG = '#f9f9f7'

/**
 * 顶栏 Window Controls Overlay 按钮符号（最小化 / 最大化 / 关闭）的颜色 ——
 * `titleBarOverlay.symbolColor` 的取值。三个按钮是系统画的，不认 CSS 变量；
 * 取值 = `tokens.css` 的 `--mi-text`（顶条标题文字用的就是它）。
 */
export const TITLE_SYMBOL_COLOR = '#151515'
