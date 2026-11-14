import { handle } from '../ipc'
import { IPC } from '../../shared/ipc-channels'
import { appendPractice, normalizePractice } from '../store/practice-merge'
import type { PracticeFile, PracticeRecordInput } from '../../shared/types'
import type { MainFeature } from '../context'

export const practiceFeature: MainFeature = {
  name: 'practice',
  register(ctx) {
    // 练习史（学习闭环）：practice.json —— 每日复习按错误率加权的**真源**。
    // 一次做完的练习落一条；上限与裁剪见 shared/types.ts 的 PRACTICE_KEEP_SESSIONS
    const practiceStore = ctx.stores.practice
    const device = ctx.device

    /** 读练习史（practice.json）：读口，清洗与裁剪都在 normalizePractice 里 */
    function readPractice(): PracticeFile {
      // installId 只为老会话回填 uid（v1→v2；回填结果会随 needsRewrite 落盘）
      const { file, needsRewrite } = normalizePractice(practiceStore.read(), device().installId)
      if (needsRewrite) {
        try {
          practiceStore.write(file)
        } catch {
          /* 落盘失败不影响本次使用 */
        }
      }
      return file
    }

    // ---- 练习史（学习闭环）
    //
    // 记账的唯一落点在渲染层的 finish()（见 docs/20 §2.2）—— 这里只负责
    // 校验入参、铸 id、追加、按上限裁剪，全是纯函数（practice-merge.ts）。
    handle(IPC.practiceRecord, (_e, input: PracticeRecordInput) => {
      // 返回新文件：渲染层手里那份（每日复习加权要用）顺手就换掉了，
      // 省一次 getPractice 往返，也就没有「写成功了、读到的还是旧的」这种缝
      const next = appendPractice(
        readPractice(),
        input,
        new Date().toISOString(),
        device().installId
      )
      practiceStore.write(next)
      return next
    })

    handle(IPC.practiceGet, () => readPractice())
  }
}
