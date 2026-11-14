/** 每个路由离开时的滚动位置；容量有限，最久没动过的先丢 */
export function createScrollMemory(limit = 50) {
  const map = new Map<string, number>()
  return {
    save(key: string, top: number): void {
      map.delete(key)
      if (top > 0) map.set(key, Math.round(top))
      while (map.size > limit) map.delete(map.keys().next().value as string)
    },
    get(key: string): number {
      return map.get(key) ?? 0
    },
    get size(): number {
      return map.size
    }
  }
}
