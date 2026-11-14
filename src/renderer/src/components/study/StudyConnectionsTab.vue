<script setup lang="ts">
// 「模型」页签与设置 → AI 助教共用同一个 Provider 列表（docs/30 §1.2）
import ProviderList from '../domain/ProviderList.vue'
</script>

<template>
  <div class="study-connections-pane pg">
    <ProviderList />
  </div>
</template>

<style scoped>
.study-connections-pane { max-width: 760px; }
</style>
