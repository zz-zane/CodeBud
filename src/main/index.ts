import { app } from 'electron'
import { mkdirSync } from 'node:fs'
import { packagedDataDir } from './data-path'

// Set the profile before the app creates stores or acquires its single-instance lock.
if (app.isPackaged) {
  const data = packagedDataDir(
    app.getPath('exe'),
    process.env.PORTABLE_EXECUTABLE_DIR,
    process.env.MIAI_DATA_DIR
  )
  mkdirSync(data, { recursive: true })
  app.setPath('userData', data)
  app.setPath('sessionData', data)
}

// 主进程入口：启动应用本体
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('./app')
