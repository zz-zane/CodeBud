import { handle } from '../ipc'
import { IPC } from '../../shared/ipc-channels'
import { addSettle, parseSettlePayload, restoreOnStartup, type PendingSettleOp } from '../cloud'
import type { MainFeature } from '../context'

export const cloudFeature: MainFeature = {
  name: 'cloud',
  register(ctx) {
    const { settleQueue, uplink, accountFlowDeps } = ctx.cloud

    // 挑战结算入队（P10.x 上行接线）：渲染层收工时把一天的挑战成绩交上来。
    // 【为什么是"入队"而不是"发请求"】结算不能指望"提交那一刻正好在线"：
    // 断网/未登录时排进 .sync/pending-ops.json，下次触达服务端再发（幂等键 =
    // submissionId + 提交体 sha256，重试逐字节复用，见 pending-ops 文件头）。
    // invoke 只回"排上了没有"——网络结果不在渲染层的等待里。
    // 【载荷不合法就抛】照 checkinSubmit 的先例：那是渲染层传错了参数（我们
    // 自己的代码 bug），翻译成温和的失败只会把 bug 藏起来。
    handle(IPC.cloudChallengeSettle, (_e, raw: unknown) => {
      const payload = parseSettlePayload(raw)
      if (!payload) throw new Error('invalid settle payload')
      const op: PendingSettleOp = {
        submissionId: crypto.randomUUID(),
        dateKey: payload.dateKey,
        payload,
        attempts: 0,
        lastError: null,
        queuedAt: new Date().toISOString()
      }
      const before = settleQueue.read()
      const after = addSettle(before, op)
      const queued = after !== before
      if (queued) {
        settleQueue.write(after)
        // 入队即触发一次上行（fire-and-forget）。未登录 = 零网络 skip；
        // 已在飞的一轮会把它并进去（uplink 单飞），不会叠请求。
        void uplink.run().then(
          undefined,
          () => {
            /* run 除编程错误外不抛；真抛了也不该连坐"入队已成功"这个事实 */
          }
        )
      }
      return { queued }
    })

    // 启动恢复：扫描 session.bin，把已激活账号的盒接回来（还原会话 + 装账号
    // 账本）。【needsActivation 为什么不切盒】切过去界面看到空盒 = "数据没了"
    // —— 停在客人盒，由 cloud:state 读出 activated=false、界面引导收编
    // （P10.6）。【失败不连坐启动】扫描/装载异常出声报修，照常开窗在客人盒。
    // 【启动零网络】：移除启动时自动调用的 void uplink.run()，纯本地恢复账号盒
    try {
      const restore = restoreOnStartup(accountFlowDeps)
      if (restore.restored) {
        console.log(`[miai] account| session restored: ${String(restore.accountId)}`)
      } else if (restore.needsActivation) {
        console.log('[miai] account| signed in, activation pending')
      }
    } catch (err) {
      console.warn('[miai] session restore failed', err)
    }
  }
}
