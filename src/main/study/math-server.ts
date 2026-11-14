import { STUDY_TEXT } from '../../shared/study-copy'
import { createInterface } from 'node:readline'
import { runOctave } from './math'

const lines = createInterface({ input: process.stdin })
const write = (id: unknown, result: unknown) => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n')
lines.on('line', line => {
  void (async () => {
    let message: { id?: unknown; method?: string; params?: Record<string, unknown> }
    try { message = JSON.parse(line) } catch { return }
    if (message.id === undefined) return
    if (message.method === 'initialize') write(message.id, { protocolVersion: '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'miai-octave-mcp', version: '1.0.0' } })
    else if (message.method === 'tools/list') write(message.id, { tools: [{ name: 'octave_calculate', description: STUDY_TEXT.MATH_TOOL_DESCRIPTION, inputSchema: { type: 'object', properties: { script: { type: 'string', maxLength: 3000 }, plot: { type: 'boolean' } }, required: ['script'], additionalProperties: false } }] })
    else if (message.method === 'tools/call' && message.params?.name === 'octave_calculate') {
      try {
        const result = await runOctave(message.params.arguments, process.env.MIAI_MATH_DIR || process.cwd())
        write(message.id, { content: [{ type: 'text', text: JSON.stringify(result) }] })
      } catch (error) { write(message.id, { isError: true, content: [{ type: 'text', text: error instanceof Error ? error.message : STUDY_TEXT.MATH_FAILED }] }) }
    } else process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'Method not found' } }) + '\n')
  })()
})
