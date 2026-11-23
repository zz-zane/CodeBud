/**
 * 交卷后看解析：把这道题的依据（Cet6Question.evidence，scripts/cet6-evidence 生成）在左侧原文里标亮并滚过去。
 * 不改原文的渲染结构：拿 evidence.quote 去页面上已渲染的文字里找，找到就用 CSS Highlight 画出来。
 * 页面文字和 JSON 原文会有空白 / 换行 / 弯引号的差别（段落拆成 <p>、段首字母单独成按钮），所以按「规范化后」匹配。
 */
import type { Cet6Evidence } from '../../../shared/cet6'

const QUOTES: Record<string, string> = { '‘': "'", '’': "'", '“': '"', '”': '"', '—': '-', '–': '-' }

/** 规范化：连续空白压成一个空格、弯引号 / 破折号统一；map[i] = 规范化串第 i 个字符在原串里的下标 */
export function normalizeWithMap(text: string): { norm: string; map: number[] } {
  let norm = ''
  const map: number[] = []
  let space = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (/\s/.test(ch)) {
      if (!space && norm.length > 0) { norm += ' '; map.push(i) }
      space = true
      continue
    }
    space = false
    norm += QUOTES[ch] ?? ch
    map.push(i)
  }
  if (norm.endsWith(' ')) { norm = norm.slice(0, -1); map.pop() }
  return { norm, map }
}

/** 在 haystack 里找 needle（都按 normalizeWithMap 规范化、不区分大小写），返回原串下标 [start, end)；找不到 null */
export function findLoose(haystack: string, needle: string): [number, number] | null {
  const h = normalizeWithMap(haystack)
  const n = normalizeWithMap(needle).norm.toLowerCase()
  if (!n) return null
  const at = h.norm.toLowerCase().indexOf(n)
  if (at < 0) return null
  return [h.map[at], h.map[at + n.length - 1] + 1]
}

/** 容器里所有文字节点拼成一串，找到 quote 后映射回 DOM Range（可跨多个文字节点） */
export function rangeInElement(root: Element, quote: string): Range | null {
  const nodes: Text[] = []
  const starts: number[] = []
  let all = ''
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    starts.push(all.length)
    nodes.push(n)
    all += n.data
  }
  const hit = findLoose(all, quote)
  if (!hit) return null
  const locate = (pos: number, isEnd: boolean): [Text, number] => {
    let i = nodes.length - 1
    while (i > 0 && (isEnd ? starts[i] >= pos : starts[i] > pos)) i--
    return [nodes[i], pos - starts[i]]
  }
  const [sn, so] = locate(hit[0], false)
  const [en, eo] = locate(hit[1], true)
  const r = root.ownerDocument.createRange()
  r.setStart(sn, so)
  r.setEnd(en, eo)
  return r
}

/** 依据所在的页面容器：阅读原文 [data-evidence-text=blockId]，听力原文 [data-evidence-transcript=blockId] */
export function evidenceContainer(root: ParentNode, ev: Cet6Evidence): Element | null {
  const attr = ev.field === 'transcript' ? 'data-evidence-transcript' : 'data-evidence-text'
  return root.querySelector(`[${attr}="${CSS.escape(ev.blockId)}"]`)
}
