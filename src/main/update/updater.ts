import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { UpdateSnapshot, UpdateStatus } from '../../shared/update'

export const UPDATE_START_DELAY_MS = 15_000
export const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000

const ALLOWED_OVERRIDE_HOSTS = new Set(['127.0.0.1', 'localhost'])

/**
 * Only local HTTP(S) test feeds (`127.0.0.1` / `localhost`) may override the GitHub release source.
 */
export function resolveFeedUrlOverride(
  rawUrl: string | undefined,
  onWarn?: (message: string) => void
): string | undefined {
  const trimmed = rawUrl?.trim()
  if (!trimmed) return undefined
  try {
    const parsed = new URL(trimmed)
    const isHttp = parsed.protocol === 'http:' || parsed.protocol === 'https:'
    if (isHttp && !parsed.username && !parsed.password && ALLOWED_OVERRIDE_HOSTS.has(parsed.hostname)) {
      return trimmed
    }
  } catch {
    /* fall through to warn */
  }
  onWarn?.(`ignoring disallowed MIAI_UPDATE_FEED_URL "${trimmed}": only http(s)://127.0.0.1 or http(s)://localhost is allowed`)
  return undefined
}

export interface UpdaterLogger {
  info(message?: unknown): void
  warn(message?: unknown): void
  error(message?: unknown): void
}

export interface AutoUpdaterLike {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  allowPrerelease: boolean
  allowDowngrade: boolean
  logger?: UpdaterLogger | null
  on(event: string, listener: (...args: any[]) => void): unknown
  setFeedURL?(options: { provider: 'generic'; url: string }): void
  checkForUpdates(): Promise<unknown>
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void
}

export interface UpdateControllerDeps {
  version: string
  isPackaged: boolean
  platform: NodeJS.Platform
  updater: AutoUpdaterLike
  isAutoEnabled: () => boolean
  emit: (snapshot: UpdateSnapshot) => void
  logPath?: string
  feedUrlOverride?: string
  now?: () => number
  startDelayMs?: number
  checkIntervalMs?: number
}

export interface UpdateController {
  start(): void
  getSnapshot(): UpdateSnapshot
  check(): Promise<UpdateSnapshot>
  install(): { ok: boolean }
  dispose(): void
}

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message.trim() || err.name
  if (typeof err === 'string') return err.trim()
  try {
    return JSON.stringify(err)
  } catch {
    return String(err)
  }
}

function appendLog(logPath: string | undefined, level: string, message: unknown): void {
  if (!logPath) return
  try {
    mkdirSync(dirname(logPath), { recursive: true })
    const line = `${new Date().toISOString()} [${level}] ${typeof message === 'string' ? message : formatError(message)}\n`
    appendFileSync(logPath, line, 'utf8')
  } catch {
    /* ignore log write failures */
  }
}

export function createUpdateController(deps: UpdateControllerDeps): UpdateController {
  const now = deps.now ?? Date.now
  const startDelayMs = deps.startDelayMs ?? UPDATE_START_DELAY_MS
  const checkIntervalMs = deps.checkIntervalMs ?? UPDATE_CHECK_INTERVAL_MS
  const supported = deps.isPackaged && deps.platform === 'win32'

  let status: UpdateStatus = { state: 'idle' }
  let manual = false
  let downloadingVersion = ''
  let activeCheck: Promise<UpdateSnapshot> | null = null
  let settleCheck: (() => void) | null = null
  let startTimer: ReturnType<typeof setTimeout> | null = null
  let intervalTimer: ReturnType<typeof setInterval> | null = null
  let disposed = false

  function writeLog(level: 'INFO' | 'WARN' | 'ERROR', msg: unknown): void {
    appendLog(deps.logPath, level, msg)
    if (level !== 'INFO') console.warn(`[miai] updater: ${typeof msg === 'string' ? msg : formatError(msg)}`)
  }

  function snapshot(): UpdateSnapshot {
    return { version: deps.version, status, manual }
  }

  function setStatus(next: UpdateStatus, nextManual = manual): void {
    status = next
    manual = nextManual
    deps.emit(snapshot())
  }

  function finishCheck(): void {
    const done = settleCheck
    settleCheck = null
    activeCheck = null
    done?.()
  }

  if (supported) {
    const { updater } = deps
    updater.autoDownload = true
    updater.autoInstallOnAppQuit = true
    updater.allowPrerelease = false
    updater.allowDowngrade = false
    updater.logger = {
      info: (m) => writeLog('INFO', m),
      warn: (m) => writeLog('WARN', m),
      error: (m) => writeLog('ERROR', m)
    }
    const feedUrl = resolveFeedUrlOverride(deps.feedUrlOverride, (msg) => writeLog('WARN', msg))
    if (feedUrl && updater.setFeedURL) {
      updater.setFeedURL({ provider: 'generic', url: feedUrl })
      writeLog('INFO', `feed URL overridden for testing: ${feedUrl}`)
    }

    updater.on('checking-for-update', () => {
      if (disposed) return
      if (status.state !== 'checking') setStatus({ state: 'checking' })
    })

    updater.on('update-available', (info?: { version?: unknown }) => {
      if (disposed) return
      downloadingVersion = typeof info?.version === 'string' && info.version ? info.version : ''
      setStatus({ state: 'downloading', version: downloadingVersion, percent: 0 })
    })

    updater.on('update-not-available', () => {
      if (disposed) return
      downloadingVersion = ''
      setStatus({ state: 'latest', checkedAt: now() })
      finishCheck()
    })

    updater.on('download-progress', (progress?: { percent?: unknown }) => {
      if (disposed) return
      const rawPercent = typeof progress?.percent === 'number' && Number.isFinite(progress.percent) ? progress.percent : 0
      const percent = Math.max(0, Math.min(100, Math.round(rawPercent)))
      const version = status.state === 'downloading' ? status.version : downloadingVersion
      setStatus({ state: 'downloading', version, percent })
    })

    updater.on('update-downloaded', (info?: { version?: unknown }) => {
      if (disposed) return
      const version = typeof info?.version === 'string' && info.version ? info.version : downloadingVersion
      downloadingVersion = ''
      setStatus({ state: 'ready', version })
      finishCheck()
    })

    updater.on('error', (err?: unknown) => {
      if (disposed) return
      const message = formatError(err)
      writeLog('ERROR', message)
      setStatus({ state: 'error', message })
      finishCheck()
    })
  }

  function runCheck(isManual: boolean): Promise<UpdateSnapshot> {
    if (disposed) return Promise.resolve(snapshot())
    if (!deps.isPackaged) {
      setStatus({ state: 'unsupported', reason: 'dev' }, isManual)
      return Promise.resolve(snapshot())
    }
    if (deps.platform !== 'win32') {
      setStatus({ state: 'unsupported', reason: 'platform' }, isManual)
      return Promise.resolve(snapshot())
    }
    if (status.state === 'ready') {
      if (isManual) setStatus(status, true)
      return Promise.resolve(snapshot())
    }
    if (activeCheck) {
      if (isManual && !manual) setStatus(status, true)
      return activeCheck
    }

    setStatus({ state: 'checking' }, isManual)
    const promise = new Promise<UpdateSnapshot>((resolve) => {
      settleCheck = () => resolve(snapshot())
    })
    activeCheck = promise

    void Promise.resolve()
      .then(() => deps.updater.checkForUpdates())
      .catch((err) => {
        if (disposed || activeCheck !== promise) return
        const message = formatError(err)
        writeLog('ERROR', message)
        setStatus({ state: 'error', message })
        finishCheck()
      })

    return promise
  }

  function maybeAutoCheck(): void {
    if (disposed || !supported || !deps.isAutoEnabled()) return
    void runCheck(false)
  }

  return {
    start() {
      if (disposed || !supported) return
      if (startTimer || intervalTimer) return
      startTimer = setTimeout(() => {
        startTimer = null
        maybeAutoCheck()
      }, startDelayMs)
      startTimer.unref?.()
      intervalTimer = setInterval(() => {
        maybeAutoCheck()
      }, checkIntervalMs)
      intervalTimer.unref?.()
    },

    getSnapshot() {
      return snapshot()
    },

    check() {
      return runCheck(true)
    },

    install() {
      if (status.state !== 'ready') return { ok: false }
      // Use silent + force-run so assisted NSIS (oneClick: false) upgrades and relaunches automatically.
      deps.updater.quitAndInstall(true, true)
      return { ok: true }
    },

    dispose() {
      disposed = true
      if (startTimer) {
        clearTimeout(startTimer)
        startTimer = null
      }
      if (intervalTimer) {
        clearInterval(intervalTimer)
        intervalTimer = null
      }
      finishCheck()
    }
  }
}
