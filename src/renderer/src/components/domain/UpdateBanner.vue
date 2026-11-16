<script setup lang="ts">
import { useUpdateStore } from '../../stores/update'
import { SETTINGS } from '../../lib/copy'
import MiButton from '../base/MiButton.vue'

const update = useUpdateStore()
</script>

<template>
  <div v-if="update.showBanner && update.readyVersion" class="update-banner" role="status">
    <span class="update-dot" aria-hidden="true" />
    <span class="update-text">{{ SETTINGS.updateBanner(update.readyVersion) }}</span>
    <MiButton variant="ghost" size="sm" @click="update.dismissBanner()">
      {{ SETTINGS.UPDATE_LATER_BTN }}
    </MiButton>
    <MiButton variant="primary" size="sm" @click="update.install()">
      {{ SETTINGS.UPDATE_RESTART_BTN }}
    </MiButton>
  </div>
</template>

<style scoped>
.update-banner {
  display: flex;
  align-items: center;
  gap: var(--mi-sp-3);
  padding: 10px var(--mi-sp-3) 10px var(--mi-sp-4);
  background: var(--mi-blue-light);
  border: 1px solid var(--mi-border);
  border-radius: var(--mi-radius-lg);
}
.update-dot {
  width: 8px;
  height: 8px;
  border-radius: 4px;
  background: var(--mi-blue-deep);
  flex: none;
}
.update-text {
  flex: 1;
  min-width: 0;
  font-size: var(--mi-fs-body);
  color: var(--mi-text);
}
</style>
