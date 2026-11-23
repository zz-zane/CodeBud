// 实测第三轮：聊天里生成（真实模型，Antigravity ACP）。三问：应命中内置 / 应改用文字 / 应生成新动画
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const path = require('node:path')
const { chromium } = require('playwright-core')
const repo = path.resolve(__dirname, '..', '..')
const src = process.env.CODEBUD_QA_SOURCE || '<本地工作区>'
const out = path.join(__dirname, 'shots3'); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true })
const data = path.join(__dirname, 'data3'); fs.rmSync(data, { recursive: true, force: true }); fs.mkdirSync(data, { recursive: true })
for (const f of ['config.json', 'study-companion.json', 'device.json', 'Local State', 'ai-secret.bin']) if (fs.existsSync(path.join(src, f))) fs.copyFileSync(path.join(src, f), path.join(data, f))
const env = { ...process.env, MIAI_QA_DATA_DIR: data, MIAI_DEBUG_PORT: '19357' }
delete env.ELECTRON_RUN_AS_NODE; delete env.MIAI_DATA_DIR
const child = spawn(repo + '/node_modules/electron/dist/electron.exe', ['start-qa.cjs'], { cwd: repo, env, stdio: 'ignore' })
const wait = (ms) => new Promise(r => setTimeout(r, ms))
const log = { runs: [] }
const save = () => fs.writeFileSync(path.join(out, 'log.json'), JSON.stringify(log, null, 1))
;(async () => {
  let browser
  for (let i = 0; i < 60 && !browser; i++) { try { browser = await chromium.connectOverCDP('http://127.0.0.1:19357') } catch { await wait(500) } }
  let page
  for (let i = 0; i < 40 && !page; i++) { page = browser.contexts().flatMap(c => c.pages()).find(p => !p.url().startsWith('devtools')); if (!page) await wait(500) }
  await page.waitForLoadState('domcontentloaded'); await wait(3500)
  const shot = (n) => page.screenshot({ path: path.join(out, n + '.png') })
  await page.evaluate(() => { localStorage.setItem('codebud.video.narration.enabled', 'false'); location.hash = '#/ai' }); await wait(3000)
  // 等连接就绪
  for (let i = 0; i < 40; i++) { const dis = await page.evaluate(() => document.querySelector('textarea')?.disabled); if (dis === false) break; await wait(1000) }
  log.textareaEnabled = await page.evaluate(() => document.querySelector('textarea')?.disabled === false)
  await shot('00-ready')
  async function setMode() {
    const label = () => page.evaluate(() => [...document.querySelectorAll('button')].map(b => b.textContent.trim()).find(t => /^(直接解答|完整解释|提示|思路|错因诊断|费曼检验|算法图解|分步解题|视频讲解|动画讲解)$/.test(t)))
    if (/视频讲解|动画讲解/.test(await label() || '')) return true
    await page.evaluate(() => [...document.querySelectorAll('button')].find(b => /^(直接解答|完整解释|提示|思路|错因诊断|费曼检验|算法图解|分步解题)$/.test(b.textContent.trim()))?.click()); await wait(500)
    const ok = await page.evaluate(() => { const it = [...document.querySelectorAll('button,[role=menuitem],[role=menuitemradio],[role=option]')].filter(b => /^(视频讲解|动画讲解)/.test(b.textContent.trim())).pop(); if (!it) return false; it.click(); return true }); await wait(400)
    return ok && /视频讲解|动画讲解/.test(await label() || '')
  }
  async function ask(tag, q, maxSec) {
    const run = { tag, q, timeline: [] }; log.runs.push(run)
    run.modeSet = await setMode()
    await page.evaluate(() => document.querySelector('textarea').focus()); await page.keyboard.insertText(q); await wait(300); await shot(`${tag}-typed`); await page.keyboard.press('Enter')
    const t0 = Date.now(); let last = ''; let shots = 0
    for (let s = 0; s < maxSec; s++) {
      await wait(1000)
      const snap = await page.evaluate(() => {
        const msgs = [...document.querySelectorAll('[class*=message], [class*=msg]')].filter(e => e.innerText && e.innerText.trim())
        const tail = (document.querySelector('[class*=messages], [class*=chat-scroll], main')?.innerText || document.body.innerText).slice(-420)
        const confirm = [...document.querySelectorAll('button')].find(b => /运行并核对|^运行$|允许运行/.test(b.textContent.trim()))
        return { tail, hasConfirm: !!confirm, streaming: !!document.querySelector('[class*=progress-card], [class*=video-progress], [class*=anim-progress]'), card: !!document.querySelector('[class*=anim-card]'), n: msgs.length }
      })
      if (snap.tail !== last) { run.timeline.push({ t: Math.round((Date.now() - t0) / 1000), tail: snap.tail.replace(/\n+/g, ' / ').slice(-260), card: snap.card, progress: snap.streaming }); last = snap.tail; if (shots < 5) { await shot(`${tag}-${String(shots++).padStart(2, '0')}`) } }
      if (snap.hasConfirm) { run.confirmAt = Math.round((Date.now() - t0) / 1000); await shot(`${tag}-confirm`); const b = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => /运行并核对|^运行$|允许运行/.test(b.textContent.trim()))); await b.asElement().click(); await wait(800)
        // 现有 runner 的二次确认弹窗
        const b2 = await page.evaluateHandle(() => [...document.querySelectorAll('.mi-modal button, [role=dialog] button')].find(b => /运行|继续|确定|允许/.test(b.textContent.trim()))); if (b2.asElement()) { await shot(`${tag}-confirm2`); await b2.asElement().click(); await wait(500) } }
      const idle = await page.evaluate(() => { const ta = document.querySelector('textarea'); return ta && !ta.disabled && ![...document.querySelectorAll('button')].some(b => /^取消$|停止/.test(b.textContent.trim())) })
      if (idle && s > 4 && !snap.streaming) break
    }
    run.seconds = Math.round((Date.now() - t0) / 1000); await wait(800); await shot(`${tag}-final`); save()
  }
  if (log.textareaEnabled) {
    await ask('builtin', '我分不清 p 和 *p，指针里到底存的是什么？', 90)
    await ask('text', '#include <stdio.h> 这一行是什么意思？', 90)
    await ask('gen', '二级指针 int **pp 是怎么顺着找到最后那个数的？我完全绕晕了', 240)
    log.videosAfter = JSON.parse(fs.readFileSync(path.join(data, 'videos.json'), 'utf8')).videos?.map(v => ({ title: v.title, acts: v.acts.map(a => `${a.skin}:${a.title}(${a.steps.length})`), verified: v.codeVerified }))
  }
  save(); await browser.close(); child.kill(); console.log('done')
})().catch(e => { console.error(String(e).slice(0, 400)); try { save() } catch {} child.kill(); process.exit(1) })
