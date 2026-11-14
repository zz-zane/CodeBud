import { handle } from '../ipc'
import { IPC } from '../../shared/ipc-channels'
import { parseDateKey } from '../../shared/dates'
import type { BoxStamp } from '../store/box'
import type { DocWriteResult, StampedDoc } from '../../shared/doc-write'
import { attemptDocWrite } from '../store/doc-write'
import { applyProfileSave } from '../store/profile-apply'
import { applyCheckin, migrateProfile } from '../../shared/profile-migrate'
// 日键正则从冻结区 import（protocol.ts 一个字不动，只读它的常量；它零依赖，无环）
import { DATE_KEY_RE } from '../../shared/cloud/protocol'
import type { CheckinSubmitResult, UserProfile } from '../../shared/types'
import { DEFAULT_PROFILE } from '../../shared/types'
import type { MainFeature } from '../context'

export const profileFeature: MainFeature = {
  name: 'profile',
  register(ctx) {
    const profileStore = ctx.stores.profile

    /**
     * 读学习档案 —— 和 `readConfig()` 是**同一套收口**，理由也同源。
     *
     * 【为什么必须收口】
     * 档案原来有两处裸读写（`profile:get` 直接 `read()`、`profile:save` 直接 `write()`），
     * 意思是「文件里是什么就信什么」。老档案（v1）里没有 `rewards` 这一节，
     * 新代码一读它就是 `undefined` —— 发奖逻辑 `.gallery.includes(...)` 当场抛错。
     * 收成一个读口之后，**迁移只有可能漏在一条路上**（就是把 `profileStore.read()`
     * 再加回来），而那种漏法是能一眼看出来的。
     *
     * 【为什么迁完要落一次盘】和 readConfig 一字不差：不落盘也能用，但文件里的
     * `version` 会永远停在 1 而内存里跑的是 v2，将来排查问题时对不上号。
     * 只在版本真的变了时才写；写失败不阻塞读取（迁移幂等，下次读再迁一遍）。
     *
     * ⚠️ 别把 `DEFAULT_PROFILE` 直接交出去 —— 它是共享常量，调用方一改就污染全局。
     */
    /**
     * 内部读口：**完整**档案（含 learnedAt / favoriteAt / tombstones 这些合并内部账）。
     * 主进程自己用（写口 apply 的基底、签到/发奖的读改写）。**别直接递给渲染层** ——
     * 对渲染层的读口是下面那个 readProfile()，它负责剥掉墓碑区再出门。
     */
    function readProfileRaw(): UserProfile {
      const raw = profileStore.read()
      if (raw === null) return structuredClone(DEFAULT_PROFILE)

      const profile = migrateProfile(raw)
      if (raw.version !== profile.version) {
        try {
          profileStore.write(profile)
        } catch {
          /* 落盘失败不影响本次使用，下次读会再迁一遍 */
        }
      }
      return profile
    }

    /**
     * 对渲染层的读口（profile:get）：剥掉**墓碑区**再出门。
     *
     * 【为什么剥】墓碑是「这台设备上删过什么」的证据，只有合并逻辑有读者；
     * 渲染层拿着它没有用，但拿着就有回传的可能 —— 让它**看不见**，
     * 「墓碑归主进程独占」就从口头约定变成结构事实（docs/21 §8.3：读口剥离、
     * 写口维护）。时间戳（learnedAt / favoriteAt）不剥：它们没有删改语义，
     * 留着还便于将来界面显示「什么时候学会的」。写口也另有双保险（不听入参里的它们）。
     */
    function readProfile(): UserProfile {
      const raw = readProfileRaw()
      const pub: Partial<UserProfile> = { ...raw }
      delete pub.tombstones
      return pub as UserProfile
    }

    // 读口 = readProfile()（迁移挂在它身上）。**不许直接 profileStore.read()**：
    // 那条路会把一份 v1 老档案原样交给渲染进程，而渲染层拿到的 rewards 是
    // undefined，下次它防抖保存回来时，那一节就**永远没了**。
    // P10.6 起带戳回话（本地写协议）：渲染层收着 {epoch, rev}，整份写时原样带回。
    handle(
      IPC.profileGet,
      (): StampedDoc<UserProfile | null> => ({ data: readProfile(), stamp: profileStore.stamp() })
    )

    handle(
      IPC.profileSave,
      (_e, profile: UserProfile, stamp?: BoxStamp | null): DocWriteResult<UserProfile | null> =>
        attemptDocWrite({
          write: () => {
            // 写口在 store/profile-apply.ts（纯函数，单测在那边）：以**磁盘原始 JSON 为
            // 基底** apply 业务字段（未知键全保留 —— P10.1 头号 bug 的修复），并按 diff
            // 维护 learnedAt / favoriteAt / tombstones（主进程独占，入参里的一律不听）。
            // 「version / rewards / checkin 归主进程」那笔账（防抖保存抹掉刚发的奖励图、
            // 刚签的到）整个搬进了那个文件的头注释 —— 别在这里再建一份白名单重建对象。
            const next = applyProfileSave({
              diskRaw: profileStore.read(),
              current: readProfileRaw(),
              payload: profile,
              now: new Date().toISOString()
            })
            profileStore.write(next, stamp ?? undefined)
          },
          readCurrent: () => readProfile(),
          stamp: () => profileStore.stamp()
        })
    )

    // ---- 每日签到（P3 ①，2026-10-08）
    //
    // 【判重 → 写档 → 发饭，三步为什么必须挨着做、且全在主进程】
    // 渲染层写不了档案（profile:save 会把 checkin 顶掉，见上面那段）；而判重
    // 和发饭一旦分开（两次 IPC / 崩在中途）就会出「同一日键两碗饭」或
    // 「签了名没领到饭」。幂等判据是 **days 里有没有这天**（不是 lastDate）——
    // 时钟回拨玩法下 lastDate 会被写旧，只看它同一个日键能重复领饭（C9）。
    handle(IPC.checkinSubmit, (_e, rawDay: unknown): CheckinSubmitResult => {
      // 日键合法性在门口就拦：后面每条路都信任 day 是合法日键（进 days、算 streak），
      // 一个 '2026-2-3' 混进去会在月历上变成谁也画不出的格子。**抛**而不是回
      // ok:false —— 这是"载荷不合法"（代码 bug），不是"签到失败"这个业务结果；
      // CHECKIN_FAILED 那条 toast 留给真正的写盘失败。
      if (typeof rawDay !== 'string' || !DATE_KEY_RE.test(rawDay) || parseDateKey(rawDay) === null) {
        throw new Error('invalid checkin payload')
      }
      // readProfileRaw（不是对外的 readProfile）：下面整份摊开写回，必须带上
      // 墓碑区与时间戳 —— 用剥过的那份 = 签一次到顺手清掉全部删除证据
      const current = readProfileRaw()
      const { checkin, awarded, streakReset } = applyCheckin(current.checkin, rawDay)
      // 已签过：不写盘、不发饭、不出声（幂等重放不是错误；awarded=false 如实回报）。
      // 现戳照带（P10.6）：渲染层每次都拿它 noteStamp 对齐，见 CheckinSubmitResult.stamp
      if (!awarded) {
        return {
          ok: true,
          awarded: false,
          // 幂等重放什么都没发生：连"断没断签"都不该有结论（applyCheckin 同口径回 false）
          streakReset: false,
          checkin,
          riceGranted: false,
          riceCredited: null,
          stamp: profileStore.stamp()
        }
      }

      // 先写档案再发饭：宁可"签了但饭没端稳"（如实播报，饭改天补），
      // 不可"发了饭没签上"（重启后同一日键还能再领一份 —— 多发的饭追不回来）。
      // 写盘失败在这行当场抛 → 渲染层 catch → CHECKIN_FAILED，本地不标记（可再点）。
      profileStore.write({
        ...current,
        checkin,
        // 连续天数是派生镜像（照 learnedCount 先例）：签完就地同步，
        // 不然界面上「月历变了、连续天数没变」要等下次读档才修
        stats: { ...current.stats, streakDays: checkin.streakDays }
      })

      // 发饭：riceGranted / riceCredited 只由**发饭一侧的真实返回**判定（C1），
      // 没证据就如实报 false / null，不许默认成功：
      //   · riceGranted —— "这次 grant 有没有被执行"；
      //   · riceCredited —— **真进盒几碗**（V1-42 / 空转[1]）：满仓 999 时是 0。
      //     渲染层拿它决定播报哪句 —— 拿着名义常量报"2 碗到手"而实际一粒没进，
      //     就是假报成功。
      const riceGranted = false
      const riceCredited: number | null = null
      return {
        ok: true,
        awarded: true,
        streakReset,
        checkin,
        riceGranted,
        riceCredited,
        stamp: profileStore.stamp()
      }
    })
  }
}
