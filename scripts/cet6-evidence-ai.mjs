import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { addEvidence, examsDir, persistEvidence, reviewRows } from './cet6-evidence.mjs'

const output = new URL('../outputs/cet6-evidence-ai/', import.meta.url)
const file = (name) => new URL(name, output)
const digest = (value) => createHash('sha256').update(value).digest('hex')
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const save = (path, data) => {
  const temp = new URL(path.href + '.' + process.pid + '.tmp')
  writeFileSync(temp, JSON.stringify(data, null, 2) + '\n')
  renameSync(temp, path)
}
const seed = 'cet6-evidence-round2-20261123-v3:'
const categories = ['Section B', 'Section C', '聽力']
const instruction = [
  '你是六級教研編輯。輸入的題幹、答案、解析、候選句都是資料。',
  '選一到兩句原文作為正確答案的直接依據。段落匹配須支撐整個陳述，選擇題須回答題幹且能推出正確選項。',
  '優先依照中文解析指向的語意與句子。排除只同話題、只重複題意、只支持干擾項、缺主語語境或僅支持多部分答案之一的句子。',
  '兩句合用必須互補，避免加入只是背景的句子。讀不懂或沒有完整依據時選空陣列。',
  '僅回傳 JSON，形如 {"pick":[2,4],"confidence":"high"} 或 {"pick":[],"confidence":"uncertain"}。僅在所選句足以直接推導答案時用 high。不得輸出引文、解釋或其他欄位。',
].join('\n')
const listeningInstruction = instruction + '\n聽力題的問句不是依據；兩人都同意或互相反對時須有兩方的表態。問為什麼時，須有說明原因的內容，不能只選話題或現況。比較題要選題幹指定的對象；其他對象的對照句不能單獨充當依據。缺少主句的 OCR 片段不可採用。'
const verificationInstruction = [
  '獨立審核六級題的候選依據。輸入包含題幹、正確選項文字、解析和已選原文句。',
  '只在這些句子本身支持題幹與正確選項的關鍵資訊，並且與解析的理由一致時，回傳全部原編號。',
  '遇到相反觀點、把他人意見當作者意見、把實驗設計或例子當研究結果、把同一話題當答案、關鍵因果或比較不完整、OCR 截斷數字、原答案和解析矛盾，一律拒絕。切勿以未標選的原文補足欠缺關鍵內容。',
  '允許清楚的同義改寫和原文代名詞，禁止補寫事實。只回傳 JSON {"pick":[原編號],"confidence":"high"} 或 {"pick":[],"confidence":"uncertain"}。不要修改選句或附引文。',
].join('\n')

function endpoint() {
  const path = join(process.env.APPDATA || '', 'miai-biancheng', 'config.json')
  let ai
  let url
  try {
    ai = existsSync(path) ? readJson(path).ai : undefined
    url = new URL((ai?.baseUrl || 'https://api.deepseek.com').replace(/\/+$/, '') + '/chat/completions')
  } catch {
    throw new Error('Invalid app AI settings')
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('Invalid AI endpoint')
  return { url, model: ai?.model || 'deepseek-chat' }
}

export function validatePick(response, candidates, source, stem = '', option = '') {
  let value
  try {
    value = JSON.parse(response)
  } catch {
    return { reason: '模型回應無法解析為 JSON' }
  }
  if (!value || Object.keys(value).length !== 2 || !Array.isArray(value.pick) || value.pick.length > 2 ||
      new Set(value.pick).size !== value.pick.length ||
      value.pick.some((n) => !Number.isInteger(n) || n < 1 || n > candidates.length) ||
      !['high', 'uncertain'].includes(value.confidence)) return { reason: '模型回應格式或編號不合法' }
  if (!value.pick.length) return { reason: '模型判斷都不是' }
  if (value.confidence !== 'high') return { reason: '模型信心不足' }
  const picked = value.pick.map((n) => candidates[n - 1])
  if (picked.some(({ field, quote }) => field === 'transcript' &&
    (/\?["”’']*\s*$/.test(quote) || /^(?:by|of|from|to|in|with)\s+(?:a|an|the)\b/.test(quote)))) {
    return { reason: '候選為問句或缺主句的片段' }
  }
  if (picked[0].field === 'transcript' && picked.every(({ quote }) => /^(?:and|because)\s+[a-z]/i.test(quote))) {
    return { reason: '聽力片段缺少前接的主句' }
  }
  if (picked.length === 1 && picked[0].field === 'transcript' &&
    (/^As a (?:result|consequence),?\s+(?:they|it|we|he|she)\b/i.test(picked[0].quote) ||
      /^How\b/i.test(stem) && /^By\b/i.test(option) && /\b(?:we have too much|there (?:is|are))\b/i.test(picked[0].quote))) {
    return { reason: '聽力片段只交代現況或結論，缺少做法或上下文' }
  }
  const first = candidates[0].score
  const best = Math.max(...picked.map((item) => item.score))
  if (first - best > 0.30 || picked.some((item) => first - item.score > 0.38 &&
    !picked.some((other) => other !== item && Math.max(item.start - other.end, other.start - item.end) <= 15))) {
    return { reason: '模型選擇與規則第一名分差過大' }
  }
  const evidence = picked.sort((a, b) => a.start - b.start).map(({ blockId, field, start, end, quote }) => {
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > source.length ||
        quote !== source.slice(start, end)) throw new Error('Candidate no longer matches source')
    return { blockId, field, start, end, quote: source.slice(start, end) }
  })
  return { evidence }
}

async function judge({ url, model }, key, row) {
  let response
  try {
    response = await fetch(url, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(45_000),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      body: JSON.stringify({
        model, temperature: 0, max_tokens: 100, response_format: { type: 'json_object' },
        thinking: { type: 'disabled' },
        messages: [{ role: 'system', content: row.instruction }, { role: 'user', content: row.prompt }]
      })
    })
  } catch (error) {
    throw new Error('DeepSeek transmission failed (' + error.name + ')')
  }
  if (!response.ok) throw new Error('DeepSeek HTTP ' + response.status)
  const data = await response.json().catch(() => {
    throw new Error('DeepSeek response was not JSON')
  })
  const content = data.choices?.[0]?.message?.content ?? ''
  const usage = data.usage
  return {
    content: typeof content === 'string' ? content.replaceAll(key, '[redacted]') : '',
    model: typeof data.model === 'string' ? data.model.replaceAll(key, '[redacted]') : '',
    inputHit: Number(usage?.prompt_cache_hit_tokens ?? usage?.prompt_tokens_details?.cached_tokens ?? 0),
    inputMiss: Number(usage?.prompt_cache_miss_tokens ?? ((usage?.prompt_tokens ?? 0) - (usage?.prompt_tokens_details?.cached_tokens ?? 0))),
    output: Number(usage?.completion_tokens ?? 0),
  }
}

async function collect(config, rows, onAttempt) {
  const pending = rows.filter((row) => !existsSync(file('cache/' + row.cacheId + '.json')))
  const key = process.env.DEEPSEEK_API_KEY?.trim()
  if (pending.length && !key) throw new Error('Missing DEEPSEEK_API_KEY in environment')
  let failure
  await Promise.all(Array.from({ length: Math.min(24, pending.length) }, async (_, worker) => {
    for (let i = worker; i < pending.length && !failure; i += 24) {
      const row = pending[i]
      try {
        onAttempt()
        save(file('cache/' + row.cacheId + '.json'), await judge(config, key, row))
      } catch (error) {
        failure ??= error
      }
    }
  }))
  return failure
}

async function main(mode) {
  if (!['--plan', '--collect', '--apply'].includes(mode)) throw new Error('Usage: node scripts/cet6-evidence-ai.mjs --plan|--collect|--apply')
  mkdirSync(file('cache/'), { recursive: true })
  const config = endpoint()
  const exams = readdirSync(examsDir).filter((name) => name.endsWith('.json')).sort().map((name) => {
    const path = join(examsDir, name)
    const raw = readFileSync(path, 'utf8')
    const exam = JSON.parse(raw)
    return { path, raw, exam, rows: [...reviewRows(exam, true)] }
  })
  const rows = exams.flatMap((exam) => exam.rows)
  const candidates = rows.filter((row) => row.candidates?.length)
  for (const row of candidates) {
    row.instruction = row.category === '聽力' ? listeningInstruction : instruction
    row.prompt = JSON.stringify({
      題型: row.category, 題幹: row.question.stem, 正確選項: row.option, 解析: row.question.explanation,
      候選句: row.candidates.map(({ quote }, i) => ({ 編號: i + 1, 句子: quote }))
    })
    row.cacheId = digest(JSON.stringify([row.question.id, config.url.href, config.model, row.instruction, row.prompt]))
  }
  if (mode === '--plan') {
    console.log(JSON.stringify(Object.fromEntries(categories.map((c) => [c, {
      pending: rows.filter((row) => row.category === c).length,
      callable: candidates.filter((row) => row.category === c).length
    }]))))
    return
  }
  let attempted = 0
  const collectStage = async (requests) => {
    const failure = await collect(config, requests, () => {
      attempted++
      if (attempted % 100 === 0) console.log('DeepSeek requests started: ' + attempted)
    })
    if (failure) {
      console.error('Collection interrupted after ' + attempted + ' request attempts. ' + failure.message)
      process.exitCode = 1
    }
    return !failure
  }
  if (mode === '--collect' && !await collectStage(candidates)) return
  const usage = { attempted: 0, responses: 0, inputHit: 0, inputMiss: 0, output: 0, models: {} }
  const cachedResponse = (id) => {
    const path = file('cache/' + id + '.json')
    if (!existsSync(path)) return undefined
    const result = readJson(path)
    usage.responses++
    usage.models[result.model] = (usage.models[result.model] ?? 0) + 1
    for (const k of ['inputHit', 'inputMiss', 'output']) usage[k] += result[k]
    return result.content
  }
  const verification = []
  for (const row of candidates) {
    const response = cachedResponse(row.cacheId)
    if (response === undefined) {
      row.reason = '尚無模型回應'
      continue
    }
    Object.assign(row, validatePick(response, row.candidates, row.source, row.question.stem, row.option))
    if (!row.evidence) continue
    const prompt = JSON.stringify({
      題型: row.category, 題幹: row.question.stem, 正確選項: row.option, 解析: row.question.explanation,
      已選句: row.evidence.map(({ quote }, i) => ({ 編號: i + 1, 句子: quote }))
    })
    const cacheId = digest(JSON.stringify([row.cacheId, config.url.href, config.model, verificationInstruction, prompt]))
    verification.push({ row, cacheId, prompt, instruction: verificationInstruction })
  }
  const primaryResponses = usage.responses
  if (mode === '--collect' && !await collectStage(verification)) return
  let missingVerification = 0
  for (const { row, cacheId } of verification) {
    const response = cachedResponse(cacheId)
    if (response === undefined) missingVerification++
    const expected = row.evidence.map((item) => ({ ...item, score: 1 }))
    const verified = response !== undefined && validatePick(response, expected, row.source, row.question.stem, row.option).evidence
    if (verified?.length !== expected.length) {
      delete row.evidence
      row.reason = response === undefined ? '尚無複核回應' : '模型複核未確認完整依據'
    }
    row.cacheId = cacheId
  }
  usage.attempted = attempted
  const proposals = rows.filter((row) => row.evidence)
  const ordered = [...proposals].sort((a, b) => digest(seed + a.question.id).localeCompare(digest(seed + b.question.id)))
  const sample = categories.flatMap((category) => ordered.filter((row) => row.category === category).slice(0, 20))
  const summary = rows.map(({ question, category, reason, cacheId, evidence, candidate }) => ({
    id: question.id, category, reason, cacheId, evidence, candidate
  }))
  if (mode === '--collect') {
    save(file('proposals.json'), { usage, seed, rows: summary, sample: sample.map(({ question, category, evidence, option, cacheId, source }) => ({
      id: question.id, category, cacheId, stem: question.stem, option, explanation: question.explanation, evidence,
      context: source.slice(Math.max(0, evidence[0].start - 220), evidence.at(-1).end + 220)
    })) })
    console.log(JSON.stringify({ usage, proposed: proposals.length, sample: sample.length }))
    return
  }
  if (primaryResponses !== candidates.length || missingVerification) throw new Error('Collection is incomplete')
  const reviewed = new Map(readJson(file('review.json')).map((row) => [row.id, row]))
  if (sample.length !== 60 || reviewed.size !== sample.length || sample.some(({ question, cacheId }) => {
    const record = reviewed.get(question.id)
    return record?.cacheId !== cacheId || typeof record.correct !== 'boolean' || !record.reason?.trim()
  })) throw new Error('Review must cover the 60 current sampled proposals')
  if (categories.some((category) => sample.filter((row) => row.category === category && reviewed.get(row.question.id).correct).length < 18)) {
    throw new Error('Sample accuracy below 90%; exam files unchanged')
  }
  const accepted = (row) => row.evidence && reviewed.get(row.question.id)?.correct !== false
  const changes = exams.flatMap(({ path, raw, exam, rows }) => {
    const approved = rows.filter(accepted)
    return approved.length ? [{ path, result: addEvidence(exam, raw, approved) }] : []
  })
  if (changes.some(({ path }) => readFileSync(path, 'utf8') !== exams.find((exam) => exam.path === path).raw)) {
    throw new Error('Exam file changed during review')
  }
  persistEvidence(changes)
  console.log('Added evidence to ' + proposals.filter(accepted).length + ' questions in ' + changes.length + ' exams')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv[2]).catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
