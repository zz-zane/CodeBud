import { describe, expect, it, vi } from 'vitest'
import fixture from '../../../fixtures/video-pointer.json'
import { generateExplainer, loadBuiltinCatalog, matchBuiltin, validVideoGenerationInput } from '../video/generator'

const input = { requestId: 'test-1', question: '指针与地址' }
const judge = JSON.stringify({ shouldAnimate: true, concept: '指针', actsPlan: [{ steps: 5 }, { steps: 6 }] })
const signal = () => new AbortController().signal

describe('v2 动画生成', () => {
  it('取消后不返回内置动画或继续生成', async () => {
    const alreadyCanceled = new AbortController()
    alreadyCanceled.abort()
    await expect(generateExplainer({ requestId: 'canceled', question: '我分不清 p 和 *p' }, vi.fn(), vi.fn(), vi.fn(), alreadyCanceled.signal)).rejects.toThrow()
    const controller = new AbortController()
    const prompt = vi.fn().mockImplementation(async () => { controller.abort(); return judge })
    await expect(generateExplainer({ ...input, avoid: ['locker'] }, prompt, vi.fn(), vi.fn(), controller.signal)).rejects.toThrow()
    expect(prompt).toHaveBeenCalledTimes(1)
  })
  it('拒绝无界输入并对不适合动画的问题回退', async () => {
    expect(validVideoGenerationInput({ ...input, avoid: ['x'.repeat(41)] })).toBe(false)
    const prompt = vi.fn().mockResolvedValue(JSON.stringify({ shouldAnimate: false, reason: '适合文字' }))
    const result = await generateExplainer(input, prompt, vi.fn(), vi.fn(), signal())
    expect(result).toMatchObject({ ok: false, reason: '适合文字' })
    expect(prompt).toHaveBeenCalledTimes(2)
  })

  it('带错误重试一次，只在第二次仅输出不匹配时保留未验证视频', async () => {
    const prompt = vi.fn().mockResolvedValueOnce(judge).mockResolvedValue(JSON.stringify(fixture))
    const verify = vi.fn().mockResolvedValue({ status: 'mismatch', detail: '输出不符' })
    const progress = vi.fn()
    const result = await generateExplainer(input, prompt, verify, progress, signal())
    expect(result.ok && result.video.codeVerified).toBe(false)
    expect(prompt).toHaveBeenCalledTimes(3)
    expect(prompt.mock.calls[2][0]).toContain('输出不符')
    expect(progress).toHaveBeenCalledWith(expect.objectContaining({ stage: 'done', status: 'ok' }))
  })

  it('两次结构错误不返回视频，运行错误也不会标为仅输出不符', async () => {
    const prompt = vi.fn().mockResolvedValueOnce(judge).mockResolvedValue('{}')
    expect(await generateExplainer(input, prompt, vi.fn(), vi.fn(), signal())).toMatchObject({ ok: false })
    const prompt2 = vi.fn().mockResolvedValueOnce(judge).mockResolvedValue(JSON.stringify(fixture))
    expect(await generateExplainer(input, prompt2, vi.fn().mockResolvedValue({ status: 'error', detail: '编译失败' }), vi.fn(), signal())).toMatchObject({ ok: false })
  })

  it('R9 命中内置动画：6 个验收用例零模型调用，非内置或带 avoid 时正常生成', async () => {
    const catalog = loadBuiltinCatalog()
    expect(catalog.length).toBe(9)
    const cases: Array<[string, string]> = [
      ['我分不清 p 和 *p', 'c-pointer-basics'],
      ['swap 为什么换不了', 'c-pointer-swap'],
      ['p+1 为什么是下一个元素', 'c-pointer-array'],
      ['递归是怎么一层层返回的', 'recursion'],
      ['b = a 之后改 b，a 也变了', 'py-names'],
      ['for 循环括号里三句的执行顺序', 'for-loop-order']
    ]
    for (const [question, expectedId] of cases) {
      expect(matchBuiltin(question, undefined, catalog)).toEqual({ kind: 'builtin', id: expectedId })
      const prompt = vi.fn()
      const result = await generateExplainer({ requestId: `r9-${expectedId}`, question }, prompt, vi.fn(), vi.fn(), signal())
      expect(result).toMatchObject({ ok: true, video: { id: expectedId, source: 'builtin' } })
      expect(prompt).not.toHaveBeenCalled()
    }
    // 课内命中 1 个关键词即可
    expect(matchBuiltin('门牌怎么用', 'c-stage1-14', catalog)).toEqual({ kind: 'builtin', id: 'c-pointer-basics' })
    // 非内置概念不命中
    expect(matchBuiltin('二级指针怎么找到数', undefined, catalog)).toBeNull()
    // 带 avoid（换一种讲法）跳过内置匹配直接调模型
    const promptAvoid = vi.fn().mockResolvedValueOnce(judge).mockResolvedValue(JSON.stringify(fixture))
    await generateExplainer({ requestId: 'r9-avoid', question: '我分不清 p 和 *p', avoid: ['locker'] }, promptAvoid, vi.fn().mockResolvedValue({ status: 'ok' }), vi.fn(), signal())
    expect(promptAvoid).toHaveBeenCalled()
  })
})
