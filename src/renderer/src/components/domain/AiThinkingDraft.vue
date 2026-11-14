<script setup lang="ts">
import { AI_ASSISTANT } from '../../lib/copy'
</script>

<template>
  <!-- 回复开始前的占位：一段正在起笔的代码草稿。第一个字到达时由正文在同一位置接手 -->
  <div class="thinking-draft" role="status" :aria-label="AI_ASSISTANT.THINKING" :title="AI_ASSISTANT.THINKING">
    <span class="seg seg-1 keyword" />
    <span class="seg seg-2" />
    <span class="seg seg-3 keyword" />
    <span class="seg seg-4" />
    <span class="seg seg-5" />
    <span class="caret mi-motion-keep" />
  </div>
</template>

<style scoped>
/*
 * 一轮 3.4 秒。百分比按游标走过的横向距离算，语法块的生长和游标同步：
 *   0–25% 第一行 / 27–47% 第二行 / 49–67% 第三行 / 67–84% 停笔闪烁 / 84–95% 淡出
 * 淡出用 background-color 而不是 opacity：全库 opacity 声明数有快照闸门（wall-glass.test.ts）。
 */
.thinking-draft {
  --cycle: 3.4s;
  --seg-plain: color-mix(in srgb, var(--mi-text-3) 38%, transparent);
  --seg-keyword: color-mix(in srgb, var(--mi-blue-deep) 55%, transparent);
  position: relative;
  width: 62px;
  height: 34px;
  margin: var(--mi-sp-2) 0;
}
.seg {
  --seg: var(--seg-plain);
  position: absolute;
  height: 6px;
  border-radius: 3px;
  background-color: var(--seg);
  transform-origin: left center;
  animation-duration: var(--cycle);
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}
.keyword { --seg: var(--seg-keyword); }
/* keyframe 名必须直接写在 animation-name 上：scoped 编译只改写这里，放进 CSS 变量会失效 */
.seg-1 { animation-name: draft-seg-1, draft-vanish; left: 0; top: 0; width: 18px; }
.seg-2 { animation-name: draft-seg-2, draft-vanish; left: 24px; top: 0; width: 36px; }
.seg-3 { animation-name: draft-seg-3, draft-vanish; left: 12px; top: 14px; width: 28px; }
.seg-4 { animation-name: draft-seg-4, draft-vanish; left: 46px; top: 14px; width: 12px; }
.seg-5 { animation-name: draft-seg-5, draft-vanish; left: 12px; top: 28px; width: 46px; }
/* 没有动画时停在最后一行行尾，语法块保持写完的样子（减弱动效时用） */
.caret {
  position: absolute;
  left: 60px;
  top: 25px;
  width: 2px;
  height: 12px;
  border-radius: 1px;
  background-color: var(--mi-blue-deep);
  animation: draft-caret-move var(--cycle) linear infinite, draft-caret-blink var(--cycle) linear infinite;
}

@keyframes draft-seg-1 { 0% { transform: scaleX(0); } 7.5%, 100% { transform: scaleX(1); } }
@keyframes draft-seg-2 { 0%, 10% { transform: scaleX(0); } 25%, 100% { transform: scaleX(1); } }
@keyframes draft-seg-3 { 0%, 27% { transform: scaleX(0); } 39%, 100% { transform: scaleX(1); } }
@keyframes draft-seg-4 { 0%, 42% { transform: scaleX(0); } 47%, 100% { transform: scaleX(1); } }
@keyframes draft-seg-5 { 0%, 49% { transform: scaleX(0); } 67%, 100% { transform: scaleX(1); } }
@keyframes draft-vanish {
  84% { background-color: var(--seg); }
  95%, 100% { background-color: transparent; }
}
/* 基准位置在 (60, 25)，这里写相对位移。行与行之间瞬移，像换行 */
@keyframes draft-caret-move {
  0% { transform: translate(-60px, -28px); }
  25% { transform: translate(0, -28px); }
  25.01%, 27% { transform: translate(-48px, -14px); }
  47% { transform: translate(-2px, -14px); }
  47.01%, 49% { transform: translate(-48px, 0); }
  67%, 95% { transform: translate(-2px, 0); }
  95.01%, 100% { transform: translate(-60px, -28px); }
}
@keyframes draft-caret-blink {
  0%, 70% { background-color: var(--mi-blue-deep); }
  70.01%, 74% { background-color: transparent; }
  74.01%, 78% { background-color: var(--mi-blue-deep); }
  78.01%, 82% { background-color: transparent; }
  82.01%, 84% { background-color: var(--mi-blue-deep); }
  95%, 100% { background-color: transparent; }
}
@keyframes draft-caret-still-blink {
  0%, 50% { background-color: var(--mi-blue-deep); }
  50.01%, 100% { background-color: transparent; }
}

/* 减弱动效：草稿静止，只留游标闪烁。停住的加载指示和卡死长得一样（见 styles/motion.css） */
@media (prefers-reduced-motion: reduce) {
  .caret { animation: draft-caret-still-blink 1.6s linear infinite; }
}
</style>
