// logo.svg → out/logo.png（1024，透明底）
const path = require('node:path'), { pathToFileURL } = require('node:url'), home = process.env.USERPROFILE
const { chromium } = require(process.env.PW_CORE || `${home}/AppData/Local/npm-cache/_npx/9833c18b2d85bc59/node_modules/playwright-core`)
;(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || `${home}/AppData/Local/ms-playwright/chromium-1223/chrome-win64/chrome.exe` })
  const p = await b.newPage({ viewport: { width: 1024, height: 1024 } })
  await p.setContent(`<body style="margin:0">${require('node:fs').readFileSync(path.join(__dirname, 'assets/logo.svg'), 'utf8').replace('width="512" height="512"', 'width="1024" height="1024"')}`)
  await p.screenshot({ path: path.join(__dirname, 'out/logo.png'), omitBackground: true })
  await b.close()
})()
