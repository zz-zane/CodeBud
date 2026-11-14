import http from 'node:http'
import { describe, expect, it } from 'vitest'
import { NativeHarness, ThinkFilter } from '../native-harness'

describe('DeepTutor NativeHarness & ThinkFilter', () => {
  it('ThinkFilter splits inline <think> tags even across chunk boundaries', () => {
    const filter = new ThinkFilter()
    const out: Array<['content' | 'thinking', string]> = []
    for (const chunk of ['Hello ', '<thi', 'nk>step 1', ' step 2</th', 'ink>Final answer!']) {
      out.push(...filter.feed(chunk, false))
    }
    out.push(...filter.feed('', true))
    const thinking = out.filter(([k]) => k === 'thinking').map(([, v]) => v).join('')
    const content = out.filter(([k]) => k === 'content').map(([, v]) => v).join('')
    expect(thinking).toBe('step 1 step 2')
    expect(content).toBe('Hello Final answer!')
  })

  it('streams OpenAI SSE chunks, strips <think>, preserves multi-turn session history, and auto-continues on truncation', async () => {
    const receivedBodies: any[] = []
    let callCount = 0

    const server = http.createServer((req, res) => {
      let raw = ''
      req.on('data', (c) => (raw += c))
      req.on('end', () => {
        receivedBodies.push(JSON.parse(raw))
        callCount++
        res.writeHead(200, { 'Content-Type': 'text/event-stream' })
        if (callCount === 1) {
          // Round 1: truncated with finish_reason = length
          res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: '<think>internal</think>Part 1 ' } }] }) + '\n\n')
          res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: 'Part 2' }, finish_reason: 'length' }] }) + '\n\n')
          res.end('data: [DONE]\n\n')
        } else {
          // Round 2: continuation finishes normally
          res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: ' + Part 3' }, finish_reason: 'stop' }] }) + '\n\n')
          res.end('data: [DONE]\n\n')
        }
      })
    })

    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    const port = (server.address() as { port: number }).port

    try {
      const harness = new NativeHarness({
        getConfig: () => ({
          protocol: 'openai',
          baseUrl: `http://127.0.0.1:${port}`,
          apiKey: 'sk-test-secret-999',
          model: 'deepseek-chat',
          systemPrompt: 'System tutor prompt'
        })
      })

      const chunks: string[] = []
      const res = await harness.runTurn({
        sessionId: 'sess-1',
        isResume: false,
        prompt: 'Explain binary search',
        onChunk: (c) => chunks.push(c)
      })

      expect(res.ok).toBe(true)
      if (res.ok) {
        expect(res.data.text).toBe('Part 1 Part 2 + Part 3')
        expect(chunks.join('')).toBe('Part 1 Part 2 + Part 3')
      }
      expect(callCount).toBe(2)

      // Verify multi-turn resume includes previous turn
      const res2 = await harness.runTurn({
        sessionId: 'sess-1',
        isResume: true,
        prompt: 'Follow-up question'
      })
      expect(res2.ok).toBe(true)
      const lastReqMessages = receivedBodies.at(-1).messages
      expect(lastReqMessages.some((m: any) => m.role === 'assistant' && m.content === 'Part 1 Part 2 + Part 3')).toBe(true)
    } finally {
      await new Promise<void>((r) => server.close(() => r()))
    }
  })

  it('per-turn systemPrompt replaces the configured one (openai + anthropic); omitting it keeps the configured one', async () => {
    const bodies: any[] = []
    const server = http.createServer((req, res) => {
      let raw = ''
      req.on('data', (c) => (raw += c))
      req.on('end', () => {
        bodies.push(JSON.parse(raw))
        res.writeHead(200, { 'Content-Type': 'text/event-stream' })
        res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: 'ok' }, finish_reason: 'stop' }] }) + '\n\n')
        res.end('data: [DONE]\n\n')
      })
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    try {
      const port = (server.address() as { port: number }).port
      const mk = (protocol: 'openai' | 'anthropic') => new NativeHarness({ getConfig: () => ({ protocol, baseUrl: `http://127.0.0.1:${port}`, apiKey: 'k', model: 'm', systemPrompt: 'CONFIGURED' }) })
      await mk('openai').runTurn({ sessionId: 'a', prompt: 'x', systemPrompt: 'OVERRIDE' })
      await mk('openai').runTurn({ sessionId: 'b', prompt: 'x' })
      await mk('anthropic').runTurn({ sessionId: 'c', prompt: 'x', systemPrompt: 'OVERRIDE' })
      await mk('anthropic').runTurn({ sessionId: 'd', prompt: 'x' })
      expect(bodies[0].messages[0]).toEqual({ role: 'system', content: 'OVERRIDE' })
      expect(bodies[1].messages[0]).toEqual({ role: 'system', content: 'CONFIGURED' })
      expect(bodies[2].system).toBe('OVERRIDE')
      expect(bodies[3].system).toBe('CONFIGURED')
    } finally { await new Promise<void>(resolve => server.close(() => resolve())) }
  })

  it('captures usage-only final SSE chunks once for every continuation round', async () => {
    let count = 0
    const server = http.createServer((req, res) => {
      req.resume()
      req.on('end', () => {
        count++
        res.writeHead(200, { 'Content-Type': 'text/event-stream' })
        res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: 'part' }, finish_reason: count === 1 ? 'length' : 'stop' }] }) + '\n\n')
        const usage = { choices: [], usage: { prompt_tokens: 100, completion_tokens: 20, prompt_tokens_details: { cached_tokens: 80 } } }
        res.write('data: ' + JSON.stringify(usage) + '\n\n')
        res.write('data: ' + JSON.stringify(usage) + '\n\n')
        res.end('data: [DONE]\n\n')
      })
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    try {
      const port = (server.address() as { port: number }).port
      const harness = new NativeHarness({ getConfig: () => ({ protocol: 'openai', baseUrl: `http://127.0.0.1:${port}`, apiKey: 'fake-key', model: 'test' }) })
      const usage: unknown[] = []
      const result = await harness.runTurn({ prompt: 'x', onUsage: value => usage.push(value) })
      expect(result.ok).toBe(true)
      expect(usage).toHaveLength(2)
      expect(usage).toEqual(Array(2).fill({ inputTokens: 100, outputTokens: 20, cachedInputTokens: 80, totalTokens: 120 }))
    } finally { await new Promise<void>(resolve => server.close(() => resolve())) }
  })

  it('never leaks API key on upstream HTTP errors and respects AbortSignal', async () => {
    const secretKey = 'sk-ultra-secret-token-xyz'
    const server = http.createServer((req, res) => {
      req.resume()
      req.on('end', () => {
        res.writeHead(401, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: `Invalid token ${secretKey}` }))
      })
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    const port = (server.address() as { port: number }).port

    try {
      const harness = new NativeHarness({
        getConfig: () => ({
          protocol: 'openai',
          baseUrl: `http://127.0.0.1:${port}`,
          apiKey: secretKey,
          model: 'deepseek-chat'
        })
      })

      const failRes = await harness.runTurn({ prompt: 'hi' })
      expect(failRes.ok).toBe(false)
      if (!failRes.ok) {
        expect(failRes.reason).toBe('unauthorized')
        expect(failRes.detail || '').not.toContain(secretKey)
      }

      const ac = new AbortController()
      ac.abort()
      const canceledRes = await harness.runTurn({ prompt: 'hi', signal: ac.signal })
      expect(canceledRes.ok).toBe(false)
      if (!canceledRes.ok) {
        expect(['aborted', 'canceled']).toContain(canceledRes.reason)
      }
    } finally {
      await new Promise<void>((r) => server.close(() => r()))
    }
  })

  it('falls back unclosed <think> to visible content when no prior content was emitted (P2)', () => {
    const filter = new ThinkFilter()
    const out: Array<['content' | 'thinking', string]> = []
    out.push(...filter.feed('<think>Unfinished thought that never closes...', true))
    const content = out.filter(([k]) => k === 'content').map(([, v]) => v).join('')
    expect(content).toBe('Unfinished thought that never closes...')
  })

  it('detects OpenAI in-stream top-level error packets and evicts LRU sessions over 32 (P2)', async () => {
    let callCount = 0
    const server = http.createServer((req, res) => {
      req.resume()
      req.on('end', () => {
        callCount++
        res.writeHead(200, { 'Content-Type': 'text/event-stream' })
        if (callCount === 1) {
          // Stream error packet mid-stream
          res.write('data: ' + JSON.stringify({ error: { message: 'insufficient_quota', code: 429 } }) + '\n\n')
          res.end()
        } else {
          res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: 'ok' }, finish_reason: 'stop' }] }) + '\n\n')
          res.end('data: [DONE]\n\n')
        }
      })
    })

    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    const port = (server.address() as { port: number }).port

    try {
      const harness = new NativeHarness({
        getConfig: () => ({
          protocol: 'openai',
          baseUrl: `http://127.0.0.1:${port}`,
          apiKey: 'sk-test-token',
          model: 'deepseek-chat'
        })
      })

      // 1. In-stream error packet
      const errRes = await harness.runTurn({ prompt: 'test error' })
      expect(errRes.ok).toBe(false)
      if (!errRes.ok) {
        expect(errRes.reason).toBe('quota')
        expect(errRes.detail).toContain('insufficient_quota')
      }

      // 2. LRU limit & message clipping (create 35 sessions)
      for (let i = 0; i < 35; i++) {
        await harness.runTurn({
          sessionId: `session-${i}`,
          isResume: false,
          prompt: 'x'.repeat(30_000)
        })
      }

      // Oldest sessions (e.g. session-0, session-1) should be evicted
      expect(harness.getSessionHistory('session-0')).toHaveLength(0)
      expect(harness.getSessionHistory('session-1')).toHaveLength(0)

      // Recent sessions (e.g. session-34) should exist and its content clipped to 24000
      const recentHistory = harness.getSessionHistory('session-34')
      expect(recentHistory).toHaveLength(2)
      expect(recentHistory[0].content.length).toBeLessThanOrEqual(24_000)
    } finally {
      await new Promise<void>((r) => server.close(() => r()))
    }
  })


  it('emits unclosed <think> content at the end even after prior content (P2)', () => {
    const filter = new ThinkFilter()
    const out: Array<['content' | 'thinking', string]> = []
    out.push(...filter.feed('前导正文', false))
    out.push(...filter.feed('<think>未闭合的后半段正文', true))
    const content = out.filter(([k]) => k === 'content').map(([, v]) => v).join('')
    expect(content).toBe('前导正文未闭合的后半段正文')
  })

  it('aborts mid-stream when signal is triggered and preserves partial history for resume (P2)', async () => {
    let callCount = 0
    const server = http.createServer((req, res) => {
      req.resume()
      req.on('end', () => {
        callCount++
        res.writeHead(200, { 'Content-Type': 'text/event-stream' })
        res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: 'First partial chunk ' } }] }) + '\n\n')
        setTimeout(() => {
          if (!res.writableEnded) {
            res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: 'Second chunk' } }] }) + '\n\n')
            res.end('data: [DONE]\n\n')
          }
        }, 500)
      })
    })

    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    const port = (server.address() as { port: number }).port

    try {
      const harness = new NativeHarness({
        getConfig: () => ({
          protocol: 'openai',
          baseUrl: `http://127.0.0.1:${port}`,
          apiKey: 'sk-test-token',
          model: 'deepseek-chat'
        })
      })

      const ac = new AbortController()
      let receivedChunk = false

      const runPromise = harness.runTurn({
        sessionId: 'abort-sess-1',
        isResume: false,
        prompt: 'Start calculating',
        signal: ac.signal,
        onChunk: () => {
          if (!receivedChunk) {
            receivedChunk = true
            ac.abort()
          }
        }
      })

      const res = await runPromise
      expect(res.ok).toBe(false)
      if (!res.ok) {
        expect(res.reason).toBe('aborted')
      }

      // Check that partial response was saved into history
      const history = harness.getSessionHistory('abort-sess-1')
      expect(history.length).toBe(2)
      expect(history[0]).toEqual({ role: 'user', content: 'Start calculating' })
      expect(history[1]).toEqual({ role: 'assistant', content: 'First partial chunk ' })

      // Next turn can resume with the partial history
      expect(callCount).toBe(1)
    } finally {
      await new Promise<void>((r) => server.close(() => r()))
    }
  })
  /**
   * 这两条守的是原 local-router 时代就有的契约，随代理退役后一度没人看。
   * endpoint-url.ts / postStream 是活代码，所以必须继续守。
   */
  it('decodes a multi-byte UTF-8 char split across two SSE chunks', async () => {
    const server = http.createServer((req, res) => {
      req.resume()
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'text/event-stream' })
        const bytes = Buffer.from(
          'data: ' + JSON.stringify({ choices: [{ delta: { content: '中文' } }] }) + '\n\ndata: [DONE]\n\n'
        )
        // 切在「中」的字节中间：任何按块独立 decode 的实现都会得到乱码
        const split = bytes.indexOf(Buffer.from('中')) + 1
        res.write(bytes.subarray(0, split))
        setTimeout(() => res.end(bytes.subarray(split)), 5)
      })
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    const port = (server.address() as { port: number }).port

    try {
      const harness = new NativeHarness({
        getConfig: () => ({
          protocol: 'openai',
          baseUrl: `http://127.0.0.1:${port}`,
          apiKey: 'sk-split-test',
          model: 'deepseek-chat'
        })
      })
      const res = await harness.runTurn({ prompt: 'hi' })
      expect(res.ok).toBe(true)
      if (res.ok) expect(res.data.text).toBe('中文')
    } finally {
      await new Promise<void>((r) => server.close(() => r()))
    }
  })

  it('rejects non-http(s) endpoints and URLs carrying embedded credentials', async () => {
    for (const baseUrl of ['ftp://example.test', 'http://user:pass@127.0.0.1:1']) {
      const harness = new NativeHarness({
        getConfig: () => ({ protocol: 'openai', baseUrl, apiKey: 'sk-x', model: 'deepseek-chat' })
      })
      const res = await harness.runTurn({ prompt: 'hi' })
      expect(res.ok).toBe(false)
      if (!res.ok) expect(res.detail || '').not.toContain('sk-x')
    }
  })

})
