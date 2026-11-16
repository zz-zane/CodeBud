import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UpdateSnapshot } from '../../shared/update'
import {
  UPDATE_CHECK_INTERVAL_MS,
  UPDATE_START_DELAY_MS,
  createUpdateController,
  resolveFeedUrlOverride,
  type AutoUpdaterLike
} from '../update/updater'

class FakeAutoUpdater implements AutoUpdaterLike {
  autoDownload = false
  autoInstallOnAppQuit = false
  allowPrerelease = true
  allowDowngrade = true
  logger = null
  feedUrl: { provider: 'generic'; url: string } | null = null
  checkCount = 0
  quitAndInstallCount = 0
  quitAndInstallArgs: Array<[boolean | undefined, boolean | undefined]> = []
  private listeners = new Map<string, Array<(...args: any[]) => void>>()
  checkImpl: () => Promise<unknown> = async () => ({})

  on(event: string, listener: (...args: any[]) => void): this {
    const list = this.listeners.get(event) ?? []
    list.push(listener)
    this.listeners.set(event, list)
    return this
  }

  emitEvent(event: string, ...args: any[]): void {
    for (const fn of this.listeners.get(event) ?? []) fn(...args)
  }

  setFeedURL(options: { provider: 'generic'; url: string }): void {
    this.feedUrl = options
  }

  checkForUpdates(): Promise<unknown> {
    this.checkCount += 1
    return this.checkImpl()
  }

  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void {
    this.quitAndInstallCount += 1
    this.quitAndInstallArgs.push([isSilent, isForceRunAfter])
  }
}

describe('createUpdateController', () => {
  let tempDir: string | null = null

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true })
      tempDir = null
    }
  })

  it('开发模式不自动检查，手动检查返回 unsupported(dev)', async () => {
    const updater = new FakeAutoUpdater()
    const emitted: UpdateSnapshot[] = []
    const ctrl = createUpdateController({
      version: '0.2.0',
      isPackaged: false,
      platform: 'win32',
      updater,
      isAutoEnabled: () => true,
      emit: (s) => emitted.push(s)
    })

    ctrl.start()
    vi.advanceTimersByTime(UPDATE_START_DELAY_MS + 1000)
    expect(updater.checkCount).toBe(0)
    expect(ctrl.getSnapshot().status).toEqual({ state: 'idle' })

    const res = await ctrl.check()
    expect(res).toEqual({
      version: '0.2.0',
      status: { state: 'unsupported', reason: 'dev' },
      manual: true
    })
    expect(updater.checkCount).toBe(0)
    ctrl.dispose()
  })

  it('非 win32 打包环境不自动检查，手动检查返回 unsupported(platform)', async () => {
    const updater = new FakeAutoUpdater()
    const ctrl = createUpdateController({
      version: '0.2.0',
      isPackaged: true,
      platform: 'darwin',
      updater,
      isAutoEnabled: () => true,
      emit: () => {}
    })

    ctrl.start()
    vi.advanceTimersByTime(UPDATE_START_DELAY_MS + 1000)
    expect(updater.checkCount).toBe(0)

    const res = await ctrl.check()
    expect(res.status).toEqual({ state: 'unsupported', reason: 'platform' })
    ctrl.dispose()
  })

  it('配置 updater 默认策略与测试源覆盖，完整走完 checking -> downloading -> ready -> install', async () => {
    const updater = new FakeAutoUpdater()
    const emitted: UpdateSnapshot[] = []
    updater.checkImpl = async () => {
      updater.emitEvent('update-available', { version: '0.2.1' })
      updater.emitEvent('download-progress', { percent: 37.4 })
      updater.emitEvent('update-downloaded', { version: '0.2.1' })
    }

    const ctrl = createUpdateController({
      version: '0.2.0',
      isPackaged: true,
      platform: 'win32',
      updater,
      isAutoEnabled: () => true,
      feedUrlOverride: 'http://127.0.0.1:18888',
      emit: (s) => emitted.push(structuredClone(s))
    })

    expect(updater.autoDownload).toBe(true)
    expect(updater.autoInstallOnAppQuit).toBe(true)
    expect(updater.allowPrerelease).toBe(false)
    expect(updater.allowDowngrade).toBe(false)
    expect(updater.feedUrl).toEqual({ provider: 'generic', url: 'http://127.0.0.1:18888' })
    expect(ctrl.install()).toEqual({ ok: false })

    ctrl.start()
    vi.advanceTimersByTime(UPDATE_START_DELAY_MS - 1)
    expect(updater.checkCount).toBe(0)
    vi.advanceTimersByTime(1)
    await vi.waitFor(() => expect(ctrl.getSnapshot().status).toEqual({ state: 'ready', version: '0.2.1' }))

    expect(emitted.map((s) => s.status)).toEqual([
      { state: 'checking' },
      { state: 'downloading', version: '0.2.1', percent: 0 },
      { state: 'downloading', version: '0.2.1', percent: 37 },
      { state: 'ready', version: '0.2.1' }
    ])
    expect(emitted[0].manual).toBe(false)
    expect(ctrl.install()).toEqual({ ok: true })
    expect(updater.quitAndInstallCount).toBe(1)
    expect(updater.quitAndInstallArgs).toEqual([[true, true]])
    ctrl.dispose()
  })

  it('无新版本流转为 latest 并记录 checkedAt；6 小时后再次自动检查', async () => {
    const updater = new FakeAutoUpdater()
    updater.checkImpl = async () => {
      updater.emitEvent('update-not-available')
    }
    const ctrl = createUpdateController({
      version: '0.2.0',
      isPackaged: true,
      platform: 'win32',
      updater,
      isAutoEnabled: () => true,
      now: () => 1700000000000,
      emit: () => {}
    })

    ctrl.start()
    vi.advanceTimersByTime(UPDATE_START_DELAY_MS)
    await vi.waitFor(() => expect(updater.checkCount).toBe(1))
    expect(ctrl.getSnapshot().status).toEqual({ state: 'latest', checkedAt: 1700000000000 })

    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS)
    await vi.waitFor(() => expect(updater.checkCount).toBe(2))
    ctrl.dispose()
  })

  it('关闭 auto 时启动和定时都不检查，但手动检查仍可触发', async () => {
    const updater = new FakeAutoUpdater()
    updater.checkImpl = async () => {
      updater.emitEvent('update-not-available')
    }
    const ctrl = createUpdateController({
      version: '0.2.0',
      isPackaged: true,
      platform: 'win32',
      updater,
      isAutoEnabled: () => false,
      now: () => 1234,
      emit: () => {}
    })

    ctrl.start()
    vi.advanceTimersByTime(UPDATE_START_DELAY_MS + UPDATE_CHECK_INTERVAL_MS)
    expect(updater.checkCount).toBe(0)

    const snap = await ctrl.check()
    expect(updater.checkCount).toBe(1)
    expect(snap).toEqual({
      version: '0.2.0',
      status: { state: 'latest', checkedAt: 1234 },
      manual: true
    })
    ctrl.dispose()
  })

  it('后台与手动检查出错均置为 error 且写入日志文件，不抛未捕获异常', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'miai-updater-test-'))
    const logPath = join(tempDir, 'updater.log')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const updater = new FakeAutoUpdater()
    updater.checkImpl = async () => {
      updater.emitEvent('error', new Error('net::ERR_INTERNET_DISCONNECTED'))
      throw new Error('net::ERR_INTERNET_DISCONNECTED')
    }

    const ctrl = createUpdateController({
      version: '0.2.0',
      isPackaged: true,
      platform: 'win32',
      updater,
      isAutoEnabled: () => true,
      logPath,
      emit: () => {}
    })

    ctrl.start()
    vi.advanceTimersByTime(UPDATE_START_DELAY_MS)
    await vi.waitFor(() => expect(ctrl.getSnapshot().status.state).toBe('error'))
    expect(ctrl.getSnapshot()).toEqual({
      version: '0.2.0',
      status: { state: 'error', message: 'net::ERR_INTERNET_DISCONNECTED' },
      manual: false
    })

    const manualSnap = await ctrl.check()
    expect(manualSnap).toEqual({
      version: '0.2.0',
      status: { state: 'error', message: 'net::ERR_INTERNET_DISCONNECTED' },
      manual: true
    })

    const logContent = readFileSync(logPath, 'utf8')
    expect(logContent).toContain('ERR_INTERNET_DISCONNECTED')
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
    ctrl.dispose()
  })

  it('MIAI_UPDATE_FEED_URL 仅接受 http(s)://127.0.0.1 或 http(s)://localhost，其它值忽略并写 WARN', () => {
    const warn = vi.fn()
    expect(resolveFeedUrlOverride(undefined, warn)).toBeUndefined()
    expect(resolveFeedUrlOverride('   ', warn)).toBeUndefined()
    expect(warn).not.toHaveBeenCalled()

    expect(resolveFeedUrlOverride('http://127.0.0.1:19555/feed', warn)).toBe('http://127.0.0.1:19555/feed')
    expect(resolveFeedUrlOverride('https://localhost:8443', warn)).toBe('https://localhost:8443')
    expect(warn).not.toHaveBeenCalled()

    for (const bad of [
      'https://evil.example.com/feed',
      'http://127.0.0.1.evil.com',
      'http://localhost.evil.com',
      'http://user@localhost:8080',
      'file:///C:/feed',
      'not-a-url'
    ]) {
      expect(resolveFeedUrlOverride(bad, warn)).toBeUndefined()
    }
    expect(warn).toHaveBeenCalledTimes(6)

    tempDir = mkdtempSync(join(tmpdir(), 'miai-updater-feed-'))
    const logPath = join(tempDir, 'updater.log')
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const updater = new FakeAutoUpdater()
    const ctrl = createUpdateController({
      version: '0.2.0',
      isPackaged: true,
      platform: 'win32',
      updater,
      isAutoEnabled: () => true,
      logPath,
      feedUrlOverride: 'https://evil.example.com',
      emit: () => {}
    })
    expect(updater.feedUrl).toBeNull()
    expect(readFileSync(logPath, 'utf8')).toContain('[WARN] ignoring disallowed MIAI_UPDATE_FEED_URL')
    expect(warnSpy).toHaveBeenCalled()
    warnSpy.mockRestore()
    ctrl.dispose()
  })
})
