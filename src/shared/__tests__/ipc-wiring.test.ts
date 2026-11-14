import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { IPC } from '../ipc-channels'
import { maskComments } from './mask-comments'

const root = join(__dirname, '..', '..')

// window.miai 的方法清单（点名通道的地方）在 shared/miai-api.ts；preload 只是传输层
const preloadSrc = maskComments(readFileSync(join(root, 'shared', 'miai-api.ts'), 'utf8'))
// 主进程接线分散在组合根（app.ts）、上下文（context.ts，含 configExternal 推送）与 features/ 各功能文件
const mainDir = join(root, 'main')
const mainFiles = [
  join(mainDir, 'app.ts'),
  join(mainDir, 'context.ts'),
  ...readdirSync(join(mainDir, 'features')).filter((f) => f.endsWith('.ts')).map((f) => join(mainDir, 'features', f))
]
const mainSrc = mainFiles.map((f) => maskComments(readFileSync(f, 'utf8'))).join('\n')

function channelsIn(src: string, pattern: RegExp): string[] {
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = pattern.exec(src)) !== null) out.push(m[1])
  return out
}

const declared = Object.keys(IPC)

/** 仍保留常量与 preload 订阅、但主进程已不再推送的退役通道（桌宠等推送方已随退役代码清理删除） */
const RETIRED_CHANNELS = new Set<string>()

const preloadUsed = channelsIn(preloadSrc, /\bt\.(?:invoke|on)(?:<[^>]*>)?\(\s*IPC\.(\w+)/g)
const mainHandled = channelsIn(mainSrc, /(?<![.\w])handle\(\s*IPC\.(\w+)/g)
const mainPushed = channelsIn(mainSrc, /\.send\(\s*IPC\.(\w+)/g)
const mainRegistered = [...mainHandled, ...mainPushed]

describe('IPC 接线（首版活跃契约）', () => {
  it('自检：成功提取主进程与 Preload 中的活跃 IPC 注册', () => {
    expect(declared.length).toBeGreaterThan(0)
    expect(preloadUsed.length).toBeGreaterThan(0)
    expect(mainRegistered.length).toBeGreaterThan(0)
  })

  it('preload 中活跃调用的核心通道，主进程都有真实注册', () => {
    const handled = new Set(mainRegistered)
    const missing = preloadUsed.filter((c) => !handled.has(c) && !RETIRED_CHANNELS.has(c))
    expect(missing, `这些核心通道 preload 在调、主进程未注册：${missing.join(', ')}`).toEqual([])
  })

  it('IPC 常量表中除去退役通道外，核心业务通道均被妥善处理', () => {
    const handled = new Set(mainRegistered)
    const orphan = declared.filter((c) => !handled.has(c) && !RETIRED_CHANNELS.has(c))
    expect(orphan, `这些核心通道名在 IPC 中但主进程未处理：${orphan.join(', ')}`).toEqual([])
  })

  it('业务接线代码里不许出现裸的通道字符串', () => {
    const activeSources = [preloadSrc, mainSrc]
    const bare = Object.values(IPC).filter((v) => {
      const quoted = new RegExp(`['"\`]${v}['"\`]`)
      return activeSources.some((s) => quoted.test(s))
    })
    expect(bare, `这些通道名被写成裸字符串，请使用 IPC 常量：${bare.join(', ')}`).toEqual([])
  })
})
