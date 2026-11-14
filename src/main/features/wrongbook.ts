import { handle } from '../ipc'
import { IPC } from '../../shared/ipc-channels'
import { applyWrongRecord, applyWrongUpdate, normalizeWrongbook } from '../store/wrongbook-merge'
import type { WrongBookEntry, WrongRecordItem, WrongUpdateItem } from '../../shared/types'
import { CURRENT_WRONGBOOK_VERSION } from '../../shared/types'
import type { MainFeature } from '../context'

export const wrongbookFeature: MainFeature = {
  name: 'wrongbook',
  register(ctx) {
    // 错题本（M4-05）：wrongbook.json。2026-09-29 起根是**信封**（`{version, entries}`），
    // 老文件是裸数组 —— 形状的兼容与清洗全在 normalizeWrongbook（读口 readWrongbook）
    const wrongbookStore = ctx.stores.wrongbook

    /**
     * 读错题本 —— 读口唯一入口，形状兼容（裸数组 / 信封）全在 `normalizeWrongbook` 里。
     *
     * 【为什么必须收口】和 profile 同款：这个文件的根**换了形状**（裸数组 → 信封），
     * 而且条目加了 source / removed / hole。任何一处绕过它直接 `wrongbookStore.read()`，
     * 拿到的就是一份「类型说是信封、实际是数组」的东西 —— 而 TS 不会报错，
     * 因为磁盘上的形状它根本看不见。
     *
     * 【为什么会写盘】认出裸数组、或者这次迁掉了坏条目 → 把干净的信封写回去，
     * 顺手给文件补上版本号（和 readConfig 的「迁完落一次盘」同一笔账）。
     * 写失败不阻塞读取：内存里这份是好的，顶多下次读再迁一遍（幂等）。
     */
    function readWrongbook(): WrongBookEntry[] {
      const { file, needsRewrite } = normalizeWrongbook(wrongbookStore.read())
      if (needsRewrite) {
        try {
          wrongbookStore.write(file)
        } catch {
          /* 落盘失败不影响本次使用 */
        }
      }
      return file.entries
    }

    /**
     * 写错题本：**只走这里**，免得某处写回一个裸数组把刚补上的信封又拆了。
     *
     * 【为什么没有条件写戳（P10.6 定案）】错题本三条写口是**操作型**：主进程
     * 拿到最新盘面自己 RMW，任何时刻写下的都是最新数据 —— 天然无冲突。
     * 给它加戳只会把「用户刚答错一题」延迟成「重载 + 重放」，而那个冲突
     * 根本防不住任何东西（没有第二个写者会覆盖它）。
     */
    function writeWrongbook(entries: WrongBookEntry[]): void {
      wrongbookStore.write({ version: CURRENT_WRONGBOOK_VERSION, entries })
    }

    // ---- 错题本（M4-05，学习闭环扩）
    //
    // 三条路全部走 readWrongbook() / writeWrongbook()：读口负责把老形状搬成信封、
    // 写口保证永远写出信封。**别在这里再出现裸的 wrongbookStore.read()**。
    handle(IPC.wrongbookGet, () => readWrongbook())

    handle(IPC.wrongbookRecord, (_e, items: WrongRecordItem[]) => {
      if (!Array.isArray(items)) throw new Error('invalid wrongbook payload')
      // 合并 + 裁剪 + 复活名单**一次算完**，全在 applyWrongRecord 里（纯函数，
      // 单测在 store/__tests__）。里面三条规矩都是「错了不会报错」的那种：
      // AI 题必带本体、AI 题封顶、**复活名单要在合并前问**（合并会把"删过"的证据抹掉，
      // 顺序反了提示就永久沉默）。顺序收在纯函数里，才有测试守得住 —— 见它的注释
      const { entries, revived } = applyWrongRecord(
        readWrongbook(),
        items,
        new Date().toISOString()
      )
      writeWrongbook(entries)
      // 返回给渲染层 → finish() 弹「这条你删过，又答错了喵」。
      // 返回类型从 void 变成 string[] 是**加法**，老调用点忽略返回值即可
      return revived
    })

    handle(IPC.wrongbookClear, (_e, keys: string[]) => {
      if (!Array.isArray(keys) || keys.some((k) => typeof k !== 'string')) {
        throw new Error('invalid wrongbook payload')
      }
      const all = readWrongbook()
      const now = new Date().toISOString()
      // AI 题和内置题走**同一套**：答对就标 cleared，不特殊对待。
      // 给某一类题开个例外（比如「答对了直接删」）看着只多一行，
      // 代价是「历史会保留」那句话从此只对一半的题成立，而用户没法知道是哪一半
      for (const e of all) {
        if (!e.cleared && keys.includes(e.key)) {
          e.cleared = true
          e.clearedAt = now
        }
      }
      writeWrongbook(all)
    })

    // 用户手动动一条：软删 / 恢复 / 标漏洞（学习闭环）。
    // 合并逻辑在 applyWrongUpdate（纯函数，单测在 store/__tests__），这里只管形状与落盘。
    // 返回**新列表**，渲染层的错题本 store 直接用它刷新快照。
    handle(IPC.wrongbookUpdate, (_e, updates: WrongUpdateItem[]) => {
      if (!Array.isArray(updates)) throw new Error('invalid wrongbook payload')
      const next = applyWrongUpdate(readWrongbook(), updates, new Date().toISOString())
      writeWrongbook(next)
      return next
    })
  }
}
