<script setup lang="ts">
/**
 * 互动示意（```widget，2026-11-24）：AI 按本题量身写的一段 HTML + SVG + 内联脚本，跑在 html-preview 沙盒里
 * （CSP sandbox allow-scripts、不同源、禁网，见 main/study/html-preview.ts）。
 * 这里补三件事：注入应用配色变量与一套基础样式（AI 只用这些类，风格统一）、
 * 自动加载（不用点「打开」）、按内容自动定高（iframe 里的脚本 postMessage 报高度，只认这个 iframe 发来的）。
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { AI_ASSISTANT } from '../../../lib/copy'
import { studyPreviewUrl } from '../../../lib/asset-base'

const props = defineProps<{ html: string }>()

const frame = ref<HTMLIFrameElement | null>(null)
const url = ref('')
const failed = ref(false)
const height = ref(240)

/** 应用令牌 → 沙盒里的短名变量；值取自当前页面的计算样式 */
const VARS: Record<string, string> = {
  paper: '--mi-card', ink: '--mi-text', muted: '--mi-text-2', soft: '--mi-text-3', rule: '--mi-border', 'rule-strong': '--mi-border-control',
  accent: '--mi-blue-deep', 'accent-soft': '--mi-blue-light', ok: '--mi-success-deep', 'ok-soft': '--mi-success-fill',
  warn: '--mi-warn-edge', 'warn-soft': '--mi-warn-fill', bad: '--mi-error-deep', 'bad-soft': '--mi-error-fill', font: '--mi-font-family', mono: '--mi-code',
  // 分类色：不同对象各一色、跨图一致（蓝 / 绿 / 橙 / 紫 / 主色）
  c1: '--mi-cat-blue', c2: '--mi-success-deep', c3: '--mi-warn-deep', c4: '--mi-purple-ink', c5: '--mi-blue-deep'
}

function themeCss(): string {
  const cs = getComputedStyle(document.documentElement)
  return Object.entries(VARS).map(([k, v]) => `--${k}: ${cs.getPropertyValue(v).trim().replace(/[<>{};]/g, '') || 'initial'};`).join(' ')
}

/*
 * 基础样式 + 图解元件库（AI 只用这些类，风格统一）。参照 ChatGPT 图解：每节一张小图、不同对象分色、
 * 互动演示 = 标题 + 控件 + 数值卡 + 标亮的图 + 算式 + 结果 / 越界提示 + 恢复按钮。细线、无阴影、小圆角。
 * 字号只用 12 / 13 / 14 / 16 / 22 / 28（全库字号刻度）。
 */
const BASE_CSS = `
*,*::before,*::after{box-sizing:border-box}
:root{--c1-soft:color-mix(in srgb,var(--c1) 12%,var(--paper));--c2-soft:color-mix(in srgb,var(--c2) 12%,var(--paper));--c3-soft:color-mix(in srgb,var(--c3) 14%,var(--paper));--c4-soft:color-mix(in srgb,var(--c4) 12%,var(--paper));--c5-soft:color-mix(in srgb,var(--c5) 12%,var(--paper));--fill:color-mix(in srgb,var(--ink) 4%,var(--paper))}
html,body{margin:0;background:var(--paper);color:var(--ink);font:14px/1.6 var(--font);overflow:hidden}
body{padding:14px 16px}
svg{display:block;max-width:100%;height:auto;overflow:visible}
svg text{font-family:var(--font);fill:var(--ink)}
h4{margin:0 0 10px;font-size:16px;font-weight:500}
p{margin:6px 0}
.row{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;margin:10px 0}
.between{display:flex;align-items:baseline;justify-content:space-between;gap:12px;margin:8px 0}
.panel{border:1px solid var(--rule);border-radius:12px;padding:14px}
.muted{color:var(--muted)}.soft{color:var(--soft)}
.mono,.num{font-family:var(--mono);font-variant-numeric:tabular-nums}
.label{font-size:13px;color:var(--muted)}
.caption{margin:10px 0 0;font-size:12px;color:var(--soft);text-align:center}
.tag{display:inline-block;padding:1px 8px;border-radius:999px;background:var(--accent-soft);color:var(--accent);font-size:12px}
/* 分类色：给对象加 tone-1..5，边框 / 底 / 连线都跟着变 */
.tone-1{--t:var(--c1);--ts:var(--c1-soft)}.tone-2{--t:var(--c2);--ts:var(--c2-soft)}.tone-3{--t:var(--c3);--ts:var(--c3-soft)}.tone-4{--t:var(--c4);--ts:var(--c4-soft)}.tone-5{--t:var(--c5);--ts:var(--c5-soft)}
.bad{--t:var(--bad);--ts:var(--bad-soft)}.ok{--t:var(--ok);--ts:var(--ok-soft)}
/* 格子：内存块 / 页 / 段 / 数组元素 */
.cells{display:flex;gap:6px;flex-wrap:wrap}.cells.col{flex-direction:column}
.cell{flex:1 1 0;min-width:44px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:8px 6px;border:1.5px solid var(--t,var(--rule-strong));border-radius:8px;background:var(--ts,var(--paper));color:var(--t,var(--ink));font-size:13px;text-align:center;transition:background-color .15s,border-color .15s}
.cell small{font-size:12px;color:var(--muted)}
.cell.on{border-width:2px;box-shadow:0 0 0 3px var(--ts,var(--accent-soft))}
.cell.dim{border-color:var(--rule);background:var(--paper);color:var(--soft)}
/* 两段式说明卡：如「页号 P / 页内偏移 W」 */
.parts{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px}
.part{padding:10px 12px;border:1.5px solid var(--t,var(--rule-strong));border-radius:10px;background:var(--ts,var(--paper));text-align:center}
.part b{display:block;font-size:16px;font-weight:500;color:var(--ink)}.part span{font-size:13px;color:var(--muted)}
/* 数值卡 */
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin:10px 0}
.stat{padding:10px 12px;border-radius:10px;background:var(--fill)}
.stat .k{font-size:13px;color:var(--muted)}.stat .v{font-size:22px;font-weight:500;font-family:var(--mono);font-variant-numeric:tabular-nums;color:var(--t,var(--ink))}
.result{font-size:28px;font-weight:500;font-family:var(--mono);color:var(--ok)}
.alert{display:flex;align-items:center;gap:6px;color:var(--bad);font-weight:500}.alert::before{content:'!';display:inline-grid;place-items:center;width:18px;height:18px;border:1.5px solid currentColor;border-radius:50%;font-size:12px}
.formula{margin:8px 0;padding:8px 12px;border-radius:8px;background:var(--fill);font-family:var(--mono);font-size:14px;text-align:center;overflow-x:auto}
hr{border:0;border-top:1px solid var(--rule);margin:12px 0}
.btn,button{font:inherit;font-size:13px;padding:6px 14px;border:1px solid var(--rule-strong);border-radius:8px;background:var(--paper);color:var(--ink);cursor:pointer}
.btn:hover,button:hover{border-color:var(--accent)}
.btn.primary,button.primary{background:var(--accent);border-color:var(--accent);color:var(--paper)}
.btn.on,button.on{background:var(--accent-soft);border-color:var(--accent);color:var(--accent)}
.btn.block,button.block{display:block;width:100%;margin-top:12px;border-radius:999px}
input[type=range]{accent-color:var(--accent);width:100%;height:24px;margin:6px 0}
input[type=radio],input[type=checkbox]{accent-color:var(--accent);width:16px;height:16px}
input[type=number],input[type=text],select{font:inherit;font-size:13px;padding:4px 8px;border:1px solid var(--rule-strong);border-radius:6px;background:var(--paper);color:var(--ink)}
label{display:inline-flex;align-items:center;gap:6px;font-size:14px}
.options{display:flex;flex-direction:column;gap:6px;margin:6px 0}
table{border-collapse:collapse;font-size:13px}td,th{border:1px solid var(--rule);padding:4px 10px}
img{max-width:100%;border-radius:8px}
.mi-photo{display:inline-flex;flex-direction:column;gap:4px;max-width:100%;margin:0}
.mi-photo img{display:block;width:100%;object-fit:cover;background:var(--accent-soft)}
.mi-photo figcaption{font-size:12px;color:var(--soft);overflow-wrap:anywhere}
.mi-photo-ph{display:flex;align-items:center;justify-content:center;min-height:120px;padding:12px;border:1px dashed var(--rule-strong);border-radius:8px;color:var(--soft);font-size:12px;text-align:center}
@media (max-width:480px){body{padding:12px}.result{font-size:22px}}
`
/*
 * 搜图：<img data-search="英文关键词" alt="中文说明"> → 去 Wikimedia Commons（免 Key、允许跨域）找一张图填上，
 * 下面注明作者与许可（多为 CC 许可，必须署名）；离线 / 没搜到就显示 alt 文字。也暴露 miaiSearchImage(q) 给 AI 自己调。
 */
const IMG_JS = `(()=>{const L=__LABELS__;
async function search(q){const u='https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrnamespace=6&gsrlimit=6&gsrsearch='+encodeURIComponent(q+' filetype:bitmap')+'&prop=imageinfo&iiprop=url|mime|extmetadata&iiurlwidth=640';
const r=await fetch(u);if(!r.ok)return null;const d=await r.json();const ps=Object.values((d.query&&d.query.pages)||{}).sort((a,b)=>(a.index||0)-(b.index||0));
for(const p of ps){const i=p.imageinfo&&p.imageinfo[0];if(!i||!/^image\\/(jpeg|png|webp)/.test(i.mime||''))continue;const m=i.extmetadata||{};const strip=s=>String(s||'').replace(/<[^>]*>/g,'').trim().slice(0,80);
return{url:i.thumburl||i.url,page:i.descriptionurl,artist:strip(m.Artist&&m.Artist.value),license:strip(m.LicenseShortName&&m.LicenseShortName.value)}}return null}
window.miaiSearchImage=q=>search(q).catch(()=>null);
for(const img of document.querySelectorAll('img[data-search]')){const fig=document.createElement('figure');fig.className='mi-photo';if(img.getAttribute('width'))fig.style.width=img.getAttribute('width')+'px';
const ph=document.createElement('div');ph.className='mi-photo-ph';ph.textContent=img.alt||L.loading;img.replaceWith(fig);fig.append(ph);
search(img.dataset.search).then(r=>{if(!r){ph.textContent=(img.alt?img.alt+' · ':'')+L.none;return}img.src=r.url;img.removeAttribute('width');img.onload=()=>ph.replaceWith(img);img.onerror=()=>{ph.textContent=img.alt||L.none};
const c=document.createElement('figcaption');c.textContent=[L.source,r.artist,r.license].filter(Boolean).join(' · ');fig.append(c)}).catch(()=>{ph.textContent=(img.alt?img.alt+' · ':'')+L.offline})}})()`

/* 报高度：内容变了（脚本重画、展开）就再报一次 */
const RESIZE_JS = `(()=>{const post=()=>parent.postMessage({miaiWidgetHeight:Math.ceil(document.documentElement.getBoundingClientRect().height)+2},'*');new ResizeObserver(post).observe(document.body);addEventListener('load',post);post()})()`

function documentFor(body: string): string {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>:root{${themeCss()}}${BASE_CSS}</style><script>window.$=id=>document.getElementById(id)<\/script></head><body>${body}<script>${IMG_JS.replace('__LABELS__', JSON.stringify(AI_ASSISTANT.WIDGET_IMG))}<\/script><script>${RESIZE_JS}<\/script></body></html>`
}

let gen = 0
async function load(): Promise<void> {
  const my = ++gen
  failed.value = false
  url.value = ''
  try {
    const res = await window.miai.study.createHtmlPreview(documentFor(props.html), { network: true })
    if (my !== gen) return
    if (res.ok) url.value = studyPreviewUrl(res.data)
    else failed.value = true
  } catch {
    if (my === gen) failed.value = true
  }
}

function onMessage(e: MessageEvent): void {
  if (!frame.value || e.source !== frame.value.contentWindow) return
  const h = (e.data as { miaiWidgetHeight?: unknown } | null)?.miaiWidgetHeight
  if (typeof h === 'number' && Number.isFinite(h)) height.value = Math.max(60, Math.min(1600, h))
}

onMounted(() => { window.addEventListener('message', onMessage); void load() })
onBeforeUnmount(() => { gen++; window.removeEventListener('message', onMessage) })
watch(() => props.html, () => void load())
</script>

<template>
  <figure class="vw">
    <figcaption class="vw-head">
      <span class="vw-label">{{ AI_ASSISTANT.WIDGET_LABEL }}</span>
      <button type="button" class="vw-reset" :title="AI_ASSISTANT.WIDGET_RESET" @click="load">{{ AI_ASSISTANT.WIDGET_RESET }}</button>
    </figcaption>
    <iframe
      v-if="url"
      ref="frame"
      class="vw-frame"
      :src="url"
      sandbox="allow-scripts"
      referrerpolicy="no-referrer"
      :title="AI_ASSISTANT.WIDGET_LABEL"
      :style="{ height: height + 'px' }"
    />
    <p v-else-if="failed" class="vw-note" role="alert">{{ AI_ASSISTANT.WIDGET_FAILED }}</p>
    <p v-else class="vw-note">{{ AI_ASSISTANT.WIDGET_PENDING }}</p>
  </figure>
</template>

<style scoped>
.vw { margin: var(--mi-sp-3) 0; border: 1px solid var(--mi-border); border-radius: 12px; background: var(--mi-card); overflow: hidden; }
.vw-head { display: flex; align-items: center; justify-content: space-between; padding: 6px var(--mi-sp-3); border-bottom: 1px solid var(--mi-border); }
.vw-label { font-size: var(--mi-fs-caption); font-weight: 500; color: var(--mi-blue-ink); }
.vw-reset { padding: 2px 8px; border: 0; border-radius: 6px; background: transparent; color: var(--mi-text-3); font: inherit; font-size: var(--mi-fs-caption); cursor: pointer; }
.vw-reset:hover { background: var(--mi-blue-light); color: var(--mi-text); }
.vw-reset:focus-visible { outline: 2px solid var(--mi-blue-deep); outline-offset: 1px; }
.vw-frame { display: block; width: 100%; border: 0; transition: height var(--mi-dur-fast) var(--mi-ease); }
.vw-note { margin: 0; padding: var(--mi-sp-6) var(--mi-sp-4); color: var(--mi-text-3); font-size: var(--mi-fs-label); text-align: center; }
</style>
