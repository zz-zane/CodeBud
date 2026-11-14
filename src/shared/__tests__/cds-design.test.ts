import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '../../..')
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')
const ui = 'src/renderer/src/'
const vendor = `${ui}styles/vendor/open-claude-ui/`

describe('Pinned CDS source and Vue integration', () => {
  it.each([
    ['cds-theme.css', '7002fa1f190eb64ea4539a0bd9a8c1ae8e2c553320cc331dd4cb4915c5ea24f0'],
    ['cds-pure.css', 'd7811a43fce8a1b75af9c91a3bf50fcb62b8d192febf0ad5377c8b32f4a7ab4b'],
    ['LICENSE', '623d6fdcde280ee7294f9b8a79a22cb16eaf2b20940358aaeff787f8912cd2c9']
  ])('preserves upstream %s byte-for-byte', (file, expected) => {
    const bytes = readFileSync(resolve(root, vendor, file))
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(expected)
  })

  it('imports the upstream layer before the host adapter; nothing sets dark-mode hooks (light only)', () => {
    const main = read(`${ui}main.ts`)
    expect(main.indexOf("import './styles/vendor/open-claude-ui/cds-pure.css'"))
      .toBeLessThan(main.indexOf("import './styles/cds-adapter.css'"))
    expect(main).not.toMatch(/dataset\.(theme|mode)|classList\.toggle\('dark'/)
    const bridge = read(`${ui}styles/cds-adapter.css`)
    for (const [host, source] of [['canvas', 1], ['card', 2], ['bg', 3]]) {
      expect(bridge).toContain(`--mi-${host}: var(--cds-surface-${source});`)
    }
    expect(read(`${vendor}source.json`)).toContain('c1f923ae0051a871941b98a0e2e3183a545e6a85')
  })

  it('keeps composition Enter ahead of submit and retains roving tab keyboard support', () => {
    const input = read(`${ui}components/base/MiInput.vue`)
    expect(input.indexOf('e.isComposing')).toBeGreaterThan(0)
    expect(input.indexOf('e.isComposing')).toBeLessThan(input.indexOf("if (e.key !== 'Enter') return"))
    const tabs = read(`${ui}components/base/MiTabs.vue`)
    expect(tabs).toContain('tabNavTarget(e.key, i, props.tabs.length)')
    expect(tabs).toContain('btns.value[target]?.focus()')
    expect(tabs).toContain(':tabindex="modelValue === t.key ? 0 : -1"')
  })
})
