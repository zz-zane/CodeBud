import { contextBridge, ipcRenderer } from 'electron'
import { createMiaiApi, type MiaiTransport } from '../shared/miai-api'

/**
 * preload 只做一件事：把 ipcRenderer 包成传输层交给 `createMiaiApi`，再暴露成 `window.miai`。
 * 方法清单与每个方法的说明都在 shared/miai-api.ts（手机浏览器用的是同一份定义）。
 * renderer 永远拿不到 ipcRenderer / node 原生对象。
 */
const ipcTransport: MiaiTransport = {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on(channel, listener) {
    const wrapped = (_e: Electron.IpcRendererEvent, payload: unknown): void => listener(payload)
    ipcRenderer.on(channel, wrapped)
    return () => {
      ipcRenderer.removeListener(channel, wrapped)
    }
  },
  isRemote: false
}

contextBridge.exposeInMainWorld('miai', createMiaiApi(ipcTransport))

export type { MiaiApi } from '../shared/miai-api'
