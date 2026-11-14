#!/usr/bin/env node
/**
 * scripts/algo-build.mjs
 * 
 * 构建 Hello 算法离线课程数据包 (src/renderer/src/generated/algo-bundle.json)
 * - 纯 Node.js ESM 脚本，不依赖外部环境或 Python
 * - 源数据位于 content/algo/
 * - 校验图片存在、代码完整抽取、admonition、HTML 安全转换与搜索索引
 */

import fs from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const CONTENT_ALGO_DIR = path.join(ROOT, 'content', 'algo')
const DOCS_DIR = path.join(CONTENT_ALGO_DIR, 'docs')
const CODES_DIR = path.join(CONTENT_ALGO_DIR, 'codes')
const NAV_FILE = path.join(CONTENT_ALGO_DIR, 'nav.json')
const MANIFEST_FILE = path.join(CONTENT_ALGO_DIR, 'manifest.json')

const PUBLIC_ALGO_DIR = path.join(ROOT, 'src', 'renderer', 'public', 'algo')
const GENERATED_DIR = path.join(ROOT, 'src', 'renderer', 'src', 'generated')
const OUT_BUNDLE = path.join(GENERATED_DIR, 'algo-bundle.json')
const LICENSE_OUT = path.join(ROOT, 'LICENSES', 'hello-algo-CC-BY-NC-SA-4.0.txt')
const QUESTIONS_FILE = path.join(ROOT, 'content', 'algo-questions', 'questions.json')

const COMMIT_SHA = '71a773df64fa20a31e32c23e01e6d29442d54adb'
const LICENSE_NAME = 'CC BY-NC-SA 4.0'
const AUTHOR = 'krahets'
const UPSTREAM_URL = 'https://github.com/krahets/hello-algo'
const OFFICIAL_WEB = 'https://www.hello-algo.com'

function toPascal(s) {
  if (!s) return ''
  return s.split('_').map((p) => {
    const lower = p.toLowerCase()
    if (lower === 'ii') return 'II'
    if (lower === 'iii') return 'III'
    if (lower === 'iv') return 'IV'
    if (lower === 'dp') return 'DP'
    if (lower === 'dfs') return 'DFS'
    if (lower === 'bfs') return 'BFS'
    if (lower === 'lcro') return 'LCRO'
    return p.charAt(0).toUpperCase() + p.slice(1)
  }).join('')
}

function toCamel(s) {
  if (!s) return ''
  const pascal = toPascal(s)
  return pascal.charAt(0).toLowerCase() + pascal.slice(1)
}

function getFuncCandidates(func, cls, lang) {
  const cands = new Set()
  if (!func) return []
  if (func === '__init__') {
    if (lang === 'python') cands.add('__init__')
    else if (lang === 'cpp' || lang === 'java') {
      cands.add(toPascal(cls))
      cands.add(cls)
    } else if (lang === 'c') {
      cands.add('new' + toPascal(cls))
      cands.add('new_' + cls)
    }
    return Array.from(cands)
  }
  cands.add(func)
  cands.add(toCamel(func))
  cands.add(toPascal(func))
  cands.add(func.replace(/_([a-z0-9]+)/g, (_, p) => p.toUpperCase()))
  if (lang === 'c') {
    if (func === 'remove') cands.add('removeItem')
  }
  return Array.from(cands)
}

function getClassCandidates(cls) {
  if (!cls) return []
  const cands = new Set()
  cands.add(cls)
  cands.add(toPascal(cls))
  cands.add(toCamel(cls))
  return Array.from(cands)
}

function extractPy(code, func, cls) {
  const lines = code.split(/\r?\n/)
  if (func) {
    const pattern = new RegExp(`^\\s*(?:async\\s+)?def\\s+${func}\\b`)
    let start = -1
    let baseIndent = -1
    const extracted = []
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (start === -1) {
        if (pattern.test(line)) {
          start = i
          baseIndent = line.length - line.trimStart().length
          if (i > 0 && lines[i - 1].trim().startsWith('#')) {
            extracted.push(lines[i - 1])
          }
          extracted.push(line)
        }
      } else {
        if (!line.trim()) {
          extracted.push(line)
          continue
        }
        const indent = line.length - line.trimStart().length
        if (indent > baseIndent) {
          extracted.push(line)
        } else {
          break
        }
      }
    }
    return extracted.length > 0 ? extracted.join('\n').trim() : null
  }

  if (cls) {
    const cands = getClassCandidates(cls)
    for (const cand of cands) {
      const pattern = new RegExp(`^\\s*class\\s+${cand}\\b`, 'i')
      let start = -1
      let baseIndent = -1
      const extracted = []
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (start === -1) {
          if (pattern.test(line)) {
            start = i
            baseIndent = line.length - line.trimStart().length
            if (i > 0 && lines[i - 1].trim().startsWith('#')) {
              extracted.push(lines[i - 1])
            }
            extracted.push(line)
          }
        } else {
          if (!line.trim()) {
            extracted.push(line)
            continue
          }
          const indent = line.length - line.trimStart().length
          if (indent > baseIndent) {
            extracted.push(line)
          } else {
            break
          }
        }
      }
      if (extracted.length > 0) return extracted.join('\n').trim()
    }
  }

  return null
}

function extractCLike(code, func, cls, lang) {
  const lines = code.split(/\r?\n/)

  if (func) {
    const candidates = getFuncCandidates(func, cls, lang)
    for (const cand of candidates) {
      const pattern = new RegExp(`\\b${cand}\\s*\\(`)
      let start = -1
      let braceCount = 0
      const extracted = []
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const stripped = line.trim()
        if (start === -1) {
          if (
            pattern.test(line) &&
            !stripped.startsWith('//') &&
            !stripped.startsWith('*') &&
            !(stripped.endsWith(';') && !stripped.includes('{'))
          ) {
            start = i
            if (i > 0 && (lines[i - 1].trim().startsWith('/*') || lines[i - 1].trim().startsWith('//'))) {
              extracted.push(lines[i - 1])
            }
            extracted.push(line)
            braceCount += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length
            if (braceCount === 0 && line.includes('{')) {
              return extracted.join('\n').trim()
            }
          }
        } else {
          extracted.push(line)
          braceCount += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length
          if (braceCount <= 0 && (line.includes('}') || line.includes(';'))) {
            return extracted.join('\n').trim()
          }
        }
      }
    }
    return null
  }

  if (cls) {
    if (lang === 'c') {
      // In C, a data structure implementation starts at the struct definition
      // and continues with its functions until "Driver Code" or "main"
      let start = -1
      const extracted = []
      const cands = getClassCandidates(cls)

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const stripped = line.trim()
        if (start === -1) {
          const isStructStart =
            (stripped.startsWith('typedef struct') || stripped.startsWith('struct')) &&
            cands.some((c) => line.includes(c) || lines.slice(i, Math.min(lines.length, i + 15)).some((l) => l.includes(c)))
          if (isStructStart) {
            start = i
            if (i > 0 && (lines[i - 1].trim().startsWith('/*') || lines[i - 1].trim().startsWith('//'))) {
              extracted.push(lines[i - 1])
            }
            extracted.push(line)
          }
        } else {
          if (stripped.includes('Driver Code') || stripped.startsWith('int main(') || stripped.startsWith('int main()')) {
            break
          }
          extracted.push(line)
        }
      }
      if (extracted.length > 0) {
        return extracted.join('\n').trimEnd()
      }
    } else {
      // C++ and Java: extract class or struct block
      const cands = getClassCandidates(cls)
      for (const cand of cands) {
        const pattern = new RegExp(`\\b(?:class|struct)\\s+${cand}\\b`)
        let start = -1
        let braceCount = 0
        const extracted = []
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          const stripped = line.trim()
          if (start === -1) {
            if (pattern.test(line) && !stripped.startsWith('//') && !stripped.startsWith('*')) {
              start = i
              if (i > 0 && (lines[i - 1].trim().startsWith('/*') || lines[i - 1].trim().startsWith('//'))) {
                extracted.push(lines[i - 1])
              }
              extracted.push(line)
              braceCount += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length
              if (braceCount === 0 && line.includes('{')) {
                return extracted.join('\n').trim()
              }
            }
          } else {
            extracted.push(line)
            braceCount += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length
            if (braceCount <= 0 && (line.includes('}') || line.includes(';'))) {
              return extracted.join('\n').trim()
            }
          }
        }
      }
    }
  }

  return null
}

function findCodeSnippet(chap, fileBase, cls, func, lang) {
  const exts = { python: '.py', c: '.c', cpp: '.cpp', java: '.java' }
  const ext = exts[lang]
  let fpath = path.join(CODES_DIR, lang, chap, fileBase + ext)
  if (!fs.existsSync(fpath)) {
    const chapDir = path.join(CODES_DIR, lang, chap)
    if (fs.existsSync(chapDir)) {
      const candidates = fs.readdirSync(chapDir).filter((f) => f.endsWith(ext) && f.includes(fileBase))
      if (candidates.length > 0) fpath = path.join(chapDir, candidates[0])
    }
  }
  if (!fs.existsSync(fpath)) return null

  const raw = fs.readFileSync(fpath, 'utf8')
  if (lang === 'python') {
    return extractPy(raw, func, cls)
  } else {
    return extractCLike(raw, func, cls, lang)
  }
}

/**
 * 转换 MkDocs 缩进 admonitions 语法
 * !!! tip "标题"
 *     内容行
 * ->
 * ::: tip 标题
 * 内容行
 * :::
 */
function convertAdmonitions(text) {
  const lines = text.split(/\r?\n/)
  const out = []
  let inAdm = false
  let admIndent = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const admMatch = line.match(/^(\?{3}|!{3})\s+([a-zA-Z0-9_-]+)(?:\s+"([^"]*)"|\s+'([^']*)'|\s+(.*))?$/)

    if (admMatch) {
      if (inAdm) {
        out.push(':::')
        inAdm = false
      }
      let kind = admMatch[2].toLowerCase()
      let title = (admMatch[3] ?? admMatch[4] ?? admMatch[5] ?? '').trim()
      if (kind === 'pythontutor') {
        kind = 'tip'
        if (!title) title = '可视化运行'
      } else if (kind === 'warning') {
        kind = 'warn'
      }
      out.push(title ? `::: ${kind} ${title}` : `::: ${kind}`)
      inAdm = true
      admIndent = 4
      continue
    }

    if (inAdm) {
      if (!line.trim()) {
        // Lookahead to see if next non-empty line is still indented
        let nextIndented = false
        for (let j = i + 1; j < lines.length; j++) {
          if (lines[j].trim()) {
            nextIndented = lines[j].startsWith('    ') || lines[j].startsWith('\t')
            break
          }
        }
        if (!nextIndented) {
          out.push(':::')
          inAdm = false
          out.push(line)
        } else {
          out.push('')
        }
        continue
      }

      if (line.startsWith('    ') || line.startsWith('\t')) {
        const stripped = line.startsWith('    ') ? line.slice(4) : line.slice(1)
        out.push(stripped)
        continue
      } else {
        out.push(':::')
        inAdm = false
        out.push(line)
        continue
      }
    }

    out.push(line)
  }

  if (inAdm) out.push(':::')
  return out.join('\n')
}

/**
 * 安全转换已知 HTML 标记
 */
function sanitizeKnownHtml(text) {
  // Keep the term readable: punctuation next to CJK can leave injected ** delimiters visible.
  text = text.replace(/<u>([\s\S]*?)<\/u>/g, '$1')

  // 2. <p align="center"> 表 <id> &nbsp; 标题 </p> -> *表：标题*
  text = text.replace(/<p align="center">\s*表\s*<id>\s*(?:&nbsp;|\s+)*(.*?)\s*<\/p>/g, '*表：$1*')
  text = text.replace(/<p align="center">\s*(.*?)\s*<\/p>/g, '*$1*')

  // 3. <div style="text-align: center;">\s*<h2[^>]*>(.*?)</h2>\s*</div> -> ## $1
  text = text.replace(/<div style="text-align:\s*center;">\s*<h2[^>]*>([\s\S]*?)<\/h2>\s*<\/div>/g, '## $1')

  // 4. 清理 iframe / video-container (纸质书介绍视频) 转换为友好外链
  text = text.replace(/<div class="video-container">[\s\S]*?<iframe[^>]*src="([^"]*)"[\s\S]*?<\/div>/g, (_m, src) => {
    return `[观看 Bilibili 官方视频介绍](https:${src.replace(/^\/\//, '//')})`
  })

  // 5. 清理剩余特定属性标记
  text = text.replace(/\{\s*class="[^"]*"\s*\}/g, '')

  return text
}

function convertTabs(text) {
  const lines = text.split(/\r?\n/)
  const output = []
  for (let i = 0; i < lines.length; i++) {
    const tab = lines[i].match(/^===\s+"([^"]+)"\s*$/)
    if (!tab) {
      output.push(lines[i])
      continue
    }
    output.push(`#### ${tab[1]}`, '')
    while (i + 1 < lines.length) {
      const next = lines[i + 1]
      if (next.trim() && !next.startsWith('    ') && !next.startsWith('\t')) break
      i++
      output.push(next.startsWith('    ') ? next.slice(4) : next.startsWith('\t') ? next.slice(1) : next)
    }
    output.push('')
  }
  return output.join('\n')
}

function buildSearchText(body) {
  let text = body
  text = text.replace(/```[\s\S]*?```/g, ' ')
  text = text.replace(/`[^`]+`/g, ' ')
  text = text.replace(/!\[.*?\]\(.*?\)/g, ' ')
  text = text.replace(/\[(.*?)\]\(.*?\)/g, '$1')
  text = text.replace(/#{1,6}\s*/g, '')
  text = text.replace(/[*_~]/g, '')
  text = text.replace(/:::\s*\w+.*/g, '')
  return text.split(/\s+/).filter(Boolean).join(' ')
}

export function verifyAlgoSources() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf8'))
  if (manifest.upstreamCommit !== COMMIT_SHA || Object.keys(manifest.sha256).length !== manifest.filesCount) {
    throw new Error('Invalid Hello Algo source manifest')
  }
  for (const [relative, expected] of Object.entries(manifest.sha256)) {
    const source = path.resolve(CONTENT_ALGO_DIR, ...relative.split(/[\\/]/))
    if (!source.startsWith(CONTENT_ALGO_DIR + path.sep)) throw new Error(`Source outside content/algo: ${relative}`)
    const actual = createHash('sha256').update(fs.readFileSync(source)).digest('hex')
    if (actual !== expected) throw new Error(`Hello Algo source checksum mismatch: ${relative}`)
  }
  return manifest.filesCount
}

export function buildAlgoBundle() {
  console.log('Building Hello Algo bundle...')
  verifyAlgoSources()

  if (!fs.existsSync(NAV_FILE)) {
    throw new Error(`nav.json not found at ${NAV_FILE}`)
  }
  const navChapters = JSON.parse(fs.readFileSync(NAV_FILE, 'utf8'))
  const algoQuestionsMap = fs.existsSync(QUESTIONS_FILE) ? JSON.parse(fs.readFileSync(QUESTIONS_FILE, 'utf8')) : {}

  const algoChapters = []
  const allAlgoLessons = []
  const searchIndex = []

  let lessonSeq = 0
  let totalSnippetMatches = 0
  let convertedSnippetMatches = 0

  for (let chapIdx = 0; chapIdx < navChapters.length; chapIdx++) {
    const chap = navChapters[chapIdx]
    const chapTitle = chap.title
    const chapId = `algo-c${String(chapIdx).padStart(2, '0')}`

    const chapObj = {
      id: chapId,
      title: chapTitle,
      order: chapIdx + 1,
      lessons: []
    }

    for (let secIdx = 0; secIdx < chap.lessons.length; secIdx++) {
      const sec = chap.lessons[secIdx]
      lessonSeq++
      let secTitle = sec.title
      const secRelPath = sec.path
      const secId = `algo-s${String(lessonSeq).padStart(3, '0')}`

      const mdFullPath = path.join(DOCS_DIR, secRelPath)
      if (!fs.existsSync(mdFullPath)) {
        throw new Error(`Markdown file not found: ${mdFullPath}`)
      }
      let rawMd = fs.readFileSync(mdFullPath, 'utf8')

      // 1. 清理 YAML frontmatter
      rawMd = rawMd.replace(/^---[\s\S]*?---\s*/, '')

      // 2. 章节首页如果标题为 index.md，提取实际 H1 或章节名
      if (secTitle === 'index.md' || secTitle.endsWith('/index.md')) {
        const h1Match = rawMd.match(/^#\s+(.+)$/m)
        if (h1Match) {
          secTitle = h1Match[1].trim()
        } else {
          secTitle = chapTitle
        }
      }

      const secDir = path.dirname(secRelPath)

      // 3. 代码片段抽取与替换
      function replaceSnippet(match, tag) {
        totalSnippetMatches++
        const sm = tag.match(/\[file\]\{([^}]+)\}-\[class\]\{([^}]*)\}-\[func\]\{([^}]*)\}/)
        if (!sm) {
          throw new Error(`Malformed snippet tag: ${tag} in ${secRelPath}`)
        }
        const fbase = sm[1]
        const cls = sm[2]
        const func = sm[3]

        const snippetsByLang = {}
        for (const lang of ['python', 'c', 'cpp', 'java']) {
          const snip = findCodeSnippet(secDir, fbase, cls, func, lang)
          if (snip) {
            snippetsByLang[lang] = snip
          } else {
            throw new Error(`Failed to extract code snippet for [${lang}] in ${secRelPath}: tag=${tag}`)
          }
        }

        convertedSnippetMatches++
        const lines = ['```compare']
        for (const lang of ['python', 'c', 'cpp', 'java']) {
          lines.push(`${lang}::`)
          lines.push(snippetsByLang[lang])
        }
        lines.push('```')
        return lines.join('\n')
      }

      // 匹配 ```src \n [file]... \n ```
      let processedMd = rawMd.replace(/```src\s*\n\s*(\[file\]\{[^}]+\}-\[class\]\{[^}]*\}\-\[func\]\{[^}]*\})\s*\n```/g, replaceSnippet)
      // 匹配独立的 [file]...
      processedMd = processedMd.replace(/(\[file\]\{[^}]+\}-\[class\]\{[^}]*\}\-\[func\]\{[^}]*\})/g, replaceSnippet)

      // 4. Admonitions 转换
      processedMd = convertAdmonitions(processedMd)
      processedMd = convertTabs(processedMd)

      // 5. 图片路径本地与 file:// 适配
      function replaceImg(match, alt, fullSrc) {
        const src = fullSrc.split(/\s+/)[0]
        if (src.startsWith('http://') || src.startsWith('https://')) {
          return match
        }
        let normalizedRel
        if (src.startsWith('../')) {
          normalizedRel = path.normalize(path.join(secDir, src)).replace(/\\/g, '/')
        } else {
          normalizedRel = path.normalize(path.join(secDir, src)).replace(/\\/g, '/')
        }

        // 检查图片文件在 public/algo 中是否存在
        const targetDiskPath = path.join(PUBLIC_ALGO_DIR, normalizedRel)
        if (!fs.existsSync(targetDiskPath)) {
          throw new Error(`Missing image asset: ${targetDiskPath} referenced in ${secRelPath}`)
        }

        // 输出为相对路径 ./algo/... 确保生产环境 file:// 和开发服务器均正常工作
        const newSrc = `./algo/${normalizedRel}`
        return `![${alt}](${newSrc})`
      }
      processedMd = processedMd.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, replaceImg)

      // 6. 安全转换已知 HTML 标记
      processedMd = sanitizeKnownHtml(processedMd)

      // 7. 链接与来源生成
      // 官方对应网页地址
      const officialLessonUrl = `${OFFICIAL_WEB}/${secRelPath.replace(/\.md$/, '').replace(/\/index$/, '')}/`

      const lessonObj = {
        id: secId,
        category: 'algo',
        lang: 'common',
        stage: 0,
        order: lessonSeq,
        title: secTitle,
        chapterId: chapId,
        chapterTitle: chapTitle,
        path: secRelPath,
        upstreamUrl: officialLessonUrl,
        upstreamCommit: COMMIT_SHA,
        license: LICENSE_NAME,
        author: AUTHOR,
        tags: ['Hello 算法', chapTitle],
        keywords: [chapTitle, secTitle],
        required: [],
        crossRefs: [],
        compare: [],
        estMinutes: 15,
        body: processedMd,
        questions: algoQuestionsMap[secId] || []
      }

      chapObj.lessons.push({
        id: secId,
        title: secTitle,
        order: secIdx + 1,
        hasContent: true
      })

      allAlgoLessons.push(lessonObj)

      // 8. 搜索索引条目
      const plainText = buildSearchText(processedMd)
      searchIndex.push({
        id: secId,
        source: 'algo',
        chapterTitle: chapTitle,
        lang: 'common',
        stage: 0,
        title: secTitle,
        tags: ['Hello 算法', chapTitle],
        keywords: [chapTitle, secTitle],
        text: `${secTitle} ${chapTitle} ${plainText}`.slice(0, 5000)
      })
    }

    algoChapters.push(chapObj)
  }

  const bundleData = {
    version: 1,
    upstreamCommit: COMMIT_SHA,
    license: LICENSE_NAME,
    author: AUTHOR,
    url: UPSTREAM_URL,
    officialWeb: OFFICIAL_WEB,
    title: 'Hello 算法',
    subtitle: '动画图解、能运行、提炼核心的数据结构与算法教程',
    chaptersCount: algoChapters.length,
    lessonsCount: allAlgoLessons.length,
    chapters: algoChapters,
    lessons: allAlgoLessons,
    searchIndex
  }

  if (!fs.existsSync(GENERATED_DIR)) {
    fs.mkdirSync(GENERATED_DIR, { recursive: true })
  }

  fs.writeFileSync(OUT_BUNDLE, JSON.stringify(bundleData, null, 2), 'utf8')
  console.log(`Successfully generated ${OUT_BUNDLE} (${(fs.statSync(OUT_BUNDLE).size / 1024 / 1024).toFixed(2)} MB)`)
  console.log(`Processed: ${algoChapters.length} chapters, ${allAlgoLessons.length} lessons, ${convertedSnippetMatches} code snippets converted`)

  // Write license notice
  const licenseText = `Hello 算法 (Hello Algo)
原作者: ${AUTHOR} (${UPSTREAM_URL})
上游固定提交: ${COMMIT_SHA}
许可证: ${LICENSE_NAME}

本项目所包含的《Hello 算法》图文教程及配套示例代码基于 CC BY-NC-SA 4.0 许可证整合于离线学习客户端中。
版权所有 (c) 2023 krahets。
特此遵照协议保留原作者署名、源项目链接与相同方式共享许可说明。`
  fs.writeFileSync(LICENSE_OUT, licenseText, 'utf8')
  console.log(`Saved license text to ${LICENSE_OUT}`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  buildAlgoBundle()
}
