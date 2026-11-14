import { describe, expect, it } from 'vitest'
import path from 'path'

// 测试验证 IPC 核心纯防御逻辑
describe('exportMarkdown 安全防护逻辑', () => {
  const WINDOWS_RESERVED = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\..*)?$/i
  const INVALID_CHARS = /[\\/:*?"<>|\x00-\x1f\x7f]/

  function validateFilename(filename: string): 'ok' | 'bad_filename' {
    const fname = (filename || '').trim()
    if (!fname || fname === '.' || fname === '..' || INVALID_CHARS.test(fname) || WINDOWS_RESERVED.test(fname)) {
      return 'bad_filename'
    }
    return 'ok'
  }

  function assertPathSafe(targetDir: string, filename: string): 'ok' | 'path_escape' {
    const full = path.join(targetDir, filename)
    const rel = path.relative(targetDir, full)
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      return 'path_escape'
    }
    return 'ok'
  }

  it('拦截非法文件名与路径穿越字符', () => {
    expect(validateFilename('../../escape.md')).toBe('bad_filename')
    expect(validateFilename('..\\..\\escape.md')).toBe('bad_filename')
    expect(validateFilename('.')).toBe('bad_filename')
    expect(validateFilename('..')).toBe('bad_filename')
    expect(validateFilename('')).toBe('bad_filename')
    expect(validateFilename('CON')).toBe('bad_filename')
    expect(validateFilename('con.md')).toBe('bad_filename')
    expect(validateFilename('aux.txt')).toBe('bad_filename')
    expect(validateFilename('nul')).toBe('bad_filename')
    expect(validateFilename('com1.md')).toBe('bad_filename')
    expect(validateFilename('a:b.md')).toBe('bad_filename')
    expect(validateFilename('a*b.md')).toBe('bad_filename')
    expect(validateFilename('a?b.md')).toBe('bad_filename')
    expect(validateFilename('a"b.md')).toBe('bad_filename')
    expect(validateFilename('a<b.md')).toBe('bad_filename')
    expect(validateFilename('a>b.md')).toBe('bad_filename')
    expect(validateFilename('a|b.md')).toBe('bad_filename')
  })

  it('放行合法文件名', () => {
    expect(validateFilename('备忘_Python基础.md')).toBe('ok')
    expect(validateFilename('错题_common-01_q1.md')).toBe('ok')
    expect(validateFilename('note (2).md')).toBe('ok')
  })

  it('基于 path.relative 严格拦截路径逃逸，防止前缀相似目录假借', () => {
    const targetDir = 'D:\\safe\\vault'
    expect(assertPathSafe(targetDir, 'note.md')).toBe('ok')
    expect(assertPathSafe(targetDir, '..\\vault2\\hack.md')).toBe('path_escape')
    expect(assertPathSafe(targetDir, '..\\hack.md')).toBe('path_escape')
  })
})
