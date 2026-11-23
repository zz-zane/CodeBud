// 实测第二轮：完整走完内置动画与真实模型生成的动画，记录每步字幕与画面；聊天入口；手机宽度
const { spawn } = require('node:child_process')
const fs = require('node:fs'); const path = require('node:path')
const { chromium } = require('playwright-core')
const repo = path.resolve(__dirname, '..', '..')
const out = path.join(__dirname, 'shots4'); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true })
const data = path.join(__dirname, 'data4'); fs.rmSync(data, { recursive: true, force: true }); fs.mkdirSync(data, { recursive: true })
fs.copyFileSync(path.join(process.env.CODEBUD_QA_SOURCE || '<本地工作区>', 'videos.json'), path.join(data, 'videos.json'))
const env = { ...process.env, MIAI_QA_DATA_DIR: data, MIAI_DEBUG_PORT: '19356' }
delete env.ELECTRON_RUN_AS_NODE; delete env.MIAI_DATA_DIR
const child = spawn(repo + '/node_modules/electron/dist/electron.exe', ['start-qa.cjs'], { cwd: repo, env, stdio: 'ignore' })
const wait = (ms) => new Promise(r => setTimeout(r, ms))
const log = {}
;(async () => {
  let browser
  for (let i = 0; i < 60 && !browser; i++) { try { browser = await chromium.connectOverCDP('http://127.0.0.1:19356') } catch { await wait(500) } }
  let page
  for (let i = 0; i < 40 && !page; i++) { page = browser.contexts().flatMap(c => c.pages()).find(p => !p.url().startsWith('devtools')); if (!page) await wait(500) }
  await page.waitForLoadState('domcontentloaded'); await wait(3500)
  const shot = (n) => page.screenshot({ path: path.join(out, n + '.png') })
  const go = async (h, ms = 2000) => { await page.evaluate(x => { location.hash = x }, h); await wait(ms) }
  await page.evaluate(() => { localStorage.setItem('codebud.video.narration.enabled', 'false') })
  const state = () => page.evaluate(() => {
    const world = document.querySelector('.player .world'); const stage = document.querySelector('.player .stage-wrap')
    const wb = world?.getBoundingClientRect(); const sb = stage?.getBoundingClientRect()
    const cells = [...document.querySelectorAll('.player [data-cell]')].map(c => c.getBoundingClientRect())
    const used = cells.length ? { w: Math.max(...cells.map(r => r.right)) - Math.min(...cells.map(r => r.left)), h: Math.max(...cells.map(r => r.bottom)) - Math.min(...cells.map(r => r.top)) } : null
    return { counter: [...document.querySelectorAll('.player footer span')].map(s => s.textContent).find(t => /\d+\s*\/\s*\d+/.test(t)), skin: world?.className, asking: !!document.querySelector('.caption.question'),
      caption: document.querySelector('.caption')?.innerText?.replace(/\n/g, ' | ').slice(0, 140), cells: [...document.querySelectorAll('.player [data-cell]')].map(c => c.innerText.replace(/\n/g, ' ')).join(' ; ').slice(0, 200),
      arrows: document.querySelectorAll('.player svg.arrows > path').length, out: document.querySelector('.player .output pre')?.textContent,
      stagePx: sb ? [Math.round(sb.width), Math.round(sb.height)] : null, usedPx: used ? [Math.round(used.w), Math.round(used.h)] : null, hasCode: !!document.querySelector('.player .code') }
  })
  async function passAsk(tag) {
    for (let k = 0; k < 5; k++) {
      const info = await page.evaluate(() => ({ asking: !!document.querySelector('.caption.question'), buttons: [...document.querySelectorAll('.caption.question button')].map(b => ({ t: b.textContent.trim(), d: b.disabled, c: b.className })) }))
      if (!info.asking) return
      log[tag + '-ask-' + k] = info.buttons
      const btns = await page.$$('.caption.question button')
      const submitIdx = info.buttons.findIndex(b => /提交/.test(b.t))
      if (submitIdx >= 0) {
        if (!info.buttons.some(b => /chosen/.test(b.c))) { await btns[1].click(); await wait(250) }   // 故意选第二项（多半是错的）
        await btns[submitIdx].click(); await wait(700); await shot(tag + '-answered')
      } else { await btns[btns.length - 1].click(); await wait(500) }
    }
  }
  async function walk(tag, max = 20) {
    await wait(500); await page.keyboard.press('Space'); await wait(300)
    for (let i = 0; i < max; i++) { await page.keyboard.press('ArrowLeft'); await wait(100) }
    await wait(900); const steps = []
    for (let i = 1; i <= max; i++) {
      await passAsk(`${tag}-${String(i).padStart(2, '0')}`); await wait(700)
      const s = await state(); steps.push(s); await shot(`${tag}-${String(i).padStart(2, '0')}`)
      const before = s.counter
      await page.keyboard.press('ArrowRight'); await wait(180); await page.screenshot({ path: path.join(out, `${tag}-${String(i).padStart(2, '0')}-mid.png`) }); await wait(1200)
      await passAsk(`${tag}-${String(i + 1).padStart(2, '0')}`)
      const after = (await state()).counter
      if (after === before) break
    }
    log[tag] = steps
  }
  // A 内置：指针
  await go('#/lesson/c-stage1-14', 3000)
  await (await page.$('.video-card .vc-thumb')).click(); await wait(600)
  await walk('basics')
  log.playerChrome = await page.evaluate(() => ({ header: document.querySelector('.player header')?.innerText.replace(/\n/g, ' | '), footer: [...document.querySelectorAll('.player footer button')].map(b => `${b.textContent.trim()}[${b.getAttribute('aria-label') || ''}]`), badge: document.querySelector('.player header')?.innerText.includes('核对') }))
  await page.keyboard.press('Escape'); await wait(400)
  // B 资料库里的真实模型生成视频
  await go('#/study?tab=video', 2500)
  const names = ['指针里存的是变量地址', '递归：先存现场', 'Python 列表别名']
  for (let n = 0; n < names.length; n++) {
    const h = await page.evaluateHandle((name) => { const card = [...document.querySelectorAll('article, .card, li, div')].filter(e => e.innerText && e.innerText.includes(name) && e.querySelector('button')).sort((a, b) => a.innerText.length - b.innerText.length)[0]; return card ? [...card.querySelectorAll('button')].find(b => /播放/.test(b.textContent) || /播放/.test(b.getAttribute('aria-label') || '')) || card.querySelector('button') : null }, names[n])
    if (!h.asElement()) { log['ai' + n] = 'card not found'; continue }
    await h.asElement().click(); await wait(700); await walk('ai' + n); await page.keyboard.press('Escape'); await wait(400)
  }
  // C 内置：递归（sheet 皮）
  await go('#/lesson/python-stage1-16', 3000)
  const c2 = await page.$('.video-card .vc-thumb'); if (c2) { await c2.scrollIntoViewIfNeeded(); await c2.click(); await wait(600); await walk('recur'); await page.keyboard.press('Escape'); await wait(300) }
  // D 聊天入口：未配置 AI 时选「动画讲解」发送
  await go('#/ai', 2500); await shot('chat-0')
  const trigger = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find(b => /^(直接解答|完整解释|提示|思路)/.test(b.textContent.trim())))
  if (trigger.asElement()) { await trigger.asElement().click(); await wait(500); await shot('chat-1-menu')
    const item = await page.evaluateHandle(() => [...document.querySelectorAll('button,[role=menuitem],[role=option],li')].find(b => b.textContent.trim().startsWith('动画讲解')))
    log.menuItems = await page.evaluate(() => [...document.querySelectorAll('[role=menu] button,[role=menuitem],[role=menuitemradio],[role=option]')].map(b => b.textContent.trim()))
    if (item.asElement()) { await item.asElement().click(); await wait(300) } }
  const ta = await page.$('textarea'); if (ta) { await ta.fill('为什么 swap(a, b) 换不了两个数，要传指针才行？'); await wait(300); await shot('chat-2-typed'); await page.keyboard.press('Enter'); await wait(2500); await shot('chat-3-sent')
    log.chatAfterSend = await page.evaluate(() => document.querySelector('#app')?.innerText.slice(-500)) }
  // E 手机宽度的播放器
  try { const cdp = await page.context().newCDPSession(page); await go('#/lesson/c-stage1-14', 2500); await cdp.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }); await wait(1200)
    const c3 = await page.$('.video-card .vc-thumb'); if (c3) { await c3.scrollIntoViewIfNeeded(); await shot('phone-card'); await c3.click(); await wait(800); await page.keyboard.press('Space'); for (let i = 0; i < 9; i++) { await page.keyboard.press('ArrowRight'); await wait(500); await passAsk('phone' + i) } await wait(800); await shot('phone-player') }
    await cdp.send('Emulation.clearDeviceMetricsOverride') } catch (e) { log.phoneError = String(e) }
  fs.writeFileSync(path.join(out, 'log.json'), JSON.stringify(log, null, 1))
  await browser.close(); child.kill(); console.log('done', Object.keys(log).length)
})().catch(e => { console.error(e); try { fs.writeFileSync(path.join(out, 'log.json'), JSON.stringify(log, null, 1)) } catch {} child.kill(); process.exit(1) })
