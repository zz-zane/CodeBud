import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { renderMarkdown } from '../md'
import algoBundleJson from '../../generated/algo-bundle.json'
import type { AlgoBundle } from '../../stores/content'

const algoBundle = algoBundleJson as unknown as AlgoBundle

describe('Hello 算法离线课程集成验证', () => {
  it('上游语言分页可读，不展示 MkDocs 分页标记或注入的强调符号', () => {
    for (const lesson of algoBundle.lessons) {
      expect(lesson.body).not.toMatch(/^===\s+"/m)
    }
    const lesson = algoBundle.lessons.find(l => l.id === 'algo-s027')!
    const rendered = renderMarkdown(lesson.body)
    expect(rendered.html).not.toContain('**列表')
    expect(rendered.html).toContain('列表（list）是')
  })
  it('产物结构完整性：20 个章节，119 节课', () => {
    expect(algoBundle.chapters.length).toBe(20)
    expect(algoBundle.lessons.length).toBe(119)
    expect(algoBundle.version).toBe(1)
    expect(algoBundle.upstreamCommit).toBe('71a773df64fa20a31e32c23e01e6d29442d54adb')
    expect(algoBundle.license).toBe('CC BY-NC-SA 4.0')
    expect(algoBundle.author).toBe('krahets')
  })

  it('没有残留未转换的 [file]{...} 标记和根路径 /algo/ 图片', () => {
    let unconvertedSnippets = 0
    let rootImages = 0
    const snippetRe = /\[file\]\{[^}]+\}/
    const rootImageRe = /!\[.*?\]\(\/algo\//

    for (const l of algoBundle.lessons) {
      if (snippetRe.test(l.body)) {
        unconvertedSnippets++
      }
      if (rootImageRe.test(l.body)) {
        rootImages++
      }
    }

    expect(unconvertedSnippets).toBe(0)
    expect(rootImages).toBe(0)
  })

  it('全部 506 处图片引用均指向本地真实磁盘文件', () => {
    const publicDir = path.resolve(__dirname, '../../../public')
    const imgRe = /!\[.*?\]\((\.\/algo\/[^)]+)\)/g
    let imgCount = 0

    for (const l of algoBundle.lessons) {
      for (const match of l.body.matchAll(imgRe)) {
        imgCount++
        const rel = match[1].replace(/^\.\//, '')
        const full = path.join(publicDir, rel)
        expect(fs.existsSync(full)).toBe(true)
      }
    }

    expect(imgCount).toBe(506)
  })

  it('全部 136 处代码引用均提取出完整四语言（C, C++, Java, Python）对照块', () => {
    const compareRe = /```compare\n([\s\S]*?)```/g
    let compareBlocksCount = 0
    let missingLangCount = 0

    for (const l of algoBundle.lessons) {
      for (const match of l.body.matchAll(compareRe)) {
        compareBlocksCount++
        const block = match[1]
        const hasC = /^c::/m.test(block)
        const hasCpp = /^cpp::/m.test(block)
        const hasJava = /^java::/m.test(block)
        const hasPython = /^python::/m.test(block)
        if (!hasC || !hasCpp || !hasJava || !hasPython) {
          missingLangCount++
        }
      }
    }

    expect(compareBlocksCount).toBe(136)
    expect(missingLangCount).toBe(0)
  })

  it('KaTeX 数学公式渲染（行内与块级公式）', () => {
    const inlineSample = '时间复杂度为 $O(n)$，空间复杂度为 $O(1)$。'
    const resInline = renderMarkdown(inlineSample)
    expect(resInline.html).toContain('katex')
    expect(resInline.html).toContain('class="katex"')

    const blockSample = '递推关系式：\n\n$$\ndp[i] = dp[i-1] + dp[i-2]\n$$\n'
    const resBlock = renderMarkdown(blockSample)
    expect(resBlock.html).toContain('class="math-block"')
    expect(resBlock.html).toContain('katex-display')
  })

  it('提示容器渲染（tip, warn, note, question, success 等）', () => {
    const sample = [
      '::: tip 提示标题',
      '这是一段提示正文',
      ':::',
      '',
      '::: note',
      '这是一段说明正文',
      ':::',
      '',
      '::: question 思考',
      '为什么这里不用数组？',
      ':::'
    ].join('\n')

    const res = renderMarkdown(sample)
    expect(res.html).toContain('class="mi-admonition mi-tip"')
    expect(res.html).toContain('class="mi-admonition mi-note"')
    expect(res.html).toContain('class="mi-admonition mi-question"')
  })

  it('类定义代码块完整提取（例如 algo-s027 列表）', () => {
    const s027 = algoBundle.lessons.find((l) => l.id === 'algo-s027')
    expect(s027).toBeDefined()
    expect(s027?.body).toContain('```compare')
    expect(s027?.body).not.toContain('[file]')
    expect(s027?.body).toContain('class MyList')
    expect(s027?.body).toContain('typedef struct')
  })
})
