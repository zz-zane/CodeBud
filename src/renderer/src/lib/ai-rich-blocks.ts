import { AI_ASSISTANT } from './copy'
/**
 * DeepTutor Rich Teaching Blocks Parser & Pure-TS Mermaid/SVG Compiler.
 *
 * 核心功能：
 * 1. parseAiRichBlocks: 切分 Markdown、错因诊断(diagnosis)、费曼检验(feynman)、算法步进(algo-viz)、流程图(mermaid/mindmap)、SVG
 * 2. compileMermaidToSvg: 零外部依赖，纯 TypeScript 语法解析并自动排版生成高清晰度 SVG
 * 3. sanitizeSvg: 严格剥离 script/foreignObject/onEvent/javascript: 链接，确保符合最严格的 CSP 安全规范
 */

export interface DiagnosisBlockData {
  errorType: 'structural' | 'deviation' | 'application' | 'metacognitive'
  title: string
  location?: string
  rootCause: string
  remediation: string
  checkQuestion?: string
}

export interface FeynmanBlockData {
  passed: boolean
  score: number
  concept: string
  feedback: string
  gap?: string
  followUpPrompt?: string
}

export interface AlgoVizStep {
  label: string
  explanation?: string
  items?: (string | number)[]
  highlights?: number[]
  pointers?: Record<string, string>
  note?: string
}


export interface AskUserOption {
  label: string
  description?: string
}

export interface AskUserBlockData {
  question: string
  reason?: string
  options: AskUserOption[]
}

export interface SolveStepItem {
  title: string
  hint: string
  detail: string
  code?: string
}

export interface SolveStepsBlockData {
  title: string
  strategy?: string
  steps: SolveStepItem[]
}

export interface AlgoVizBlockData {
  title: string
  subtitle?: string
  steps: AlgoVizStep[]
}

export type AiRichSegment =
  | { type: 'markdown'; content: string }
  | { type: 'anim-card'; videoId: string; raw: string }
  | { type: 'diagnosis'; data: DiagnosisBlockData; raw: string }
  | { type: 'feynman'; data: FeynmanBlockData; raw: string }
  | { type: 'algo-viz'; data: AlgoVizBlockData; raw: string }
  | { type: 'ask-user'; data: AskUserBlockData; raw: string }
  | { type: 'solve-steps'; data: SolveStepsBlockData; raw: string }
  | { type: 'mermaid'; code: string; svg: string; raw: string }
  | { type: 'svg'; svg: string; raw: string }
  | { type: 'artifact'; html: string; title?: string; raw: string }

const ALLOWED_TAGS = new Set([
  'svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line',
  'polyline', 'polygon', 'text', 'tspan', 'defs', 'marker',
  'lineargradient', 'radialgradient', 'stop', 'clippath', 'pattern'
])

const DANGEROUS_BLOCK_TAGS = new Set([
  'script', 'style', 'foreignobject', 'iframe', 'object',
  'embed', 'image', 'use', 'a', 'animate', 'animatetransform',
  'animatemotion', 'set'
])

const ALLOWED_ATTRS = new Set([
  'viewbox', 'width', 'height', 'xmlns', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
  'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points', 'fill', 'fill-opacity',
  'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap',
  'stroke-linejoin', 'stroke-opacity', 'opacity', 'transform',
  'text-anchor', 'dominant-baseline', 'font-size', 'font-weight',
  'font-family', 'id', 'marker-end', 'marker-start', 'markerwidth',
  'markerheight', 'refx', 'refy', 'orient', 'offset', 'stop-color',
  'stop-opacity', 'gradientunits', 'gradienttransform', 'clip-path', 'class'
])

function decodeEntities(str: string): string {
  return str
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#([0-9]+);?/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&colon;/gi, ':')
    .replace(/&tab;/gi, '')
    .replace(/&newline;/gi, '')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
}

function isSafeAttrValue(attrName: string, val: string): boolean {
  const decoded = decodeEntities(val).replace(/[\u0000-\u001f\u007f-\u009f\s]/g, '')
  if (/javascript:/i.test(decoded) || /vbscript:/i.test(decoded) || /data:/i.test(decoded) || /expression\(/i.test(decoded)) {
    return false
  }
  if (/url\(http/i.test(decoded) || /url\(\/\//i.test(decoded)) {
    return false
  }
  if (['marker-end', 'marker-start', 'clip-path', 'fill'].includes(attrName)) {
    if (/url\(/i.test(val)) {
      return /^\s*url\(\s*#[A-Za-z0-9_-]+\s*\)\s*$/.test(val)
    }
  } else if (/url\(/i.test(val)) {
    return false
  }
  return true
}

export function sanitizeSvg(raw: string): string {
  if (!raw || typeof raw !== 'string') return ''
  let cleaned = raw.trim()
  cleaned = cleaned.replace(/^\`\`\`(?:svg)?\s*/i, '').replace(/\`\`\`\s*$/i, '').trim()
  const svgStart = cleaned.indexOf('<svg')
  if (svgStart === -1) return ''
  cleaned = cleaned.slice(svgStart)

  let out = ''
  let i = 0
  const n = cleaned.length

  while (i < n) {
    const nextLt = cleaned.indexOf('<', i)
    if (nextLt === -1) {
      out += cleaned.slice(i)
      break
    }
    if (nextLt > i) {
      out += cleaned.slice(i, nextLt)
      i = nextLt
    }

    const tagEnd = cleaned.indexOf('>', i)
    if (tagEnd === -1) {
      break
    }

    const rawTag = cleaned.slice(i, tagEnd + 1)
    i = tagEnd + 1

    if (rawTag.startsWith('</')) {
      const closeMatch = rawTag.match(/^<\/\s*([a-zA-Z0-9_-]+)/)
      if (closeMatch) {
        const tagName = closeMatch[1].toLowerCase()
        if (ALLOWED_TAGS.has(tagName)) {
          out += `</${tagName}>`
        }
      }
      continue
    }

    const openMatch = rawTag.match(/^<([a-zA-Z0-9_-]+)([\s/\S]*)$/)
    if (!openMatch) continue

    const tagName = openMatch[1].toLowerCase()
    const rest = openMatch[2]
    const isSelfClosing = rest.trimEnd().endsWith('/>')

    if (DANGEROUS_BLOCK_TAGS.has(tagName)) {
      if (!isSelfClosing) {
        const closeTag = `</${tagName}>`
        const closeIdx = cleaned.toLowerCase().indexOf(closeTag, i)
        if (closeIdx !== -1) {
          i = closeIdx + closeTag.length
        } else {
          i = n
        }
      }
      continue
    }

    if (!ALLOWED_TAGS.has(tagName)) {
      continue
    }

    const attrRegex = /([a-zA-Z0-9_:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g
    let attrStr = rest
    if (attrStr.endsWith('/>')) attrStr = attrStr.slice(0, -2)
    else if (attrStr.endsWith('>')) attrStr = attrStr.slice(0, -1)

    const safeAttrs: string[] = []
    let m: RegExpExecArray | null
    while ((m = attrRegex.exec(attrStr)) !== null) {
      const rawAttr = m[1]
      const attrName = rawAttr.toLowerCase()
      if (rawAttr === '/') continue
      if (!ALLOWED_ATTRS.has(attrName)) continue

      const rawVal = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : ''
      if (!isSafeAttrValue(attrName, rawVal)) continue

      safeAttrs.push(`${attrName}="${rawVal.replace(/"/g, '&quot;')}"`)
    }

    const attrPart = safeAttrs.length ? ' ' + safeAttrs.join(' ') : ''
    if (isSelfClosing) {
      out += `<${tagName}${attrPart} />`
    } else {
      out += `<${tagName}${attrPart}>`
    }
  }

  return out
}

export function escapeXml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function simpleHash(str: string): string {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return Math.abs(h).toString(36).slice(0, 6)
}

export function compileMermaidToSvg(code: string): string {
  const trimmed = code.trim()
  const lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('%%'))

  if (lines.length === 0) {
    return '<svg viewBox="0 0 100 40" xmlns="http://www.w3.org/2000/svg"></svg>'
  }

  const hash = simpleHash(code)
  const first = lines[0].toLowerCase()

  if (first.startsWith('sequencediagram')) {
    return compileSequence(lines.slice(1), hash)
  } else if (first.startsWith('mindmap')) {
    return compileMindmap(trimmed)
  } else if (first.startsWith('flowchart') || first.startsWith('graph')) {
    const isLR = first.includes('lr')
    return compileFlowchart(lines.slice(1), isLR, hash)
  }

  return compileFlowchart(lines, false, hash)
}

function compileFlowchart(lines: string[], isLR: boolean, hash = 'm0'): string {
  interface FlowNode {
    id: string
    label: string
    shape: 'rect' | 'round' | 'diamond'
  }
  interface FlowEdge {
    from: string
    to: string
    label?: string
  }

  const nodes = new Map<string, FlowNode>()
  const edges: FlowEdge[] = []

  /**
   * 节点文字里的 `<br/>` / `<br>` 是模型照 mermaid 习惯写的换行，
   * 原样 escapeXml 会把它当字面文字显示（"返回 mid<br/>查找成功"）。
   * 统一折成真换行符，渲染时按行拆 tspan。
   */
  const normalizeLabel = (raw: string): string =>
    raw.replace(/<br\s*\/?>/gi, '\n').trim()

  function ensureNode(id: string, label?: string, shape: 'rect' | 'round' | 'diamond' = 'rect'): string {
    const cleanId = id.trim()
    if (!cleanId) return ''
    const text = label ? normalizeLabel(label) : cleanId
    if (!nodes.has(cleanId)) {
      nodes.set(cleanId, { id: cleanId, label: text, shape })
    } else if (label && nodes.get(cleanId)!.label === cleanId) {
      nodes.get(cleanId)!.label = text
      nodes.get(cleanId)!.shape = shape
    }
    return cleanId
  }

  const nodeRegex = /([a-zA-Z0-9_\u4e00-\u9fa5-]+)(?:\["?(.*?)"?\]|\("?(.*?)"?\)|\{"?(.*?)"?\}|\[\("?(.*?)"?\)\])?/

  for (const line of lines) {
    const arrowMatch = line.match(/(.*?)\s*(-->|-.->|==>|---)(?:\|(.*?)\|)?\s*(.*)/)
    if (arrowMatch) {
      const leftPart = arrowMatch[1].trim()
      const edgeLabel = arrowMatch[3] ? arrowMatch[3].trim() : undefined
      const rightPart = arrowMatch[4].trim()

      const leftM = leftPart.match(nodeRegex)
      const rightM = rightPart.match(nodeRegex)

      if (leftM && rightM) {
        const leftShape: 'rect' | 'round' | 'diamond' = leftPart.includes('{')
          ? 'diamond'
          : leftPart.includes('(')
            ? 'round'
            : 'rect'
        const rightShape: 'rect' | 'round' | 'diamond' = rightPart.includes('{')
          ? 'diamond'
          : rightPart.includes('(')
            ? 'round'
            : 'rect'
        const leftLabel = leftM[2] || leftM[3] || leftM[4] || leftM[1]
        const rightLabel = rightM[2] || rightM[3] || rightM[4] || rightM[1]

        const fromId = ensureNode(leftM[1], leftLabel, leftShape)
        const toId = ensureNode(rightM[1], rightLabel, rightShape)
        if (fromId && toId) {
          edges.push({ from: fromId, to: toId, label: edgeLabel })
        }
      }
    } else {
      const singleM = line.match(nodeRegex)
      if (singleM) {
        const shape: 'rect' | 'round' | 'diamond' = line.includes('{')
          ? 'diamond'
          : line.includes('(')
            ? 'round'
            : 'rect'
        const label = singleM[2] || singleM[3] || singleM[4] || singleM[1]
        ensureNode(singleM[1], label, shape)
      }
    }
  }

  if (nodes.size === 0) {
    return '<svg viewBox="0 0 100 40" xmlns="http://www.w3.org/2000/svg"></svg>'
  }

  const inDegree = new Map<string, number>()
  nodes.forEach((_, id) => inDegree.set(id, 0))
  edges.forEach((e) => inDegree.set(e.to, (inDegree.get(e.to) || 0) + 1))

  const ranks = new Map<string, number>()
  const queue: string[] = []
  nodes.forEach((_, id) => {
    if ((inDegree.get(id) || 0) === 0) {
      ranks.set(id, 0)
      queue.push(id)
    }
  })

  if (queue.length === 0) {
    const firstId = nodes.keys().next().value!
    ranks.set(firstId, 0)
    queue.push(firstId)
  }

  let steps = 0
  const maxSteps = nodes.size * Math.max(1, edges.length) + 64
  while (queue.length > 0 && steps++ < maxSteps) {
    const curr = queue.shift()!
    const curRank = ranks.get(curr) || 0
    const outgoing = edges.filter((e) => e.from === curr)
    for (const e of outgoing) {
      const nextRank = curRank + 1
      if (nextRank < nodes.size && nextRank > (ranks.get(e.to) ?? 0)) {
        ranks.set(e.to, nextRank)
        queue.push(e.to)
      }
    }
  }

  nodes.forEach((_, id) => {
    if (!ranks.has(id)) ranks.set(id, 0)
  })

  const layers: string[][] = []
  ranks.forEach((rank, id) => {
    while (layers.length <= rank) layers.push([])
    layers[rank].push(id)
  })

  const nodePositions = new Map<string, { x: number; y: number; w: number; h: number }>()
  const nodeH = 42
  const nodeW = 140
  const gapX = 36
  const gapY = 48

  let totalW = 0
  let totalH = 0

  if (isLR) {
    const maxRows = Math.max(...layers.map((l) => l.length), 1)
    totalW = 60 + layers.length * (nodeW + gapX)
    totalH = 60 + maxRows * (nodeH + gapY)

    layers.forEach((layer, colIdx) => {
      const colX = 30 + colIdx * (nodeW + gapX)
      const layerH = layer.length * nodeH + (layer.length - 1) * gapY
      const startY = (totalH - layerH) / 2

      layer.forEach((id, rowIdx) => {
        const y = startY + rowIdx * (nodeH + gapY)
        nodePositions.set(id, { x: colX, y, w: nodeW, h: nodeH })
      })
    })
  } else {
    const maxCols = Math.max(...layers.map((l) => l.length), 1)
    totalW = 60 + maxCols * (nodeW + gapX)
    totalH = 60 + layers.length * (nodeH + gapY)

    layers.forEach((layer, rowIdx) => {
      const rowY = 30 + rowIdx * (nodeH + gapY)
      const layerW = layer.length * nodeW + (layer.length - 1) * gapX
      const startX = (totalW - layerW) / 2

      layer.forEach((id, colIdx) => {
        const x = startX + colIdx * (nodeW + gapX)
        nodePositions.set(id, { x, y: rowY, w: nodeW, h: nodeH })
      })
    })
  }

  totalW = Math.max(totalW, 300)
  totalH = Math.max(totalH, 120)

  let svg = '<svg viewBox="0 0 ' + totalW + ' ' + totalH + '" width="100%" xmlns="http://www.w3.org/2000/svg">\n'
  svg += '  <defs>\n'
  svg += '    <marker id="mm-arrow-' + hash + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">\n'
  svg += '      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#64748b" />\n'
  svg += '    </marker>\n'
  svg += '  </defs>\n'

  edges.forEach((e) => {
    const p1 = nodePositions.get(e.from)
    const p2 = nodePositions.get(e.to)
    if (!p1 || !p2) return

    let sx: number, sy: number, ex: number, ey: number, pathD: string
    if (isLR) {
      sx = p1.x + p1.w
      sy = p1.y + p1.h / 2
      ex = p2.x
      ey = p2.y + p2.h / 2
      const mx = (sx + ex) / 2
      pathD = 'M ' + sx + ' ' + sy + ' C ' + mx + ' ' + sy + ', ' + mx + ' ' + ey + ', ' + ex + ' ' + ey
    } else {
      sx = p1.x + p1.w / 2
      sy = p1.y + p1.h
      ex = p2.x + p2.w / 2
      ey = p2.y
      const my = (sy + ey) / 2
      pathD = 'M ' + sx + ' ' + sy + ' C ' + sx + ' ' + my + ', ' + ex + ' ' + my + ', ' + ex + ' ' + ey
    }

    svg += '  <path d="' + pathD + '" fill="none" stroke="#94a3b8" stroke-width="1.8" marker-end="url(#mm-arrow-' + hash + ')" />\n'

    if (e.label) {
      const mx = (sx + ex) / 2
      const my = (sy + ey) / 2
      const lw = Math.min(80, e.label.length * 10 + 14)
      svg += '  <rect x="' + (mx - lw / 2) + '" y="' + (my - 10) + '" width="' + lw + '" height="18" rx="4" fill="#ffffff" stroke="#e2e8f0" stroke-width="1" />\n'
      svg += '  <text x="' + mx + '" y="' + (my + 3) + '" text-anchor="middle" font-size="11" font-family="system-ui, sans-serif" fill="#64748b">' + escapeXml(e.label) + '</text>\n'
    }
  })

  nodes.forEach((node) => {
    const pos = nodePositions.get(node.id)
    if (!pos) return
    const { x, y, w, h } = pos

    if (node.shape === 'diamond') {
      const pts = (x + w / 2) + ',' + y + ' ' + (x + w) + ',' + (y + h / 2) + ' ' + (x + w / 2) + ',' + (y + h) + ' ' + x + ',' + (y + h / 2)
      svg += '  <polygon points="' + pts + '" fill="#f0fdf4" stroke="#16a34a" stroke-width="1.6" />\n'
    } else if (node.shape === 'round') {
      svg += '  <rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (h / 2) + '" fill="#eff6ff" stroke="#2563eb" stroke-width="1.6" />\n'
    } else {
      svg += '  <rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="8" fill="#ffffff" stroke="#3b82f6" stroke-width="1.6" />\n'
    }

    // 标签里的换行（来自 <br/>）逐行渲染：单行保持原基线，多行围绕节点中心上下排布
    const lines = node.label.split('\n').map((l) => l.trim()).filter(Boolean)
    const showLines = lines.length ? lines : [node.label]
    const lineH = 15
    const firstY = y + h / 2 + 4 - ((showLines.length - 1) * lineH) / 2
    svg += '  <text x="' + (x + w / 2) + '" y="' + firstY + '" text-anchor="middle" font-size="12" font-weight="500" font-family="system-ui, sans-serif" fill="#1e293b">' +
      showLines.map((l, i) => '<tspan x="' + (x + w / 2) + '" y="' + (firstY + i * lineH) + '">' + escapeXml(l) + '</tspan>').join('') +
      '</text>\n'
  })

  svg += '</svg>'
  return svg
}

function compileSequence(lines: string[], hash = 'm0'): string {
  const participants = new Map<string, string>()
  const messages: Array<{ from: string; to: string; text: string }> = []

  for (const line of lines) {
    const pMatch = line.match(/^participant\s+([a-zA-Z0-9_\u4e00-\u9fa5-]+)(?:\s+as\s+(.*))?$/i)
    if (pMatch) {
      participants.set(pMatch[1], pMatch[2] || pMatch[1])
      continue
    }

    const msgMatch = line.match(/^([a-zA-Z0-9_\u4e00-\u9fa5-]+)\s*(->>|-->>|->|-->)\s*([a-zA-Z0-9_\u4e00-\u9fa5-]+)\s*:\s*(.*)$/)
    if (msgMatch) {
      const from = msgMatch[1]
      const to = msgMatch[3]
      const text = msgMatch[4]
      if (!participants.has(from)) participants.set(from, from)
      if (!participants.has(to)) participants.set(to, to)
      messages.push({ from, to, text })
    }
  }

  const pList = Array.from(participants.entries())
  if (pList.length === 0) return '<svg viewBox="0 0 100 40" xmlns="http://www.w3.org/2000/svg"></svg>'

  const colW = 160
  const totalW = Math.max(340, 60 + pList.length * colW)
  const totalH = Math.max(160, 100 + messages.length * 44)

  const xMap = new Map<string, number>()
  pList.forEach(([id], idx) => {
    xMap.set(id, 40 + idx * colW + colW / 2)
  })

  let svg = '<svg viewBox="0 0 ' + totalW + ' ' + totalH + '" width="100%" xmlns="http://www.w3.org/2000/svg">\n'
  svg += '  <defs>\n'
  svg += '    <marker id="mm-arrow-' + hash + '" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">\n'
  svg += '      <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#3b82f6" />\n'
  svg += '    </marker>\n'
  svg += '  </defs>\n'

  xMap.forEach((x) => {
    svg += '  <line x1="' + x + '" y1="40" x2="' + x + '" y2="' + (totalH - 40) + '" stroke="#cbd5e1" stroke-width="1.5" stroke-dasharray="4,4" />\n'
  })

  pList.forEach(([id, label]) => {
    const x = xMap.get(id)!
    const boxW = 110
    const boxH = 32
    // Top box
    svg += '  <rect x="' + (x - boxW / 2) + '" y="12" width="' + boxW + '" height="' + boxH + '" rx="6" fill="#eff6ff" stroke="#3b82f6" stroke-width="1.5" />\n'
    svg += '  <text x="' + x + '" y="32" text-anchor="middle" font-size="12" font-weight="500" font-family="system-ui, sans-serif" fill="#1e293b">' + escapeXml(label) + '</text>\n'
    // Bottom box
    svg += '  <rect x="' + (x - boxW / 2) + '" y="' + (totalH - 44) + '" width="' + boxW + '" height="' + boxH + '" rx="6" fill="#eff6ff" stroke="#3b82f6" stroke-width="1.5" />\n'
    svg += '  <text x="' + x + '" y="' + (totalH - 24) + '" text-anchor="middle" font-size="12" font-weight="500" font-family="system-ui, sans-serif" fill="#1e293b">' + escapeXml(label) + '</text>\n'
  })

  messages.forEach((msg, idx) => {
    const x1 = xMap.get(msg.from) || 40
    const x2 = xMap.get(msg.to) || 40
    const y = 70 + idx * 44
    svg += '  <line x1="' + x1 + '" y1="' + y + '" x2="' + x2 + '" y2="' + y + '" stroke="#3b82f6" stroke-width="1.6" marker-end="url(#mm-arrow-' + hash + ')" />\n'
    svg += '  <text x="' + ((x1 + x2) / 2) + '" y="' + (y - 6) + '" text-anchor="middle" font-size="12" font-family="system-ui, sans-serif" fill="#334155">' + escapeXml(msg.text) + '</text>\n'
  })

  svg += '</svg>'
  return svg
}

function compileMindmap(rawCode: string): string {
  const lines = rawCode
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .filter((l) => l.trim().length > 0)
  if (lines.length === 0) return '<svg viewBox="0 0 100 40" xmlns="http://www.w3.org/2000/svg"></svg>'

  const tree: Array<{ indent: number; text: string }> = []
  lines.forEach((line) => {
    const indent = line.search(/\S/)
    const text = line
      .trim()
      .replace(/^root\s*\(\((.*?)\)\)/i, '$1')
      .replace(/^\(\((.*?)\)\)/, '$1')
      .replace(/^\["?(.*?)"?\]/, '$1')
      .trim()
    tree.push({ indent, text })
  })

  const nodeW = 120
  const nodeH = 34
  const gapX = 60
  const gapY = 24

  const totalW = Math.max(380, 60 + 3 * (nodeW + gapX))
  const totalH = Math.max(180, 40 + tree.length * (nodeH + gapY))

  let svg = '<svg viewBox="0 0 ' + totalW + ' ' + totalH + '" width="100%" xmlns="http://www.w3.org/2000/svg">\n'

  tree.forEach((item, idx) => {
    const level = Math.min(3, Math.floor(item.indent / 2))
    const x = 30 + level * (nodeW + gapX)
    const y = 30 + idx * (nodeH + gapY)

    if (level === 0) {
      svg += '  <rect x="' + x + '" y="' + y + '" width="' + nodeW + '" height="' + nodeH + '" rx="17" fill="#dbeafe" stroke="#2563eb" stroke-width="2" />\n'
      svg += '  <text x="' + (x + nodeW / 2) + '" y="' + (y + 21) + '" text-anchor="middle" font-size="12" font-weight="bold" font-family="system-ui, sans-serif" fill="#1e3a8a">' + escapeXml(item.text) + '</text>\n'
    } else {
      svg += '  <path d="M ' + (x - gapX) + ' ' + (y - 10) + ' C ' + (x - gapX / 2) + ' ' + (y - 10) + ', ' + (x - gapX / 2) + ' ' + (y + nodeH / 2) + ', ' + x + ' ' + (y + nodeH / 2) + '" fill="none" stroke="#93c5fd" stroke-width="1.8" />\n'
      svg += '  <rect x="' + x + '" y="' + y + '" width="' + nodeW + '" height="' + nodeH + '" rx="8" fill="#ffffff" stroke="#60a5fa" stroke-width="1.5" />\n'
      svg += '  <text x="' + (x + nodeW / 2) + '" y="' + (y + 21) + '" text-anchor="middle" font-size="11" font-weight="500" font-family="system-ui, sans-serif" fill="#1e293b">' + escapeXml(item.text) + '</text>\n'
    }
  })

  svg += '</svg>'
  return svg
}

export function parseAiRichBlocks(raw: string): AiRichSegment[] {
  if (!raw || typeof raw !== 'string') return []

  const segments: AiRichSegment[] = []
  const blockRegex = /\`\`\`(anim-card|diagnosis|feynman|algo-viz|ask-user|solve-steps|mermaid|mindmap|svg|study-html)(?=\s)\s*([\s\S]*?)\`\`\`/g

  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = blockRegex.exec(raw)) !== null) {
    const preText = raw.slice(lastIndex, match.index)
    if (preText) {
      segments.push({ type: 'markdown', content: preText })
    }

    const type = match[1]
    const body = match[2].trim()
    const rawBlock = match[0]
    lastIndex = match.index + rawBlock.length

    if (type === 'anim-card') {
      try {
        const data = JSON.parse(body) as { videoId?: unknown }
        if (typeof data.videoId === 'string' && data.videoId.length > 0 && data.videoId.length <= 128) {
          segments.push({ type: 'anim-card', videoId: data.videoId, raw: rawBlock })
          continue
        }
      } catch {}
    } else if (type === 'study-html') {
      segments.push({ type: 'artifact', html: body, raw: rawBlock })
      continue
    } else if (type === 'diagnosis') {
      try {
        const json = JSON.parse(body) as DiagnosisBlockData
        if (json && typeof json === 'object' && json.title) {
          segments.push({ type: 'diagnosis', data: json, raw: rawBlock })
          continue
        }
      } catch {}
    } else if (type === 'feynman') {
      try {
        const json = JSON.parse(body) as FeynmanBlockData
        if (json && typeof json === 'object' && json.concept) {
          const rawScore = Number((json as any).score)
          json.score = Number.isFinite(rawScore) ? Math.max(0, Math.min(100, Math.round(rawScore))) : 0
          segments.push({ type: 'feynman', data: json, raw: rawBlock })
          continue
        }
      } catch {}
    } else if (type === 'ask-user') {
      try {
        const parsed = JSON.parse(body)
        if (parsed && typeof parsed === 'object' && typeof parsed.question === 'string' && parsed.question.trim() && Array.isArray(parsed.options)) {
          const options: AskUserOption[] = (parsed.options as unknown[])
            .map((opt: unknown): AskUserOption | null => {
              if (typeof opt === 'string' && opt.trim()) return { label: opt.trim() }
              if (opt && typeof opt === 'object' && typeof (opt as { label?: unknown }).label === 'string' && (opt as { label: string }).label.trim()) {
                const desc = (opt as { description?: unknown }).description
                return {
                  label: (opt as { label: string }).label.trim(),
                  ...(typeof desc === 'string' && desc.trim() ? { description: desc.trim() } : {})
                }
              }
              return null
            })
            .filter((x: AskUserOption | null): x is AskUserOption => x !== null)

          if (options.length > 0) {
            const data: AskUserBlockData = {
              question: parsed.question.trim(),
              ...(typeof parsed.reason === 'string' && parsed.reason.trim() ? { reason: parsed.reason.trim() } : {}),
              options
            }
            segments.push({ type: 'ask-user', data, raw: rawBlock })
            continue
          }
        }
      } catch {}
    } else if (type === 'solve-steps') {
      try {
        const parsed = JSON.parse(body)
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.steps)) {
          const steps: SolveStepItem[] = (parsed.steps as unknown[])
            .filter((s: unknown): s is Record<string, unknown> => Boolean(s && typeof s === 'object'))
            .map((s: Record<string, unknown>, idx: number): SolveStepItem => ({
              title: typeof s.title === 'string' && s.title.trim() ? s.title.trim() : `#${idx + 1}`,
              hint: typeof s.hint === 'string' ? s.hint : '',
              detail: typeof s.detail === 'string' ? s.detail : '',
              ...(typeof s.code === 'string' && s.code.trim() ? { code: s.code } : {})
            }))

          if (steps.length > 0) {
            const data: SolveStepsBlockData = {
              title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : AI_ASSISTANT.SOLVE_STEPS_BADGE,
              ...(typeof parsed.strategy === 'string' && parsed.strategy.trim() ? { strategy: parsed.strategy.trim() } : {}),
              steps
            }
            segments.push({ type: 'solve-steps', data, raw: rawBlock })
            continue
          }
        }
      } catch {}
    } else if (type === 'algo-viz') {
      try {
        const json = JSON.parse(body) as AlgoVizBlockData
        if (json && typeof json === 'object' && Array.isArray(json.steps)) {
          segments.push({ type: 'algo-viz', data: json, raw: rawBlock })
          continue
        }
      } catch {}
    } else if (type === 'mermaid' || type === 'mindmap') {
      const code = type === 'mindmap' && !body.startsWith('mindmap') ? 'mindmap\n' + body : body
      const svg = compileMermaidToSvg(code)
      segments.push({ type: 'mermaid', code, svg, raw: rawBlock })
      continue
    } else if (type === 'svg') {
      const svg = sanitizeSvg(body)
      segments.push({ type: 'svg', svg, raw: rawBlock })
      continue
    }

    segments.push({ type: 'markdown', content: rawBlock })
  }

  const remaining = raw.slice(lastIndex)
  if (remaining) {
    segments.push({ type: 'markdown', content: remaining })
  }

  return segments
}
