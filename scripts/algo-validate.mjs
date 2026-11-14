#!/usr/bin/env node
/**
 * scripts/algo-validate.mjs
 * 
 * 严格校验 Hello 算法离线课程数据包与产物结构：
 * 1. 结构与章节数量（20章，119课）
 * 2. 136处代码对比块（四语言全部抽取成功，无 [file] 残留）
 * 3. 506处图片引用（全量本地存在，路径以 ./algo/ 开头，绝无 /algo/ 根路径）
 * 4. 章节首页无 index.md
 * 5. 安全渲染防线：无裸露 script/iframe/raw div 等未知或违规标签
 * 6. Manifest 与许可证校验
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { verifyAlgoSources } from './algo-build.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const BUNDLE_PATH = path.join(ROOT, 'src', 'renderer', 'src', 'generated', 'algo-bundle.json')
const PUBLIC_ALGO_DIR = path.join(ROOT, 'src', 'renderer', 'public', 'algo')
const MANIFEST_PATH = path.join(ROOT, 'content', 'algo', 'manifest.json')
const LICENSE_PATH = path.join(ROOT, 'LICENSES', 'hello-algo-CC-BY-NC-SA-4.0.txt')

export function validateAlgoBundle() {
  console.log('Validating Hello Algo bundle and assets...')
  verifyAlgoSources()

  if (!fs.existsSync(BUNDLE_PATH)) {
    throw new Error(`algo-bundle.json not found at ${BUNDLE_PATH}. Please run npm run build:algo first.`)
  }

  const bundle = JSON.parse(fs.readFileSync(BUNDLE_PATH, 'utf8'))
  const errors = []

  // 1. 结构与统计
  if (bundle.chapters.length !== 20) {
    errors.push(`Expected 20 chapters, got ${bundle.chapters.length}`)
  }
  if (bundle.lessons.length !== 119) {
    errors.push(`Expected 119 lessons, got ${bundle.lessons.length}`)
  }

  // 2. 检查每一课
  let totalCompare = 0
  let totalImages = 0

  bundle.lessons.forEach((l, idx) => {
    // 标题不得为 index.md
    if (l.title === 'index.md' || l.title.endsWith('/index.md')) {
      errors.push(`Lesson ${l.id} has invalid title: "${l.title}"`)
    }

    // 不得残留 [file] 占位符
    if (l.body.includes('[file]{') || l.body.includes('-[func]{')) {
      errors.push(`Lesson ${l.id} (${l.title}) contains unconverted [file] snippet placeholder!`)
    }

    // 检查 compare 块与四语言抽取完整性
    const compareParts = l.body.split('```compare')
    if (compareParts.length > 1) {
      for (let i = 1; i < compareParts.length; i++) {
        totalCompare++
        const block = compareParts[i].split('```')[0]
        for (const lang of ['python', 'c', 'cpp', 'java']) {
          if (!block.includes(`${lang}::`)) {
            errors.push(`Lesson ${l.id} compare block #${i} missing [${lang}]!`)
          }
        }
      }
    }

    // 检查图片引用
    for (const m of l.body.matchAll(/!\[(.*?)\]\((.*?)\)/g)) {
      totalImages++
      const src = m[2]
      if (src.startsWith('/algo/')) {
        errors.push(`Lesson ${l.id} uses root path "${src}", which breaks in file:// production environment!`)
      }
      if (!src.startsWith('./algo/') && !src.startsWith('http')) {
        errors.push(`Lesson ${l.id} uses non-standard image path: "${src}"`)
      }

      if (src.startsWith('./algo/')) {
        const diskPath = path.join(PUBLIC_ALGO_DIR, src.slice('./algo/'.length))
        if (!fs.existsSync(diskPath)) {
          errors.push(`Lesson ${l.id} references missing image on disk: ${diskPath}`)
        }
      }
    }

    // 检查违规原始 HTML 标签
    if (/<script\b/i.test(l.body)) {
      errors.push(`Lesson ${l.id} contains unsafe <script> tag`)
    }
    if (/<iframe\b/i.test(l.body)) {
      errors.push(`Lesson ${l.id} contains raw <iframe> tag`)
    }
    if (/<div style="text-align:\s*center;"/i.test(l.body)) {
      errors.push(`Lesson ${l.id} contains unhandled <div style="text-align: center;"> tag`)
    }
    if (/<p align="center">/i.test(l.body)) {
      errors.push(`Lesson ${l.id} contains unhandled <p align="center"> tag`)
    }
  })

  // 3. 检查代码块总数
  if (totalCompare !== 136) {
    errors.push(`Expected 136 compare blocks, got ${totalCompare}`)
  }

  // 4. 检查图片总数
  if (totalImages !== 506) {
    errors.push(`Expected 506 image references, got ${totalImages}`)
  }

  // 5. 检查 Manifest 和许可证
  if (!fs.existsSync(MANIFEST_PATH)) {
    errors.push(`manifest.json not found at ${MANIFEST_PATH}`)
  }
  if (!fs.existsSync(LICENSE_PATH)) {
    errors.push(`License file not found at ${LICENSE_PATH}`)
  } else {
    const lic = fs.readFileSync(LICENSE_PATH, 'utf8')
    if (!lic.includes('71a773df64fa20a31e32c23e01e6d29442d54adb')) {
      errors.push(`License file missing upstream commit SHA!`)
    }
    if (!lic.includes('CC BY-NC-SA 4.0')) {
      errors.push(`License file missing CC BY-NC-SA 4.0 mention!`)
    }
  }

  // 6. 搜索索引检查
  if (!Array.isArray(bundle.searchIndex) || bundle.searchIndex.length !== 119) {
    errors.push(`Search index missing or length is not 119 (got ${bundle.searchIndex?.length})`)
  }

  // 7. 算法题目（questions）全量合规校验
  let totalQuestionsCount = 0
  const questionTypeStats = { choice: 0, fill: 0, codefill: 0, code: 0 }

  bundle.lessons.forEach((l) => {
    if (!Array.isArray(l.questions)) {
      errors.push(`Lesson ${l.id} questions is not an array`)
      return
    }

    // 核心章节（algo-c02 ~ algo-c16，对应 algo-s006 ~ algo-s113）每课至少2道题
    const chapNum = parseInt(l.chapterId.replace('algo-c', ''), 10)
    if (chapNum >= 2 && chapNum <= 16) {
      if (l.questions.length < 2) {
        errors.push(`Core lesson ${l.id} (${l.title}) in ${l.chapterId} requires >= 2 questions, but got ${l.questions.length}`)
      }
    }

    const qidSet = new Set()
    l.questions.forEach((q, qIdx) => {
      totalQuestionsCount++
      if (!q.id || typeof q.id !== 'string') {
        errors.push(`Lesson ${l.id} question #${qIdx} missing valid id`)
      } else if (qidSet.has(q.id)) {
        errors.push(`Lesson ${l.id} duplicate question id: ${q.id}`)
      } else {
        qidSet.add(q.id)
      }

      if (!['choice', 'fill', 'codefill', 'code'].includes(q.type)) {
        errors.push(`Lesson ${l.id} question ${q.id} invalid type: ${q.type}`)
      } else {
        questionTypeStats[q.type] = (questionTypeStats[q.type] || 0) + 1
      }

      if (!q.stem || typeof q.stem !== 'string' || !q.stem.trim()) {
        errors.push(`Lesson ${l.id} question ${q.id} missing stem`)
      }
      if (!q.explanation || typeof q.explanation !== 'string' || !q.explanation.trim()) {
        errors.push(`Lesson ${l.id} question ${q.id} missing explanation`)
      }

      if (q.type === 'choice') {
        if (!Array.isArray(q.options) || q.options.length < 2) {
          errors.push(`Lesson ${l.id} choice ${q.id} must have >= 2 options`)
        }
        if (typeof q.answer !== 'number' || q.answer < 0 || (Array.isArray(q.options) && q.answer >= q.options.length)) {
          errors.push(`Lesson ${l.id} choice ${q.id} answer index ${q.answer} out of bounds`)
        }
      } else if (q.type === 'fill' || q.type === 'code') {
        if (typeof q.answer !== 'string' || !q.answer.trim()) {
          errors.push(`Lesson ${l.id} ${q.type} ${q.id} answer must be non-empty string`)
        }
        if (!Array.isArray(q.accept)) {
          errors.push(`Lesson ${l.id} ${q.type} ${q.id} accept must be an array of strings`)
        }
      } else if (q.type === 'codefill') {
        if (!q.code || typeof q.code !== 'string') {
          errors.push(`Lesson ${l.id} codefill ${q.id} missing code`)
        }
        if (!Array.isArray(q.blanks) || q.blanks.length === 0) {
          errors.push(`Lesson ${l.id} codefill ${q.id} blanks must be non-empty array`)
        } else {
          const blankMatches = q.code ? (q.code.match(/____/g) || []) : []
          if (blankMatches.length !== q.blanks.length) {
            errors.push(`Lesson ${l.id} codefill ${q.id} blank count mismatch: found ${blankMatches.length} "____" but blanks.length is ${q.blanks.length}`)
          }
          q.blanks.forEach((b, bIdx) => {
            if (typeof b.answer !== 'string' || !b.answer.trim()) {
              errors.push(`Lesson ${l.id} codefill ${q.id} blank #${bIdx} answer must be non-empty string`)
            }
            if (b.answer && b.answer.includes('\n')) {
              errors.push(`Lesson ${l.id} codefill ${q.id} blank #${bIdx} answer cannot contain newline`)
            }
          })
        }
      }
    })
  })

  // 检查总题数满足高覆盖要求 (>= 300 道题)
  if (totalQuestionsCount < 300) {
    errors.push(`Expected >= 300 questions in total, but found ${totalQuestionsCount}`)
  }

  if (errors.length > 0) {
    console.error('Validation FAILED with errors:')
    errors.forEach((e) => console.error(`  - ${e}`))
    process.exit(1)
  }

  console.log(`Validation PASSED!`)
  console.log(`  - 20 chapters, 119 lessons, 136 4-language compare blocks`)
  console.log(`  - ${totalQuestionsCount} practice questions verified across 119 lessons (choice: ${questionTypeStats.choice}, fill: ${questionTypeStats.fill}, codefill: ${questionTypeStats.codefill}, code: ${questionTypeStats.code})`)
  console.log(`  - 506 local images verified on disk with relative ./algo/ paths`)
  console.log(`  - Frontmatter cleaned, no index.md titles, HTML sanitized`)
  console.log(`  - Manifest & CC BY-NC-SA 4.0 license verified`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  validateAlgoBundle()
}
