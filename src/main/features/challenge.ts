import { handle } from '../ipc'
import { IPC } from '../../shared/ipc-channels'
import { todayKey } from '../../shared/dates'
import { challengeToday, mergeChallengeDay } from '../store/challenge-merge'
import type { ChallengeDay, ChallengeToday } from '../../shared/types'
import type { MainFeature } from '../context'

export const challengeFeature: MainFeature = {
  name: 'challenge',
  register(ctx) {
    /**
     * 每日挑战（M6）：challenge.json —— **单独一个文件，不塞进 profile.json**。
     *
     * 【为什么不复用 profile.json】
     * 塞进去就要写迁移函数（老档案没有这个字段，读出来得补默认值），
     * 而本项目的迁移基建目前是 0 —— 为一个新功能先造一套迁移，代价远大于多一个文件。
     * 而且挑战记录和「学习档案」的生命周期不一样：档案是要跟人一辈子的，
     * 挑战记录只留 30 天。放一起，将来想清挑战记录都不敢动手。
     */
    const challengeStore = ctx.stores.challenge

    // ---- 每日挑战（M6）
    //
    // 这里**只管存取**，不管出题。出题要读内容包（在渲染进程手里）、
    // 要调 AI（走上面那两条通道），放主进程就得把内容包再读一份 ——
    // 两份内容包意味着两套题库，改一处另一处不会报错。
    //
    // 主进程负责的是**渲染进程够不着的两件事**：
    //   1. 文件读写（渲染进程没有 fs）
    //   2. 30 天裁剪 —— 这是「文件别无限长」的责任，跟界面无关，
    //      放这里一处生效，而且纯函数好测

    handle(IPC.challengeGet, (_e, dateKey: string): ChallengeToday => {
      if (typeof dateKey !== 'string') throw new Error('invalid challenge payload')
      return challengeToday(challengeStore.read(), dateKey)
    })

    handle(IPC.challengeSave, (_e, day: ChallengeDay) => {
      // 裁剪的「今天」用**主进程的时钟**：这个日期只用来判断「哪些批次太老了」，
      // 差一天不会让任何一天的记录消失（窗口是 30 天，不是 1 天）。
      // 真正要跟用户时区对齐的是「今天是哪天」—— 那个由渲染进程算好传进来。
      // 无戳（P10.6）：逐日 upsert 是操作型写口，天然无冲突（同 wrongbook）。
      challengeStore.write(mergeChallengeDay(challengeStore.read(), day, todayKey()))
    })
  }
}
