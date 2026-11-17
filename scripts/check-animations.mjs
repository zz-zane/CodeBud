#!/usr/bin/env node
/**
 * 内置动画代码真跑台 —— 编译运行 content/animations/*.json 每幕代码，断言 stdout 与 expectedOutput 一致。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gradeByRun, normalizeRunOutput, runBlock } from './lib/run-code.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ANIM_DIR = path.resolve(__dirname, '..', 'content', 'animations')
if (!fs.existsSync(ANIM_DIR)) {
  console.error('✗ 目录不存在：content/animations/')
  process.exit(1)
}

const files = fs.readdirSync(ANIM_DIR).filter((f) => f.endsWith('.json')).sort()
if (files.length === 0) {
  console.error('✗ content/animations/ 下没有动画 JSON')
  process.exit(1)
}

let checkedActs = 0
let failed = 0

for (const f of files) {
  const data = JSON.parse(fs.readFileSync(path.join(ANIM_DIR, f), 'utf8'))
  for (let i = 0; i < (data.acts?.length ?? 0); i++) {
    const act = data.acts[i]
    if (!act.code) continue
    checkedActs++
    const code = act.code.lines.join('\n')
    const res = runBlock(act.code.lang, code)
    if (!res.ok) {
      failed++
      console.error(`✗ [${f} 第${i + 1}幕] ${res.phase} 失败：\n${res.output}`)
      continue
    }
    if (!gradeByRun(act.code.expectedOutput, res.stdout)) {
      failed++
      console.error(
        `✗ [${f} 第${i + 1}幕] 输出不匹配：\n  期望：${JSON.stringify(normalizeRunOutput(act.code.expectedOutput))}\n  实际：${JSON.stringify(normalizeRunOutput(res.stdout))}`
      )
    } else {
      console.log(`✓ [${f} 第${i + 1}幕] ${act.code.lang} 真跑输出一致`)
    }
  }
}

if (checkedActs === 0) {
  console.error('✗ 未找到任何带 code 的动画幕')
  process.exit(1)
}

console.log(`\n动画真跑核对完成：${checkedActs} 幕代码，${failed} 失败`)
process.exit(failed > 0 ? 1 : 0)
