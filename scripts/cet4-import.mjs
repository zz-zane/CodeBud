#!/usr/bin/env node
/**
 * 四级真题数据转换器（<本地四级真题目录> -> content/cet4/）
 *
 * 用法：
 *   node scripts/cet4-import.mjs [来源目录]
 *   - 传入单套目录（含 真题解析听力.md）时：只更新该卷并重排 content/cet4/index.json
 *   - 省略参数或传入根目录时：全量扫描目录下所有子目录并重建 index.json
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DEFAULT_SOURCE_ROOT = process.env.CET4_SOURCE_DIR || ''
const OUT_ROOT = path.join(ROOT, 'content', 'cet4')
const EXAMS_DIR = path.join(OUT_ROOT, 'exams')

const LISTENING_BLOCKS = [
  { id: 'listening-news-1', title: 'News Report One', range: [1, 2], qPattern: /Questions?\s+1\s+(?:and|to)\s+2\b/i },
  { id: 'listening-news-2', title: 'News Report Two', range: [3, 4], qPattern: /Questions?\s+3\s+(?:and|to)\s+4\b/i },
  { id: 'listening-news-3', title: 'News Report Three', range: [5, 7], qPattern: /Questions?\s+5\s+(?:and|to)\s+7\b/i },
  { id: 'listening-conv-1', title: 'Conversation One', range: [8, 11], qPattern: /Questions?\s+8\s+(?:and|to)\s+11\b/i },
  { id: 'listening-conv-2', title: 'Conversation Two', range: [12, 15], qPattern: /Questions?\s+12\s+(?:and|to)\s+15\b/i },
  { id: 'listening-pass-1', title: 'Passage One', range: [16, 18], qPattern: /Questions?\s+16\s+(?:and|to)\s+18\b/i },
  { id: 'listening-pass-2', title: 'Passage Two', range: [19, 21], qPattern: /Questions?\s+19\s+(?:and|to)\s+21\b/i },
  { id: 'listening-pass-3', title: 'Passage Three', range: [22, 25], qPattern: /Questions?\s+22\s+(?:and|to)\s+25\b/i },
]

// ---------------------------------------------------------------- 基础工具

export function parseDirMeta(dirName) {
  const m = dirName.match(/^(\d{4})\.(\d{2})\s+第(\d+)(?:-(\d+))?套$/)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const sets = m[4] ? [Number(m[3]), Number(m[4])] : [Number(m[3])]
  return { dirName, year, month, sets, isCombined: sets.length > 1 }
}

export function makeExamId(year, month, set) {
  return `${year}-${String(month).padStart(2, '0')}-${set}`
}

export function makeExamTitle(year, month, set) {
  return `${year}年${month}月 第${set}套`
}

export function sortMetas(metas) {
  return [...metas].sort(
    (a, b) => (b.year - a.year) || (b.month - a.month) || (a.set - b.set)
  )
}

function isOcrNoiseLine(line) {
  const s = line.trim()
  return (
    /^\*?【补】以下为真题/.test(s) ||
    /^四\s*级\s*20\d{2}\s*(?:年|[0-9]{1,2}\s*[0-9]{1,2})/.test(s) ||
    /^(?:WOR|POR|\d)?\s*202\d[年4F]\s*\d{1,2}\s*[月AH]/.test(s) ||
    /^202\d-\d{2}-CET4\b/i.test(s) ||
    /^201\d\.\s*1?\d\s*\/\s*\d+\s*[(（]/.test(s)
  )
}

function cleanLine(line) {
  const s = line.replace(/\r/g, '').trim()
  return isOcrNoiseLine(s) ? '' : s
}

/** 清理 PDF 硬换行，保留空行分段；英文行按空格连接，中文行直接拼接 */
export function unwrapLines(text) {
  const paras = []
  let cur = ''
  const flush = () => {
    if (cur) paras.push(cur)
    cur = ''
  }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || isOcrNoiseLine(line)) {
      flush()
      continue
    }
    if (!cur) {
      cur = line
      continue
    }
    const cjkJoin = /[\u4e00-\u9fff，。；：、”’）]$/.test(cur) && /^[\u4e00-\u9fff（“‘]/.test(line)
    if (cur.endsWith('-') && /^[a-z]/.test(line)) {
      cur = cur.slice(0, -1) + line
    } else {
      cur += (cjkJoin ? '' : ' ') + line
    }
  }
  flush()
  return paras.join('\n\n')
}

function stripMarkdownBold(s) {
  return s
    .replace(/\*\*/g, '')
    .replace(/\*([^*\n]+)\*/g, '$1')
}

function cleanEssayCell(s) {
  return stripMarkdownBold(
    s
      .replace(/<br\s*\/?>/gi, '\n\n')
      .replace(/<\/?(?:u|div)(?:\s+[^>]*)?>/gi, '')
      .replace(/[①②③④⑤⑥⑦⑧⑨⑩⑪⑫]/g, '')
      .replace(/\s*\^\d+/g, '')
      .replace(/[\u00b9\u00b2\u00b3\u2070-\u2079]+/g, '')
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function buildSources(dirPath, examId) {
  const files = fs.readdirSync(dirPath).sort()
  const tagMap = {
    '真题解析听力.md': 'md',
    '真题.pdf': 'paper-pdf',
    '解析.pdf': 'analysis-pdf',
    '听力.mp3': 'mp3',
    '听力说明.txt': 'audio-note',
    '参考答案.md': 'ref-md',
  }
  return files
    .filter((f) => !f.startsWith('.'))
    .map((f) => ({
      id: `cet4-${examId}-${tagMap[f] || f.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()}`,
      title: f,
      localPath: `${dirPath.replace(/\\/g, '/')}/${f}`,
    }))
}

function extractFirstColumnFromTable(text, headerPattern) {
  const lines = text.split('\n')
  const headIdx = lines.findIndex((l) => headerPattern.test(l))
  if (headIdx < 0) return ''
  const chunks = []
  for (let i = headIdx + 1; i < lines.length; i++) {
    const l = lines[i].trim()
    if (!l) {
      if (chunks.length) break
      continue
    }
    if (!l.startsWith('|')) {
      if (chunks.length) break
      continue
    }
    if (/^\|\s*:?-{2,}/.test(l)) continue
    const cells = l.split('|').slice(1, -1)
    if (cells.length >= 1) {
      const first = cleanEssayCell(cells[0])
      if (first && !/^参考(?:范文|译文)$/.test(first)) chunks.push(first)
    }
  }
  return chunks.join('\n\n').trim()
}

// ---------------------------------------------------------------- 原卷/解析切分

function splitPaperAndAnalysis(mdText) {
  const text = mdText.replace(/\r\n/g, '\n').replace(/\f/g, '\n\n')
  const paperIdx = text.search(/^##\s*原卷\b/m)
  const analysisIdx = text.search(/^##\s*解析/m)
  const paperStart = paperIdx >= 0 ? paperIdx : 0
  const paperText = analysisIdx >= 0 ? text.slice(paperStart, analysisIdx) : text.slice(paperStart)
  const analysisText = analysisIdx >= 0 ? text.slice(analysisIdx) : ''
  return { paperText, analysisText }
}

function findSequentialMarkers(text, specs) {
  const hits = []
  let cursor = 0
  for (const spec of specs) {
    const slice = text.slice(cursor)
    let foundIdx = -1
    for (const re of spec.res) {
      const m = slice.match(re)
      if (m) {
        foundIdx = cursor + m.index
        break
      }
    }
    if (foundIdx >= 0) {
      hits.push({ key: spec.key, index: foundIdx })
      cursor = foundIdx + 6
    }
  }
  return hits
}

/** 从原卷中按 Part I..IV 顺序切出各部分文本（兼容 OCR 罗马数字识别误差） */
function splitPaperParts(paperText) {
  const keysIdx = paperText.search(/^(?:#*\s*)?KEYS\s*$/m)
  const body = keysIdx >= 0 ? paperText.slice(0, keysIdx) : paperText
  const keysText = keysIdx >= 0 ? paperText.slice(keysIdx) : ''

  const hits = findSequentialMarkers(body, [
    {
      key: 'writing',
      res: [
        /^(?:#+\s*)?(?:\*\*)?Part\s+\S{1,4}[\s\S]{0,160}?\bWriting\b/im,
        /^(?:#+\s*)?(?:\*\*)?Part\s+(?:I|Ⅰ|\[|\||1)(?=\s|$|[.:：*])/im,
      ],
    },
    {
      key: 'listening',
      res: [
        /^(?:#+\s*)?(?:\*\*)?Part\s+\S{1,4}[\s\S]{0,160}?\bListening(?:\s+Comprehension)?\b/im,
        /^(?:#+\s*)?(?:\*\*)?Part\s+(?:II|Ⅱ|Il|\]I|:U:|工|\|\[|\||\[)(?=\s|$|[.:：*])(?![\s\S]{0,80}\bReading\b)/im,
      ],
    },
    {
      key: 'reading',
      res: [
        /^(?:#+\s*)?(?:\*\*)?Part\s+\S{1,4}[\s\S]{0,160}?\bReading(?:\s+Comprehension)?\b/im,
        /^(?:#+\s*)?(?:\*\*)?Part\b[\s\S]{0,60}?\n+(?:#+\s*)?(?:\*\*)?Section\s*A\b[\s\S]{0,400}?(?:word\s*bank|ten\s+blanks|Directions)/im,
        /^(?:#+\s*)?(?:\*\*)?Part\s+(?:III|Ⅲ|m|\]\[|D\[|\|\|?|Il|1|3)(?=\s|$|[.:：*])/im,
      ],
    },
    {
      key: 'translation',
      res: [
        /^(?:#+\s*)?(?:\*\*)?Part\s+\S{1,4}[\s\S]{0,160}?\bTranslation\b/im,
        /^(?:#+\s*)?(?:\*\*)?Part\s+(?:IV|Ⅳ|lV|TV|V|N|了|4)(?=\s|$|[.:：*])[\s\S]{0,160}?(?:Directions|translate)/im,
      ],
    },
  ])

  const parts = { writing: '', listening: '', reading: '', translation: '', keys: keysText }
  for (let i = 0; i < hits.length; i++) {
    const end = i + 1 < hits.length ? hits[i + 1].index : body.length
    parts[hits[i].key] = body.slice(hits[i].index, end)
  }

  // 修复 PDF 分页把第 25 题 D) 选项甩到 `Part III` 标题后面的情况（如 2026-06-2）
  if (parts.reading) {
    const rLines = parts.reading.split('\n')
    const secAIdx = rLines.findIndex((l) => /^(?:#+\s*)?(?:\*\*)?Section\s*A\b/i.test(l.trim()))
    if (secAIdx > 0) {
      const headLines = rLines.slice(0, secAIdx)
      const strayOpts = headLines.filter((l) => /^[A-D]\s*[)）.]\s*\S/.test(l.trim()))
      if (strayOpts.length) {
        parts.listening += '\n' + strayOpts.join('\n')
        parts.reading = [
          ...headLines.filter((l) => !/^[A-D]\s*[)）.]\s*\S/.test(l.trim())),
          ...rLines.slice(secAIdx),
        ].join('\n')
      }
    }
  }
  return parts
}

function splitAnalysisParts(analysisText) {
  const hits = findSequentialMarkers(analysisText, [
    {
      key: 'writing',
      res: [
        /^(?:#+\s*)?(?:\*\*)?Part\s+\S{1,4}[\s_]*Writing\b/im,
        /^(?:#+\s*)?(?:\*\*)?Part\s+(?:I|Ⅰ|\[|\||1)(?=\s|$|[.:：*_])(?![\s\S]{0,40}\b(?:Listening|Reading)\b)/im,
      ],
    },
    {
      key: 'listening',
      res: [
        /^(?:#+\s*)?(?:\*\*)?Part\s+\S{1,4}[\s_]*Listening(?:\s+Comprehension)?\b/im,
        /^(?:#+\s*)?(?:\*\*)?Part\s+(?:II|Ⅱ|ll|Il|\]I|J)(?=\s*(?:\n|类|【|$))/im,
      ],
    },
    {
      key: 'reading',
      res: [
        /^(?:#+\s*)?(?:\*\*)?Part\s+\S{1,4}[\s_]*Reading(?:\s+Comprehension)?\b/im,
        /^(?:#+\s*)?(?:\*\*)?Part\s+(?:III|Ⅲ|If|亚|m|\|\])(?=\s|$)/im,
        /^(?:#+\s*)?(?:\*\*)?Part\s+\S{1,4}\s*\n+(?:#+\s*)?(?:\*\*)?Section\s*A\b/im,
      ],
    },
    {
      key: 'translation',
      res: [
        /^(?:#+\s*)?(?:\*\*)?Part\s+\S{1,4}[\s_]*Translation\b/im,
        /^(?:#+\s*)?(?:\*\*)?Part\s+(?:IV|Ⅳ|lV|TV|V|N|了|4)(?=\s|$)/im,
      ],
    },
  ])

  const parts = { writing: '', listening: '', reading: '', translation: '' }
  for (let i = 0; i < hits.length; i++) {
    const end = i + 1 < hits.length ? hits[i + 1].index : analysisText.length
    parts[hits[i].key] = analysisText.slice(hits[i].index, end)
  }
  return parts
}

// ---------------------------------------------------------------- 题目与答案提取

/** 解析文本中形如 `1. A) ... B) ...`（兼容双栏 A C B D、无空格 `49.What`、跨题号选项错位）的选择题 */
export function parseChoiceQuestions(text, minNum, maxNum) {
  const lines = text.split('\n')
  const questions = new Map()
  let curQ = null
  let prevQ = null
  let curOpt = null
  let curOptTarget = null
  let numOffset = 0
  let groupFirstQ = null
  const pendingForwardOpts = []

  const getOrCreateQ = (num) => {
    if (!questions.has(num)) {
      questions.set(num, { number: num, stemLines: [], optMap: new Map() })
    }
    if (groupFirstQ === null || num < groupFirstQ) groupFirstQ = num
    return questions.get(num)
  }

  const assignOption = (targetQ, key, val) => {
    const cleaned = val
      .replace(/<\/?u>/gi, '')
      .replace(/\s*(?:#{1,6}\s*|\*\*)?(?:Questions?\s+\d+\s+(?:and|to)\s+\d+\s+are\s+based.*|Section\s+[ABC]\s+Directions\s*:.*|#{1,6}\s*Section\s+[ABC]\b.*)\s*$/i, '')
      .replace(/\s+---+\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (!targetQ) {
      pendingForwardOpts.push({ afterQ: 0, key, text: cleaned })
      return null
    }
    // 若双栏排版把前面题目的选项（如 C/D 或 B/D）甩到后面题号之后，先回填同组内最早缺该 key 的题；若前面不缺则暂存留给后面缺该 key 的题
    if (targetQ.optMap.has(key)) {
      const nums = [...questions.keys()].sort((a, b) => a - b)
      for (const n of nums) {
        if (n >= targetQ.number || (groupFirstQ !== null && n < groupFirstQ)) continue
        const q = questions.get(n)
        if (!q.optMap.has(key)) {
          q.optMap.set(key, cleaned)
          return q
        }
      }
      pendingForwardOpts.push({ afterQ: targetQ.number, key, text: cleaned })
      return targetQ
    }
    targetQ.optMap.set(key, cleaned)
    return targetQ
  }

  const flushForwardOrphans = () => {
    if (!pendingForwardOpts.length) return
    const nums = [...questions.keys()].sort((a, b) => a - b)
    for (const item of pendingForwardOpts) {
      const dest =
        nums.find((n) => n > item.afterQ && !questions.get(n).optMap.has(item.key)) ??
        nums.find((n) => !questions.get(n).optMap.has(item.key))
      if (dest !== undefined) questions.get(dest).optMap.set(item.key, item.text)
    }
    pendingForwardOpts.length = 0
  }

  const flushOpt = () => {
    if (curOpt) {
      curOptTarget = assignOption(curOptTarget || curQ, curOpt.key, curOpt.text)
    }
    curOpt = null
    curOptTarget = null
  }

  // 一行内可能含 2~4 个选项（如 `A) ... B) ... C) ... D) ...`），循环拆分全部选项
  const feedOptionLine = (targetQ, firstKey, restText) => {
    let key = firstKey
    let rest = restText
    let dest = targetQ
    while (true) {
      const inlineNext = rest.match(/^(.*?\S)\s+['"‘-]?\s*([B-D]|©)\s*(?:[)）]\s*|[.]\s+(?=[A-Z]))_?(.*)$/)
      if (!inlineNext) {
        curOptTarget = dest
        curOpt = { key, text: rest }
        break
      }
      assignOption(dest, key, inlineNext[1])
      key = inlineNext[2] === '©' ? 'C' : inlineNext[2]
      rest = inlineNext[3]
      dest = targetQ
    }
  }

  for (const raw of lines) {
    const line = cleanLine(raw)
    if (!line) continue
    const boundaryLine = stripMarkdownBold(line.replace(/^#{1,6}\s*/, '').replace(/^[_*]+\s*/, ''))
    if (/^(?:Questions?\s+\d+|Section\s+[ABC]\b|Passage\s+(?:One|Two|Three)\b|Directions\s*:|---+$)/i.test(boundaryLine)) {
      flushOpt()
      flushForwardOrphans()
      curQ = null
      numOffset = 0
      groupFirstQ = null
      continue
    }

    const qMatch = line.match(/^(?:\*\*)?(\d{1,2})\s*(?:[.．,，]\s*|\s+)(.*)$/)
    if (qMatch && (/[.．,，]/.test(line) || /^[A-Z“"‘']/.test(qMatch[2])) && (qMatch[2] === '' || /^[A-Z“"‘'0-9*]/.test(qMatch[2]))) {
      let num = Number(qMatch[1]) + numOffset
      if (num >= minNum && num <= maxNum) {
        flushOpt()
        if (curQ && curQ.number === num && curQ.optMap.size >= 3 && !questions.has(num + 1) && num + 1 <= maxNum) {
          numOffset += 1
          num += 1
        }
        if (curQ && curQ.number !== num) prevQ = curQ
        curQ = getOrCreateQ(num)
        const rest = stripMarkdownBold(qMatch[2]).trim()
        const inlineOpt = rest.match(/^['"‘-]?\s*([A-D]|©)\s*[)）.]\s*_?(.*)$/)
        if (inlineOpt) {
          feedOptionLine(curQ, inlineOpt[1] === '©' ? 'C' : inlineOpt[1], inlineOpt[2])
        } else if (rest) {
          curQ.stemLines.push(rest)
        }
        continue
      }
    }

    const plainLine = stripMarkdownBold(line)
    const optStart = plainLine.match(/^['"‘-]?\s*([A-D]|©)\s*[)）.]\s*_?(.*)$/)
    if (optStart) {
      flushOpt()
      feedOptionLine(curQ, optStart[1] === '©' ? 'C' : optStart[1], optStart[2])
      continue
    }

    if (!curQ) continue
    if (curOpt) {
      curOpt.text += ' ' + plainLine
    } else {
      curQ.stemLines.push(plainLine)
    }
  }
  flushOpt()
  flushForwardOrphans()

  const out = new Map()
  for (const [num, q] of questions) {
    const options = ['A', 'B', 'C', 'D']
      .filter((k) => q.optMap.has(k))
      .map((key) => ({ key, text: q.optMap.get(key) }))
    out.set(num, {
      number: num,
      stem: q.stemLines.join(' ').replace(/\s+/g, ' ').trim(),
      options,
    })
  }
  return out
}

/** 解析 KEYS 表格或内联速查表 `| 1. A | 2. C |` 中的客观题答案 */
export function parseKeysSection(keysText) {
  const answers = new Map()
  if (!keysText) return answers
  for (const m of keysText.matchAll(/\b(\d{1,2})\s*[.．]\s*([A-T])\b/g)) {
    const num = Number(m[1])
    if (num >= 1 && num <= 55 && !answers.has(num)) answers.set(num, m[2])
  }
  const tokens = keysText.replace(/\r/g, '').split(/\s+/).filter(Boolean)
  for (let i = 0; i < tokens.length - 1; i++) {
    if (/^\d{1,2}$/.test(tokens[i]) && /^[A-T]$/.test(tokens[i + 1])) {
      const num = Number(tokens[i])
      if (num >= 1 && num <= 55 && !answers.has(num)) {
        answers.set(num, tokens[i + 1])
      }
    }
  }
  return answers
}

function parseRefAnswerMd(dirPath, set) {
  const refPath = path.join(dirPath, '参考答案.md')
  if (!fs.existsSync(refPath)) return null
  const text = fs.readFileSync(refPath, 'utf8').replace(/\r\n/g, '\n')
  const answers = new Map()
  const rowRe = new RegExp(`\\|\\s*第\\s*${set}\\s*套\\s*\\|([^\\n]+)\\|`, 'g')
  for (const m of text.matchAll(rowRe)) {
    const before = text.slice(0, m.index)
    const isListening = before.lastIndexOf('## 听力') > before.lastIndexOf('## 阅读')
    const startNum = isListening ? 1 : 26
    const letters = m[1].replace(/\|/g, ' ').trim().split(/\s+/).filter((t) => /^[A-T]$/.test(t))
    letters.forEach((letter, idx) => {
      const qNum = startNum + idx
      if (qNum <= 55 && !answers.has(qNum)) answers.set(qNum, letter)
    })
  }

  let writingSample = ''
  let translationSample = ''
  const secMatch = text.match(new RegExp(`## 第\\s*${set}\\s*套[：:]学习示例([\\s\\S]*?)(?=\\n## |$)`))
  if (secMatch) {
    const block = secMatch[1]
    const wMatch = block.match(/### 写作[：:][^\n]*\n+([\s\S]*?)(?=\n### 翻译|$)/)
    if (wMatch) writingSample = wMatch[1].trim()
    const tMatch = block.match(/### 翻译[：:][^\n]*\n+([\s\S]*?)$/)
    if (tMatch) translationSample = tMatch[1].trim()
  }
  return { answers, writingSample, translationSample }
}

// ---------------------------------------------------------------- Writing / Translation

function parseWriting(paperPart, analysisPart) {
  const lines = paperPart.split('\n').map(cleanLine)
  let dirStart = lines.findIndex((l) => /Directions\s*[:：;；]/i.test(l))
  if (dirStart < 0) {
    dirStart = lines.findIndex((l) => /^(?:Suppose\b|For this part\b|Write\b)/i.test(l))
  }
  const dirLines = []
  if (dirStart >= 0) {
    for (let i = dirStart; i < lines.length; i++) {
      const l = lines[i]
      if (/^(?:结构|范文|参考范文|高分范文|Part\s)/i.test(l)) break
      if (!l) {
        if (dirLines.some((x) => !/^Directions\s*[:：;；]?$/i.test(x))) break
        continue
      }
      if (/^[_\\-]+$/.test(l) || /^\(30\s*minutes\)$/i.test(l) || /^Writing$/i.test(l) || /^##/.test(l)) continue
      dirLines.push(l)
      if (/no more than \d+ words\.?\*?$/i.test(l)) break
    }
  }
  const directions = stripMarkdownBold(dirLines.join(' ').replace(/<\/?u>/gi, ''))
    .replace(/^Directions\s*[:：;；]\s*/i, '')
    .replace(/\breferenee\b/gi, 'reference')
    .replace(/\b(\d+)\s*minutes\b/gi, '$1 minutes')
    .replace(/\bno more tha\s+n(\d+)\s*words\b/gi, 'no more than $1 words')
    .replace(/\s+/g, ' ')
    .trim()

  const essaySource = analysisPart || (/范文|参考范文/.test(paperPart) ? paperPart : '')
  let answer = ''
  let explanation = ''
  if (essaySource) {
    answer = extractFirstColumnFromTable(essaySource, /\|\s*参考范文\s*\|/)
    if (!answer) {
      const essaySec = essaySource.match(
        /(?:#{2,4}\s*·?\s*参考范文[^#\n]*|\*\*·?参考范文[^*]*·?\*\*|\*\*【参考范文】\*\*|【参考\s*范文\s*】|\*\*参考范文\*\*|(?:参考\s*范文(?:\s*精彩\s*点\s*评)?|高分范文|范文\s*点\s*评)[：:]?)\s*\n+(?:(?:高分范文|参考范文|精彩点评)\s*\n+)*([\s\S]*?)(?=\n+(?:#{2,4}\s|\*\*·?(?:范文\s*译文|亮点词汇|点评|精彩点评|写作|参考译文)|【\s*(?:点评|精彩点评|范文\s*译文|亮点)|(?:\*\*)?(?:点评|精彩点评|话题词汇|亮点词汇|写作句型)[：:\s]|(?:\d+[.．]?\s+|【?\d+】\s*|[①②③④⑤⑥⑦⑧⑨⑩⑪⑫]+\s*)?[\u4e00-\u9fff]|---|\|\s*---)|$)/
      )
      if (essaySec) {
        const cleaned = essaySec[1]
          .split('\n')
          .map((l) => (l.includes('|') ? l.split('|')[0] : l))
          .join('\n')
        answer = cleanEssayCell(cleaned)
      }
    }
    answer = answer
      .replace(/^(?:参考\s*范文|高分范文)[：:]?\s*/i, '')
      .replace(/\n+---+$/g, '')
      .trim()
    explanation = essaySource
      .replace(/^(?:#+\s*)?(?:\*\*)?Part\s+\S{1,4}[^\n]*\n+/, '')
      .trim()
      .replace(/\n+>\s*注：[^\n]*$/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  return { directions, answer, explanation }
}

function parseTranslation(paperPart, analysisPart) {
  const lines = paperPart.split('\n').map(cleanLine)
  const dirIdx = lines.findIndex((l) => /Directions\s*[:：]/i.test(l))
  let dirEnd = dirIdx
  const dirLines = []
  if (dirIdx >= 0) {
    for (let i = dirIdx; i < lines.length; i++) {
      const l = lines[i]
      if (!l) {
        if (dirLines.some((x) => !/^Directions\s*[:：;；]?$/i.test(x))) break
        continue
      }
      dirLines.push(l)
      dirEnd = i
      if (/Answer Sheet/i.test(l)) break
    }
  }
  const directions = stripMarkdownBold(dirLines.join(' ').replace(/<\/?u>/gi, ''))
    .replace(/^Directions\s*[:：]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim() || 'For this part, you are allowed 30 minutes to translate a passage from Chinese into English. You should write your answer on Answer Sheet 2.'

  const rawZhLines = lines
    .slice(dirEnd + 1)
    .map((l) => l.replace(/<\/?u>/gi, ''))
  const zhLines = []
  for (const l of rawZhLines) {
    if (/^【?\s*(?:参考\s*(?:答案|译文|范文)|难点|话题词汇)/.test(l)) break
    if (!l || /^注[：:]/.test(l) || /^---+$/.test(l) || /^\d{4}[-年]\d{1,2}.*CET4|^\d+$/.test(l) || /^202\d\s*年/.test(l)) {
      zhLines.push('')
      continue
    }
    zhLines.push(l)
  }
  const sourceText = unwrapLines(zhLines.join('\n')).replace(/\n{3,}/g, '\n\n').trim()

  const transSource = analysisPart || (paperPart.includes('参考译文') ? paperPart : '')
  let answer = ''
  let explanation = ''
  if (transSource) {
    answer = extractFirstColumnFromTable(transSource, /\|\s*参考译文\s*\|/)
    if (!answer) {
      const refMatch = transSource.match(
        /(?:#{1,4}\s*·?\s*参考\s*译文(?:\s*与难点注释)?\s*·?|\*\*·?参考\s*译文(?:\s*与难点注释)?·?[：:]?\*\*|\*\*【全文翻译】\*\*|参考\s*译文(?:\s*与难点注释)?[：:]?)\s*\n+([\s\S]*?)(?=\n+(?:#{1,4}\s*·?(?:译点精析|难点注释|话题词汇|重点词汇)|(?:\*\*|#{1,4})?\s*·?(?:译点精析|难点注释|话题词汇|重点词汇|译点|难点)|1\.\s*(?:第一|【原句)|注[：:]|\||---)|$)/
      )
      if (refMatch) {
        answer = cleanEssayCell(refMatch[1])
      }
    }
    // 某些 OCR 卷（如 2020-09-2）把英文译文直接放在 `Part IV Translation` 标题之后，中文解析之前
    if (!answer) {
      const directMatch = transSource.match(
        /^(?:#+\s*)?(?:\*\*)?Part\s+\S{1,4}[^\n]*\n+([A-Z][\s\S]*?)(?=\n+(?:参考\s*译文|难点|话题词汇|1\.\s*第|\.\s*第|[a-z]+\s+[\u4e00-\u9fff]|---))/
      )
      if (directMatch) {
        answer = cleanEssayCell(directMatch[1])
      }
    }
    answer = answer
      .replace(/\n+注[：:][\s\S]*$/, '')
      .replace(/\n+---+\s*$/, '')
      .trim()
    explanation = transSource
      .replace(/^(?:#+\s*)?(?:\*\*)?Part\s+\S{1,4}[^\n]*\n+/, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  return { directions, sourceText, answer, explanation }
}

// ---------------------------------------------------------------- Listening 解析

function parseListeningAnalysis(analysisPart) {
  const transcripts = new Map()
  const details = new Map()
  if (!analysisPart) return { transcripts, details }

  // 优先按 News Report / Conversation / Passage 切分；无单元标题时回退按 Questions X and Y 切分
  const unitHits = []
  for (const spec of LISTENING_BLOCKS) {
    const m =
      analysisPart.match(new RegExp(`(?:\\*\\*|#{2,5}|^)\\s*${spec.title.replace(/\s+/g, '\\s+')}\\b`, 'im')) ||
      analysisPart.match(spec.qPattern)
    if (m) unitHits.push({ spec, index: m.index })
  }
  unitHits.sort((a, b) => a.index - b.index)

  for (let i = 0; i < unitHits.length; i++) {
    const { spec, index } = unitHits[i]
    const chunk = analysisPart.slice(index, i + 1 < unitHits.length ? unitHits[i + 1].index : analysisPart.length)

    let ansIdx = chunk.search(/(?:\*\*|#{2,5})?\s*·?(?:答\s*案\s*详\s*解|题目与解析|参考答案)·?/)
    if (ansIdx < 0) {
      const firstTok = spec.range[0] === 1 ? '(?:(?:Q\\s*)?1|QI)' : `(?:Q\\s*)?${spec.range[0]}`
      ansIdx = chunk.search(new RegExp(`(?:^|\\n)\\s*(?:\\*\\*)?${firstTok}\\s*[.．,，:：]\\s*(?:\\*\\*)?(?:Q[:：]|[A-Z]|【答案|答案)`))
    }
    const beforeAns = ansIdx >= 0 ? chunk.slice(0, ansIdx) : chunk
    const transMatch = beforeAns.match(/(?:\*\*|#{2,5})?\s*·?(?:听力\s*原文|【\s*听力\s*原文\s*】)·?[：:]?\s*(?:\*\*)?\s*\n+([\s\S]*)$/)
    let rawTranscript = (transMatch && transMatch[1].trim().length > 40)
      ? transMatch[1]
      : beforeAns.replace(/^[^\n]*\n+/, '').trim()
    rawTranscript = rawTranscript
      .replace(/(?:\n+\s*\d{1,2})?\n+(?:\*\*|#{2,5})?\s*·?(?:听力\s*原文|【\s*听力\s*原文\s*】)·?[：:]?\s*(?:\*\*)?\s*$/i, '')
      .trim()
    let rawTranslation = ''
    const zhTransSplit = rawTranscript.search(/【\s*译\s*文\s*】/)
    if (zhTransSplit >= 0) {
      rawTranslation = rawTranscript.slice(zhTransSplit).replace(/^【\s*译\s*文\s*】\s*\n*/, '').trim()
      rawTranscript = rawTranscript.slice(0, zhTransSplit).trim()
    }
    const previewSplit = rawTranscript.search(/\n*\s*(?:Questions?\s+\d+\s+(?:and|to)\s+\d+\s+are\s+based|未听先知)/i)
    if (previewSplit >= 0) rawTranscript = rawTranscript.slice(0, previewSplit).trim()

    if (rawTranscript && rawTranscript.length > 40) {
      const cleaned = rawTranscript
        .replace(/\*\*\[(\d{1,2})\]\*\*/g, '[$1]')
        .replace(/<\/?u>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
      transcripts.set(spec.id, {
        transcript: stripListeningQuestionMarkers(unwrapEnglishKeepDialogue(cleaned)),
        translation: rawTranslation ? unwrapLines(rawTranslation) : '',
      })
    }

    if (ansIdx >= 0) {
      parseDetailedChoiceExplanations(chunk.slice(ansIdx), spec.range[0], spec.range[1], details)
    }
  }

  return { transcripts, details }
}

/** 统一清除听力原文中的解析题号定位标记，如 (3)、（ 19）、(12-1)、(l-l)、[1] 等 */
export function stripListeningQuestionMarkers(text) {
  if (!text) return ''
  const markerInner = '(?:[1-9]|1\\s*[0-9]|2\\s*[0-5]|[lI][O0]|[lI]{2})(?:\\s*[-–—.]\\s*[1-9lI])?'
  const multiMarkerRe = new RegExp(
    `[ \\t]*(?:(?:\\*\\*\\s*)?(?:[（(]\\s*${markerInner}\\s*[）)]|[［\\[]\\s*${markerInner}\\s*[］\\]])(?:\\s*\\*\\*)?[ \\t]*)+`,
    'g'
  )
  const stripped = text
    .replace(/(^|\n)(?:\*\*|#{2,5})?\s*[·•]*\s*听力\s*原文\s*[·•]*\s*(?:\*\*)?\s*/g, '$1')
    .replace(multiMarkerRe, (m, offset, str) => {
      const prev = offset > 0 ? str[offset - 1] : ''
      const next = offset + m.length < str.length ? str[offset + m.length] : ''
      if (!prev || prev === '\n' || !next || next === '\n') return ''
      if ('“‘(['.includes(prev) || '.,?!;:”’)]'.includes(next)) return ''
      return ' '
    })
  return stripMarkdownBold(stripped)
    .replace(/^\s*[·•]+\s*/gm, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function unwrapEnglishKeepDialogue(text) {
  const lines = text.split('\n')
  const out = []
  let cur = ''
  const flush = () => {
    if (cur) out.push(cur)
    cur = ''
  }
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || isOcrNoiseLine(line)) {
      if (cur && /[.!?。！？”"’')]$/.test(cur)) flush()
      continue
    }
    if (/^[MW]\s*[:：]\s/.test(line)) {
      flush()
      cur = line.replace(/^([MW])\s*[:：]\s*/, '$1: ')
      continue
    }
    if (!cur) cur = line
    else cur += ' ' + line
  }
  flush()
  return out.join('\n')
}

/** 把 OCR 双栏（含 `|` 或同起两道题号或左题右析）的解析块还原为按栏顺序排列 */
function deinterleaveTwoColumn(text, minNum = 1, maxNum = 55) {
  const rawLines = text.split('\n')
  const splitSecondQ = (line) => {
    const m =
      line.match(
        new RegExp(`^(.+?(?:\\?|题\\s*[。.]|【\\s*定位[^】]*】|\\S{6,}))\\s+((?:\\*\\*)?(?:Q\\s*)?(\\d{1,2})\\s*[.．,，]\\s*(?:What|Why|How|When|Where|Who|Which|According|【|[A-Z]).*)$`)
      ) ||
      line.match(/^(.+?\?)\s+((?:O?[A-D]\s*[)）.]?\s*(?:C\s*(?:A\s*R|B)?\s*T\s*[)）\]]|【\s*精\s*析|〖\s*精\s*析)|[A-D]\)\s*【).*)$/)
    if (!m) return null
    if (m[3] !== undefined) {
      const secondNum = Number(m[3])
      if (secondNum >= minNum && secondNum <= maxNum) return [m[1].trim(), m[2].trim()]
      return null
    }
    return [m[1].trim(), m[2].trim()]
  }

  const hasPipe = rawLines.some((l) => l.includes('|'))
  const hasDoubleQ = rawLines.some((l) => splitSecondQ(l) !== null)
  if (!hasPipe && !hasDoubleQ) return rawLines

  // 只在大题边界或新一轮左栏题号出现时 flush，不在空行处拆散同一对左右栏题目
  const out = []
  let left = []
  let right = []
  const flushBlock = () => {
    if (left.length) out.push(...left)
    if (right.length) out.push('', ...right)
    left = []
    right = []
  }

  for (const raw of rawLines) {
    const trimmed = raw.trim()
    if (!trimmed) {
      if (left.length) left.push('')
      if (right.length) right.push('')
      continue
    }
    if (/^(?:Questions?\s+\d+|Section\s+[ABC]\b|Passage\s+(?:One|Two|Three)|News\s*Report|Conversation)/i.test(trimmed)) {
      flushBlock()
      out.push(raw)
      continue
    }
    if (raw.includes('|')) {
      const [l, ...r] = raw.split('|')
      if (l.trim()) left.push(l.trim())
      const rt = r.join('|').trim()
      if (rt) right.push(rt)
      continue
    }
    const dbl = splitSecondQ(trimmed)
    if (dbl) {
      if (right.length && /^(?:\*\*)?(?:Q\s*)?\d{1,2}\s*[.．,，]/.test(dbl[1])) flushBlock()
      left.push(dbl[0])
      right.push(dbl[1])
      continue
    }
    if (right.length && /^(?:\*\*)?(?:Q\s*)?\d{1,2}\s*[.．,，]/.test(trimmed)) {
      flushBlock()
    }
    left.push(raw)
  }
  flushBlock()
  return out
}

function parseDetailedChoiceExplanations(text, minNum, maxNum, details) {
  const lines = deinterleaveTwoColumn(text, minNum, maxNum)
  const blocks = new Map()
  let cur = null

  for (const raw of lines) {
    const line = cleanLine(raw)
    if (!line) {
      if (cur) cur.lines.push('')
      continue
    }
    const qHead = line.match(/^(?:\*\*)?(?:Q\s*(\d{1,2})|(\d{1,2})|(Q)I)\s*[.．,，:：]\s*(.*)$/)
    if (qHead) {
      const num = qHead[3] ? 1 : Number(qHead[1] || qHead[2])
      if (num >= minNum && num <= maxNum) {
        cur = { number: num, headRest: qHead[4], lines: [] }
        blocks.set(num, cur)
        continue
      }
    }
    if (cur) cur.lines.push(line)
  }

  for (const [num, b] of blocks) {
    const full = [b.headRest, ...b.lines].join('\n').trim()
    const headClean = stripMarkdownBold(b.headRest).replace(/^Q[:：]\s*/i, '').trim()
    const engStemMatch = headClean.match(/^([A-Z][^?？\u4e00-\u9fff]*[?？])/)
    const stem = engStemMatch ? engStemMatch[1].replace(/？$/, '?').trim() : ''

    const plain = stripMarkdownBold(full)
    // 消除 OCR 在汉字间插入的空格（如 `因 此 答 案 为 A)`）便于匹配结论句
    const compact = plain.replace(/([\u4e00-\u9fff])[ \t]+(?=[\u4e00-\u9fffA-D])/g, '$1')
    let answer = null
    const inlineCorrect = plain.match(/^\s*-?\s*([A-D])\s*[)）][^\n]*?[（(]正确答案[)）]/m)
    if (inlineCorrect) {
      answer = inlineCorrect[1]
    } else {
      const ansPatterns = [
        [plain, /【\s*答\s*案\s*解\s*析\s*】\s*([A-D])\b/],
        [plain, /(?:^|\n|\|)\s*(?:O([A-D])|©(?=\s*[【〖]|\s*[CO]\s*[AHR]?\s*T)|([A-D])\s*[A-D]?)\s*[)）.\]]?\s*(?:[【〖]\s*精\s*析|[CO]\s*(?:A\s*R|[AHR])?\s*T\s*[)）\]]?|细节|主旨|推理|词义|观点|目的|事实)/],
        [plain, /^\s*([A-D])\s*[)）]\s*(?=\n|$)/m],
        [compact, /(?:因此|故|所以)?(?:本题)?(?:(?:答)?案|选)(?:为|是|[:：])?\s*([A-D])\s*[)）项]?/],
        [compact, /(?<!排除)(?:故)?选项\s*([A-D])\s*(?:正确|为正确答案|与原文表述?相符)/],
        [compact, /故\s*([A-D])\s*项?(?:为正确答案|正确)/],
        [compact, /([A-D])\s*项?\s*(?:为正确答案|是正确答案)/],
        [compact, /(?:只有|显然)\s*(?:选项\s*)?([A-D])\s*(?:表达|符合|与)/],
        [compact, /([A-D])\s*项?(?:与(?:文章|原文|新闻|对话)(?:内容|表述)?一致|符合(?:原文|文意|题意))[^。]*?(?:故为答案|为正确答案|正确)/],
        [compact, /【答案】\s*([A-D])/],
        [compact, /答案[：:]\s*([A-D])/],
      ]
      for (const [src, re] of ansPatterns) {
        const m = src.match(re)
        if (m) {
          answer = m[1] || m[2] || (re.source.includes('©') ? 'C' : null)
          if (answer) break
        }
      }
    }

    const explanation = plain
      .replace(/^[^\n]*\n?/, (first) => (stem && first.includes(stem) ? `${first.trim()}\n` : first))
      .replace(/\n+\s*Section\s+[A-C]\s*$/i, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    details.set(num, { stem, answer, explanation })
  }
}

// ---------------------------------------------------------------- Reading 解析

function stripReadingPageNumbers(text) {
  return text
    .replace(/([^\n.!?"”’)\]:])\n+[1-9]\n+(?=[a-z(]|__\()/g, '$1\n')
    .replace(/(?:^|\n)\s*[1-9]\s*(?=\n|$)/g, '')
    .trim()
}

function parseReading(paperPart, analysisPart) {
  const normPaper = stripReadingPageNumbers(paperPart).replace(/([.!?。])\s*(Section\s+[ABC]\b)/g, '$1\n$2')
  const secAIdx = normPaper.search(/^(?:#+\s*)?(?:\*\*)?Section\s*A\b/im)
  const secBIdx = normPaper.search(/^(?:#+\s*)?(?:\*\*)?Section\s*B\b/im)
  let secCIdx = normPaper.search(/^(?:#+\s*)?(?:\*\*)?Section\s*C\b/im)
  if (secCIdx < 0) secCIdx = normPaper.search(/\bSection\s*C\s+(?:Directions|Passage\s+(?:One|1))/i)

  const secAText = secAIdx >= 0 ? normPaper.slice(secAIdx, secBIdx >= 0 ? secBIdx : normPaper.length) : ''
  const secBText = secBIdx >= 0 ? normPaper.slice(secBIdx, secCIdx >= 0 ? secCIdx : normPaper.length) : ''
  const secCText = secCIdx >= 0 ? normPaper.slice(secCIdx) : ''

  let aSecBIdx = analysisPart.search(/^(?:#+\s*)?(?:\*\*)?(?:\|\s*)?Section\s*B\b/im)
  if (aSecBIdx < 0) {
    aSecBIdx = analysisPart.search(/^(?:\*\*)?36\s*[.．]\s*[A-Z“"‘']/im)
  }
  const searchCFrom = aSecBIdx >= 0 ? aSecBIdx : 0
  const afterB = analysisPart.slice(searchCFrom)
  let relCIdx = afterB.search(/^(?:#+\s*)?(?:\*\*)?(?:\|\s*)?Section\s*C\b/im)
  if (relCIdx < 0) {
    relCIdx = afterB.search(/^(?:#+\s*)?(?:\*\*)?(?:[^\na-zA-Z]{0,4})?Passage\s+(?:One|1)\b/im)
  }
  if (relCIdx < 0) {
    relCIdx = afterB.search(/^(?:\*\*)?46\s*[.．]/im)
  }
  const aSecCIdx = relCIdx >= 0 ? searchCFrom + relCIdx : -1
  let aSecAIdx = analysisPart.search(/^(?:#+\s*)?(?:\*\*)?(?:\|\s*)?Section\s*A\b/im)
  if (aSecAIdx < 0 && analysisPart && (aSecBIdx > 0 || aSecCIdx > 0 || /(?:^|\n)\s*(?:\*\*)?26\s*[.．]/.test(analysisPart))) {
    aSecAIdx = 0
  }
  const aSecAText = aSecAIdx >= 0 ? analysisPart.slice(aSecAIdx, aSecBIdx >= 0 ? aSecBIdx : (aSecCIdx >= 0 ? aSecCIdx : analysisPart.length)) : ''
  const aSecBText = aSecBIdx >= 0 ? analysisPart.slice(aSecBIdx, aSecCIdx >= 0 ? aSecCIdx : analysisPart.length) : ''
  const aSecCText = aSecCIdx >= 0 ? analysisPart.slice(aSecCIdx) : ''

  return {
    secA: parseReadingSecA(secAText, aSecAText),
    secB: parseReadingSecB(secBText, aSecBText),
    secC: parseReadingSecC(secCText, aSecCText),
  }
}

function stripDirectionsPrefix(text) {
  const lines = text.split('\n')
  const out = []
  let skipping = false
  for (const raw of lines) {
    const l = stripMarkdownBold(raw.trim())
    if (/^(?:#+\s*)?Section\s+[ABC]\s*$/i.test(l)) continue
    if (/^Directions\s*:/i.test(l)) {
      skipping = true
      if (/more than once\.|Answer Sheet 2\.|single line through the cent(?:re|er)\./i.test(l)) skipping = false
      continue
    }
    if (!skipping && /^Each paragraph is marked with a letter\b/i.test(l)) {
      skipping = true
      if (/Sheet\s*2\./i.test(l)) skipping = false
      continue
    }
    if (skipping) {
      if (/^(?:Passage\s+(?:One|Two|1|2)|Questions?\s+\d+)/i.test(l) || /^(?:\[?[A-T]\]?|[A-T]\s*[)）.．])\s+\S/.test(l)) {
        skipping = false
      } else if (/more than once\.|(?:Answer\s+)?Sheet\s*2\.|single line through the cent(?:re|er)\./i.test(l)) {
        skipping = false
        continue
      } else {
        continue
      }
    }
    out.push(raw)
  }
  return out.join('\n').trim()
}

function parseReadingSecA(secText, aText) {
  const body = stripDirectionsPrefix(secText)
    .replace(/\\_/g, '_')
    .replace(/<u>(?:[\s\u2003_]|&(?:emsp|nbsp);)*(\d{2})(?:[\s\u2003_]|&(?:emsp|nbsp);)*<\/u>/gi, ' __($1)__ ')
  const lines = body.split('\n')
  const passageLines = []
  const wordMap = new Map()
  let inBank = false

  for (const raw of lines) {
    const l = cleanLine(raw)
    if (!inBank && (/^(?:[-*]\s*|\|\s*)?A\s*[)）.]\s*[a-zA-Z-]+/.test(l) || /^\|\s*(?:\|\s*)+$/.test(l) || /^\|(?:\s*:?-{2,}\s*\|)+$/.test(l))) {
      inBank = true
    }
    if (inBank) {
      if (/^\|(?:\s*:?-{2,}\s*\|)+$/.test(l) || /^\|\s*(?:\|\s*)+$/.test(l)) continue
      for (const m of l.matchAll(/\b([A-O1])\s*[)）.]\s*([a-zA-Z-]+)/g)) {
        const key = m[1] === '1' ? 'I' : m[1]
        if (!wordMap.has(key)) wordMap.set(key, m[2])
      }
    } else if (!/^\*\*Questions?\s+26\s+to\s+35\b/i.test(l) && !/^Questions?\s+26\s+to\s+35\b/i.test(l) && !isOcrNoiseLine(l)) {
      passageLines.push(raw)
    }
  }

  let passage = unwrapLines(passageLines.join('\n'))
  passage = passage.replace(
    /(?:_{1,}|~)\s*\(?(\d{2})\)?(?:\s|[~_])*(?:_{1,}|~)|_{2,}\s*\(?(\d{2})\)?|\(?(\d{2})\)?\s*(?:_{2,}|~_)/g,
    (_, a, b, c) => ` __(${a || b || c})__ `
  )
  passage = passage.replace(/[ \t]{2,}/g, ' ')
  for (let n = 26; n <= 35; n++) {
    if (!passage.includes(`__(${n})__`)) {
      passage = passage.replace(new RegExp(`(?<=\\s|^)${n}(?=\\s|[.,;:?!])`), `__(${n})__`)
    }
  }
  // 修复 OCR/转录把连续两个空标成同一题号的情况（如 2023-06-2 缺 31 且 32 出现两次）
  for (let n = 26; n <= 34; n++) {
    if (!passage.includes(`__(${n})__`)) {
      const nextTag = `__(${n + 1})__`
      const firstIdx = passage.indexOf(nextTag)
      const secondIdx = firstIdx >= 0 ? passage.indexOf(nextTag, firstIdx + nextTag.length) : -1
      if (firstIdx >= 0 && secondIdx >= 0) {
        passage = passage.slice(0, firstIdx) + `__(${n})__` + passage.slice(firstIdx + nextTag.length)
      }
    }
  }

  const options = Array.from({ length: 15 }, (_, i) => String.fromCharCode(65 + i))
    .filter((k) => wordMap.has(k))
    .map((key) => ({ key, text: wordMap.get(key) }))

  const translation = extractSectionTranslation(aText, 26)
  const qDetails = new Map()
  if (aText) {
    let ansIdx = aText.search(/·?答案详解·?|详解详析/)
    if (ansIdx < 0) ansIdx = aText.search(/(?:^|\n)\s*(?:\*\*)?26\s*[.．]/)
    const ansChunk = ansIdx >= 0 ? aText.slice(ansIdx) : aText
    let cur = null
    for (const raw of deinterleaveTwoColumn(ansChunk, 26, 35)) {
      const l = cleanLine(raw)
      if (/^\*\*干扰项/.test(l)) {
        cur = null
        continue
      }
      const mSameLine = l.match(/^(?:\*\*)?(\d{2})\s*[.．]\s*(?:\*\*)?(?:【答案解析】\s*|答\s*案\s*[：:]\s*)?([A-O])(?:\s*[)）.]\s*([a-zA-Z-]+))?(?:\*\*)?(.*)$/)
      if (mSameLine) {
        const num = Number(mSameLine[1])
        if (num >= 26 && num <= 35) {
          const rest = stripMarkdownBold(mSameLine[4]).trim()
          const headLine = mSameLine[3]
            ? `${mSameLine[2]}) ${mSameLine[3]}${rest ? ' ' + rest : ''}`
            : rest
          cur = {
            number: num,
            answer: mSameLine[2],
            lines: [headLine].filter(Boolean),
          }
          qDetails.set(num, cur)
          continue
        }
      }
      const mHeadOnly = l.match(/^(?:\*\*)?(\d{2})\s*[.．]\s*(.*)$/)
      if (mHeadOnly) {
        const num = Number(mHeadOnly[1])
        if (num >= 26 && num <= 35) {
          cur = { number: num, answer: null, lines: [stripMarkdownBold(mHeadOnly[2]).trim()].filter(Boolean) }
          qDetails.set(num, cur)
          continue
        }
      }
      if (cur && l) {
        const plainL = stripMarkdownBold(l)
        if (!cur.answer) {
          const compactL = plainL.replace(/([\u4e00-\u9fff])[ \t]+(?=[\u4e00-\u9fffA-O])/g, '$1')
          const nextLineAns =
            plainL.match(/^(?:([A-O])|F[PE]\)|©(?=\s*[【〖]))\s*[)）.]?\s*(?:[【〖]|$)/) ||
            compactL.match(/(?:因此|故|所以)?(?:本题)?(?:答案|选)(?:为|是|[:：])?\s*(?:F[PE]\)|([A-O]))\b/)
          if (nextLineAns) {
            cur.answer = nextLineAns[1] || (plainL.startsWith('©') ? 'C' : 'F')
          }
        }
        cur.lines.push(plainL)
      }
    }
  }

  const formattedDetails = new Map()
  for (const [num, item] of qDetails) {
    formattedDetails.set(num, { answer: item.answer, explanation: item.lines.join('\n').trim() })
  }
  return { passage, options, translation, details: formattedDetails }
}

function parseReadingSecB(secText, aText) {
  const body = stripDirectionsPrefix(secText)
  const lines = body.split('\n')
  let firstStmtIdx = lines.findIndex((l) => /^\s*(?:\*\*)?36\s*[.．,，]?\s*[A-Z“"‘']/.test(l))
  if (firstStmtIdx < 0) {
    firstStmtIdx = lines.findIndex((l) => /^\s*(?:\*\*)?3[7-9]\s*[.．,，]\s*[A-Z“"‘']/.test(l))
  }
  const passageRaw = (firstStmtIdx >= 0 ? lines.slice(0, firstStmtIdx) : lines).join('\n').trim()
  const stmtsRaw = firstStmtIdx >= 0 ? lines.slice(firstStmtIdx).join('\n') : ''

  const ocrParaAlias = { ID: 'I', FE: 'F', FP: 'F', QO: 'O', OD: 'D', OC: 'C', OO: 'O', II: 'H', '1': 'I' }
  const pLines = passageRaw.split('\n')
  const titleLines = []
  const paraList = []
  let curPara = null
  for (let i = 0; i < pLines.length; i++) {
    const l = cleanLine(pLines[i])
    if (!l) continue
    const paraMatch = l.match(/^(?:\*\*)?(?:\[([A-T])\]|([A-Z0-9]{1,2})\s*[)）.．])\s*(?:\*\*)?\s*(.*)$/)
    if (paraMatch) {
      const tok = paraMatch[1] || paraMatch[2]
      const expectedNext = String.fromCharCode(65 + paraList.length + (curPara ? 1 : 0))
      const afterLetter = String.fromCharCode(expectedNext.charCodeAt(0) + 1)
      let matchedLetter = tok === expectedNext || ocrParaAlias[tok] === expectedNext ? expectedNext : null
      // 若标签被 OCR 识别成错字但非孤立空行（后接段落首句），且后文紧接着出现 expectedNext+1，则按顺序归位
      if (!matchedLetter && paraMatch[3] && /^[A-Z“"‘'0-9]/.test(paraMatch[3])) {
        const lookahead = pLines.slice(i + 1, i + 40).some((nl) =>
          new RegExp(`^(?:\\*\\*)?(?:\\[${afterLetter}\\]|${afterLetter}\\s*[)）])\\s+\\S`).test(cleanLine(nl))
        )
        if (lookahead) matchedLetter = expectedNext
      }
      if (matchedLetter) {
        if (curPara) paraList.push(curPara)
        curPara = { letter: matchedLetter, text: stripMarkdownBold(paraMatch[3]).trim() }
        continue
      }
    }
    if (curPara) {
      if (curPara.text.endsWith('-') && /^[a-z]/.test(l)) {
        curPara.text = curPara.text.slice(0, -1) + l
      } else {
        curPara.text += ' ' + l
      }
    } else {
      titleLines.push(l)
    }
  }
  if (curPara) paraList.push(curPara)

  const title = stripMarkdownBold(titleLines.join(' ')).replace(/\s+/g, ' ').trim()
  const passage = [title, ...paraList.map((p) => `[${p.letter}] ${p.text.replace(/\s+/g, ' ').trim()}`)]
    .filter(Boolean)
    .join('\n')

  const matchingOptions = paraList.map((p) => ({ key: p.letter, text: `段落 [${p.letter}]` }))

  const stmtMap = new Map()
  let curStmt = null
  for (const raw of stmtsRaw.split('\n')) {
    const l = cleanLine(raw)
    if (!l) continue
    const sm = l.match(/^(?:\*\*)?(\d{2})\s*(?:[.．,，]\s*|\s+)(.*)$/)
    if (sm && /^[A-Za-z“"‘']/.test(sm[2])) {
      const num = Number(sm[1])
      if (num >= 36 && num <= 45) {
        curStmt = { number: num, text: stripMarkdownBold(sm[2]) }
        stmtMap.set(num, curStmt)
        continue
      }
    }
    if (curStmt) curStmt.text += ' ' + stripMarkdownBold(l)
  }
  for (const [num, s] of stmtMap) {
    stmtMap.set(num, s.text.replace(/\s+/g, ' ').trim())
  }

  const translation = extractSectionTranslation(aText, 36)
  const details = new Map()
  if (aText) {
    let ansIdx = aText.search(/答案详解|详解详析/)
    if (ansIdx < 0) ansIdx = aText.search(/(?:^|\n)\s*(?:\*\*)?36\s*[.．]/)
    const ansChunk = ansIdx >= 0 ? aText.slice(ansIdx) : aText
    let cur = null
    for (const raw of deinterleaveTwoColumn(ansChunk, 36, 45)) {
      const l = cleanLine(raw)
      if (!l) continue
      const m = l.match(/^(?:\*\*)?(\d{2})\s*[.．,，]\s*(.*)$/)
      if (m) {
        const num = Number(m[1])
        if (num >= 36 && num <= 45) {
          cur = { number: num, lines: [stripMarkdownBold(m[2]).trim()].filter(Boolean) }
          details.set(num, cur)
          continue
        }
      }
      if (cur) cur.lines.push(stripMarkdownBold(l))
    }
  }

  const formattedDetails = new Map()
  for (const [num, item] of details) {
    const full = item.lines.join('\n').trim()
    const compact = full.replace(/([\u4e00-\u9fff])\s+(?=[\u4e00-\u9fffA-T])/g, '$1')
    const ansMatch =
      full.match(/【答案解析】\s*([A-T])\b/) ||
      compact.match(/答案解析\s*[:：]?\s*([A-T])\s*[。.]/) ||
      full.match(/(?:^|\n|\|)\s*(?:O([A-T])|([A-T]))\s*[)）.]\s*[【〖]\s*精\s*析/) ||
      compact.match(/(?:故)?(?:答案|选|对应)[：:为]?\s*\[?([A-T])\]?(?:\s*段|\s*[。)）]|$)/) ||
      full.match(/(?:^|\n)\[([A-T])\]\s+/) ||
      full.match(/^([A-T])\s*[)。.]/)
    formattedDetails.set(num, {
      answer: ansMatch ? ansMatch[1] || ansMatch[2] : null,
      explanation: full,
    })
  }
  return { passage, matchingOptions, statements: stmtMap, translation, details: formattedDetails }
}

function parseReadingSecC(secText, aText) {
  const body = stripDirectionsPrefix(secText)
  let p1Idx = body.search(/^(?:#+\s*)?(?:\*\*)?Passage\s+(?:One|1)\b/im)
  let p2Idx = body.search(/^(?:#+\s*)?(?:\*\*)?Passage\s+(?:Two|2)\b/im)
  if (p1Idx < 0) p1Idx = body.search(/Questions?\s+46\s+to\s+50\b/i)
  if (p2Idx < 0) p2Idx = body.search(/Questions?\s+51\s+to\s+55\b/i)
  // 若仍无 Passage One 标题，则整块从头到 Passage Two（或 50 题结束）属于 Passage One
  const p1Start = p1Idx >= 0 ? p1Idx : 0
  const p1Raw = body.slice(p1Start, p2Idx >= 0 ? p2Idx : body.length)
  const p2Raw = p2Idx >= 0 ? body.slice(p2Idx) : ''

  let ap1Idx = aText.search(/^(?:#+\s*)?(?:\*\*)?(?:[^\na-zA-Z]{0,4})?Passage\s+(?:One|1)\b/im)
  let ap2Idx = aText.search(/^(?:#+\s*)?(?:\*\*)?(?:[^\na-zA-Z]{0,4})?Passage\s+(?:Two|2)\b/im)
  if (ap1Idx < 0) ap1Idx = aText.search(/(?:^|\n)\s*(?:\*\*)?46\s*[.．]/)
  if (ap2Idx < 0) ap2Idx = aText.search(/(?:^|\n)\s*(?:\*\*)?51\s*[.．]/)
  const ap1Raw = ap1Idx >= 0 ? aText.slice(ap1Idx, ap2Idx >= 0 ? ap2Idx : aText.length) : ''
  const ap2Raw = ap2Idx >= 0 ? aText.slice(ap2Idx) : ''

  return {
    p1: parseSingleCarefulPassage(p1Raw, ap1Raw, 46, 50),
    p2: parseSingleCarefulPassage(p2Raw, ap2Raw, 51, 55),
  }
}

function parseSingleCarefulPassage(paperRaw, analysisRaw, minNum, maxNum) {
  const lines = paperRaw.split('\n')
  const firstQIdx = lines.findIndex((l) => new RegExp(`^\\s*(?:\\*\\*)?${minNum}\\s*(?:[.．]\\s*|\\s+)[A-Z“"‘']`).test(l))
  const passageLines = (firstQIdx >= 0 ? lines.slice(0, firstQIdx) : lines).filter(
    (l) => !/^\s*(?:#+\s*)?(?:\*\*)?Passage\s+(?:One|Two|1|2)\b/i.test(l) && !/^\s*(?:\*\*)?Questions?\s+[\d\]]+\s+(?:to|and)\s+\d+\s+are\s+based/i.test(l) && !isOcrNoiseLine(l)
  )
  const passage = unwrapLines(passageLines.join('\n'))
  const qsRaw = firstQIdx >= 0 ? lines.slice(firstQIdx).join('\n') : ''
  const questions = parseChoiceQuestions(qsRaw, minNum, maxNum)

  const translation = extractSectionTranslation(analysisRaw, minNum)
  const details = new Map()
  if (analysisRaw) {
    let ansIdx = analysisRaw.search(/·?答案详解·?/)
    if (ansIdx < 0) ansIdx = analysisRaw.search(new RegExp(`(?:^|\\n)\\s*(?:\\*\\*)?${minNum}\\s*[.．]`))
    let ansChunk = ansIdx >= 0 ? analysisRaw.slice(ansIdx) : analysisRaw
    const transTail = ansChunk.search(/\n+(?:#{1,6}\s*|\*\*)?·?(?:参考译文|全文翻译|重点词汇|核心词汇)·?/)
    if (transTail >= 0) ansChunk = ansChunk.slice(0, transTail)
    parseDetailedChoiceExplanations(ansChunk, minNum, maxNum, details)
  }
  return { passage, questions, translation, details }
}

function extractSectionTranslation(analysisChunk, firstQNum = 0) {
  if (!analysisChunk) return ''
  const stopRe = '(?:#{1,6}\\s*|\\*\\*)?[·\\s]*(?:答案详解|详解详析|选项归类|干扰项注释|题目与解析|核心词汇|重点词汇|重难点)'
  const m = analysisChunk.match(new RegExp(`·?(?:全文翻译|参考译文)·?[^\\n]*\\n+([\\s\\S]*?)(?=\\n+${stopRe}|$)`))
  let raw = m ? m[1] : ''
  if (!raw && firstQNum > 0) {
    const qStart = analysisChunk.search(new RegExp(`(?:^|\\n)\\s*(?:\\*\\*)?${firstQNum}\\s*[.．]`))
    if (qStart > 0) {
      raw = analysisChunk.slice(0, qStart).replace(/^(?:[^\n]*\n){1,2}/, '')
    }
  }
  if (!raw) return ''
  return raw
    .replace(/<\/?u>/gi, '')
    .replace(/^#{1,6}\s*·?概览·?\s*\n+/g, '')
    .replace(/(?:^|\n)(?:\*\*|#{1,6}\s*)·?(?:重难点单词及短语|核心词汇|重点词汇)·?(?:\*\*)?[\s\S]*?(?=\n+(?:#{1,6}\s|$))/g, '\n')
    .replace(new RegExp(`\\n+${stopRe}[\\s\\S]*$`, 'g'), '')
    .replace(/\n+---+\s*$/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ---------------------------------------------------------------- 组装 Exam

function buildSharedSection(type, title, sharedWithExamId, sharedWithTitle, sharedNote) {
  return {
    id: type,
    type,
    title,
    directions: '',
    audio: null,
    blocks: [],
    questions: [],
    sharedWithExamId,
    sharedWithTitle,
    sharedNote,
  }
}

/** 从 听力说明.txt 提取真实共用目标套号（避开开头「本套（第3套）」自指） */
export function parseSharedAudioTargetSet(noteText, currentSet) {
  const m =
    noteText.match(/与\s*第\s*(\d)\s*套/) ||
    noteText.match(/「\d{4}\.\d{2}\s+第\s*(\d)\s*套」/)
  const targetSet = m ? Number(m[1]) : 1
  if (targetSet === currentSet) {
    throw new Error(`听力说明指向自身（第${currentSet}套）: ${noteText}`)
  }
  return targetSet
}

function isSharedPlaceholder(text) {
  const s = (text || '').trim()
  return s.length < 600 && /不再重复出现|无单独听力|与第[一二两12]|与前两套.*相同|OMITTED/i.test(s)
}

export function parseStandardExam({ dirPath, dirName, paperText, analysisText, year, month, set, isCombinedSplit = false }) {
  const id = makeExamId(year, month, set)
  const title = makeExamTitle(year, month, set)
  const sources = buildSources(dirPath, id)
  const mdSource = sources.find((s) => s.title === '真题解析听力.md')
  const mp3Source = sources.find((s) => s.title === '听力.mp3')
  const mdFileId = mdSource ? mdSource.id : `cet4-${id}-md`

  const paper = splitPaperParts(paperText)
  const analysis = splitAnalysisParts(analysisText)
  const keysAnswers = parseKeysSection([paper.keys, analysisText.slice(-3000)].filter(Boolean).join('\n'))
  const refAns = parseRefAnswerMd(dirPath, set)
  const issues = []

  // 1. Writing
  const writing = parseWriting(paper.writing, analysis.writing)
  if (!writing.answer && refAns?.writingSample) writing.answer = refAns.writingSample
  if (!writing.directions) issues.push('写作题干缺失')
  if (!writing.answer) issues.push('写作参考范文缺失')

  // 2. Listening
  const listeningNotePath = path.join(dirPath, '听力说明.txt')
  const hasMp3 = Boolean(mp3Source)
  const listeningSharedInPaper = isSharedPlaceholder(paper.listening)
  let listeningSection

  if ((!hasMp3 && fs.existsSync(listeningNotePath)) || listeningSharedInPaper) {
    let targetSet = 1
    if (fs.existsSync(listeningNotePath)) {
      const noteText = fs.readFileSync(listeningNotePath, 'utf8').trim()
      targetSet = parseSharedAudioTargetSet(noteText, set)
    }
    const sharedWithExamId = makeExamId(year, month, targetSet)
    const sharedWithTitle = makeExamTitle(year, month, targetSet)
    listeningSection = buildSharedSection(
      'listening',
      'Part II Listening (听力理解)',
      sharedWithExamId,
      sharedWithTitle,
      `本套听力与 ${sharedWithTitle} 共用，题目、解析和听力材料集中在 ${sharedWithExamId} 练习；本套不再重复展示。`
    )
  } else {
    const listeningQsParsed = parseChoiceQuestions(paper.listening, 1, 25)
    const listeningAnalysis = parseListeningAnalysis(analysis.listening)
    const blocks = LISTENING_BLOCKS.map((spec) => {
      const tr = listeningAnalysis.transcripts.get(spec.id)
      return {
        id: spec.id,
        title: spec.title,
        text: '',
        transcript: tr?.transcript || '',
        translation: tr?.translation || '',
        source: { fileId: mdFileId },
      }
    })
    const questions = []
    for (let n = 1; n <= 25; n++) {
      const spec = LISTENING_BLOCKS.find((b) => n >= b.range[0] && n <= b.range[1])
      const pq = listeningQsParsed.get(n) || { options: [] }
      const det = listeningAnalysis.details.get(n)
      const optKeys = new Set(pq.options.map((o) => o.key))
      const rawAns = refAns?.answers.get(n) || keysAnswers.get(n) || det?.answer || null
      const answer = rawAns && optKeys.has(rawAns) ? rawAns : null
      if (!answer) issues.push(`听力第 ${n} 题缺少有效答案`)
      if (pq.options.length !== 4) issues.push(`听力第 ${n} 题选项数异常（${pq.options.length}）`)
      questions.push({
        id: `${id}-q${n}`,
        number: n,
        kind: 'single-choice',
        stem: det?.stem || `Question ${n} (请根据录音选择最佳答案)`,
        blockId: spec.id,
        options: pq.options,
        answer,
        explanation: det?.explanation || '',
        source: { fileId: mdFileId },
        answerSource: { fileId: mdFileId },
        verified: Boolean(answer),
      })
    }
    if (blocks.some((b) => !b.transcript)) issues.push('部分听力原文缺失')
    listeningSection = {
      id: 'listening',
      type: 'listening',
      title: 'Part II Listening (听力理解)',
      directions: 'In this section, you will hear three news reports, two long conversations and three passages.',
      audio: mp3Source
        ? { src: `source-media/${dirName}/听力.mp3`, sourceId: mp3Source.id, sharedWith: [] }
        : null,
      blocks,
      questions,
    }
    if (!mp3Source) issues.push('缺少听力音频 听力.mp3')
  }

  // 3. Reading
  let readingSection
  const readingSharedMatch = paperText.slice(0, 600).match(/其余题目和第\s*(\d)\s*套完全相同/)
  if (isCombinedSplit || isSharedPlaceholder(paper.reading) || !paper.reading.trim() || readingSharedMatch) {
    const targetReadSet = readingSharedMatch ? Number(readingSharedMatch[1]) : 1
    const sharedWithExamId = makeExamId(year, month, targetReadSet)
    const sharedWithTitle = makeExamTitle(year, month, targetReadSet)
    readingSection = buildSharedSection(
      'reading',
      'Part III Reading (阅读理解)',
      sharedWithExamId,
      sharedWithTitle,
      `本套阅读与 ${sharedWithTitle} 共用（原卷未单列），请前往 ${sharedWithExamId} 练习。`
    )
    issues.push(
      isCombinedSplit
        ? `合卷拆分：本套仅含写作与翻译；听力与阅读与 ${sharedWithTitle} 共用。`
        : id === '2022-06-3'
          ? `阅读理解与 ${sharedWithTitle} 共用（原卷未单列，依使用者决定指向第1套）。`
          : `阅读理解与 ${sharedWithTitle} 共用（原卷未单列）。`
    )
  } else {
    const reading = parseReading(paper.reading, analysis.reading)
    const readingBlocks = [
      { id: 'reading-sec-a-passage', title: 'Section A 选词填空', text: reading.secA.passage, source: { fileId: mdFileId }, transcript: null, translation: reading.secA.translation || null },
      { id: 'reading-sec-b-passage', title: 'Section B 长篇阅读', text: reading.secB.passage, source: { fileId: mdFileId }, transcript: null, translation: reading.secB.translation || null },
      { id: 'reading-passage-1', title: 'Section C Passage One', text: reading.secC.p1.passage, source: { fileId: mdFileId }, transcript: null, translation: reading.secC.p1.translation || null },
      { id: 'reading-passage-2', title: 'Section C Passage Two', text: reading.secC.p2.passage, source: { fileId: mdFileId }, transcript: null, translation: reading.secC.p2.translation || null },
    ]
    const readingQuestions = []
    for (let n = 26; n <= 35; n++) {
      const det = reading.secA.details.get(n)
      const optKeys = new Set(reading.secA.options.map((o) => o.key))
      const rawAns = refAns?.answers.get(n) || keysAnswers.get(n) || det?.answer || null
      const answer = rawAns && optKeys.has(rawAns) ? rawAns : null
      if (!answer) issues.push(`阅读第 ${n} 题缺少有效答案`)
      if (!reading.secA.passage.includes(`__(${n})__`)) issues.push(`选词填空缺少空格 __(${n})__`)
      readingQuestions.push({
        id: `${id}-q${n}`,
        number: n,
        kind: 'word-bank',
        stem: `第 [${n}] 空处填入词汇`,
        blockId: 'reading-sec-a-passage',
        options: reading.secA.options,
        answer,
        explanation: det?.explanation || '',
        source: { fileId: mdFileId },
        answerSource: { fileId: mdFileId },
        verified: Boolean(answer),
      })
    }
    if (reading.secA.options.length !== 15) issues.push(`选词填空词库数量异常（${reading.secA.options.length}）`)

    const matchKeys = new Set(reading.secB.matchingOptions.map((o) => o.key))
    for (let n = 36; n <= 45; n++) {
      const stem = reading.secB.statements.get(n) || ''
      const det = reading.secB.details.get(n)
      const rawAns = refAns?.answers.get(n) || keysAnswers.get(n) || det?.answer || null
      const answer = rawAns && matchKeys.has(rawAns) ? rawAns : null
      if (!stem) issues.push(`长篇阅读第 ${n} 题题干缺失`)
      if (!answer) issues.push(`长篇阅读第 ${n} 题缺少有效答案`)
      readingQuestions.push({
        id: `${id}-q${n}`,
        number: n,
        kind: 'matching',
        stem,
        blockId: 'reading-sec-b-passage',
        options: reading.secB.matchingOptions,
        answer,
        explanation: det?.explanation || '',
        source: { fileId: mdFileId },
        answerSource: { fileId: mdFileId },
        verified: Boolean(answer),
      })
    }

    for (const [blockId, pData, minN, maxN] of [
      ['reading-passage-1', reading.secC.p1, 46, 50],
      ['reading-passage-2', reading.secC.p2, 51, 55],
    ]) {
      for (let n = minN; n <= maxN; n++) {
        const pq = pData.questions.get(n) || { stem: '', options: [] }
        const det = pData.details.get(n)
        const optKeys = new Set(pq.options.map((o) => o.key))
        const rawAns = refAns?.answers.get(n) || keysAnswers.get(n) || det?.answer || null
        const answer = rawAns && optKeys.has(rawAns) ? rawAns : null
        if (!pq.stem) issues.push(`仔细阅读第 ${n} 题题干缺失`)
        if (!answer) issues.push(`仔细阅读第 ${n} 题缺少有效答案`)
        if (pq.options.length !== 4) issues.push(`仔细阅读第 ${n} 题选项数异常（${pq.options.length}）`)
        readingQuestions.push({
          id: `${id}-q${n}`,
          number: n,
          kind: 'single-choice',
          stem: pq.stem,
          blockId,
          options: pq.options,
          answer,
          explanation: det?.explanation || '',
          source: { fileId: mdFileId },
          answerSource: { fileId: mdFileId },
          verified: Boolean(answer),
        })
      }
    }

    readingSection = {
      id: 'reading',
      type: 'reading',
      title: 'Part III Reading (阅读理解)',
      directions: 'Part III consists of Section A (Word Bank, 26-35), Section B (Long Passage Matching, 36-45), and Section C (Careful Reading, 46-55).',
      audio: null,
      blocks: readingBlocks,
      questions: readingQuestions,
    }
  }

  // 4. Translation
  const trans = parseTranslation(paper.translation, analysis.translation)
  if (!trans.answer && refAns?.translationSample) trans.answer = refAns.translationSample
  if (!trans.sourceText) issues.push('翻译题干缺失')
  if (!trans.answer) issues.push('翻译参考译文缺失')

  const status = issues.length === 0 ? 'ready' : 'partial'

  return {
    id,
    title,
    year,
    month,
    set,
    status,
    issues,
    sources,
    sections: [
      {
        id: 'writing',
        type: 'writing',
        title: 'Part I Writing (写作)',
        directions: writing.directions,
        audio: null,
        blocks: [
          {
            id: 'writing-topic-block',
            title: '作文题目要求',
            text: writing.directions,
            source: { fileId: mdFileId },
            transcript: null,
            translation: null,
          },
        ],
        questions: [
          {
            id: `${id}-writing`,
            number: 56,
            kind: 'essay',
            stem: writing.directions,
            blockId: 'writing-topic-block',
            options: [],
            answer: writing.answer || null,
            explanation: writing.explanation,
            source: { fileId: mdFileId },
            answerSource: { fileId: mdFileId },
            verified: Boolean(writing.answer),
          },
        ],
      },
      listeningSection,
      readingSection,
      {
        id: 'translation',
        type: 'translation',
        title: 'Part IV Translation (段落翻译)',
        directions: trans.directions,
        audio: null,
        blocks: [
          {
            id: 'translation-topic-block',
            title: '待翻译中文段落',
            text: trans.sourceText,
            source: { fileId: mdFileId },
            transcript: null,
            translation: null,
          },
        ],
        questions: [
          {
            id: `${id}-translation`,
            number: 57,
            kind: 'translation',
            stem: trans.sourceText,
            blockId: 'translation-topic-block',
            options: [],
            answer: trans.answer || null,
            explanation: trans.explanation,
            source: { fileId: mdFileId },
            answerSource: { fileId: mdFileId },
            verified: Boolean(trans.answer),
          },
        ],
      },
    ],
  }
}

function splitCombinedSets(paperText, analysisText, sets) {
  const cnNum = { 2: '二', 3: '三' }
  const out = []
  for (let i = 0; i < sets.length; i++) {
    const s = sets[i]
    const nextS = sets[i + 1]
    const pRe = new RegExp(`^###\\s*20\\d{2}\\s*年.*第\\s*${s}\\s*套`, 'm')
    const pNextRe = nextS ? new RegExp(`^###\\s*20\\d{2}\\s*年.*第\\s*${nextS}\\s*套`, 'm') : null
    const pStart = paperText.search(pRe)
    const pEnd = pNextRe ? paperText.search(pNextRe) : paperText.length
    const pSlice = pStart >= 0 ? paperText.slice(pStart, pEnd >= 0 ? pEnd : paperText.length) : ''

    const aRe = new RegExp(`^###\\s*20\\d{2}\\s*年.*(?:第\\s*${s}\\s*套|（${cnNum[s] || s}）)`, 'm')
    const aNextRe = nextS ? new RegExp(`^###\\s*20\\d{2}\\s*年.*(?:第\\s*${nextS}\\s*套|（${cnNum[nextS] || nextS}）)`, 'm') : null
    const aStart = analysisText.search(aRe)
    const aEnd = aNextRe ? analysisText.search(aNextRe) : analysisText.length
    const aSlice = aStart >= 0 ? analysisText.slice(aStart, aEnd >= 0 ? aEnd : analysisText.length) : ''

    out.push({ set: s, paperText: pSlice, analysisText: aSlice })
  }
  return out
}

// ---------------------------------------------------------------- CLI 入口

function toMeta(exam) {
  return {
    id: exam.id,
    title: exam.title,
    year: exam.year,
    month: exam.month,
    set: exam.set,
    file: `exams/${exam.id}.json`,
    status: exam.status,
    issues: exam.issues,
  }
}

/** 读取人工复核覆盖文件 scripts/cet4-overrides/<id>.json 与 <id>.supplement.json（依序合并） */
function applyOverrides(exam) {
  const overrideFiles = [`${exam.id}.json`, `${exam.id}.supplement.json`]
    .map((name) => path.join(__dirname, 'cet4-overrides', name))
    .filter((p) => fs.existsSync(p))
  if (!overrideFiles.length) return exam

  const readingSec = exam.sections.find((s) => s.type === 'reading')
  const qByNum = new Map()
  for (const sec of exam.sections) {
    for (const q of sec.questions || []) qByNum.set(q.number, q)
  }

  for (const overridePath of overrideFiles) {
    const ov = JSON.parse(fs.readFileSync(overridePath, 'utf8'))

    // 1. 支持 _sections: { [section.type]: { directions?, evidence? } }
    if (ov._sections && typeof ov._sections === 'object') {
      for (const sec of exam.sections) {
        const sp = ov._sections[sec.type]
        if (sp && sp.directions !== undefined) sec.directions = sp.directions
      }
    }

    // 2. 支持 _blocks: { [blockId]: { text?, transcript?, translation?, options?, evidence? } }
    if (ov._blocks && typeof ov._blocks === 'object') {
      for (const sec of exam.sections) {
        for (const blk of sec.blocks || []) {
          const bp = ov._blocks[blk.id]
          if (!bp) continue
          if (bp.text !== undefined) blk.text = bp.text
          if (bp.transcript !== undefined) blk.transcript = bp.transcript
          if (bp.translation !== undefined) blk.translation = bp.translation
          if (Array.isArray(bp.options)) {
            for (const q of sec.questions || []) {
              if (q.blockId === blk.id) q.options = bp.options
            }
          }
        }
      }
    }

    // 3. 兼容 _secA / _secB，以及通过 _blocks['reading-sec-b-passage'].text 同步刷新匹配选项 A..T
    if (readingSec && ov._secA) {
      const secABlock = readingSec.blocks.find((b) => b.id === 'reading-sec-a-passage')
      if (secABlock && ov._secA.passage) secABlock.text = ov._secA.passage
      if (Array.isArray(ov._secA.options)) {
        for (const q of readingSec.questions) {
          if (q.kind === 'word-bank') q.options = ov._secA.options
        }
      }
    }
    if (readingSec && ov._secB) {
      const secBBlock = readingSec.blocks.find((b) => b.id === 'reading-sec-b-passage')
      if (secBBlock && ov._secB.passage) secBBlock.text = ov._secB.passage
      if (Array.isArray(ov._secB.matchingOptions)) {
        for (const q of readingSec.questions) {
          if (q.kind === 'matching') q.options = ov._secB.matchingOptions
        }
      }
    }
    if (readingSec && ov._blocks?.['reading-sec-b-passage']?.text && !ov._blocks['reading-sec-b-passage'].options) {
      const letters = [...ov._blocks['reading-sec-b-passage'].text.matchAll(/^\[([A-T])\]/gm)].map((m) => m[1])
      if (letters.length) {
        const mOpts = letters.map((key) => ({ key, text: `段落 [${key}]` }))
        for (const q of readingSec.questions) {
          if (q.kind === 'matching') q.options = mOpts
        }
      }
    }

    // 4. 顶层题号覆写: { answer?, options?, stem?, explanation?, evidence? }
    for (const sec of exam.sections) {
      for (const q of sec.questions || []) {
        const patch = ov[String(q.number)]
        if (!patch) continue
        if (patch.stem !== undefined) q.stem = patch.stem
        if (Array.isArray(patch.options)) q.options = patch.options
        if (patch.explanation !== undefined) q.explanation = patch.explanation
        if (patch.answer !== undefined) {
          const optKeys = new Set((q.options || []).map((o) => o.key))
          if (q.kind === 'essay' || q.kind === 'translation' || optKeys.has(patch.answer)) {
            q.answer = patch.answer
            q.verified = true
          }
        }
        if (patch.evidence) q.verificationNote = `人工对照原卷/解析 PDF 核对：${patch.evidence}`
      }
    }
  }

  const secABlock = readingSec?.blocks.find((b) => b.id === 'reading-sec-a-passage')
  const secAOpts = readingSec?.questions.find((q) => q.kind === 'word-bank')?.options || []
  const listeningSec = exam.sections.find((s) => s.type === 'listening')
  for (const blk of listeningSec?.blocks || []) {
    if (blk.transcript) blk.transcript = stripListeningQuestionMarkers(blk.transcript)
  }
  const allTranscriptsPresent = Boolean(listeningSec?.blocks?.length && listeningSec.blocks.every((b) => b.transcript))

  exam.issues = exam.issues.filter((msg) => {
    const m = msg.match(/第\s*(\d{1,2})\s*题/)
    if (m) {
      const q = qByNum.get(Number(m[1]))
      if (q) {
        if (msg.includes('缺少有效答案') && q.answer) return false
        if (msg.includes('题干缺失') && q.stem) return false
        if (msg.includes('选项数异常') && q.kind === 'single-choice' && (q.options || []).length === 4) return false
      }
    }
    if (secAOpts.length === 15 && msg.startsWith('选词填空词库数量异常')) return false
    if (secABlock?.text) {
      const blankM = msg.match(/选词填空缺少空格 __\((\d{2})\)__/)
      if (blankM && secABlock.text.includes(`__(${blankM[1]})__`)) return false
    }
    if (allTranscriptsPresent && msg === '部分听力原文缺失') return false
    if (qByNum.get(56)?.answer && msg === '写作参考范文缺失') return false
    if (qByNum.get(57)?.answer && msg === '翻译参考译文缺失') return false
    return true
  })
  exam.status = exam.issues.length === 0 ? 'ready' : 'partial'
  return exam
}

function writeExamAndUpdateIndex(exam) {
  applyOverrides(exam)
  fs.mkdirSync(EXAMS_DIR, { recursive: true })
  fs.writeFileSync(path.join(EXAMS_DIR, `${exam.id}.json`), JSON.stringify(exam, null, 2) + '\n', 'utf8')

  const indexPath = path.join(OUT_ROOT, 'index.json')
  let metas = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, 'utf8')) : []
  const meta = toMeta(exam)
  metas = sortMetas([...metas.filter((m) => m.id !== meta.id), meta])
  fs.writeFileSync(indexPath, JSON.stringify(metas, null, 2) + '\n', 'utf8')
}

export function importDirectory(dirPath) {
  const dirName = path.basename(dirPath)
  const dirMeta = parseDirMeta(dirName)
  if (!dirMeta) throw new Error(`无法识别四级目录名: ${dirName}`)
  const mdPath = path.join(dirPath, '真题解析听力.md')
  if (!fs.existsSync(mdPath)) throw new Error(`缺少真题解析听力.md: ${dirPath}`)
  const mdText = fs.readFileSync(mdPath, 'utf8')
  const { paperText, analysisText } = splitPaperAndAnalysis(mdText)

  if (dirMeta.isCombined) {
    const slices = splitCombinedSets(paperText, analysisText, dirMeta.sets)
    const exams = slices.map((sl) =>
      parseStandardExam({
        dirPath,
        dirName,
        paperText: sl.paperText,
        analysisText: sl.analysisText,
        year: dirMeta.year,
        month: dirMeta.month,
        set: sl.set,
        isCombinedSplit: true,
      })
    )
    exams.forEach(writeExamAndUpdateIndex)
    return exams
  }

  const exam = parseStandardExam({
    dirPath,
    dirName,
    paperText,
    analysisText,
    year: dirMeta.year,
    month: dirMeta.month,
    set: dirMeta.sets[0],
  })
  writeExamAndUpdateIndex(exam)
  return [exam]
}

function main() {
  const arg = process.argv[2] || DEFAULT_SOURCE_ROOT
  const target = path.resolve(arg)
  if (!fs.existsSync(target)) {
    console.error(`来源路径不存在: ${target}`)
    process.exit(1)
  }

  const isSingle = fs.existsSync(path.join(target, '真题解析听力.md'))
  const dirs = isSingle
    ? [target]
    : fs
        .readdirSync(target)
        .sort()
        .map((name) => path.join(target, name))
        .filter((p) => fs.statSync(p).isDirectory())

  let count = 0
  for (const d of dirs) {
    const exams = importDirectory(d)
    count += exams.length
    for (const e of exams) {
      console.log(`imported ${e.id} [${e.status}] issues=${e.issues.length}`)
    }
  }
  console.log(`done: ${count} exam(s)`)
}

const isEntry = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isEntry) {
  main()
}
