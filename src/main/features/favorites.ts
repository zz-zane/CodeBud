import { handle } from '../ipc'
import { IPC } from '../../shared/ipc-channels'
import type { BoxStamp } from '../store/box'
import type { DocWriteResult, StampedDoc } from '../../shared/doc-write'
import { attemptDocWrite } from '../store/doc-write'
import { applyFavoritesSave, normalizeFavorites } from '../store/favorites-merge'
import type { FavoritesFile } from '../../shared/types'
import type { MainFeature } from '../context'

export const favoritesFeature: MainFeature = {
  name: 'favorites',
  register(ctx) {
    // 收藏的**题目**（学习闭环，2026-09-29）：favorites.json。
    // ⚠️ 和 profile.favorites（**课级**收藏，存在学习档案里）同名不同义，别合并
    const favoritesStore = ctx.stores.favorites

    /** 读收藏夹（favorites.json）：读口，清洗与兼容都在 normalizeFavorites 里 */
    function readFavorites(): FavoritesFile {
      const { file, needsRewrite } = normalizeFavorites(favoritesStore.read())
      if (needsRewrite) {
        try {
          favoritesStore.write(file)
        } catch {
          /* 落盘失败不影响本次使用 */
        }
      }
      return file
    }

    // ---- 收藏的题目（学习闭环）
    //
    // 和 profile 同型：**只有渲染层一个写方**，所以整份读、整份存，
    // 载入 + 防抖 + 退出冲刷那套落在渲染层的 favorites store 里（照 progress.ts）。
    // 主进程这层只管两件事：读时清洗（坏文件不丢用户数据）、写时校形（写错就抛）。
    handle(
      IPC.favoritesGet,
      (): StampedDoc<FavoritesFile> => ({ data: readFavorites(), stamp: favoritesStore.stamp() })
    )

    handle(
      IPC.favoritesSave,
      (_e, file: FavoritesFile, stamp?: BoxStamp | null): DocWriteResult<FavoritesFile> =>
        attemptDocWrite({
          write: () => {
            // 写口在 store/favorites-merge.ts 的 applyFavoritesSave（纯函数，单测在那边）：
            // 入参校形会抛（形状不对**一个字节都不写**，和 config:save 一个规矩）；
            // 以磁盘原始 JSON 为基底保未知键；按 diff 维护 updatedAt 与两张墓碑表
            // （渲染层交上来的 updatedAt / 墓碑一律不听）；内置题误带的 ai 本体照旧剥掉、
            // 指向已删文件夹的 folderId 照旧摘回未分组
            const next = applyFavoritesSave({
              diskRaw: favoritesStore.read(),
              current: readFavorites(),
              payload: file,
              now: new Date().toISOString()
            })
            favoritesStore.write(next, stamp ?? undefined)
          },
          readCurrent: () => readFavorites(),
          stamp: () => favoritesStore.stamp()
        })
    )
  }
}
