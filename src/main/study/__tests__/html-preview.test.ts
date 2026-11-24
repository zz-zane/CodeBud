import { describe, it, expect } from 'vitest'
import { blockStudyFrameRequest, createHtmlPreview, htmlPreviewResponse, isHtmlPreviewUrl, STUDY_HTML_CSP, STUDY_WIDGET_CSP } from '../html-preview'

const localFixtureUrl = new URL('widget-fixture', 'file:///').href
const localAppUrl = new URL('app-fixture', 'file:///').href

describe('isolated HTML preview protocol', () => {
  it('serves only bounded registered documents under opaque sandbox CSP', async () => {
    const url = createHtmlPreview('<button>1</button>')
    const response = htmlPreviewResponse(url)
    expect(await response.text()).toBe('<button>1</button>')
    expect(response.headers.get('Content-Security-Policy')).toBe(STUDY_HTML_CSP)
    expect(STUDY_HTML_CSP).toContain('sandbox allow-scripts;')
    expect(STUDY_HTML_CSP).not.toContain('allow-same-origin')
    expect(htmlPreviewResponse(url, 'POST').status).toBe(404)
    expect(htmlPreviewResponse(url + '?bad').status).toBe(404)
    expect(isHtmlPreviewUrl(url)).toBe(true)
    expect(isHtmlPreviewUrl(url + '?bad')).toBe(false)
    expect(isHtmlPreviewUrl('https://example.com')).toBe(false)
    expect(isHtmlPreviewUrl('not-url')).toBe(false)
    expect(blockStudyFrameRequest('https://example.com/leak', 'subFrame')).toBe(true)
    expect(blockStudyFrameRequest(localFixtureUrl, 'subFrame')).toBe(true)
    expect(blockStudyFrameRequest(url, 'subFrame')).toBe(false)
    expect(blockStudyFrameRequest('https://example.com/leak', 'image', url)).toBe(true)
    expect(blockStudyFrameRequest('https://api.example.com', 'xhr', localAppUrl)).toBe(false)
    expect(htmlPreviewResponse('miai-study://preview/missing').status).toBe(404)
    expect(() => createHtmlPreview('x'.repeat(200_001))).toThrow()
  })

  it('AI 互动示意的联网预览：仍是不同源沙盒，放开 https 子资源；普通预览照旧全拦', async () => {
    const net = createHtmlPreview('<img src="https://upload.wikimedia.org/a.jpg">', { network: true })
    const plain = createHtmlPreview('<p>x</p>', { network: 'yes' })
    expect(htmlPreviewResponse(net).headers.get('Content-Security-Policy')).toBe(STUDY_WIDGET_CSP)
    expect(htmlPreviewResponse(plain).headers.get('Content-Security-Policy')).toBe(STUDY_HTML_CSP)
    expect(STUDY_WIDGET_CSP).toContain('sandbox allow-scripts;')
    expect(STUDY_WIDGET_CSP).not.toMatch(/allow-same-origin|allow-top-navigation|allow-popups|allow-forms/)
    expect(STUDY_WIDGET_CSP).toContain("frame-src 'none'")
    expect(STUDY_WIDGET_CSP).toContain("form-action 'none'")
    expect(blockStudyFrameRequest('https://upload.wikimedia.org/a.jpg', 'image', net)).toBe(false)
    expect(blockStudyFrameRequest('http://insecure.example/a.jpg', 'image', net)).toBe(true)
    expect(blockStudyFrameRequest(localFixtureUrl, 'image', net)).toBe(true)
    expect(blockStudyFrameRequest('https://upload.wikimedia.org/a.jpg', 'image', plain)).toBe(true)
    expect(blockStudyFrameRequest('https://evil.example', 'subFrame', net)).toBe(true)
  })
})
