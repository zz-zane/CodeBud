<script setup lang="ts">
/**
 * 图文积木：竖排流程图（```flow）。规则借自 diagram-design：细线框、无阴影、小圆角，
 * 强调色只给起点 / 关键节点，终点用成功色；zone 节点是整宽高亮带（例如「太平洋海底光缆」），
 * via 写在进入该节点的箭头旁。节点数在解析时已限制为 ≤ 9。
 */
import type { FlowBlockData } from '../../../lib/ai-rich-blocks'
import VisualIcon from './VisualIcon.vue'

defineProps<{ data: FlowBlockData }>()
</script>

<template>
  <figure class="vf">
    <figcaption v-if="data.title" class="vf-title">{{ data.title }}</figcaption>
    <ol class="vf-list">
      <li v-for="(n, i) in data.nodes" :key="i" class="vf-item" :class="{ zone: n.zone }">
        <div v-if="i > 0" class="vf-arrow" aria-hidden="true">
          <span class="vf-line" />
          <span v-if="n.via" class="vf-via">{{ n.via }}</span>
        </div>
        <span v-if="i > 0 && n.via" class="vf-sr">{{ n.via }}</span>
        <div class="vf-node" :class="[n.tone, { zone: n.zone }]">
          <svg v-if="n.zone" class="vf-wave" viewBox="0 0 120 8" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0 4 Q7.5 0 15 4 T30 4 T45 4 T60 4 T75 4 T90 4 T105 4 T120 4" fill="none" stroke="currentColor" stroke-width="1.2" vector-effect="non-scaling-stroke" />
          </svg>
          <VisualIcon v-if="n.icon" :name="n.icon" :size="22" class="vf-icon" />
          <div class="vf-text">
            <div class="vf-label">{{ n.label }}</div>
            <div v-if="n.sub" class="vf-sub">{{ n.sub }}</div>
          </div>
        </div>
      </li>
    </ol>
    <p v-if="data.caption" class="vf-caption">{{ data.caption }}</p>
  </figure>
</template>

<style scoped>
.vf { margin: var(--mi-sp-3) 0; padding: 20px var(--mi-sp-4); border: 1px solid var(--mi-border); border-radius: 12px; background: var(--mi-card); font-family: var(--mi-font-family); }
.vf-title { margin: 0 0 var(--mi-sp-3); font-size: var(--mi-fs-label); font-weight: 500; color: var(--mi-text-2); text-align: center; }
.vf-list { display: flex; flex-direction: column; align-items: center; margin: 0; padding: 0; list-style: none; }
.vf-item { display: flex; flex-direction: column; align-items: center; width: min(100%, 420px); }
.vf-item.zone { width: 100%; }

/* 箭头：竖线 + 箭尖；via 标在旁边 */
.vf-arrow { position: relative; display: flex; justify-content: center; height: 30px; width: 100%; }
.vf-line { position: relative; width: 1px; height: 100%; background: var(--mi-border-control); }
.vf-line::after { content: ''; position: absolute; left: 50%; bottom: 0; width: 7px; height: 7px; border-right: 1px solid var(--mi-border-control); border-bottom: 1px solid var(--mi-border-control); transform: translate(-50%, -1px) rotate(45deg); }
.vf-via { position: absolute; left: calc(50% + 12px); top: 50%; transform: translateY(-50%); font-size: var(--mi-fs-caption); color: var(--mi-text-3); white-space: nowrap; }
.vf-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }

.vf-node { position: relative; display: flex; align-items: center; gap: var(--mi-sp-3); width: 100%; box-sizing: border-box; min-height: 48px; padding: 10px var(--mi-sp-4); border: 1px solid var(--mi-border-control); border-radius: 10px; background: var(--mi-card); color: var(--mi-text); }
.vf-node.start, .vf-node.accent { border-color: var(--mi-blue-deep); }
.vf-node.start .vf-icon, .vf-node.accent .vf-icon { color: var(--mi-blue-deep); }
.vf-node.end { border-color: var(--mi-success-deep); background: var(--mi-success-fill); }
.vf-node.end .vf-icon { color: var(--mi-success-deep); }
/* 整宽高亮带：浅暖底 + 顶上一条波浪线 */
.vf-node.zone { justify-content: center; min-height: 72px; padding-top: 18px; border-color: transparent; border-radius: 8px; background: var(--mi-warn-fill); text-align: center; }
.vf-node.zone .vf-text { align-items: center; }
.vf-wave { position: absolute; top: 6px; left: 12px; right: 12px; width: calc(100% - 24px); height: 8px; color: var(--mi-warn-edge); }
.vf-icon { flex-shrink: 0; color: var(--mi-text-2); }
.vf-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.vf-label { font-size: var(--mi-fs-body); font-weight: 500; line-height: 1.4; overflow-wrap: anywhere; }
.vf-sub { font-size: var(--mi-fs-caption); line-height: 1.5; color: var(--mi-text-2); overflow-wrap: anywhere; }
.vf-caption { margin: var(--mi-sp-3) 0 0; font-size: var(--mi-fs-caption); color: var(--mi-text-3); text-align: center; text-wrap: pretty; }
</style>
