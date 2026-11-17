// 逐帧渲染 film.html → mp4。用法：
//   node promo/render.cjs                 全片（有 assets/bgm.* 则自动混音）
//   node promo/render.cjs --still 3,7,12  只导出这些秒数的静帧到 promo/out/
// 依赖：ffmpeg 在 PATH；playwright-core + Chromium（路径可用环境变量覆盖）。
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const home = process.env.USERPROFILE
const { chromium } = require(process.env.PW_CORE || `${home}/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright-core`)
const exe = process.env.CHROME || `${home}/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe`
const FPS = 30, out = path.join(__dirname, 'out')

;(async () => {
  fs.mkdirSync(out, { recursive: true })
  const browser = await chromium.launch({ executablePath: exe, args: ['--allow-file-access-from-files'] })
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  page.on('pageerror', (e) => { console.error('页面错误:', e.message); process.exitCode = 1 })
  await page.goto(pathToFileURL(path.join(__dirname, 'film.html')).href + '?render')
  await page.waitForFunction('window.READY === true')
  const grab = async (t) => Buffer.from((await page.evaluate((t) => {
    window.draw(t); return document.getElementById('c').toDataURL('image/jpeg', 0.95)
  }, t)).split(',')[1], 'base64')

  const si = process.argv.indexOf('--still')
  if (si > 0) {
    for (const t of process.argv[si + 1].split(',')) fs.writeFileSync(path.join(out, `still_${t}.jpg`), await grab(+t))
    await browser.close(); return
  }
  const dur = await page.evaluate('window.DUR')
  const bgm = ['mp3', 'ogg', 'wav', 'flac'].map((e) => path.join(__dirname, 'assets', `bgm.${e}`)).find(fs.existsSync)
  const args = ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-']
  if (bgm) args.push('-stream_loop', '-1', '-i', bgm, '-af', `afade=t=in:d=0.6,afade=t=out:st=${dur - 2.5}:d=2.5`, '-c:a', 'aac', '-b:a', '192k')
  else console.warn('未找到 assets/bgm.*，输出无声版本')
  args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '17', '-preset', 'medium', '-t', String(dur), '-movflags', '+faststart', path.join(out, 'codebud-promo.mp4'))
  const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] })
  const n = Math.round(dur * FPS)
  for (let f = 0; f < n; f++) {
    if (!ff.stdin.write(await grab(f / FPS))) await new Promise((r) => ff.stdin.once('drain', r))
    if (f % 150 === 0) console.log(`帧 ${f}/${n}`)
  }
  ff.stdin.end()
  const code = await new Promise((r) => ff.on('close', r))
  await browser.close()
  if (code) { console.error('ffmpeg 退出码', code); process.exit(1) }
  console.log('完成:', path.join(out, 'codebud-promo.mp4'))
})()
