import { describe, expect, it, vi } from 'vitest'
import { prepareDraftAttachment, REASONING_EFFORT_ORDER, showEffortForModel } from './composer-types'
import { AI_ASSISTANT } from './copy'

describe('composer file preparation', () => {
  it('shows the effort choice for GPT and o-series names, not DeepSeek or unknown models', () => {
    for (const model of ['gpt-4o', ' GPT-5 ', 'openai/gpt-5', 'o3-mini', 'o4-mini']) expect(showEffortForModel(model)).toBe(true)
    for (const model of ['deepseek-chat', 'deepseek-reasoner', 'claude-sonnet', '', 'my-gpt-proxy']) expect(showEffortForModel(model)).toBe(false)
  })
  it('reads and bounds eligible text, with a truncation notice', async () => {
    const text = vi.fn(async () => 'x'.repeat(13000))
    const file = { name: 'sample.py', type: '', size: 13000, text } as unknown as File
    const result = await prepareDraftAttachment(file)
    expect(text).toHaveBeenCalledTimes(1)
    expect(result.textContent?.length).toBe(12000)
    expect(result.textContent?.endsWith(AI_ASSISTANT.ATTACH_TRUNCATED)).toBe(true)
    expect(REASONING_EFFORT_ORDER).toEqual(['low', 'medium', 'high', 'xhigh'])
  })
  it('uses metadata only for images, oversized files and read failures', async () => {
    class Reader {
      result = 'data:image/png;base64,AA=='
      onload: (() => void) | null = null
      readAsDataURL() { this.onload?.() }
    }
    vi.stubGlobal('FileReader', Reader)
    const text = vi.fn(async () => 'should not read')
    const image = await prepareDraftAttachment({ name: 'image.png', type: 'image/png', size: 10, text } as unknown as File)
    const big = await prepareDraftAttachment({ name: 'big.txt', type: 'text/plain', size: 256 * 1024 + 1, text } as unknown as File)
    const failed = await prepareDraftAttachment({ name: 'bad.txt', type: 'text/plain', size: 5, text: async () => { throw new Error('read failed') } } as unknown as File)
    expect(text).not.toHaveBeenCalled()
    expect(image).toMatchObject({ kind: 'image', previewUrl: 'data:image/png;base64,AA==' })
    expect(image.textContent).toBeUndefined()
    expect(big.textContent).toBeUndefined()
    expect(failed.textContent).toBeUndefined()
    vi.unstubAllGlobals()
  })
})
