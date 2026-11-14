/**
 * 解锁与选课纯函数。
 * 自由选课模式：所有已编写内容的课程均自由向用户开放，先修要求仅作为学习建议。
 */

export interface Unlockable {
  id: string
  required: string[]
}

/**
 * 自由选课模式：
 * 消除强制前置锁，所有课程（含空档案阶段）均处于解锁可用状态。
 */
export function computeUnlocked(all: Unlockable[], learned: ReadonlySet<string>): Set<string> {
  const unlocked = new Set<string>(learned)
  for (const l of all) {
    unlocked.add(l.id)
  }
  return unlocked
}

/**
 * 课程状态判定：
 * 自由选课下，未学课程均为 'open'，不再产生 'locked' 阻挡访问。
 */
export function statusOf(
  id: string,
  lesson: Unlockable | undefined,
  learned: ReadonlySet<string>,
  unlocked?: ReadonlySet<string>
): 'locked' | 'open' | 'learned' | 'missing' {
  if (!lesson) return 'missing'
  if (learned.has(id)) return 'learned'
  return 'open'
}
