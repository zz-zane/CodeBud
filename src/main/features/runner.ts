import * as fs from 'fs'
import * as path from 'path'
import { BrowserWindow, dialog, shell, type OpenDialogOptions } from 'electron'
import { handle } from '../ipc'
import { IPC } from '../../shared/ipc-channels'
import { envMissingResult } from '../../shared/env-cache'
import type { EnvReport } from '../../shared/types'
import { RUNNER, EXPORT_MARKDOWN_PICK } from '../../shared/copy'
import { codeFingerprint } from '../../shared/code-hash'
import { refreshLangs, nativeEnv } from '../env/detect'
import { cancelCurrentRun, enqueueRun, isCurrentRunCanceled, killAllLiveChildren, MAX_CODE_BYTES, MAX_STDIN_BYTES, resetRunCancel } from '../runner/runner'
import { enqueueNativeRun, nativeGateReason } from '../runner/native'
import { exportCodeToFile, openInNativeIde } from '../runner/native-ide'
import { createNativeWatcher, type NativeWatcher } from '../runner/native-watch'
import { detectIdes } from '../runner/detect-ide'
import type { ExportCodeResult, IdeDetectResult, IdeOpenResult, LangOfCode, MarkdownExportFile, MarkdownExportResult, RunRequest } from '../../shared/types'
import { DEFAULT_APP_CONFIG, LANG_OF_CODE } from '../../shared/types'
import type { MainFeature } from '../context'

/**
 * 校验「{ lang, code }」形状的入参（runner:open-ide / runner:export-code 共用）。
 * **形状不对就抛**（同 runner:run 的规矩）：那是调用方写错了，
 * 翻译成一句温和的失败只会把 bug 藏起来。
 *
 * 【为什么不顺手把 runner:run 也改成用它】那条是 3.0 起就稳定运行的路径，
 * 还多验 native / stdin 两个字段 —— 为了「消一处重复」去动它，不值。
 */
function parseCodePayload(input: unknown): { lang: LangOfCode; code: string; own: boolean } {
  if (
    !input ||
    typeof input !== 'object' ||
    typeof (input as { lang?: unknown }).lang !== 'string' ||
    !(LANG_OF_CODE as readonly string[]).includes((input as { lang: string }).lang) ||
    typeof (input as { code?: unknown }).code !== 'string'
  ) {
    throw new Error('invalid code payload')
  }
  const { lang, code } = input as { lang: LangOfCode; code: string }
  if (Buffer.byteLength(code, 'utf8') > MAX_CODE_BYTES) throw new Error('code too large')
  // own（2026-10-06）：渲染层在**发起这次导出时**做的「这段是用户自己写的」
  // 一次性判定（种子比对，见 runner store 的 seedFp）。老调用方不带 = 按 false
  // 收（保守：宁可漏发奖，不把官方示例代码记成用户作品）；带了但不是布尔 =
  // 调用方坏了，如实抛（同其它字段的形状纪律）。
  const rawOwn = (input as { own?: unknown }).own
  if (rawOwn !== undefined && typeof rawOwn !== 'boolean') throw new Error('invalid code payload')
  return { lang, code, own: rawOwn === true }
}

// register 时建；dispose() 没有 ctx 参数，靠它收摊
let nativeWatcherRef: NativeWatcher | null = null

export const runnerFeature: MainFeature = {
  name: 'runner',
  register(ctx) {
    const { configStore, readConfig, commitEnvReport } = ctx

    /**
     * 原生编译路径的运行观察器（native-watch）：用户把练习场代码「本地 IDE 打开」
     * 或「导出」后，盯着同目录产物（.exe/.class）mtime 越过源文件那一刻 ——
     * 编译成功 = 用户自己写的代码跑起来了 = 大白饭 +1（经济闭环的第三条奖励来源，
     * 另两条是渲染层的内置运行与原生查看器）。接线口在 runnerOpenIde /
     * runnerExportCode 两个 handler 里（trackNativeCompile）。
     */
    const nativeWatcher = createNativeWatcher({
      onCompiled: (ev) => {
      }
    })
    nativeWatcherRef = nativeWatcher

    /**
     * 「本地 IDE 打开 / 导出」成功后的编译观察挂表（2026-10-06，原生路径的运行奖）。
     *
     * 【为什么只认 own】own 是渲染层发起这一次导出时的种子比对 ——
     * 「编辑器里这段不是官方示例代码」。示例代码导出/打开不挂表，于是「跑官方示例不奖励」这条
     * 规则在原生路径上也有机械保障（内置编辑器那条路同样只带 own 上报）。
     *
     * 【为什么指纹在这里算一次随表带入】用户接着会在 IDE 里改代码再编译（这正是
     * 「导出到本地」的用法）；确认那一刻重算指纹，奖励会记到一段我们**从没交出去**
     * 的代码头上（native-watch.ts 的契约注释写过这条）。指纹的身份是「交出去的那份」。
     *
     * python 不收（没有编译产物可观察）—— 由 native-watch 自己按语言划界，
     * 这里不做第二份判断。
     */
    function trackNativeCompile(
      result: IdeOpenResult | ExportCodeResult,
      lang: LangOfCode,
      code: string,
      own: boolean
    ): void {
      if (!result.ok || !own) return
      // ok 分支的 path 在两条返回类型里都是必填 string；再挡一手空串（防御性）
      if (result.path === '') return
      nativeWatcher.track({
        sourceFile: result.path,
        fingerprint: codeFingerprint(code),
        lang,
        startedAt: Date.now()
      })
    }

    // ---- 代码运行（M5-02）：入参校验 → 环境报告（缓存保鲜）→ 单任务队列
    //
    // 【3.0 加了原生模式，两条路是同一条队、但互不兜底】
    // req.native === true 时走 native.ts（借用户自己的 PATH + cmd.exe），否则走托管运行。
    // **不许有任何一条「这条不通就换那条」的分支**（红线 17）：原生失败必须原样报告失败，
    // 静默换回去的后果是用户以为自己跑的是自己装的编译器，其实不是。
    handle(IPC.runnerRun, async (_e, req: RunRequest) => {
      // 每次发起新的运行请求，重置取消标志
      resetRunCancel()

      if (
        !req ||
        typeof req !== 'object' ||
        typeof req.lang !== 'string' ||
        !(LANG_OF_CODE as readonly string[]).includes(req.lang) ||
        typeof req.code !== 'string'
      ) {
        throw new Error('invalid run payload')
      }
      if (req.native !== undefined && typeof req.native !== 'boolean') {
        throw new Error('invalid run payload')
      }
      if (Buffer.byteLength(req.code, 'utf8') > MAX_CODE_BYTES) throw new Error('code too large')
      if (req.stdin != null && Buffer.byteLength(req.stdin, 'utf8') > MAX_STDIN_BYTES) {
        throw new Error('stdin too large')
      }

      const cfg = configStore.read() ?? structuredClone(DEFAULT_APP_CONFIG)

      const gate = nativeGateReason(cfg.nativeRunEnabled === true, req.native)
      if (gate !== null) throw new Error(gate)

      // 缓存里报「没找到」的那门当场复核（只查它一个，跑代码用不到别的语言）。
      // 复核设置上限（2500ms）：正常机器耗时 <500ms，2.5s 留足 5 倍余量。超时直接按未找到返回，
      // 并明确告知用户可去设置页重新检测。
      // 【方案 B：超时后让后台复核继续跑并安全回写】
      // 不丢弃 refreshPromise，挂载 .then()；当后台探测晚到完成后，通过 commitEnvReport
      // 比对时间戳（startedAt >= fresh.envCache.at）：只要未被设置页的新检测顶掉，
      // 就将真实结果写盘并广播，确保用户下一次点击运行直接可用，不强迫用户手动作设置页重检。
      const startedAt = Date.now()
      const RECHECK_TIMEOUT_MS = 2500
      let timedOut = false
      const refreshPromise = refreshLangs(cfg.envCache.report, req.lang as LangOfCode)

      refreshPromise
        .then(({ report: lateReport, rechecked: lateRechecked }) => {
          if (timedOut) {
            commitEnvReport(lateReport, lateRechecked, startedAt)
          }
        })
        .catch((err) => {
          console.warn('[runner] late env recheck failed:', err)
        })

      let report: EnvReport = cfg.envCache.report ?? ({} as EnvReport)
      let rechecked: LangOfCode[] = []
      try {
        const res = await Promise.race([
          refreshPromise,
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('env_recheck_timeout')), RECHECK_TIMEOUT_MS)
          )
        ])
        report = res.report
        rechecked = res.rechecked
      } catch (err: any) {
        if (err?.message === 'env_recheck_timeout') {
          timedOut = true
        }
        report = cfg.envCache.report ?? ({} as EnvReport)
      }

      // 复核期间若用户已叫停，立即返回已取消，不进队列
      if (isCurrentRunCanceled()) {
        return {
          ok: false,
          phase: 'compile',
          stdout: '',
          stderr: '',
          exitCode: null,
          timedOut: false,
          truncated: false,
          canceled: true,
          message: RUNNER.CANCELED,
          durationMs: 0
        }
      }

      if (rechecked.length > 0 && !timedOut) {
        commitEnvReport(report, rechecked, startedAt)
      }

      if (timedOut) {
        return envMissingResult(
          req.lang as LangOfCode,
          RUNNER.ENV_RECHECK_TIMEOUT(req.lang as LangOfCode)
        )
      }

      // 复核后仍确认缺失环境：立即返回缺少环境结果，无需入队排队
      if (!report[req.lang as LangOfCode]?.found) {
        return envMissingResult(req.lang as LangOfCode)
      }

      const full = { ...req, timeoutSec: req.timeoutSec ?? cfg.runTimeoutSec }
      if (req.native === true) {
        return enqueueNativeRun(full, report, { env: await nativeEnv() })
      }
      return enqueueRun(full, report)
    })

    handle(IPC.runnerCancel, () => {
      return cancelCurrentRun()
    })

    // ---- 本地 IDE 联动（2026-10-01）：练习场「本地 IDE 打开 / 导出并复制路径」+ 设置页选程序
    //
    // 三条通道都是「**失败即值，不抛**」：没配置 / 程序不在 / 用户取消，都是使用它的
    // 日常，不该逼每个调用点写 try/catch；只有**入参形状不对**才抛（parseCodePayload）。
    //
    // ⚠️ exe 路径**不在任何入参里**：openInNativeIde 自己从 readConfig() 现读 ——
    // 让渲染层传 exe 的话，这条通道就成了「任意程序执行」。
    handle(
      IPC.exportMarkdown,
      async (event, input: unknown): Promise<MarkdownExportResult> => {
        const files = Array.isArray(input) ? (input as MarkdownExportFile[]) : []
        if (files.length === 0) {
          return { ok: false, error: 'empty_files' }
        }

        // 1. 严格文件名校验（IPC 入参不可信，非法格式直接回绝，绝不静默修整）
        const WINDOWS_RESERVED = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i
        const INVALID_CHARS = /[\\/:*?"<>|\x00-\x1f\x7f]/

        for (const f of files) {
          if (!f || typeof f.filename !== 'string' || typeof f.content !== 'string') {
            return { ok: false, error: 'bad_filename' }
          }
          const fname = f.filename.trim()
          if (
            !fname ||
            fname === '.' ||
            fname === '..' ||
            INVALID_CHARS.test(fname) ||
            WINDOWS_RESERVED.test(fname)
          ) {
            return { ok: false, error: 'bad_filename' }
          }
        }

        const win = BrowserWindow.fromWebContents(event.sender)
        const options: OpenDialogOptions = {
          title: EXPORT_MARKDOWN_PICK.TITLE,
          properties: ['openDirectory', 'createDirectory']
        }
        const { canceled, filePaths } = win
          ? await dialog.showOpenDialog(win, options)
          : await dialog.showOpenDialog(options)

        const targetDir = filePaths[0]
        if (canceled || !targetDir) {
          return { ok: false, canceled: true }
        }

        try {
          await fs.promises.access(targetDir, fs.constants.W_OK)

          for (const f of files) {
            let candidateName = f.filename.trim()
            let fullPath = path.join(targetDir, candidateName)

            // 2. 严格路径穿越断言（通过 path.relative 判定，严禁字符串 startsWith 误放行）
            let rel = path.relative(targetDir, fullPath)
            if (rel.startsWith('..') || path.isAbsolute(rel)) {
              return { ok: false, error: 'path_escape' }
            }

            // 3. 不覆盖已有文件：若目标路径已存在同名文档，自动友好递增 (2), (3)... 并复验路径边界
            const dotIdx = candidateName.lastIndexOf('.')
            const base = dotIdx !== -1 ? candidateName.slice(0, dotIdx) : candidateName
            const ext = dotIdx !== -1 ? candidateName.slice(dotIdx) : ''
            let counter = 2

            while (true) {
              try {
                await fs.promises.access(fullPath)
                // 文件已存在，递增编号
                candidateName = `${base} (${counter})${ext}`
                fullPath = path.join(targetDir, candidateName)
                rel = path.relative(targetDir, fullPath)
                if (rel.startsWith('..') || path.isAbsolute(rel)) {
                  return { ok: false, error: 'path_escape' }
                }
                counter++
              } catch {
                // 文件不存在（ENOENT），可以使用该路径写入
                break
              }
            }

            await fs.promises.writeFile(fullPath, f.content, 'utf8')
          }
          return { ok: true, dir: targetDir, exportedCount: files.length }
        } catch (err: any) {
          return { ok: false, error: err?.message || String(err) }
        }
      }
    )

    handle(IPC.runnerOpenIde, async (_e, input: unknown): Promise<IdeOpenResult> => {
      const { lang, code, own } = parseCodePayload(input)
      // deps 只给 readConfig：exe 的来源必须是那个带迁移的唯一读口（不是配置快照）
      const result = await openInNativeIde(lang, code, { readConfig })
      trackNativeCompile(result, lang, code, own)
      return result
    })

    handle(IPC.runnerExportCode, (_e, input: unknown): ExportCodeResult => {
      const { lang, code, own } = parseCodePayload(input)
      // deps 只给 readConfig：导出编码跟随该语言配好的 IDE（v9 起），
      // 来源同样必须是那个带迁移的唯一读口（不是配置快照）。
      const result = exportCodeToFile(lang, code, { readConfig })
      trackNativeCompile(result, lang, code, own)
      return result
    })

    // 自动探测本机装了哪些 IDE（设置页 / 练习场「🔍 自动检测」）。
    // 【shell 为什么在这里注入】detect-ide.ts 故意不 import electron ——
    // 否则 vitest 一 import 它就会去加载 electron（见该文件头的依赖注入说明）。
    // 解 .lnk 只有主进程的 shell 能做，所以 readShortcut 在接线处传进去。
    handle(IPC.runnerDetectIde, (): Promise<IdeDetectResult> =>
      detectIdes({ readShortcut: (p) => shell.readShortcutLink(p).target })
    )
  },

  // 退出前收割还在跑的编译/运行子进程：超时杀树靠主进程定时器，而主人跑着
  // 死循环程序直接点 X 时定时器随进程消亡 —— 不收割就是孤儿进程继续烧 CPU
  dispose() {
    killAllLiveChildren()
    // 原生编译观察器收摊（清表 + 停轮询）
    nativeWatcherRef?.stop()
  }
}
