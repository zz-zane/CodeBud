import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AcpClient, StudyConnections, classifyAcpFailure, permissionRefusal, unsafeAcpArgs } from '../acp'
import { agyCandidates, detectAgy, parseAgyModels } from '../agy-detect'
import { StudyStore } from '../store'
import { STUDY_TEXT } from '../../../shared/study-copy'
import type { StudyConnection } from '../../../shared/study-companion'

// Fake ACP agent. Message shapes replay a real `agy acp` 1.5.0 transcript (account fields scrubbed).
// Scenario = argv[2]; side effects are recorded in cwd (pid.txt, perm.json, model.txt).
const fake = `
const fs = require('node:fs');
const readline = require('node:readline');
const scenario = process.argv[2];
fs.writeFileSync('pid.txt', String(process.pid));
const send = x => process.stdout.write(JSON.stringify({ jsonrpc: '2.0', ...x }) + '\\n');
const update = (sessionId, u) => send({ method: 'session/update', params: { sessionId, update: u } });
const chunk = (sessionId, text) => update(sessionId, { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text } });
let promptId = null, sid = 'sess-1';
readline.createInterface({ input: process.stdin }).on('line', line => {
  const r = JSON.parse(line);
  if (r.id === 900) { fs.writeFileSync('perm.json', JSON.stringify(r.result)); finishPermission(); return; }
  const ok = result => send({ id: r.id, result });
  if (r.method === 'initialize') {
    if (scenario === 'v9') return ok({ protocolVersion: 9 });
    return ok({ protocolVersion: scenario === 'v2' ? 2 : 1, agentCapabilities: { loadSession: true }, agentInfo: { name: 'Antigravity ACP Server', version: '1.5.0' },
      authMethods: [{ id: 'oauth-personal', name: 'Log in with Google', description: 'x' }, { id: 'gemini-api-key', name: 'Gemini API key' }] });
  }
  if (r.method === 'session/new') {
    if (scenario === 'auth') return send({ id: r.id, error: { code: -32000, message: 'Authentication required' } });
    return ok({ sessionId: sid, models: { availableModels: [{ modelId: 'm-1', name: 'M1' }], currentModelId: 'm-1' }, modes: { currentModeId: 'default', availableModes: [] } });
  }
  if (r.method === 'session/set_model') {
    if (r.params.modelId === 'bogus') return send({ id: r.id, error: { code: -32602, message: 'Unknown model ID: bogus' } });
    fs.writeFileSync('model.txt', r.params.modelId); return ok({});
  }
  if (r.method === 'session/cancel') { if (scenario === 'cancelok' && promptId) { send({ id: promptId, result: { stopReason: 'cancelled' } }); promptId = null; } return; }
  if (r.method === 'session/prompt') {
    promptId = r.id;
    update(sid, { sessionUpdate: 'available_commands_update', availableCommands: [{ name: 'plan', description: 'Plan' }] });
    update(sid, { sessionUpdate: 'session_info_update', title: 'T' });
    update(sid, { sessionUpdate: 'user_message_chunk', content: { type: 'text', text: r.params.prompt[0].text } });
    if (scenario === 'hang' || scenario === 'cancelok') { chunk(sid, 'partial'); return; }
    if (scenario === 'exit') { chunk(sid, 'half'); setTimeout(() => process.exit(3), 20); return; }
    const notice = ' ⚠ API error (attempt 1): request failed: Post "https://daily-cloudcode-pa.googleapis.com/v1internal:streamGenerateContent?alt=sse": EOF';
    if (scenario === 'retry') { chunk(sid, notice + '\\n'); chunk(sid, '真正的回答，提到 API error 也要保留。'); return ok({ stopReason: 'end_turn' }); }
    if (scenario === 'retrysplit') { chunk(sid, ' ⚠ API error (att'); chunk(sid, 'empt 2): request failed: Post "https://x/y": EOF\\n答'); chunk(sid, '案'); return ok({ stopReason: 'end_turn' }); }
    if (scenario === 'retryonly') { chunk(sid, notice + '\\n'); chunk(sid, notice.replace('1', '2') + '\\n'); return ok({ stopReason: 'end_turn' }); }
    if (scenario === 'quota') { chunk(sid, '\\n⚠ Individual quota reached. Please upgrade your subscription to increase your limits. Resets in 49h50m54s.\\n'); return ok({ stopReason: 'end_turn' }); }
    if (scenario === 'perm' || scenario === 'permnone') {
      send({ id: 900, method: 'session/request_permission', params: { sessionId: sid, toolCall: { toolCallId: 't1', title: 'write hello.txt' },
        options: scenario === 'perm' ? [{ optionId: 'allow', name: 'Allow', kind: 'allow_once' }, { optionId: 'no', name: 'Reject', kind: 'reject_once' }] : [] } });
      return;
    }
    update(sid, { sessionUpdate: 'agent_thought_chunk', content: { type: 'text', text: 'SECRET THOUGHT' } });
    update(sid, { sessionUpdate: 'tool_call', toolCallId: 't0', title: 'ls', kind: 'execute', status: 'pending' });
    chunk(sid, '**变量就是一个用来存放数据、并且贴有名字标签的“');
    chunk(sid, '盒子”。**');
    return ok({ stopReason: 'end_turn', usage: { inputTokens: 10134, outputTokens: 29, cachedReadTokens: 0, cachedWriteTokens: 0, thoughtTokens: 0, totalTokens: 10163 } });
  }
  if (r.method === 'authenticate') return send({ id: r.id, error: { code: -32602, message: 'Unsupported auth method' } });
  function noop() {}
});
function finishPermission() {
  update(sid, { sessionUpdate: 'tool_call_update', toolCallId: 't1', status: 'failed' });
  chunk(sid, 'I could not write the file.');
  send({ id: promptId, result: { stopReason: 'end_turn' } });
}
`

let dir: string
let clients: AcpClient[]
let connections: StudyConnections | null
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'acp-agy-')); writeFileSync(join(dir, 'agent.cjs'), fake); clients = []; connections = null })
afterEach(async () => {
  await connections?.close()
  await Promise.all(clients.map(client => client.close()))
  rmSync(dir, { recursive: true, force: true })
})

function make(scenario: string, extra: Partial<StudyConnection> = {}): AcpClient {
  const connection: StudyConnection = { id: 'c1', kind: 'antigravity', label: 'agy', command: process.execPath, args: [join(dir, 'agent.cjs'), scenario], status: 'disconnected', ...extra }
  const value = new AcpClient(connection, join(dir, 'ws'))
  clients.push(value)
  return value
}
const pid = () => Number(readFileSync(join(dir, 'ws', 'pid.txt'), 'utf8'))
const alive = (p: number) => { try { process.kill(p, 0); return true } catch { return false } }
const never = () => new AbortController().signal
const waitDead = async (p: number) => { for (let i = 0; i < 100 && alive(p); i++) await new Promise(r => setTimeout(r, 50)); return !alive(p) }

describe('agy ACP transcript replay', () => {
  it('assembles streamed chunks in order and keeps thoughts, tool calls and echoes out of the answer', async () => {
    const c = make('agy')
    await c.initialize()
    expect(c.authMethods.map(m => m.id)).toEqual(['oauth-personal', 'gemini-api-key'])
    await c.probe()
    const chunks: string[] = []
    const r = await c.prompt('s', 'q', never(), t => chunks.push(t))
    expect(chunks.join('')).toBe('**变量就是一个用来存放数据、并且贴有名字标签的“盒子”。**')
    expect(r.text).toBe(chunks.join(''))
    expect(r.text).not.toContain('SECRET')
    expect(r.usage?.totalTokens).toBe(10163)
  })
  it('refuses a permission request with the reject option and says so once', async () => {
    const c = make('perm')
    await c.initialize()
    const r = await c.prompt('s', 'make a file', never(), () => {})
    expect(JSON.parse(readFileSync(join(dir, 'ws', 'perm.json'), 'utf8'))).toEqual({ outcome: { outcome: 'selected', optionId: 'no' } })
    expect(r.text).toBe('I could not write the file.' + STUDY_TEXT.ACP_TOOL_REFUSED)
    expect(existsSync(join(dir, 'ws', 'hello.txt'))).toBe(false)
  })
  it('answers a permission request without reject options with a cancelled outcome, never an allow', async () => {
    const c = make('permnone')
    await c.initialize()
    await c.prompt('s', 'x', never(), () => {})
    expect(JSON.parse(readFileSync(join(dir, 'ws', 'perm.json'), 'utf8'))).toEqual({ outcome: { outcome: 'cancelled' } })
    expect(permissionRefusal([{ optionId: 'a', kind: 'allow_always' }, { optionId: 'b', kind: 'allow_once' }])).toEqual({ outcome: { outcome: 'cancelled' } })
    expect(permissionRefusal([{ optionId: 'a', kind: 'allow_once' }, { optionId: 'r', kind: 'reject_always' }]).outcome).toEqual({ outcome: 'selected', optionId: 'r' })
  })
  it('turns the in-band quota warning into a specific error instead of answer text', async () => {
    const c = make('quota')
    await c.initialize()
    const chunks: string[] = []
    await expect(c.prompt('s', 'q', never(), t => chunks.push(t))).rejects.toThrow(STUDY_TEXT.ACP_QUOTA('49h50m54s'))
    expect(chunks).toEqual([])
  })
  it('classifies auth, quota and rate-limit failures', () => {
    expect(classifyAcpFailure(-32000, 'Authentication required')).toBe(STUDY_TEXT.ACP_AUTH_REQUIRED)
    expect(classifyAcpFailure(1, 'Please sign in')).toBe(STUDY_TEXT.ACP_AUTH_REQUIRED)
    expect(classifyAcpFailure(1, 'RESOURCE_EXHAUSTED: quota')).toContain('额度')
    expect(classifyAcpFailure(1, '429 Too Many Requests')).toBe(STUDY_TEXT.ACP_RATE_LIMIT)
    expect(classifyAcpFailure(-32602, 'Unknown model ID')).toBeNull()
  })
})

describe('retry notices', () => {
  it('drops a retry notice that arrives as its own chunk and keeps the answer', async () => {
    const c = make('retry')
    await c.initialize()
    const chunks: string[] = []
    const r = await c.prompt('s', 'q', never(), t => chunks.push(t))
    expect(r.text).toBe('真正的回答，提到 API error 也要保留。')
    expect(chunks.join('')).toBe(r.text)
    expect(JSON.stringify([r, chunks])).not.toMatch(/googleapis|⚠/)
  })
  it('drops a notice split across chunks and strips its leftover from the answer start', async () => {
    const c = make('retrysplit')
    await c.initialize()
    const chunks: string[] = []
    const r = await c.prompt('s', 'q', never(), t => chunks.push(t))
    expect(r.text).toBe('答案')
    expect(chunks.join('')).toBe('答案')
  })
  it('reports a network failure when nothing but notices came back', async () => {
    const c = make('retryonly')
    await c.initialize()
    const chunks: string[] = []
    const failure = await c.prompt('s', 'q', never(), t => chunks.push(t)).catch((e: Error) => e)
    expect(failure).toBeInstanceOf(Error)
    expect((failure as Error).message).toBe(STUDY_TEXT.ACP_NETWORK)
    expect(chunks).toEqual([])
  })
})

describe('lifecycle', () => {
  it('connect reports not-signed-in and leaves no process behind', async () => {
    connections = new StudyConnections(new StudyStore(dir))
    const saved = connections.save({ kind: 'antigravity', label: 'agy', command: process.execPath, args: [join(dir, 'agent.cjs'), 'auth'] })
    await expect(connections.connect(saved.id)).rejects.toThrow(STUDY_TEXT.ACP_AUTH_REQUIRED)
    expect(connections.snapshot().connections[0]).toMatchObject({ status: 'error', error: STUDY_TEXT.ACP_AUTH_REQUIRED })
    expect(await waitDead(Number(readFileSync(join(dir, 'study-agent-workspaces', saved.id, 'pid.txt'), 'utf8')))).toBe(true)
  })
  it('connect succeeds when signed in, hides login buttons, and disconnect kills the process', async () => {
    connections = new StudyConnections(new StudyStore(dir))
    const saved = connections.save({ kind: 'antigravity', label: 'agy', command: process.execPath, args: [join(dir, 'agent.cjs'), 'agy'] })
    const ready = await connections.connect(saved.id)
    expect(ready).toMatchObject({ status: 'ready', authMethods: [] })
    const p = Number(readFileSync(join(dir, 'study-agent-workspaces', saved.id, 'pid.txt'), 'utf8'))
    connections.select(saved.id)
    const r = await connections.prompt('s', 'hi', never(), () => {})
    expect(r.text).toContain('盒子')
    await connections.disconnect(saved.id)
    expect(await waitDead(p)).toBe(true)
  })
  it('disconnect and remove resolve only after the agent has exited, so its workspace can be deleted at once', async () => {
    connections = new StudyConnections(new StudyStore(dir))
    for (const end of ['disconnect', 'remove'] as const) {
      const saved = connections.save({ kind: 'antigravity', label: 'agy', command: process.execPath, args: [join(dir, 'agent.cjs'), 'agy'] })
      await connections.connect(saved.id)
      const ws = join(dir, 'study-agent-workspaces', saved.id)
      const p = Number(readFileSync(join(ws, 'pid.txt'), 'utf8'))
      await connections[end](saved.id)
      // No polling and no retries: a pid that merely looks dead can still hold its cwd open on Windows.
      expect(alive(p), end).toBe(false)
      // Removing the parent too: a child dir still open by a dying process stays delete-pending and blocks it.
      rmSync(join(dir, 'study-agent-workspaces'), { recursive: true })
      expect(existsSync(ws), end).toBe(false)
    }
  })
  it('cancel asks the agent to stop, ends the turn and keeps the process for the next turn', async () => {
    const c = make('cancelok')
    await c.initialize()
    const ctl = new AbortController()
    const chunks: string[] = []
    const run = c.prompt('s', 'q', ctl.signal, t => { chunks.push(t); ctl.abort() })
    await expect(run).rejects.toThrow()
    expect(c.connected).toBe(true)
    expect(alive(pid())).toBe(true)
  })
  it('kills an agent that ignores cancel', async () => {
    const c = make('hang')
    await c.initialize()
    const ctl = new AbortController()
    const run = c.prompt('s', 'q', ctl.signal, () => ctl.abort())
    await expect(run).rejects.toThrow()
    expect(await waitDead(pid())).toBe(true)
  }, 10_000)
  it('reports a process exit in the middle of a turn', async () => {
    const c = make('exit')
    await c.initialize()
    await expect(c.prompt('s', 'q', never(), () => {})).rejects.toThrow(STUDY_TEXT.ACP_EXITED)
    expect(c.connected).toBe(false)
  })
  it('times out a silent turn and kills the process', async () => {
    const c = make('hang')
    c.promptTimeoutMs = 300
    await c.initialize()
    await expect(c.prompt('s', 'q', never(), () => {})).rejects.toThrow(STUDY_TEXT.ACP_TIMEOUT)
    expect(await waitDead(pid())).toBe(true)
  })
})

describe('negotiation and model', () => {
  it('accepts protocol 2 and rejects an unknown version', async () => {
    await make('v2').initialize()
    await expect(make('v9').initialize()).rejects.toThrow(STUDY_TEXT.ACP_VERSION_UNSUPPORTED)
  })
  it('applies the chosen model after session/new and reports a rejected model plainly', async () => {
    const c = make('agy', { model: 'm-1' })
    await c.initialize()
    await c.prompt('s', 'q', never(), () => {})
    expect(readFileSync(join(dir, 'ws', 'model.txt'), 'utf8')).toBe('m-1')
    const bad = make('agy', { model: 'bogus' })
    await bad.initialize()
    await expect(bad.prompt('s', 'q', never(), () => {})).rejects.toThrow(STUDY_TEXT.ACP_MODEL_INVALID)
  })
})

describe('model switching and removal', () => {
  it('setModel changes the live session model at once and persists it on the connection', async () => {
    connections = new StudyConnections(new StudyStore(dir))
    const saved = connections.save({ kind: 'antigravity', label: 'agy', command: process.execPath, args: [join(dir, 'agent.cjs'), 'agy'], model: 'm-1' })
    await connections.connect(saved.id)
    connections.select(saved.id)
    await connections.prompt('s', 'hi', never(), () => {})
    const ws = join(dir, 'study-agent-workspaces', saved.id)
    expect(readFileSync(join(ws, 'model.txt'), 'utf8')).toBe('m-1')
    const updated = await connections.setModel({ connectionId: saved.id, model: 'm-2' })
    expect(updated.model).toBe('m-2')
    expect(readFileSync(join(ws, 'model.txt'), 'utf8')).toBe('m-2')
    expect(connections.snapshot().connections[0]).toMatchObject({ model: 'm-2', status: 'ready' })
    await expect(connections.setModel({ connectionId: saved.id, model: 'bogus' })).rejects.toThrow(STUDY_TEXT.ACP_MODEL_INVALID)
    expect(connections.snapshot().connections[0].model).toBe('m-2')
    await expect(connections.setModel({ connectionId: saved.id, model: 'bad model;x' })).rejects.toThrow(STUDY_TEXT.CONNECTION_MODEL_INVALID)
    await connections.disconnect(saved.id)
    expect(await waitDead(Number(readFileSync(join(ws, 'pid.txt'), 'utf8')))).toBe(true)
  })
  it('setModel on a disconnected connection only persists, and remove kills the agent and clears the active id', async () => {
    connections = new StudyConnections(new StudyStore(dir))
    const saved = connections.save({ kind: 'antigravity', label: 'agy', command: process.execPath, args: [join(dir, 'agent.cjs'), 'agy'] })
    expect((await connections.setModel({ connectionId: saved.id, model: 'm-9' })).model).toBe('m-9')
    await connections.connect(saved.id)
    connections.select(saved.id)
    const p = Number(readFileSync(join(dir, 'study-agent-workspaces', saved.id, 'pid.txt'), 'utf8'))
    await connections.remove(saved.id)
    expect(await waitDead(p)).toBe(true)
    expect(connections.snapshot()).toMatchObject({ connections: [], activeConnectionId: null })
    await expect(connections.remove(saved.id)).rejects.toThrow(STUDY_TEXT.CONNECTION_MISSING)
  })
})

describe('connection argument validation', () => {
  it('rejects permission-skipping flags and accepts acp', () => {
    for (const bad of [['acp', '--dangerously-skip-permissions'], ['--dangerously_skip_permissions'], ['-dangerously-skip-permissions'], ['--skip-permissions'], ['--yolo'], ['--auto-approve'], ['--mode', 'auto'], ['--mode=accept-edits'], ['--permission-mode', 'bypassPermissions']]) expect(unsafeAcpArgs(bad), bad.join(' ')).toBe(true)
    for (const good of [['acp'], ['acp', '--mode', 'plan'], ['acp', '--sandbox']]) expect(unsafeAcpArgs(good), good.join(' ')).toBe(false)
    const store = new StudyStore(dir)
    connections = new StudyConnections(store)
    const base = { kind: 'antigravity', label: 'a', command: 'C:/x/agy.exe' }
    expect(() => connections!.save({ ...base, args: ['acp', '--dangerously-skip-permissions'] })).toThrow(STUDY_TEXT.CONNECTION_UNSAFE_ARGUMENT)
    expect(connections.save({ ...base, args: ['acp'], model: 'gemini-3.8-flash-low' })).toMatchObject({ args: ['acp'], model: 'gemini-3.8-flash-low' })
    expect(() => connections!.save({ ...base, args: ['acp'], model: 'bad model;x' })).toThrow(STUDY_TEXT.CONNECTION_MODEL_INVALID)
  })
})

describe('agy detection (pure)', () => {
  const env = { path: 'C:\\Windows;"D:\\soft\\Antigravity\\cli\\bin";', localAppData: 'C:\\Users\\u\\AppData\\Local', programFiles: 'C:\\Program Files' }
  it('lists PATH first, then conventional roots, without duplicates', () => {
    const list = agyCandidates(env)
    expect(list[0]).toBe('C:\\Windows\\agy.exe')
    expect(list[1]).toBe('D:\\soft\\Antigravity\\cli\\bin\\agy.exe')
    expect(list).toContain('C:\\Users\\u\\AppData\\Local\\Programs\\Antigravity\\cli\\bin\\agy.exe')
    expect(new Set(list).size).toBe(list.length)
  })
  it('returns the first existing candidate that answers a version probe, or null', async () => {
    const hit = 'D:\\soft\\Antigravity\\cli\\bin\\agy.exe'
    expect(await detectAgy(env, p => p === hit, async () => true)).toBe(hit)
    expect(await detectAgy(env, () => true, async p => p.includes('Program Files'))).toBe('C:\\Program Files\\Antigravity\\cli\\bin\\agy.exe')
    expect(await detectAgy(env, () => false, async () => true)).toBeNull()
    expect(await detectAgy(env, () => true, async () => false)).toBeNull()
  })
  it('parses `agy models` output and ignores progress lines', () => {
    expect(parseAgyModels('Fetching available models...\ngemini-4-argon-medium\tGemini 4 Argon (Medium)\r\nclaude-sonnet-5-5-low\tClaude Sonnet 5.5 (Low)\n')).toEqual([
      { id: 'gemini-4-argon-medium', name: 'Gemini 4 Argon (Medium)' }, { id: 'claude-sonnet-5-5-low', name: 'Claude Sonnet 5.5 (Low)' }])
  })
})
