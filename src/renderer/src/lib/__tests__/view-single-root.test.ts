import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * 路由页包在 <Transition mode="out-in"> 里，根必须是单个元素。模板根层（缩进 2 格）写 HTML 注释，
 * 开发模式会保留它，根变成片段，转场卡在离场 —— 之后所有页面空白（2026-11-24 生词本页踩过）。
 */
describe('路由页模板根层不写注释', () => {
  const dir = join(__dirname, '../../views')
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.vue'))) {
    it(f, () => {
      const src = readFileSync(join(dir, f), 'utf8')
      const tpl = src.slice(src.indexOf('<template>'), src.lastIndexOf('</template>'))
      expect(tpl.split(/\r?\n/).filter((l) => /^ {2}<!--/.test(l))).toEqual([])
    })
  }
})
