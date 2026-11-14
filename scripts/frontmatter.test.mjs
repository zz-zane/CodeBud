import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { test } from 'node:test'

for (const script of ['content-build.mjs', 'content-validate.mjs']) {
  test(`${script}: Windows CRLF and LF parse identically`, () => {
    const source = readFileSync(new URL(script, import.meta.url), 'utf8')
    // Load only the real parser declarations, without running either CLI's filesystem work.
    const declarations = ['parseFrontmatter', 'parseYamlValue'].map(name => {
      const match = source.match(new RegExp(`function ${name}\\([^]*?\\n\\}`))
      assert.ok(match, `${name} declaration missing`)
      return match[0]
    }).join('\n')
    const parse = vm.runInNewContext(declarations + '\nparseFrontmatter')
    const lesson = readFileSync(new URL('../content/common/35-toolchain-map/lesson.md', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
    const lf = parse(lesson)
    const crlf = parse(lesson.replace(/\n/g, '\r\n'))
    assert.ok(lf.data && lf.data.title)
    assert.equal(JSON.stringify(crlf), JSON.stringify(lf))
    assert.equal(crlf.body.includes('\r'), false)
    assert.equal(parse('plain text\r\n').data, null)
  })
}
