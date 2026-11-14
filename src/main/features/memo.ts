import { handle } from '../ipc'
import { IPC } from '../../shared/ipc-channels'
import type { BoxStamp } from '../store/box'
import type { DocWriteResult, StampedDoc } from '../../shared/doc-write'
import { attemptDocWrite } from '../store/doc-write'
import { cleanMemo, sanitizeMemo } from '../store/memo-merge'
import type { MemoFile } from '../../shared/types'
import type { MainFeature } from '../context'

export const memoFeature: MainFeature = {
  name: 'memo',
  register(ctx) {
    // 大肥鱼备忘录（P3 ②）：memo.json —— 用户自己攒的代码片段与知识备忘。
    // 和 favorites 同型：只有渲染层一个写方，整份读整份存；清洗与校形在 store/memo-merge.ts
    // （读口宽松、写口抛错 —— 备忘是用户自己敲的字，丢一条的代价比收藏一道题还大）
    const memoStore = ctx.stores.memo

    /** 读备忘录（memo.json）：读口，清洗与兼容都在 cleanMemo 里 */
    function readMemo(): MemoFile {
      const { file, needsRewrite } = cleanMemo(memoStore.read())
      if (needsRewrite) {
        try {
          memoStore.write(file)
        } catch {
          /* 落盘失败不影响本次使用 */
        }
      }
      return file
    }

    // ---- 大肥鱼备忘录（P3 ②）
    //
    // 同 favorites：**只有渲染层一个写方**，所以整份读、整份存 ——
    // 载入 + 防抖 + 退出冲刷那套落在渲染层的 memo store 里（照 favorites.ts）。
    // 主进程这层只管两件事：读时清洗（坏文件不丢用户敲的字）、写时校形（写错就抛）。
    handle(
      IPC.memoGet,
      (): StampedDoc<MemoFile> => ({ data: readMemo(), stamp: memoStore.stamp() })
    )

    handle(
      IPC.memoSave,
      (_e, file: MemoFile, stamp?: BoxStamp | null): DocWriteResult<MemoFile> =>
        attemptDocWrite({
          write: () => {
            // sanitize 里会抛：坏条目（id 空/重复、kind 不认识、body 非串或超 64KB）
            // **一个字节都不写**，磁盘上那份原样留着 —— 备忘丢了用户自己都复述不出来，
            // 所以这里比收藏那边更不允许"顺手丢一条"
            memoStore.write(sanitizeMemo(file), stamp ?? undefined)
          },
          readCurrent: () => readMemo(),
          stamp: () => memoStore.stamp()
        })
    )
  }
}
