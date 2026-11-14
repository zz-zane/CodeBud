const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const http = require('node:http')
const net = require('node:net')
const root = path.resolve(__dirname, '..')
const out = process.env.MIAI_AI_QA_OUTPUT
const cli = process.env.MIAI_AI_QA_CLI
if (!out || !cli || !path.isAbsolute(out) || !fs.existsSync(cli)) throw Error('Set MIAI_AI_QA_OUTPUT and MIAI_AI_QA_CLI to isolated D: paths')
const qa = fs.mkdtempSync(path.join(out, 'run-'))
const data = path.join(qa, 'data'); fs.mkdirSync(path.join(data, 'ai-runtime', 'bin'), { recursive: true })
fs.copyFileSync(cli, path.join(data, 'ai-runtime', 'bin', 'claude.exe'))
const report = { ok: false, qa, requests: [], abortedRequests: [], steps: {}, errors: [] }
let child, socket, mock, exitPromise
const pending = new Map(); let nextId = 0
const pause = ms => new Promise(r => setTimeout(r, ms))
async function call(method, params={}) { return new Promise((resolve,reject) => { const id=++nextId; pending.set(id,{resolve,reject}); socket.send(JSON.stringify({id,method,params})) }) }
async function evaluate(expression) { const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true}); if(r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value }
async function until(expression, label, timeout=30000) { const end=Date.now()+timeout; while(Date.now()<end) { if(await evaluate(expression)) return; await pause(200) } throw Error(`Timed out: ${label}; ${JSON.stringify(await evaluate('document.body.innerText.slice(-1800)'))}`) }
async function main() {
  mock = http.createServer((req,res) => {
    const chunks=[]; req.on('data', b => chunks.push(b)); req.on('end', () => {
      let body; try { body=JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { res.writeHead(400); res.end(); return }
      report.requests.push(body)
      res.writeHead(200, {'content-type':'text/event-stream','cache-control':'no-cache'})
      const last=String(body.messages?.at(-1)?.content || '')
      const shouldDelay = last.includes('SWITCH_TEST') || (last.includes('CANCEL_TEST') && report.requests.filter(x => String(x.messages?.at(-1)?.content || '').includes('CANCEL_TEST')).length === 1)
      if (shouldDelay) { const marker = last.includes('CANCEL_TEST') ? 'CANCEL_TEST' : 'SWITCH_TEST'; const timer=setTimeout(() => res.end('data: [DONE]\n\n'), 10000); res.on('close',()=>{clearTimeout(timer); if (!res.writableEnded) report.abortedRequests.push(marker)}); return }
      res.write('data: '+JSON.stringify({id:'mock',choices:[{index:0,delta:{role:'assistant',content:'Mock reply '+report.requests.length+'：中文测试'},finish_reason:null}]})+'\n\n')
      res.end('data: '+JSON.stringify({id:'mock',choices:[{index:0,delta:{},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n')
    })
  })
  await new Promise(r => mock.listen(0,'127.0.0.1',r)); const upstreamPort=mock.address().port
  const config={version:20, theme:'system', soundEnabled:true, reviewEnabled:true, ai:{provider:'custom',protocol:'openai',baseUrl:`http://127.0.0.1:${upstreamPort}/v1`,model:'mock-model'}}
  fs.writeFileSync(path.join(data,'config.json'), JSON.stringify(config))
  const probe=net.createServer(); await new Promise(r => probe.listen(0,'127.0.0.1',r)); const port=probe.address().port; await new Promise(r => probe.close(r))
  const boot=path.join(qa,'launch.cjs')
  fs.writeFileSync(boot, `const {app,session}=require('electron'); app.setPath('userData',${JSON.stringify(data)}); app.setPath('sessionData',${JSON.stringify(data)}); app.whenReady().then(()=>session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(_,cb)=>cb({cancel:true}))); require(${JSON.stringify(path.join(root,'out/main/index.js'))})`)
  const env={...process.env,MIAI_DEBUG_PORT:String(port),TEMP:qa,TMP:qa}; delete env.ELECTRON_RUN_AS_NODE
  child=spawn(path.join(root,'node_modules/electron/dist/electron.exe'),[boot],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']})
  const log=fs.createWriteStream(path.join(qa,'electron.log')); child.stdout.pipe(log, {end:false}); child.stderr.pipe(log, {end:false})
  exitPromise=new Promise(r => child.once('exit',(code,signal)=>{report.exitCode=code;report.signal=signal;r()}))
  let page
  for(let i=0;i<150 && !page;i++) { try {const r=await fetch(`http://127.0.0.1:${port}/json/list`); page=(await r.json()).find(p=>p.type==='page' && p.webSocketDebuggerUrl)} catch {} if(!page) await pause(200) }
  assert(page,'No Electron page'); assert(page.url.startsWith('file:')); report.url=page.url
  socket=new WebSocket(page.webSocketDebuggerUrl); await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j})
  socket.onmessage=e=>{const msg=JSON.parse(e.data); if(msg.id && pending.has(msg.id)) {const p=pending.get(msg.id);pending.delete(msg.id); msg.error?p.reject(Error(JSON.stringify(msg.error))):p.resolve(msg.result)}}
  await call('Runtime.enable'); await call('Page.enable')
  await until("!!window.miai && !!document.querySelector('#app')?.__vue_app__",'app')
  await evaluate(`(async()=>{const s=document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('settings'); await s.updateAi({apiKey:'mock-qa-key'});})()`)
  await evaluate("location.hash='#/lesson/algo-s027'")
  await until("!!document.querySelector('.lesson-page')",'lesson')
  await evaluate("[...document.querySelectorAll('.tab-btn')].find(e=>e.innerText.includes('AI'))?.click()")
  await until("!!document.querySelector('.ai-textarea')",'AI panel')
  await until("document.querySelector('#app').__vue_app__.config.globalProperties.$pinia._s.get('aiAssistant').runtimeStatus?.installed",'CLI ready',45000)
  async function send(text) { await evaluate(`(()=>{const e=document.querySelector('.ai-textarea'); e.value=${JSON.stringify(text)}; e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));})()`); }
  await send('Explain arrays in one sentence')
  await until("document.querySelectorAll('.ai-message.assistant:not(.streaming)').length>=1",'first reply',90000)
  assert(report.requests.length>=1,'No upstream call'); report.steps.first=true
  await send('What about linked lists?')
  await until("document.querySelectorAll('.ai-message.assistant:not(.streaming)').length>=2",'second reply',90000)
  assert(report.requests.length>=2,'No second upstream call')
  assert(report.requests.at(-1).messages.some(m => String(m.content).includes('Explain arrays')), 'Resume did not send first question')
  assert(report.requests.at(-1).messages.some(m => String(m.content).includes('Mock reply')), 'Resume did not send first answer')
  report.steps.multiTurn=true
  await evaluate(`(()=>{const e=[...document.querySelectorAll('.lesson-page .markdown-body p')].find(x=>x.innerText.trim().length>4);if(!e) throw Error('No selectable paragraph');const range=document.createRange();range.selectNodeContents(e); const sel=getSelection();sel.removeAllRanges();sel.addRange(range); e.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:100,clientY:100}));})()`)
  await until("!!document.querySelector('.ai-context-menu')",'selection menu')
  await evaluate("document.querySelectorAll('.ai-context-menu .menu-item')[2].click()")
  await until("!!document.querySelector('.context-tag.selection')",'selection tag')
  await send('CANCEL_TEST')
  const waitRequests = async n => { const end=Date.now()+90000; while(report.requests.length<n && Date.now()<end) await pause(100); assert(report.requests.length>=n,'No expected upstream request') }
  await waitRequests(3)
  assert(report.requests.at(-1).messages.some(m => String(m.content).includes('CANCEL_TEST')))
  assert(report.requests.at(-1).messages.some(m => String(m.content).includes('\u5217\u8868')),'selection absent upstream')
  await until("!!document.querySelector('.stop-btn')",'stop button')
  await evaluate("document.querySelector('.stop-btn').click()")
  await until("!!document.querySelector('.retry-btn')",'retry button')
  await evaluate("document.querySelector('.retry-btn').click()")
  await waitRequests(4)
  await until("document.querySelectorAll('.ai-message.assistant:not(.streaming)').length>=4",'retry reply',90000)
  assert(report.abortedRequests.includes('CANCEL_TEST'),'cancel did not close upstream')
  report.steps.selectionCancelRetry=true
  await send('SWITCH_TEST')
  await waitRequests(5)
  await evaluate("document.querySelector('.new-chat').click()")
  await send('new session')
  await waitRequests(6)
  await until("document.querySelectorAll('.ai-message.assistant:not(.streaming)').length>=1",'new session reply',90000)
  const newText = await evaluate("document.querySelector('.ai-messages').innerText")
  assert(!newText.includes('SWITCH_TEST'),'old turn leaked into new session')
  assert(report.abortedRequests.includes('SWITCH_TEST'),'switch did not close upstream')
  report.steps.switchSession=true
  await evaluate('location.reload()')
  await until("!!document.querySelector('.tab-btn')",'reload lesson')
  await evaluate("[...document.querySelectorAll('.tab-btn')].find(e=>e.innerText.includes('AI'))?.click()")
  await until("!!document.querySelector('.ai-message')",'persisted messages after reload')
  assert((await evaluate("document.querySelector('.ai-messages').innerText")).includes('new session'))
  report.steps.reloadPersistence=true
  const shot=await call('Page.captureScreenshot',{format:'png'}); fs.writeFileSync(path.join(qa,'real-mock-chat.png'),Buffer.from(shot.data,'base64'))
  report.steps.uiScreenshot=true
  await evaluate('setTimeout(()=>window.close(),100); true'); await Promise.race([exitPromise,pause(10000)]); assert.equal(report.exitCode,0,'Electron did not close normally')
  socket.close(); socket = undefined
  child=spawn(path.join(root,'node_modules/electron/dist/electron.exe'),[boot],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']})
  child.stdout.pipe(log, {end:false}); child.stderr.pipe(log, {end:false})
  exitPromise=new Promise(r => child.once('exit',(code,signal)=>{report.restartExitCode=code;report.restartSignal=signal;r()}))
  page=undefined
  for(let i=0;i<150 && !page;i++) { try {const r=await fetch(`http://127.0.0.1:${port}/json/list`); page=(await r.json()).find(p=>p.type==='page' && p.webSocketDebuggerUrl)} catch {} if(!page) await pause(200) }
  assert(page,'No restarted Electron page')
  socket=new WebSocket(page.webSocketDebuggerUrl); await new Promise((r,j)=>{socket.onopen=r;socket.onerror=j})
  socket.onmessage=e=>{const msg=JSON.parse(e.data); if(msg.id && pending.has(msg.id)) {const p=pending.get(msg.id);pending.delete(msg.id); msg.error?p.reject(Error(JSON.stringify(msg.error))):p.resolve(msg.result)}}
  await call('Runtime.enable')
  await until('!!window.miai','restarted app')
  const saved=await evaluate('window.miai.aiAssistant.getSessions()')
  assert(saved.some(s=>s.messages.some(m=>m.content==='new session')),'new session not persisted after process restart')
  assert(saved.some(s=>s.messages.some(m=>m.content==='Explain arrays in one sentence')),'original session not persisted after process restart')
  report.steps.processRestartPersistence=true
  await evaluate('setTimeout(()=>window.close(),100); true'); await Promise.race([exitPromise,pause(10000)]); assert.equal(report.restartExitCode,0,'Restarted Electron did not close normally')
  report.ok=true
}
main().catch(e=>{report.errors.push(e.stack||String(e))}).finally(async()=>{
  if(socket) socket.close()
  if(child && child.exitCode===null) {child.kill(); await exitPromise}
  if(mock) await new Promise(r=>mock.close(r))
  fs.writeFileSync(path.join(qa,'report.json'),JSON.stringify(report,null,2)); console.log(JSON.stringify({ok:report.ok,qa,steps:report.steps,errors:report.errors,exitCode:report.exitCode,signal:report.signal},null,2)); process.exitCode=report.ok?0:1
})

