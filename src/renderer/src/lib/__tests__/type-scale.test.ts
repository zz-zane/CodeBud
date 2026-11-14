import { readdirSync, readFileSync } from 'fs'
import { join, relative, resolve, sep } from 'path'
import { describe, expect, it } from 'vitest'
import { maskComments } from '../../../../shared/__tests__/mask-comments'

/**
 * 字号刻度守卫（docs/30 §2.1）：渲染层的 .vue / .css 里，`font-size` 只许写令牌或刻度上的 px 值，
 * 字重只许 400 / 500（hero 走 --mi-fw-hero）。刻度本身定义在 tokens.css，这里不扫。
 */
const root = resolve(__dirname, '../..')
const SCALE_PX = new Set([12, 13, 14, 16, 22, 28])
/** 例外：相对单位，跟随用户可调的阅读字号（见 docs/30 §2.7「例外」）。 */
const EM_EXCEPTIONS = new Set(['components/cet6/Cet6Paper.vue', 'components/base/MiRichText.vue'])

function files(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) {
      if (['vendor', 'generated', '__tests__', 'assets'].includes(e.name)) continue
      files(p, out)
    } else if (/\.(vue|css)$/.test(e.name) && e.name !== 'tokens.css') out.push(p)
  }
  return out
}

describe('字号刻度', () => {
  const all = files(root).map((f) => ({
    rel: relative(root, f).split(sep).join('/'),
    src: maskComments(readFileSync(f, 'utf8'))
  }))

  it('font-size / font 简写只用令牌或刻度上的 px', () => {
    const bad: string[] = []
    for (const { rel, src } of all) {
      for (const m of src.matchAll(/font(?:-size)?\s*:\s*(\d+(?:\.\d+)?)(px|em|rem)\b/g)) {
        const ok = m[2] === 'px' ? SCALE_PX.has(Number(m[1])) : EM_EXCEPTIONS.has(rel)
        if (!ok) bad.push(`${rel}: ${m[0]}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('字重只用 400 / 500（hero 经令牌）', () => {
    const bad: string[] = []
    for (const { rel, src } of all) {
      for (const m of src.matchAll(/font-weight\s*:\s*([a-z0-9]+)/g)) {
        if (!['400', '500', 'normal', 'inherit', 'var'].includes(m[1])) bad.push(`${rel}: ${m[0]}`)
      }
    }
    expect(bad).toEqual([])
  })
})
