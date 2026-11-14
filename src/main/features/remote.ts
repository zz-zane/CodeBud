import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { IPC } from '../../shared/ipc-channels'
import { clampRemotePort } from '../../shared/config-schema'
import type { DevicesFile, RemoteStatus } from '../../shared/remote-auth'
import { createJsonStore } from '../store/json-store'
import { handle, lookupHandler } from '../ipc'
import { listAddresses } from '../remote/addresses'
import { createDeviceRegistry } from '../remote/devices'
import { createRemoteServer, resolveBindHost, type RemoteServer } from '../remote/server'
import type { MainContext, MainFeature } from '../context'

// register 时填；dispose() 没有参数，靠它停服务
let current: { server: RemoteServer; unsubscribe: () => void } | null = null

/**
 * 手机连接（docs/29）：管理口（状态 / 开关 / 端口 / 撤销 / 换码）+ 按配置启停 HTTP 服务。
 * 管理口只给电脑端设置页用，不在 shared/remote-channels.ts 白名单里。
 * 监听失败（端口被占用等）如实记进状态，不静默换端口。
 */
export const remoteFeature: MainFeature = {
  name: 'remote',
  register(ctx: MainContext) {
    const registry = createDeviceRegistry(createJsonStore<DevicesFile>(ctx.storageDir, 'remote-devices.json'))
    const server = createRemoteServer({
      devices: registry,
      lookupHandler,
      assets: ctx.httpAssets,
      rendererDir: ctx.rendererDir
    })
    // 开发模式（Vite dev server）下渲染层目录是上一次生产构建的产物，可能不存在；不存在就如实报
    const bindHost = resolveBindHost(process.env['MIAI_REMOTE_HOST'])
    const rendererAvailable = existsSync(join(ctx.rendererDir, 'index.html'))
    let lastError: RemoteStatus['error'] = null
    let runningPort = 0
    let queue: Promise<void> = Promise.resolve()

    /** 让服务状态与配置一致；调用串行，幂等 */
    function reconcile(): Promise<void> {
      queue = queue.then(async () => {
        const cfg = ctx.readConfig(false).remote
        if (!cfg.enabled) {
          await server.stop()
          runningPort = 0
          lastError = null
          return
        }
        if (server.isRunning() && runningPort === cfg.port) return
        await server.stop()
        runningPort = 0
        if (!rendererAvailable) {
          lastError = { code: 'no-renderer', detail: '' }
          return
        }
        const r = await server.start(cfg.port, bindHost)
        if (r.ok) {
          runningPort = cfg.port
          lastError = null
        } else {
          lastError = { code: r.code, detail: r.detail }
        }
      })
      return queue
    }

    function status(): RemoteStatus {
      const cfg = ctx.readConfig(false).remote
      const running = server.isRunning()
      return {
        enabled: cfg.enabled,
        port: cfg.port,
        running,
        error: lastError,
        pairingCode: server.pairingCode(),
        lockedUntil: server.lockedUntil(),
        devices: registry.list().map(({ id, name, pairedAt, lastSeenAt }) => ({ id, name, pairedAt, lastSeenAt })),
        latestLogin: registry.latestLogin(),
        // 惰性枚举：只有服务开着、设置页来取状态时才读网卡，且不落盘不写日志。
        // 绑定地址被环境变量指定成某个具体 IP（验证 / 调试用）时，服务只在那一个地址上听，不枚举网卡
        addresses: !running ? [] : bindHost === '0.0.0.0' ? listAddresses() : [{ address: bindHost, name: 'MIAI_REMOTE_HOST', overlay: false }],
        rendererAvailable
      }
    }

    function writeRemote(patch: Partial<{ enabled: boolean; port: number }>): void {
      const cfg = ctx.readConfig(false)
      ctx.configStore.write({ ...cfg, remote: { ...cfg.remote, ...patch } })
      ctx.broadcastPublicConfig()
    }

    handle(IPC.remoteGetStatus, () => status())
    handle(IPC.remoteSetEnabled, async (_e, enabled: unknown) => {
      if (typeof enabled !== 'boolean') throw new Error('remote: invalid enabled')
      writeRemote({ enabled })
      await reconcile()
      return status()
    })
    handle(IPC.remoteSetPort, async (_e, port: unknown) => {
      if (typeof port !== 'number' || !Number.isInteger(port)) throw new Error('remote: invalid port')
      writeRemote({ port: clampRemotePort(port) })
      await reconcile()
      return status()
    })
    handle(IPC.remoteRevokeDevice, (_e, id: unknown) => {
      if (typeof id !== 'string') throw new Error('remote: invalid device id')
      if (registry.revoke(id)) server.dropDevice(id)
      return status()
    })
    handle(IPC.remoteRevokeAll, () => {
      registry.revokeAll()
      server.dropAllDevices()
      return status()
    })
    handle(IPC.remoteRegenerateCode, () => {
      server.regenerateCode()
      return status()
    })

    // 设置变化（含 config:save 里带 remote 的情形）→ 推给手机，并让服务跟上配置
    const unsubscribe = ctx.addConfigSink((pub) => {
      server.broadcast(IPC.configExternal, pub)
      void reconcile()
    })
    const unsubscribeChat = ctx.addChatSessionsSink(() => server.broadcast(IPC.aiSessionsChanged, null))
    current = { server, unsubscribe: () => { unsubscribe(); unsubscribeChat() } }
    void reconcile()
  },
  dispose() {
    current?.unsubscribe()
    void current?.server.stop()
    current = null
  }
}
