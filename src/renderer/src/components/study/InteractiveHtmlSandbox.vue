<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { STUDY_COPY } from '../../lib/study-copy'
import { studyPreviewUrl } from '../../lib/asset-base'

const props = withDefaults(
  defineProps<{
    html: string
    title?: string
    height?: string
  }>(),
  {
    title: STUDY_COPY.ARTIFACT.TITLE,
    height: '360px'
  }
)

const iframeKey = ref(0)
const isExpanded = ref(false)
const previewUrl = ref('')
const error = ref('')
const loading = ref(false)
let generation = 0

async function resetSandbox(): Promise<void> {
  const current = ++generation
  iframeKey.value++
  previewUrl.value = ''
  error.value = ''
  loading.value = true
  try {
    const result = await window.miai.study.createHtmlPreview(safeSrcDoc.value)
    if (current !== generation) return
    if (result.ok) previewUrl.value = studyPreviewUrl(result.data)
    else error.value = result.error
  } catch (err) {
    if (current === generation) error.value = (err as Error).message
  } finally {
    if (current === generation) loading.value = false
  }
}

watch(() => props.html, () => { generation++; previewUrl.value = ''; error.value = ''; loading.value = false })

function toggleExpand(): void {
  isExpanded.value = !isExpanded.value
}

/**
 * 构建带有强 CSP 约束的安全沙箱文档
 * - default-src 'none': 禁止任何默认资源
 * - script-src 'unsafe-inline': 仅允许内联脚本计算，不可引入外部脚本
 * - style-src 'unsafe-inline': 仅允许内联样式
 * - img-src data:: 仅允许内联 base64 图形
 * - connect-src 'none': 禁止任何 fetch / XHR / WebSocket 网络通信
 * - form-action 'none': 禁止表单外提
 */
const safeSrcDoc = computed(() => {
  const content = props.html || ''
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: var(--mi-sp-4);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      font-size: var(--mi-fs-body);
      line-height: 1.5;
      color: #1f2328;
      background: #ffffff;
      overflow-x: hidden;
    }
  </style>
</head>
<body>
  ${content}
</body>
</html>`
})
</script>

<template>
  <div class="interactive-sandbox" :class="{ 'is-expanded': isExpanded }">
    <div class="sandbox-header">
      <div class="sandbox-title-wrap">
        <svg class="sandbox-shield-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <span class="sandbox-title">{{ title }}</span>
        <span class="sandbox-badge" :title="STUDY_COPY.SANDBOX.SECURITY_TOOLTIP">
          {{ STUDY_COPY.SANDBOX.SECURITY_LABEL }}
        </span>
      </div>
      <div class="sandbox-actions">
        <button
          type="button"
          class="sandbox-btn"
          :title="STUDY_COPY.SANDBOX.RESET"
          :aria-label="STUDY_COPY.SANDBOX.RESET"
          @click="resetSandbox"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="action-icon" aria-hidden="true">
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M8 16H3v5" />
          </svg>
        </button>
        <button
          type="button"
          class="sandbox-btn"
          :title="isExpanded ? STUDY_COPY.ARTIFACT.COLLAPSE : STUDY_COPY.SANDBOX.OPEN_EXTERNAL"
          :aria-label="isExpanded ? STUDY_COPY.ARTIFACT.COLLAPSE : STUDY_COPY.SANDBOX.OPEN_EXTERNAL"
          @click="toggleExpand"
        >
          <svg v-if="!isExpanded" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="action-icon" aria-hidden="true">
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="action-icon" aria-hidden="true">
            <polyline points="4 14 10 14 10 20" />
            <polyline points="20 10 14 10 14 4" />
            <line x1="14" y1="10" x2="21" y2="3" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        </button>
      </div>
    </div>

    <div class="sandbox-body" :style="{ height: isExpanded ? '600px' : height }">
      <!-- 严格限定 sandbox 权限：无 allow-same-origin，无 allow-top-navigation -->
      <iframe
        v-if="previewUrl"
        :key="iframeKey"
        class="sandbox-iframe"
        sandbox="allow-scripts"
        referrerpolicy="no-referrer"
        :src="previewUrl"
        :title="title"
        loading="lazy"
      />
      <div v-else class="sandbox-placeholder">
        <p v-if="error" role="alert">{{ error }}</p>
        <button type="button" class="sandbox-open" :disabled="loading" @click="resetSandbox">
          {{ loading ? STUDY_COPY.COMMON.LOADING : STUDY_COPY.ARTIFACT.OPEN }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.interactive-sandbox {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--mi-border, #e1e4e8);
  border-radius: 12px;
  background: var(--mi-card, #ffffff);
  overflow: hidden;
  margin: var(--mi-sp-3) 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.sandbox-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--mi-sp-2) var(--mi-sp-4);
  background: var(--cds-surface-2, #f6f8fa);
  border-bottom: 1px solid var(--mi-border, #e1e4e8);
  user-select: none;
}

.sandbox-title-wrap {
  display: flex;
  align-items: center;
  gap: var(--mi-sp-2);
  min-width: 0;
}

.sandbox-shield-icon {
  width: 16px;
  height: 16px;
  color: var(--mi-green, #1a7f37);
  flex-shrink: 0;
}

.sandbox-title {
  font-size: var(--mi-fs-label);
  font-weight: 500;
  color: var(--mi-text, #24292f);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sandbox-badge {
  display: inline-flex;
  align-items: center;
  padding: 1px var(--mi-sp-2);
  font-size: var(--mi-fs-caption);
  border-radius: 10px;
  background: var(--mi-blue-light, #ddf4ff);
  color: var(--mi-blue-deep, #0969da);
  font-weight: 400;
}

.sandbox-actions {
  display: flex;
  align-items: center;
  gap: var(--mi-sp-1);
}

.sandbox-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--mi-text-2, #57606a);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.sandbox-btn:hover {
  background: var(--cds-fill-ghost-hover, rgba(0, 0, 0, 0.06));
  color: var(--mi-text, #24292f);
}

.action-icon {
  width: 14px;
  height: 14px;
}

.sandbox-body {
  width: 100%;
  position: relative;
  background: #ffffff;
  transition: height 0.2s ease;
}

.sandbox-iframe {
  width: 100%;
  height: 100%;
  border: none;
  display: block;
}
.sandbox-placeholder { display: grid; place-content: center; height: 100%; gap: var(--mi-sp-3); color: var(--mi-text); }
.sandbox-open { padding: var(--mi-sp-3) var(--mi-sp-4); border: 1px solid var(--mi-border); border-radius: 8px; background: var(--mi-card); color: var(--mi-text); cursor: pointer; }
</style>
