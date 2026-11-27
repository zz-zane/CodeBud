import type { CetLevel } from '../../../shared/cet6'

/** 侧栏「四六级真题」记住上次看的等级：/cet 按它重定向，目录页进入时写入 */
const KEY = 'miai.cetLevel'

export function lastCetLevel(): CetLevel {
  try {
    return localStorage.getItem(KEY) === 'cet4' ? 'cet4' : 'cet6'
  } catch {
    return 'cet6'
  }
}

export function rememberCetLevel(level: CetLevel): void {
  try {
    localStorage.setItem(KEY, level)
  } catch {
    // 存不了就每次回到默认等级，不影响做题
  }
}
