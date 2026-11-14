/**
 * 配对页：发给未配对浏览器的唯一页面。自包含的小 HTML（内联样式与脚本），不引用应用包、不带任何数据；
 * 文字来自 shared/copy.ts 的 REMOTE_PAGE。错误码由 POST /pair 返回，页面按码取文案。
 */
import { REMOTE_PAGE } from '../../shared/copy'

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** 内联脚本 + 样式需要的 CSP（只允许同源 fetch，禁止其余一切） */
export const PAIR_PAGE_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; form-action 'none'; base-uri 'none'"

export function renderPairPage(): string {
  const msgs = JSON.stringify({
    wrong: REMOTE_PAGE.WRONG,
    locked: REMOTE_PAGE.LOCKED,
    network: REMOTE_PAGE.NETWORK,
    generic: REMOTE_PAGE.GENERIC,
    busy: REMOTE_PAGE.BUSY,
    submit: REMOTE_PAGE.SUBMIT
  }).replace(/</g, '\u003c')
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(REMOTE_PAGE.TITLE)}</title>
<style>
html{color-scheme:light}
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font:16px/1.6 system-ui,-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;background:#fbfbf9;color:#1f2328}
main{width:min(92vw,360px);padding:24px}
h1{font-size:20px;margin:0 0 8px}p{margin:0 0 16px;color:#57606a}
input{box-sizing:border-box;width:100%;padding:12px;font-size:24px;letter-spacing:.4em;text-align:center;border:1px solid #d0d7de;border-radius:8px}
button{margin-top:12px;width:100%;padding:12px;font-size:16px;border:0;border-radius:8px;background:#1f2328;color:#fff}
button:disabled{opacity:.6}
#msg{min-height:1.6em;margin-top:12px;color:#cf222e}
</style></head>
<body><main>
<h1>${esc(REMOTE_PAGE.TITLE)}</h1>
<p>${esc(REMOTE_PAGE.HINT)}</p>
<label for="c" hidden>${esc(REMOTE_PAGE.LABEL)}</label>
<input id="c" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]*" aria-label="${esc(REMOTE_PAGE.LABEL)}" autofocus>
<button id="b" type="button">${esc(REMOTE_PAGE.SUBMIT)}</button>
<div id="msg" role="alert"></div>
</main>
<script>
(function(){
var M=${msgs},c=document.getElementById('c'),b=document.getElementById('b'),m=document.getElementById('msg');
async function go(){
  m.textContent='';b.disabled=true;b.textContent=M.busy;
  try{
    var r=await fetch('/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:c.value.trim()})});
    if(r.ok){location.reload();return}
    var j={};try{j=await r.json()}catch(e){}
    m.textContent=M[j.error]||M.generic;
  }catch(e){m.textContent=M.network}
  b.disabled=false;b.textContent=M.submit;
}
b.addEventListener('click',go);
c.addEventListener('keydown',function(e){if(e.key==='Enter')go()});
})();
</script></body></html>`
}
