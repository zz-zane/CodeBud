const { app } = require('electron')
const { join } = require('node:path')
const { mkdirSync } = require('node:fs')

// 隔离 QA 评测档案存储（独立于原用户本地数据）
const qaData = process.env.MIAI_QA_DATA_DIR || join(__dirname, 'local-qa-data')
mkdirSync(qaData, { recursive: true })

app.setPath('userData', qaData)
app.setPath('sessionData', qaData)

require('./out/main/index.js')
