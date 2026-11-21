/**
 * Skill Acceptance Runner (docs/38 §6 + Part 3):
 * 1. Reads SKILL.md + a real non-pointer lesson (python-stage1-16 递归)
 * 2. Calls the app's configured DeepSeek AI (baseUrl/model from app config.json, key from env; NEVER logged/saved)
 * 3. Validates with engine.validate(spec); feeds exact Chinese errors back up to 2 retries
 * 4. Runs spec.code with local python/gcc and verifies stdout === expectedOutput
 * 5. Renders MP4 + keyframes + determinism check via generic render.cjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { validate } = require('./engine.js')

const ROOT = path.resolve(import.meta.dirname, '..', '..')
const SKILL_PATH = path.join(ROOT, 'content', 'skills', 'explainer-video', 'SKILL.md')

function parseArgs(argv) {
  const opts = {
    lessonId: 'python-stage1-16',
    lessonFile: null,
    topic: null,
    out: 'video-skill',
    feedback: null
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--lesson-id' && argv[i + 1]) opts.lessonId = argv[++i]
    else if (a === '--lesson-file' && argv[i + 1]) opts.lessonFile = argv[++i]
    else if (a === '--topic' && argv[i + 1]) opts.topic = argv[++i]
    else if (a === '--out' && argv[i + 1]) opts.out = argv[++i]
    else if (a === '--feedback' && argv[i + 1]) opts.feedback = argv[++i]
  }
  if (!opts.topic && !opts.lessonFile) {
    opts.lessonFile = path.join('content', 'python', 'stage1', '16-recursion', 'lesson.md')
  }
  return opts
}

const OPTS = parseArgs(process.argv.slice(2))
const LESSON_ID = OPTS.lessonId
const LESSON_PATH = OPTS.lessonFile ? (path.isAbsolute(OPTS.lessonFile) ? OPTS.lessonFile : path.join(ROOT, OPTS.lessonFile)) : null
const OUT_DIR = path.isAbsolute(OPTS.out) ? OPTS.out : path.join(ROOT, 'outputs', OPTS.out)
const ROUNDS_DIR = path.join(OUT_DIR, 'ai-rounds')

function loadAiEndpoint() {
  const cfgPath = path.join(process.env.APPDATA || '', 'miai-biancheng', 'config.json')
  let baseUrl = 'https://api.deepseek.com'
  let model = 'deepseek-chat'
  if (fs.existsSync(cfgPath)) {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
    if (cfg.ai?.baseUrl) baseUrl = cfg.ai.baseUrl
    if (cfg.ai?.model) model = cfg.ai.model
  }
  const apiKey = (process.env.DEEPSEEK_API_KEY || '').trim()
  if (!apiKey) {
    throw new Error('Missing DEEPSEEK_API_KEY in environment')
  }
  return {
    url: `${baseUrl.replace(/\/+$/, '')}/chat/completions`,
    model,
    apiKey
  }
}

function extractJsonBlock(text) {
  const fenced = /```json\s*([\s\S]*?)```/i.exec(text)
  if (fenced) return fenced[1].trim()
  const anyFence = /```\s*([\s\S]*?)```/.exec(text)
  if (anyFence) return anyFence[1].trim()
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start >= 0 && end > start) return text.slice(start, end + 1).trim()
  return text.trim()
}

function runCodeCheck(codeObj, logPath) {
  const src = codeObj.lines.join('\n') + '\n'
  const tmpFile = path.join(OUT_DIR, `_verify_${LESSON_ID}.${codeObj.lang === 'python' ? 'py' : 'c'}`)
  fs.writeFileSync(tmpFile, src, 'utf8')
  let actual = ''
  let exitCode = -1
  let stderr = ''
  let cmdDesc = ''
  if (codeObj.lang === 'python') {
    cmdDesc = `python ${path.basename(tmpFile)}`
    const r = spawnSync('python', [tmpFile], { encoding: 'utf8', timeout: 10_000 })
    exitCode = r.status ?? -1
    actual = (r.stdout || '').replace(/\r\n/g, '\n')
    stderr = (r.stderr || '').trim()
  } else {
    const exePath = tmpFile.replace(/\.c$/, '.exe')
    cmdDesc = `gcc -Wall -Wextra -std=c11 ${path.basename(tmpFile)}`
    const c = spawnSync('gcc', ['-Wall', '-Wextra', '-std=c11', tmpFile, '-o', exePath], { encoding: 'utf8', timeout: 15_000 })
    if (c.status === 0) {
      const r = spawnSync(exePath, [], { encoding: 'utf8', timeout: 10_000 })
      exitCode = r.status ?? -1
      actual = (r.stdout || '').replace(/\r\n/g, '\n')
      stderr = (r.stderr || '').trim()
    } else {
      exitCode = c.status ?? -1
      stderr = (c.stderr || '').trim()
    }
    try { fs.unlinkSync(exePath) } catch {}
  }
  try { fs.unlinkSync(tmpFile) } catch {}

  const expected = String(codeObj.expectedOutput || '').replace(/\r\n/g, '\n')
  const match = exitCode === 0 && actual.trimEnd() === expected.trimEnd()
  const log = [
    `Lang: ${codeObj.lang}`,
    `Command: ${cmdDesc}`,
    `ExitCode: ${exitCode}`,
    `ExpectedOutput: ${JSON.stringify(expected)}`,
    `ActualOutput: ${JSON.stringify(actual)}`,
    stderr ? `Stderr: ${stderr}` : null,
    `Match: ${match}`
  ].filter(Boolean).join('\n')
  fs.writeFileSync(logPath, log + '\n', 'utf8')
  return { ok: match, actual, expected, exitCode, stderr }
}

async function callAi(endpoint, messages) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 120_000)
  try {
    const res = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${endpoint.apiKey}`
      },
      body: JSON.stringify({
        model: endpoint.model,
        messages,
        temperature: 0.5,
        max_tokens: 8192,
        stream: false
      }),
      signal: ctrl.signal
    })
    if (!res.ok) {
      throw new Error(`AI HTTP ${res.status}`)
    }
    const data = await res.json()
    return data.choices?.[0]?.message?.content || ''
  } finally {
    clearTimeout(timer)
  }
}

async function main() {
  fs.mkdirSync(ROUNDS_DIR, { recursive: true })
  const endpoint = loadAiEndpoint()
  const skillMd = fs.readFileSync(SKILL_PATH, 'utf8')
  const basePrompt = OPTS.topic
    ? `请为下面这个主题编写讲解动画 JSON spec。\n\n课程 id：${LESSON_ID}\n\n主题说明：\n\n${OPTS.topic}`
    : `请为下面这节课编写讲解动画 JSON spec。\n\n课程 id：${LESSON_ID}\n\n课程正文（lesson.md）：\n\n${fs.readFileSync(LESSON_PATH, 'utf8')}`
  const userContent = OPTS.feedback
    ? `${basePrompt}\n\n上一次生成在人工审校中发现以下内容与画面问题，请在本次重写中全部修正：\n${OPTS.feedback}`
    : basePrompt

  const messages = [
    {
      role: 'system',
      content: skillMd
    },
    {
      role: 'user',
      content: userContent
    }
  ]

  const roundsLog = []
  let finalSpec = null
  const codeLogPath = path.join(OUT_DIR, `${LESSON_ID}.code-run.log`)

  for (let round = 1; round <= 3; round++) {
    console.log(`[Round ${round}] Calling ${endpoint.model}...`)
    const t0 = Date.now()
    const rawText = await callAi(endpoint, messages)
    const elapsedMs = Date.now() - t0
    fs.writeFileSync(path.join(ROUNDS_DIR, `round${round}-raw.txt`), rawText, 'utf8')

    const jsonStr = extractJsonBlock(rawText)
    fs.writeFileSync(path.join(ROUNDS_DIR, `round${round}-extracted.json`), jsonStr, 'utf8')

    const val = validate(jsonStr)
    let errors = val.ok ? [] : val.errors.slice()

    let codeRun = null
    if (val.ok) {
      codeRun = runCodeCheck(val.spec.code, codeLogPath)
      if (!codeRun.ok) {
        errors.push(`code 真跑核对失败：期望输出 ${JSON.stringify(codeRun.expected)}，实际输出 ${JSON.stringify(codeRun.actual)}（exit=${codeRun.exitCode}${codeRun.stderr ? `, stderr=${codeRun.stderr}` : ''}）`)
      }
    }

    const passed = errors.length === 0
    roundsLog.push({
      round,
      model: endpoint.model,
      elapsedMs,
      validateOk: val.ok,
      codeRunOk: codeRun ? codeRun.ok : null,
      passed,
      errors
    })
    console.log(`[Round ${round}] passed=${passed}, errors=${errors.length}, elapsed=${elapsedMs}ms`)
    if (errors.length) console.log('  Errors:', errors)

    if (passed) {
      finalSpec = val.spec
      break
    }

    messages.push({ role: 'assistant', content: rawText })
    messages.push({
      role: 'user',
      content: `上面的 JSON 未通过校验，请修正以下全部错误，只输出修正后的单个 \`\`\`json 代码块：\n${errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}`
    })
  }

  fs.writeFileSync(path.join(ROUNDS_DIR, 'summary.json'), JSON.stringify({ lessonId: LESSON_ID, rounds: roundsLog }, null, 2), 'utf8')

  if (!finalSpec) {
    console.error('Skill acceptance failed after 3 rounds.')
    process.exit(1)
  }

  const finalSpecPath = path.join(OUT_DIR, `${LESSON_ID}.spec.json`)
  fs.writeFileSync(finalSpecPath, JSON.stringify(finalSpec, null, 2), 'utf8')

  const electronBin = path.join(ROOT, 'node_modules', '.bin', 'electron.cmd')
  const renderScript = path.join(ROOT, 'scripts', 'video-lab', 'render.cjs')
  const outMp4 = path.join(OUT_DIR, `${LESSON_ID}.mp4`)
  const kfDir = path.join(OUT_DIR, `keyframes-${LESSON_ID}`)

  console.log(`Rendering AI-generated spec -> ${outMp4}`)
  const rr = spawnSync(electronBin, [renderScript, '--spec', finalSpecPath, '--out', outMp4, '--kf', kfDir], {
    stdio: 'inherit',
    shell: true
  })
  if (rr.status !== 0) process.exit(rr.status || 1)
}

main().catch((err) => {
  console.error('Accept skill failed:', err.message)
  process.exit(1)
})
