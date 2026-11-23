/**
 * 手机上的「长按选词」：不走系统选区（系统选区一出现就会弹出复制 / 粘贴菜单，把释义条挡住），
 * 由应用自己算出手指下的英文单词，再用 CSS Highlight 画出来。这里只放纯计算，方便单测。
 */
const WORD = /[A-Za-z0-9]/
const JOINER = /['’-]/

/** text 里 offset 处（或紧挨着的左边）那个英文单词的 [start, end)；不在单词上返回 null。连字符、撇号连着的算一个词（well-known、don't） */
export function wordBoundsAt(text: string, offset: number): [number, number] | null {
  let i = Math.min(Math.max(offset, 0), text.length)
  if (!WORD.test(text[i] ?? '') && WORD.test(text[i - 1] ?? '')) i -= 1
  if (!WORD.test(text[i] ?? '')) return null
  const inWord = (k: number): boolean => WORD.test(text[k] ?? '') || (JOINER.test(text[k] ?? '') && WORD.test(text[k - 1] ?? '') && WORD.test(text[k + 1] ?? ''))
  let start = i
  while (start > 0 && inWord(start - 1)) start -= 1
  let end = i + 1
  while (end < text.length && inWord(end)) end += 1
  return [start, end]
}
