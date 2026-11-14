/**
 * 旧版 pet.json 里的存量大白饭数 —— 只给账本 genesis 的 carriedRice 用。
 *
 * 【为什么还读它】旧版本把饭存在设备级 pet.json，升级后饭数的唯一事实改成账本；
 * 账本首次建账要继承这个存量，否则老用户升级后余额清零。桌宠引擎已退役，
 * 这里只剩这一个读口：取 rice 字段，整数化并夹到 [0, 999]（与旧 normalizePetState 逐值一致，
 * 含 Math.round 的负零），坏值/缺失一律 0。
 *
 * 走 createJsonStore：主文件损坏回退 .bak，且沿用它「抢救 .bak 回主文件」的行为；
 * 除此之外不写盘（旧 load() 本身没有写盘副作用，缺文件也不新建）。
 */
import { createJsonStore } from '../store/json-store'

const LEGACY_RICE_MAX = 999

export function readLegacyPetRice(dir: string): number {
  const raw = createJsonStore<unknown>(dir, 'pet.json').read()
  if (!raw || typeof raw !== 'object') return 0
  const v = (raw as Record<string, unknown>).rice
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0
  const n = Math.round(v)
  return n < 0 ? 0 : n > LEGACY_RICE_MAX ? LEGACY_RICE_MAX : n
}
