/**
 * 选项 / 选词按钮的点击里调用：用户刚在这个按钮里拖选了文字（为了查释义），就不算「选答案」。
 * 浏览器在同一个按钮里按下又松开时总会补一个 click，不拦的话拖选单词会顺手把答案改掉、选区也随重绘消失（2026-11-23 实测）。
 * 普通点击时 mousedown 已经把旧选区折叠，所以这里不会误伤真正的点选。
 */
export function isSelectingTextIn(el: EventTarget | null): boolean {
  const sel = typeof window === 'undefined' ? null : window.getSelection()
  if (!sel || sel.isCollapsed || !sel.toString().trim() || !(el instanceof Node)) return false
  const node = sel.getRangeAt(0).commonAncestorContainer
  return el.contains(node) || node.contains(el)
}
