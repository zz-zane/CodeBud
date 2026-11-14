import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../md'
import { parseAiRichBlocks } from '../ai-rich-blocks'

describe('study rendering boundaries', () => {
  it('renders safe Wiki links and aliases only outside code and only when requested', () => {
    const raw = '[[Tree|Read tree]] `<b>` `[[Code]]`\n\n```txt\n[[Fence]]\n```'
    const html = renderMarkdown(raw, false, true).html
    expect(html).toContain('class="wiki-link"')
    expect(html).toContain('data-wiki-note="Tree"')
    expect(html).toContain('>Read tree</a>')
    expect(html.match(/data-wiki-note=/g)).toHaveLength(1)
    expect(html).toContain('&lt;b&gt;')
    expect(renderMarkdown(raw).html).not.toContain('data-wiki-note')
    expect(renderMarkdown('[[<img src=x onerror=alert(1)>]]', false, true).html).not.toContain('<img')
  })

  it('makes explicit study-html available to the sandbox and leaves ordinary HTML code as code', () => {
    const source = '<button onclick="this.textContent=2">1</button>'
    expect(parseAiRichBlocks('```study-html\n' + source + '\n```')[0]).toMatchObject({ type: 'artifact', html: source })
    expect(parseAiRichBlocks('```html\n' + source + '\n```')[0].type).toBe('markdown')
    expect(parseAiRichBlocks('```svgjavascript\nalert(1)\n```')[0].type).toBe('markdown')
  })
})
