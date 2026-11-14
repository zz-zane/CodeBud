import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { AcpClient, StudyConnections } from '../acp'
import { normalizeAcpUsage, normalizeProviderUsage, recordStudyUsage } from '../usage'
import { StudyStore } from '../store'
import type { StudyConnection } from '../../../shared/study-companion'

const root = resolve('D:/project/coding/outputs/study-companion-20261105/root-tests')
let dir: string
let clients: AcpClient[]
beforeEach(() => { mkdirSync(root, { recursive: true }); dir = mkdtempSync(join(root, 'acp-')); clients = [] })
afterEach(async () => {
  await Promise.all(clients.map(client => client.close()))
  if (!dir.startsWith(root + '\\') && !dir.startsWith(root + '/')) throw new Error('Invalid cleanup target')
  rmSync(dir, { recursive: true, force: true })
})

const fakeServer = `
const readline = require('node:readline');
const send = x => process.stdout.write(JSON.stringify({jsonrpc:'2.0',...x})+'\\n');
let authed = false;
readline.createInterface({input:process.stdin}).on('line', line => {
 const r=JSON.parse(line); const ok=result=>send({id:r.id,result});
 if(r.method==='initialize') ok({protocolVersion:1,authMethods:[{id:'account',name:'Sign in'}]});
 else if(r.method==='authenticate') { authed=true; ok({}); }
 else if(r.method==='session/new') authed ? ok({sessionId:'sdk-session'}) : send({id:r.id,error:{code:-32000,message:'auth needed'}});
 else if(r.method==='session/prompt') {
   send({method:'session/update',params:{sessionId:'sdk-session',update:{sessionUpdate:'agent_message_chunk',content:{type:'text',text:'A real stdio reply'}}}});
   if(r.params.prompt[0].text !== 'wait') ok({stopReason:'end_turn',usage:{prompt_tokens:10,completion_tokens:5,total_tokens:15}});
 } else if(r.method==='session/cancel') process.exit(0);
});`

describe('provider usage', () => {
  it('keeps OpenAI cache/reasoning subsets out of the total a second time', () => {
    expect(normalizeProviderUsage('openai', { prompt_tokens: 100, completion_tokens: 30, prompt_tokens_details: { cached_tokens: 80 }, completion_tokens_details: { reasoning_tokens: 20 } })).toEqual({ inputTokens: 100, outputTokens: 30, cachedInputTokens: 80, totalTokens: 130 })
  })
  it('adds Anthropic disjoint cache input once and preserves unknowns', () => {
    expect(normalizeProviderUsage('anthropic', { input_tokens: 10, cache_read_input_tokens: 80, cache_creation_input_tokens: 5, output_tokens: 30 })).toEqual({ inputTokens: 95, outputTokens: 30, cachedInputTokens: 80, totalTokens: 125 })
    expect(normalizeProviderUsage('openai', {})).toEqual({ inputTokens: null, outputTokens: null, cachedInputTokens: null, totalTokens: null })
    expect(normalizeProviderUsage('openai', { prompt_tokens: -1, completion_tokens: NaN }).totalTokens).toBeNull()
  })
  it('persists one record per stable round id without adding a retry twice', () => {
    const store = new StudyStore(dir)
    const record = { ...normalizeProviderUsage('openai', { prompt_tokens: 10, completion_tokens: 3 }), id: 'turn-1', at: 1, provider: 'test', model: 'test', sessionId: 'study-main', source: 'fixture' }
    recordStudyUsage(store, record)
    recordStudyUsage(store, record)
    expect(new StudyStore(dir).read().usage).toEqual([record])
  })
  it('uses differences of ACP cumulative session counters without counting earlier turns twice', () => {
    const first = { inputTokens: 100, outputTokens: 20, cachedReadTokens: 60, totalTokens: 120 }
    const second = { inputTokens: 170, outputTokens: 30, cachedReadTokens: 100, totalTokens: 200 }
    expect(normalizeAcpUsage(first).totalTokens).toBe(120)
    expect(normalizeAcpUsage(second, first)).toEqual({ inputTokens: 70, outputTokens: 10, cachedInputTokens: 40, totalTokens: 80 })
    expect(normalizeAcpUsage(first, second).totalTokens).toBeNull()
  })
})

describe('actual ACP stdio transport', () => {
  function client(): AcpClient {
    const script = join(dir, 'agent.cjs')
    writeFileSync(script, fakeServer)
    const connection: StudyConnection = { id: 'test', kind: 'custom', label: 'test', command: process.execPath, args: [script], status: 'disconnected' }
    const value = new AcpClient(connection, dir)
    clients.push(value)
    return value
  }
  it('negotiates auth, logs in and streams through a real spawned protocol process', async () => {
    const value = client()
    await value.initialize()
    expect(value.authMethods[0].id).toBe('account')
    await expect(value.authenticate('invented')).rejects.toThrow('未声明')
    await value.authenticate('account')
    const chunks: string[] = []
    const response = await value.prompt('study-main', 'hello', new AbortController().signal, text => chunks.push(text))
    expect(response.text).toBe('A real stdio reply')
    expect(chunks.join('')).toBe(response.text)
    expect(response.usage?.totalTokens).toBe(15)
  })
  it('cancels a live request and releases pending work', async () => {
    const value = client()
    await value.initialize()
    await value.authenticate('account')
    const controller = new AbortController()
    const response = value.prompt('study-main', 'wait', controller.signal, () => controller.abort())
    await expect(response).rejects.toThrow()
  })
  it('requires an actually connected adapter before selecting CLI mode', () => {
    const connections = new StudyConnections(new StudyStore(dir))
    expect(() => connections.select('unknown')).toThrow('先连接')
    connections.select(null)
    connections.close()
  })
})
