import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { MainFeature } from '../context'
import { handle } from '../ipc'
import { IPC } from '../../shared/ipc-channels'
import type { UpdateSnapshot } from '../../shared/update'
import {
  createUpdateController,
  resolveFeedUrlOverride,
  type UpdateController
} from '../update/updater'

let controller: UpdateController | null = null

export const updateFeature: MainFeature = {
  name: 'update',
  register(ctx) {
    controller = createUpdateController({
      version: app.getVersion(),
      isPackaged: app.isPackaged,
      platform: process.platform,
      updater: autoUpdater,
      isAutoEnabled: () => ctx.readConfig(false).update.auto,
      logPath: join(ctx.storageDir, 'updater.log'),
      feedUrlOverride: resolveFeedUrlOverride(process.env.MIAI_UPDATE_FEED_URL, (msg) =>
        console.warn(`[miai] updater: ${msg}`)
      ),
      emit: (snapshot: UpdateSnapshot) => {
        for (const w of BrowserWindow.getAllWindows()) {
          if (!w.isDestroyed()) {
            try {
              w.webContents.send(IPC.updateStatus, snapshot)
            } catch {
              /* ignore closed window */
            }
          }
        }
      }
    })

    handle(IPC.updateGetStatus, () => controller!.getSnapshot())
    handle(IPC.updateCheck, () => controller!.check())
    handle(IPC.updateInstall, () => controller!.install())

    controller.start()
  },
  dispose() {
    controller?.dispose()
    controller = null
  }
}
