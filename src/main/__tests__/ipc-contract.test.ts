/**
 * IPC 契约闸门（docs/28 §3）：静态扫描源码，不 import Electron。
 * window.miai 用到的通道（shared/miai-api.ts 里 `t.invoke(IPC.x`）必须在 features/ 下恰有一处
 * `handle(IPC.x`（main/ipc.ts 的登记口）；不许重复注册；handler 用到的 key 必须在
 * ipc-channels.ts 里；features/ 之外不许直接 ipcMain.handle 或调 handle(IPC.…)。
 */
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const ROOT = join(__dirname, '..', '..', '..')
const MAIN = join(ROOT, 'src', 'main')
const FEATURES_DIR = join(MAIN, 'features')

/**
 * preload 里调用了、但主进程没有 handler 的通道。**没有项就保持空**；
 * 新增项必须写明原因（死代码残留 / 计划中），否则就是漏接线。
 */
const PRELOAD_WITHOUT_HANDLER_ALLOWLIST: readonly string[] = []

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (full.endsWith('.ts')) out.push(full)
  }
  return out
}

const featureFiles = walk(FEATURES_DIR)
const handled: string[] = featureFiles.flatMap((f) =>
  [...readFileSync(f, 'utf8').matchAll(/(?<![.\w])handle\(\s*IPC\.(\w+)/g)].map((m) => m[1])
)
const preloadKeys = [
  ...new Set(
    [...readFileSync(join(ROOT, 'src', 'shared', 'miai-api.ts'), 'utf8').matchAll(/\bt\.invoke(?:<[^>]*>)?\(\s*IPC\.(\w+)/g)].map(
      (m) => m[1]
    )
  )
]
const channelKeys = new Set(
  [...readFileSync(join(ROOT, 'src', 'shared', 'ipc-channels.ts'), 'utf8').matchAll(/^\s+(\w+)\s*:/gm)].map((m) => m[1])
)

describe('IPC contract', () => {
  it('每个 preload 通道在 features/ 下恰有一个 handler', () => {
    const missing = preloadKeys.filter(
      (k) => !handled.includes(k) && !PRELOAD_WITHOUT_HANDLER_ALLOWLIST.includes(k)
    )
    expect(missing).toEqual([])
    for (const k of preloadKeys) {
      if (PRELOAD_WITHOUT_HANDLER_ALLOWLIST.includes(k)) continue
      expect(handled.filter((h) => h === k), k).toHaveLength(1)
    }
  })

  it('没有通道被重复注册', () => {
    const dup = handled.filter((k, i) => handled.indexOf(k) !== i)
    expect(dup).toEqual([])
  })

  it('每个被处理的通道 key 都在 ipc-channels.ts 里', () => {
    expect(handled.filter((k) => !channelKeys.has(k))).toEqual([])
  })

  it('features/ 之外没有 ipcMain.handle / handle(IPC.…)（登记口 main/ipc.ts 自己除外）', () => {
    const offenders = walk(MAIN)
      .filter((f) => !f.startsWith(FEATURES_DIR + sep))
      .filter((f) => !f.includes(`${sep}__tests__${sep}`))
      .filter((f) => f !== join(MAIN, 'ipc.ts'))
      .filter((f) => /ipcMain\.handle\(|(?<![.\w])handle\(\s*IPC\./.test(readFileSync(f, 'utf8')))
      .map((f) => relative(ROOT, f))
    expect(offenders).toEqual([])
  })

  it('preload 只是传输层：不点名任何 IPC 通道', () => {
    const src = readFileSync(join(ROOT, 'src', 'preload', 'index.ts'), 'utf8')
    expect(/\bIPC\b/.test(src)).toBe(false)
  })
})
