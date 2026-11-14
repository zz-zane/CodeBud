import { describe, it, expect } from 'vitest'
import { blockStudyFrameRequest, createHtmlPreview, htmlPreviewResponse, isHtmlPreviewUrl, STUDY_HTML_CSP } from '../html-preview'

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
    expect(blockStudyFrameRequest('file:///D:/secret', 'subFrame')).toBe(true)
    expect(blockStudyFrameRequest(url, 'subFrame')).toBe(false)
    expect(blockStudyFrameRequest('https://example.com/leak', 'image', url)).toBe(true)
    expect(blockStudyFrameRequest('https://api.example.com', 'xhr', 'file:///app')).toBe(false)
    expect(htmlPreviewResponse('miai-study://preview/missing').status).toBe(404)
    expect(() => createHtmlPreview('x'.repeat(200_001))).toThrow()
  })
})
