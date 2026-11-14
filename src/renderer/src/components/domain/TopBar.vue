<script setup lang="ts">
/**
 * 顶条 —— Window Controls Overlay 的「网页部分」。
 *
 * 【它为什么存在 —— 2026-10-05 主人工单】
 * 改造前顶上那条是**系统画的标题栏**：原生白/深底，不受「UI 面板不透明度」
 * 控制，拉低透明度时它依旧实色挡着壁纸，极其突兀。现在窗口开了
 * `titleBarStyle: 'hidden'`（见 src/main/index.ts 的 createWindow）——
 * 整窗都是网页内容，系统只把三个窗口按钮以**悬浮层**画在右上角。
 * 于是「顶条长什么样」回到我们手里：一条玻璃条，和卡片/两栏吃**同一个**
 * `--mi-card-glass`（已进 wall-glass.test.ts 的 IN 清单，受「UI 面板不透明度」
 * 统一控制；壁纸关时它恒等实色 `--mi-card`，零残留）。
 *
 * 【三条边界，改这个文件前先读】
 * ① 只让**背景**透。标题文字是实色的（硬底线「字永远实心」对顶条同样成立）；
 *    三个窗口按钮的符号色是原生层画的，由主进程 setTitleBarOverlay 喂
 *    `--mi-text` 同款颜色（shared/theme.ts 的 TITLE_SYMBOL_COLOR）。
 * ② **绝不能拦点击**：整条是 `-webkit-app-region: drag` 的拖拽区。Chromium
 *    对 WCO 的处理是「原生按钮永远先命中，其余区域才轮到拖拽/网页」——
 *    所以本组件里**不许放任何按钮/链接**：真放了它会被拖拽区吃掉点击
 *    （表现为「点了没反应、还把窗口拖走了」）。验证这一条只能靠真实输入
 *    注入点「最小化」自证（CDP 的合成事件到不了原生层），别用 DOM click 骗自己。
 * ③ 高度用 `--mi-topbar-h`（tokens.css 定义 = `env(titlebar-area-height, 33px)`，
 *    WCO 活跃时是系统给的真空高、含 DPI 缩放）。**不要在这里另写 env() 兜底**：
 *    `.layout` 的 padding-top 和这里必须吃同一个变量，两边各写一遍迟早对不上。
 */
</script>

<template>
  <!--
    纯拖拽条：不画任何文字/交互元素（边界②）。2026-10-28 主人要求去掉可见
    应用名 —— 窗口标题仍由原生标题栏/任务栏给出，这里只是拿回透明背景。
  -->
  <div class="topbar" aria-hidden="true" />
</template>

<style scoped>
/*
 * left 从侧栏右缘起算：侧栏是贴边整列、从窗口最上沿开始画，
 * 顶栏若仍横跨整宽会把侧栏顶上那 30px 盖住，右缘的竖线在那里断掉。
 */
.topbar {
  position: fixed;
  top: 0;
  left: var(--mi-topbar-inset, var(--mi-sidebar-w));
  right: 0;
  height: var(--mi-topbar-h);
  display: flex;
  align-items: center;
  padding: 0 var(--mi-sp-3);
  /*
   * ── 雾化 ────────────────────────────────────────────────────────────
   * 要的效果：正文滚到顶条下面时，被顶条**模糊掉**，只剩柔和色块 ——
   * 看得出"下面还有内容"，但读不出字。这全靠 backdrop-filter，
   * 和"页面本身看起来发雾"是两回事。
   *
   * 【三条参数都在 tokens.css】alpha / blur / saturate 由
   * --mi-topbar-alpha / --mi-topbar-blur / --mi-topbar-saturate 给，
   * cds-adapter 的浅色规则读同一组（早先那里写死 78%，改了不生效就是这么来的）。
   *
   * 【没有底边线】早先有一条 1px inset 阴影/边框，那是「顶条与画布分开」的做法；
   * 这里要的是**连成一片**，只在有内容经过时才显出玻璃，所以一道线都不要。
   */
  /* 底色取 --mi-canvas（主页面那个色），不是 --mi-card —— 顶条要和页面同色，
     用 card 会在浅色下比页面白一档，顶部显出一条横色带。 */
  background: color-mix(in srgb, var(--mi-canvas) var(--mi-topbar-alpha), transparent);
  -webkit-backdrop-filter: blur(var(--mi-topbar-blur)) saturate(var(--mi-topbar-saturate));
  backdrop-filter: blur(var(--mi-topbar-blur)) saturate(var(--mi-topbar-saturate));
  /* 整条拖拽区。原生按钮不吃这个（它们在原生层先命中）—— 见头注释边界② */
  -webkit-app-region: drag;
  /*
   * 60：高于分隔条(1)/ZoomControl(50)，低于两侧开合按钮(100)与一切浮层
   * (MiTooltip 8000 / MiModal 9000 / SearchPanel 9500 / MiToast 9999)。
   * 浮层盖住顶条是刻意的（弹窗打开时它就是最上层）；
   * ⚠️ 但拖拽区是**布局命中**、不随绘制被「盖住」—— 弹窗开着时顶条
   * 仍然可拖窗（和原生标题栏的行为一致，勿当 bug 修）。
   */
  z-index: 60;
}

/*
 * 不支持 backdrop-filter 时退回实色：半透明但不模糊，底下的内容会直接穿透，
 * 比实色更难读。这是「宁可没有雾化，也要能看清」的退让。
 *
 * 【为什么要!important】顶栏那条规则在 cds-adapter.css 里：
 * `:root:root #app .claude-app-container .topbar` ——
 * 特异性 0-3-1，远高于这里的 `.topbar`（0-1-0）。不加 !important，
 * 降级会被它整个盖掉，等于不存在（截图里浅色下顶栏仍是半透明没模糊）。
 * 用 scoped 提特异性很难稳定超过它（它带了 :not + 两层 id/class），
 * 而这是**唯一**合理的处断点，!important 在这里是有理由的。
 */
@supports not ((-webkit-backdrop-filter: blur(1px)) or (backdrop-filter: blur(1px))) {
  .topbar {
    background: var(--mi-shell-canvas, var(--mi-card)) !important;
    box-shadow: none !important;
  }
}

</style>
