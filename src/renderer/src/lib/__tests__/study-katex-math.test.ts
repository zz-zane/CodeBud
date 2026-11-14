import { describe, expect, it } from 'vitest'
import { renderMarkdown } from '../md'

describe('KaTeX Math Rendering in Markdown pipeline', () => {
  it('renders inline math with $ delimiters', () => {
    const res = renderMarkdown('Let $x + y = z$ be an equation.')
    expect(res.html).toContain('class="katex"')
    expect(res.html).toContain('z')
  })

  it('renders inline math with \\( \\) delimiters', () => {
    const res = renderMarkdown('Euler formula \\(e^{i\\pi} + 1 = 0\\) in text.')
    expect(res.html).toContain('class="katex"')
    expect(res.html).toContain('class="mord mathnormal"')
  })

  it('renders block math with $$ delimiters', () => {
    const res = renderMarkdown('$$\n\\sum_{i=1}^n i = \\frac{n(n+1)}{2}\n$$')
    expect(res.html).toContain('class="math-block"')
    expect(res.html).toContain('class="katex-display"')
  })

  it('renders block math with \\[ \\] delimiters', () => {
    const res = renderMarkdown('\\[\n\\int_0^1 x^2 dx = \\frac{1}{3}\n\\]')
    expect(res.html).toContain('class="math-block"')
    expect(res.html).toContain('class="katex-display"')
  })

  it('does NOT parse math inside inline code', () => {
    const res = renderMarkdown('Code `var $x = 10;` or `\\(foo\\)` is not math.')
    expect(res.html).toContain('<code>var $x = 10;</code>')
    expect(res.html).toContain('<code>\\(foo\\)</code>')
    expect(res.html).not.toContain('class="katex"')
  })

  it('does NOT parse math inside fenced code blocks', () => {
    const md = '```python\ndef test():\n    # $x + y$\n    # \\[formula\\]\n    return 42\n```'
    const res = renderMarkdown(md)
    expect(res.html).toContain('code-block')
    expect(res.html).toContain('# $x + y$')
    expect(res.html).toContain('# \\[formula\\]')
    expect(res.html).not.toContain('class="katex"')
  })

  it('safely handles invalid LaTeX without breaking or executing scripts', () => {
    const res = renderMarkdown('Invalid formula: $\\invalidCommand{<<script>>alert(1)}<script>$')
    // Should render katex-error or escaped fallback, strictly avoiding raw <script> execution
    expect(res.html).not.toContain('<script>alert(1)</script>')
  })

  it('preserves html: false for normal raw HTML in markdown', () => {
    const res = renderMarkdown('Raw <button onclick="alert(1)">Click</button> tag')
    expect(res.html).toContain('&lt;button')
    expect(res.html).not.toContain('<button onclick')
  })
})
