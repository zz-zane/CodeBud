import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const src = readFileSync(resolve(__dirname, '../App.vue'), 'utf-8')
const tpl = src.slice(src.indexOf('<template>'), src.indexOf('</template>\n\n<style'))

describe('App.vue shell template (desktop regression guard)', () => {
  it('bare-viewport v-else directly follows the claude-body-layout v-if', () => {
    const lines = tpl.split('\n').map((l) => l.replace(/\r$/, '')).filter((l) => l.trim() &&!l.trim().startsWith('<!--'))
    const i = lines.findIndex((l) => l.includes('class="bare-viewport"'))
    expect(i).toBeGreaterThan(0)
    expect(lines[i]).toContain('v-else')
    expect(tpl).toMatch(/<div v-if="!isBare" class="claude-body-layout">/)
    // v-else 之前最后一个同级元素必须是 body-layout 的闭合：其前一行是 `    </div>`（4 空格缩进）
    expect(lines[i - 1]).toBe('    </div>')
    expect(tpl.indexOf('<PhoneTabBar')).toBeGreaterThan(tpl.indexOf('class="bare-viewport"'))
  })

  it('desktop route transition stays mi-route / out-in / css on', () => {
    expect(src).toContain(":name=\"isPhone ? slideName || 'mi-instant' : 'mi-route'\"")
    expect(src).toContain(":mode=\"isPhone ? 'default' : 'out-in'\"")
    expect(src).toContain(':css="!isPhone || !!slideName"')
  })
})

describe('phone.css rule', () => {
  it('every rule lives inside the 768px media query', () => {
    const css = readFileSync(resolve(__dirname, '../styles/phone.css'), 'utf-8').replace(/\/\*[\s\S]*?\*\//g, '')
    let depth = 0
    let i = 0
    while (i < css.length) {
      const ch = css[i]
      if (ch === '{') depth++
      else if (ch === '}') depth--
      else if (depth === 0 && !/\s/.test(ch)) {
        const head = css.slice(i, css.indexOf('{', i))
        expect(head.trim()).toBe('@media (max-width: 768px)')
        i = css.indexOf('{', i)
        continue
      }
      i++
    }
  })
})
