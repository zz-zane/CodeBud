<script setup lang="ts">
/**
 * 课文页右侧面板（精简为单 AI 壳，ROOT-PLAN-v1 §6）
 * 课程辅助功能已移入正文吸底两层操作栏与既有复习页；此处专用于课文+AI同屏对话。
 */
import AiPanel from './AiPanel.vue'
</script>

<template>
  <aside class="right-panel-container">
    <div class="ai-panel-wrapper">
      <AiPanel />
    </div>
  </aside>
</template>

<style scoped>
.right-panel-container {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--cds-surface-1);
  border: 1px solid var(--mi-border);
  border-radius: 14px;
  overflow: hidden;
  box-sizing: border-box;
}

.ai-panel-wrapper {
  flex: 1;
  height: 100%;
  overflow: hidden;
}
</style>
