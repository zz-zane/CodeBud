const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const net = require('node:net')

const outputDir = path.resolve(process.env.MIAI_ALGO_QA_OUTPUT || path.join(__dirname, '../../outputs/hello-algo-integration'))
fs.mkdirSync(outputDir, { recursive: true })

const qaDataDir = path.join(outputDir, 'qa-isolated-data')
fs.mkdirSync(qaDataDir, { recursive: true })
const tempDir = path.join(qaDataDir, 'temp')
fs.mkdirSync(tempDir, { recursive: true })

const logFile = path.join(outputDir, 'electron-verification.log')
const logStream = fs.createWriteStream(logFile, { flags: 'w', encoding: 'utf8' })
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`
  console.log(line)
  logStream.write(line + '\n')
}

const report = {
  ok: false,
  timestamp: new Date().toISOString(),
  steps: {},
  screenshots: [],
  rendererErrors: []
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let child, socket
let childExited
let id = 0
const pending = new Map()

async function call(method, params = {}) {
  const requestId = ++id
  return new Promise((resolve, reject) => {
    pending.set(requestId, { resolve, reject })
    socket.send(JSON.stringify({ id: requestId, method, params }))
  })
}

async function evaluate(expression) {
  const response = await call('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true
  })
  if (response.exceptionDetails) {
    throw new Error(JSON.stringify(response.exceptionDetails))
  }
  return response.result.value
}

async function until(expression, label, timeout = 15000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    try {
      const val = await evaluate(expression)
      if (val) return val
    } catch {}
    await sleep(200)
  }
  const debugInfo = await evaluate(`({
    hash: location.hash,
    bodyLen: document.body.innerHTML.length,
    snippet: document.body.innerText.slice(0, 300)
  })`).catch(() => ({}))
  throw new Error(`Timeout waiting for [${label}]. Current state: ${JSON.stringify(debugInfo)}`)
}

async function screenshot(name) {
  await sleep(600)
  const image = await call('Page.captureScreenshot', { format: 'png' })
  assert(image.data.length > 1000, `Screenshot ${name} is empty`)
  const targetPath = path.join(outputDir, `${name}.png`)
  fs.writeFileSync(targetPath, Buffer.from(image.data, 'base64'))
  report.screenshots.push({ name, path: targetPath, size: image.data.length })
  log(`Captured screenshot: ${name}.png (${Math.round(image.data.length / 1024)} KB)`)
}

async function main() {
  log('Starting Electron CDP verification...')

  const server = net.createServer()
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const port = server.address().port
  await new Promise((r) => server.close(r))
  log(`Reserved CDP debug port: ${port}`)

  const electronExe = path.join(__dirname, '../node_modules/electron/dist/electron.exe')
  const appPath = path.join(__dirname, '..')
  const bootstrap = path.join(qaDataDir, 'launch.cjs')
  fs.writeFileSync(bootstrap, [
    "const { app, session } = require('electron')",
    `app.setPath('userData', ${JSON.stringify(qaDataDir)})`,
    `app.setPath('sessionData', ${JSON.stringify(qaDataDir)})`,
    "app.whenReady().then(() => session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (_request, callback) => callback({ cancel: true })))",
    `require(${JSON.stringify(path.join(appPath, 'out/main/index.js'))})`
  ].join('\n'))

  const env = {
    ...process.env,
    MIAI_DEBUG_PORT: String(port),
    MIAI_DATA_DIR: qaDataDir,
    TEMP: tempDir,
    TMP: tempDir
  }
  delete env.ELECTRON_RUN_AS_NODE

  child = spawn(electronExe, [bootstrap], {
    env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  })

  child.stdout.on('data', (d) => log(`[stdout] ${d.toString().trim()}`))
  child.stderr.on('data', (d) => log(`[stderr] ${d.toString().trim()}`))
  childExited = new Promise(resolve => child.once('exit', (code, sig) => {
    log(`Electron process exited with code=${code}, sig=${sig}`)
    report.exitCode = code
    report.signal = sig
    resolve()
  }))

  let page
  log('Waiting for CDP target...')
  for (let i = 0; i < 150; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`)
      const pages = await res.json()
      page = pages.find((p) => p.type === 'page')
      if (page) break
    } catch {}
    await sleep(200)
  }
  assert(page, 'Failed to attach to Electron CDP target')
  log(`Attached to CDP target: ${page.url}`)
  assert(page.url.startsWith('file:') && page.url.includes('/out/renderer/index.html'), 'Expected production file:// renderer')
  report.url = page.url
  report.userData = qaDataDir
  report.networkPolicy = 'Block all HTTP(S) and WebSocket requests in the owned Electron session'

  const WebSocket = globalThis.WebSocket || require('ws')
  socket = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.onopen = resolve
    socket.onerror = reject
  })

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data)
    if (data.method === 'Runtime.consoleAPICalled') {
      const text = data.params.args.map((a) => a.value || a.description).join(' ')
      log(`[renderer-console] ${text}`)
    }
    if (data.method === 'Runtime.exceptionThrown') {
      report.rendererErrors.push(data.params.exceptionDetails)
      log(`[renderer-exception] ${JSON.stringify(data.params.exceptionDetails)}`)
    }
    if (data.id && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id)
      pending.delete(data.id)
      if (data.error) reject(new Error(JSON.stringify(data.error)))
      else resolve(data.result)
    }
  }

  await call('Page.enable')
  await call('Runtime.enable')
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 950, deviceScaleFactor: 1, mobile: false })

  // Step 1: Wait for App mount
  log('Step 1: Checking App mounting...')
  await until(`document.querySelector('.minimal-home') !== null && !!window.miai`, 'App mounted')
  await evaluate(`localStorage.setItem('miai:zoom:v1', '50')`)
  await call('Page.reload')
  await until(`document.querySelector('.minimal-home') !== null && document.querySelector('.zoom-range')?.value === '50'`, 'Saved 50% reading preference')
  await evaluate(`location.hash = '#/lesson/common-01'`)
  await until(`document.querySelector('.lesson-title') !== null`, 'Basic lesson for nonempty progress baseline')
  await evaluate(`(() => { const button = [...document.querySelectorAll('.lesson-actions button')].find(b => b.innerText.includes('标记已学')); if (button) button.click(); })()`)
  await until(`(async () => (await window.miai.getProfile()).data?.learned?.includes('common-01'))()`, 'Real IPC progress saved')
  report.profileBefore = await evaluate(`(async () => (await window.miai.getProfile()).data)()`)
  assert(report.profileBefore.learned.includes('common-01'), 'Baseline must contain an actual learned lesson')
  report.readingZoom = 50
  await evaluate(`location.hash = '#/courses?cat=basics'`)
  await until(`document.querySelector('.basics-category .language-tabs') !== null`, 'Basic language tabs')
  await evaluate(`[...document.querySelectorAll('.language-tabs button')].find(b => b.innerText.trim() === 'Python').click()`)
  await until(`document.querySelector('.language-tabs button.active')?.innerText.trim() === 'Python'`, 'Python selected before algorithm reading')
  report.steps.appMount = true

  // Step 2: Navigate to Courses view with algo category
  log('Step 2: Navigating to /courses?cat=algo...')
  await evaluate(`location.hash = '#/courses?cat=algo'`)
  await until(`document.querySelector('.algo-category') !== null`, 'Algo category view')
  const chaptersCount = await evaluate(`document.querySelectorAll('.algo-category .stage-section').length`)
  log(`Found ${chaptersCount} chapter sections in algo catalog`)
  assert(chaptersCount >= 19, `Expected >= 19 chapter sections, got ${chaptersCount}`)
  await screenshot('01-courses-algo')
  report.steps.catalog = { ok: true, chaptersCount }

  // Step 3: Class-only code reference lesson algo-s027 (List)
  log('Step 3: Checking class-only snippet lesson algo-s027...')
  await evaluate(`location.hash = '#/lesson/algo-s027'`)
  await until(`document.querySelector('.lesson-page') !== null`, 'Lesson algo-s027 page')
  await until(`document.querySelector('.compare-grid') !== null`, 'Compare grid in algo-s027')

  const s027Checks = await evaluate(`(() => {
    const text = document.body.innerText;
    const hasUnconverted = text.includes('[file]') || text.includes('[class]') || text.includes('[func]');
    const hasCompareGrid = document.querySelector('.compare-grid') !== null;
    const badges = Array.from(document.querySelectorAll('.lesson-badges .mi-tag')).map(el => el.innerText.trim());
    const actionBtns = Array.from(document.querySelectorAll('.lesson-actions button, .compare-col-actions button')).map(el => el.innerText.trim());
    return {
      hasUnconverted,
      hasCompareGrid,
      badges,
      actionBtns
    };
  })()`)

  log(`algo-s027 badges: ${JSON.stringify(s027Checks.badges)}`)
  log(`algo-s027 actions: ${JSON.stringify(s027Checks.actionBtns)}`)
  assert(!s027Checks.hasUnconverted, 'Found unconverted [file]/[class]/[func] markers in algo-s027!')
  assert(s027Checks.hasCompareGrid, 'Compare grid not found in algo-s027!')
  assert(s027Checks.badges.includes('Hello 算法'), 'Missing Hello 算法 badge!')
  assert(!s027Checks.badges.some(b => b.includes('通用') || b.includes('common')), 'Polluted by common badge!')
  assert(!s027Checks.actionBtns.some(b => b.includes('练习') || b.includes('运行') || b.includes('标记已学')), 'Illegal practice/run/learn buttons present!')
  assert(s027Checks.actionBtns.some(b => b.includes('返回目录')), 'Missing 返回目录 button!')
  await screenshot('02-lesson-algo-s027-class-snippet')
  report.steps.lessonS027 = { ok: true, checks: s027Checks }

  // Step 4: Images and Math in algo lesson (algo-s007)
  log('Step 4: Checking images and math in algo-s007...')
  await evaluate(`location.hash = '#/lesson/algo-s007'`)
  await until(`document.querySelector('.lesson-page') !== null`, 'Lesson algo-s007')
  await sleep(1000)

  const s007Checks = await evaluate(`(() => {
    const imgs = Array.from(document.querySelectorAll('.markdown-body img'));
    const imgResults = imgs.map(img => ({
      src: img.src,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      complete: img.complete
    }));
    const hasMath = document.querySelector('.katex') !== null;
    return {
      imgCount: imgs.length,
      allLoaded: imgResults.every(i => i.complete && i.naturalWidth > 0),
      imgResults: imgResults.slice(0, 5),
      hasMath
    };
  })()`)

  log(`algo-s007 images count: ${s007Checks.imgCount}, allLoaded: ${s007Checks.allLoaded}, hasMath: ${s007Checks.hasMath}`)
  assert(s007Checks.imgCount > 0, 'No images found in algo-s007')
  assert(s007Checks.allLoaded, 'Some images failed to load (naturalWidth === 0)!')
  assert(s007Checks.hasMath, 'KaTeX math not found in algo-s007!')
  await screenshot('03-lesson-algo-s007-images-math')
  report.steps.lessonS007 = { ok: true, checks: s007Checks }

  // Step 5: Search panel verification
  log('Step 5: Testing SearchPanel with algo query...')
  await evaluate(`location.hash = '#/learn'`)
  await until(`document.querySelector('.search-input[data-search=home]') !== null`, 'Home search ready')
  await evaluate(`(async () => {
    const input = document.querySelector('.search-input[data-search=home]');
    if (input) {
      input.focus();
      input.value = '动态规划';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('focus', { bubbles: true }));
    }
  })()`)
  await sleep(1000)

  const searchHits = await evaluate(`(() => {
    const items = Array.from(document.querySelectorAll('.search-results .result-item'));
    return items.map(el => el.innerText.trim());
  })()`)
  log(`Search hits for "动态规划": ${searchHits.length} items`)
  assert(searchHits.length > 0, 'Search returned 0 results!')
  const hasAlgoHit = searchHits.some(h => h.includes('Hello 算法') || h.includes('动态规划'))
  assert(hasAlgoHit, 'Search hits missing Hello 算法 or 动态规划!')
  await screenshot('04-search-panel-algo')
  report.steps.search = { ok: true, count: searchHits.length }

  // Step 6: Step through lessons with Next button
  log('Step 6: Testing Next button navigation...')
  await evaluate(`location.hash = '#/lesson/algo-s027'`)
  await until(`location.hash.includes('algo-s027') && document.querySelector('.lesson-title')?.innerText.includes('列表')`, 'Lesson algo-s027 ready')
  await sleep(500)
  const nextBtn = await evaluate(`(() => {
    const btn = Array.from(document.querySelectorAll('.lesson-actions button')).find(b => b.innerText.includes('下一节'));
    if (btn) { btn.click(); return true; }
    return false;
  })()`)
  assert(nextBtn, 'Next button click failed')
  await until(`location.hash.includes('algo-s028')`, 'Navigated to algo-s028')
  await sleep(500)
  const currentHash = await evaluate(`location.hash`)
  log(`Navigated to: ${currentHash}`)
  assert(currentHash === '#/lesson/algo-s028', `Expected #/lesson/algo-s028, got ${currentHash}`)
  await screenshot('05-lesson-algo-s028-stepped')
  report.steps.stepNext = { ok: true, target: currentHash }

  // Step 7: Return to basic course and verify state integrity
  log('Step 7: Returning to basics category...')
  await evaluate(`location.hash = '#/courses?cat=basics'`)
  await until(`document.querySelector('.basics-category') !== null`, 'Basics category view')
  assert.equal(await evaluate(`document.querySelector('.language-tabs button.active')?.innerText.trim()`), 'Python', 'Algorithm navigation changed the selected programming language')
  report.steps.languagePreserved = 'Python'
  const basicState = await evaluate(`(async () => {
    const profile = (await window.miai.getProfile()).data;
    const learnedInStore = profile.learned;
    const algoInLearned = learnedInStore.filter(id => id.startsWith('algo-'));
    return {
      learnedCount: learnedInStore.length,
      algoInLearnedCount: algoInLearned.length,
      profile
    };
  })()`)
  log(`Storage profile: learnedCount=${basicState.learnedCount}, algoInLearnedCount=${basicState.algoInLearnedCount}`)
  assert(basicState.algoInLearnedCount === 0, 'Algo lesson leaked into profile.learned!')
  assert.deepEqual(basicState.profile, report.profileBefore, 'Reading algorithm lessons changed the real profile')
  assert.equal(report.rendererErrors.length, 0, 'Renderer exceptions occurred')
  await screenshot('06-return-basics')
  report.steps.returnBasics = { ok: true, basicState }

  report.ok = true
  log('CDP verification completed successfully!')
}

main()
  .catch((err) => {
    log(`FATAL: ${err.stack || err}`)
    report.error = err.message
  })
  .finally(async () => {
    if (socket && report.ok) await evaluate('setTimeout(() => window.close(), 100); true').catch(() => {})
    if (socket) {
      try { socket.close() } catch {}
    }
    if (child) {
      await Promise.race([childExited, sleep(5000)])
      if (child.exitCode === null) {
        log('Stopping the owned QA Electron process after timeout...')
        child.kill()
        await childExited
      }
      if (report.exitCode !== 0) report.ok = false
    }
    fs.writeFileSync(path.join(outputDir, 'electron-verification-report.json'), JSON.stringify(report, null, 2), 'utf8')
    logStream.end()
    process.exit(report.ok ? 0 : 1)
  })
