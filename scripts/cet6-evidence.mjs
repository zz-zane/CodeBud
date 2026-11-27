import { existsSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const examsDir = fileURLToPath(new URL('../content/cet6/exams/', import.meta.url))
const word = /[a-z]+(?:['‘’ʼ‛‟＇][a-z]+)?|\d+(?:[.,]\d+)?/gi
const normalize = (token) => token.toLowerCase().replace(/[‘’ʼ‛‟＇]/g, "'")
const tokens = (text) => [...text.matchAll(word)].map((m) => normalize(m[0]))
const stop = new Set(tokens("a an the this that these those i you he she it we they me him her us them my your his its our their who whose whom what which where when why how in on for from to of with by at as is am are was were be been being do did does have has had can could should would may might will must about up out into over than and or but so then there here some any many much more most very such all just also only question passage author speaker man woman says say learn according following"))

export function matchQuote(source, quote) {
  const words = [...source.matchAll(word)]
  const input = words.map((m) => normalize(m[0]))
  const parts = quote.split(/(?:\s*\.){3,}|…+/).map(tokens).filter((part) => part.length)
  if (!parts.length) return []
  const find = (part, from, limit) => {
    for (let i = from; i <= limit && i + part.length <= input.length; i++) {
      if (part.every((token, index) => token === input[i + index])) return i
    }
    return -1
  }
  const matches = []
  for (let first = find(parts[0], 0, input.length); first >= 0; first = find(parts[0], first + 1, input.length)) {
    let next = first + parts[0].length
    for (const part of parts.slice(1)) {
      const index = find(part, next, next + 35)
      if (index < 0) {
        next = -1
        break
      }
      next = index + part.length
    }
    if (next > 0) matches.push({ start: words[first].index, end: words[next - 1].index + words[next - 1][0].length })
  }
  return matches
}

const marker = /(?:[（(]\s*(\d{1,2})(?:\s*[-–]\s*\d)?\s*[）)]|[［\[]\s*(\d{1,2})(?:\s*[-–]\s*\d)?\s*[］\]])/g
function sentences(text, offset) {
  const clean = text.replace(/·(?=\s*[（(]\s*\d)/g, '.').replace(marker, (s) => ' '.repeat(s.length))
    .replace(/(?<=\d)[.,](?=\s*\d{3}\b)|\.(?=\s+depicting\b)/g, ' ')
    .replace(/\bPh\.\s*D\./gi, (s) => s.replaceAll('.', ' '))
    .replace(/\b(?:Mr|Mrs|Ms|Dr|Prof|St|vs|etc)\./gi, (s) => s.replace('.', ' '))
    .replace(/\b(?:[A-Z]\.){1,}(?=\s+[A-Z])|\b(?:[A-Z]\.){2,}/g, (s) => s.replaceAll('.', ' '))
  const boundaries = /[.!?。！？]+["”’')\]]*(?=\s|$)|(?<=\S)(?=\s+[MW]:)|(?<=\w)(?=\s+For this age group,)|\n\s*\n/g
  const result = []
  let cursor = 0
  for (const boundary of [...clean.matchAll(boundaries), { index: clean.length, 0: '' }]) {
    const end = boundary.index + boundary[0].trimEnd().length
    const span = clean.slice(cursor, end)
    const start = cursor + span.match(/^(?:\s*\d*\s*•听力原文•)?[\s@•·\p{Script=Han}]*(?:[MW]:\s*)?/u)[0].length
    const trimmedEnd = cursor + span.trimEnd().length
    const quote = text.slice(start, trimmedEnd)
    if (trimmedEnd > start && tokens(quote).length) {
      const numbers = [...text.slice(cursor, trimmedEnd).matchAll(marker)].map((m) => Number(m[1] ?? m[2]))
      result.push({ start: offset + start, end: offset + trimmedEnd, quote, numbers })
    }
    cursor = end
  }
  return result
}

function sentenceHints(explanation, pool) {
  const local = explanation.replace(/(?:上一段|下一段|上段|下段)(?:的)?[^，。；,;]{0,10}?句/g, '')
  const ordinals = [...local.matchAll(/(?:倒数|倒數)?第\s*([一二三四五六七八九十\d]+)\s*(?:[、，和及与與]\s*(?:第\s*)?([一二三四五六七八九十\d]+)\s*)?句|([①②③④⑤⑥⑦⑧⑨⑩]{1,2})\s*句|(首|末|最后一|最後一)句|前[两兩二]句/g)]
    .flatMap((m) => {
      if (m[1]) return [m[1], m[2]].filter(Boolean).map((n) => /^倒/.test(m[0]) ? pool.length + 1 - ordinal(n) : ordinal(n))
      if (m[3]) return [...m[3]].map((n) => n.codePointAt(0) - 0x245f)
      if (m[4]) return [m[4] === '首' ? 1 : pool.length]
      return [1, 2]
    })
  return [...new Set(ordinals)].map((index) => pool[index - 1]).filter(Boolean)
}

function matchingParagraph(text, letter) {
  const cuts = []
  let cursor = 0
  // Follow the same label order as parseMatchingPassage, keeping original offsets.
  for (const key of 'ABCDEFGHIJKLMNOPQRST') {
    const before = key === 'A' ? '(?:^|\\s)' : '(?:^|\\n|[.?!"”’):．。…]\\s+)'
    const label = new RegExp(before + '\\s*(\\[' + key + '\\]\\.?|' + key + '[).）．])\\s*(?=[A-Zl“"‘' + "'" + '])', 'g')
    label.lastIndex = cursor
    const match = label.exec(text)
    if (!match) continue
    cursor = label.lastIndex
    cuts.push({ key, start: cursor, labelStart: match.index + match[0].lastIndexOf(match[1]) })
  }
  const index = cuts.findIndex((cut) => cut.key === letter)
  if (index < 0) return []
  const start = cuts[index].start
  return sentences(text.slice(start, cuts[index + 1]?.labelStart), start)
}

const digits = '一二三四五六七八九'
function ordinal(value) {
  if (/^\d+$/.test(value)) return Number(value)
  const [tens, units] = value.split('十')
  return units === undefined ? digits.indexOf(tens) + 1
    : 10 * (tens ? digits.indexOf(tens) + 1 : 1) + (units ? digits.indexOf(units) + 1 : 0)
}

function passageSentences(text, explanation, listening) {
  if (listening) return sentences(text, 0)
  const breaks = [...text.matchAll(/\n(?:[ \t]*\n)+|\n(?<=[.!?。！？"”’]\n)(?=[ \t]*[A-Z“"‘])/g)]
  const starts = [0, ...breaks.map((m) => m.index + m[0].length)]
  const hints = [...explanation.matchAll(/(倒数|倒數)?第\s*([一二三四五六七八九十\d]+)\s*段|(首|末|最后|最後)段|最后一段|最後一段/g)]
    .map((m) => m[2] ? (m[1] ? starts.length + 1 - ordinal(m[2]) : ordinal(m[2])) : m[3] === '首' ? 1 : starts.length)
  const allowed = new Set(hints)
  return starts.flatMap((start, i) => {
    if (allowed.size && !allowed.has(i + 1)) return []
    return sentences(text.slice(start, starts[i + 1]), start).map((sentence) => ({ ...sentence, paragraph: i + 1 }))
  })
}

const contentWords = (text) => new Set(tokens(text).filter((token) => !stop.has(token) && token.length > 2)
  .map((token) => token.length > 4 ? token.replace(/(?:ies|ing|ed|s)$/, (s) => s === 'ies' ? 'y' : '') : token))

function rank(candidates, query) {
  const vocabulary = contentWords(query)
  const rows = candidates.map((candidate) => ({ ...candidate, words: contentWords(candidate.quote) }))
  const weights = new Map([...vocabulary].map((token) => [
    token, 1 / Math.sqrt(Math.max(1, rows.filter((row) => row.words.has(token)).length))
  ]))
  const total = [...weights.values()].reduce((sum, weight) => sum + weight, 0)
  return rows.map(({ words, ...candidate }) => {
    const shared = [...vocabulary].filter((token) => words.has(token))
    const overlap = shared.reduce((sum, token) => sum + weights.get(token), 0)
    return { ...candidate, shared: shared.length, score: total ? overlap / total : 0 }
  }).sort((a, b) => b.score - a.score)
}

function explanationQuotes(explanation, stem, option) {
  const exclusions = [stem, option].filter(Boolean)
  const runs = explanation.match(/[a-z][a-z0-9 \t\r\n,.:!?()[\]'"‘’“”ʼ‛‟\-–—…/]*[a-z0-9]/gi) ?? []
  return runs.filter((phrase) => tokens(phrase).length >= 4 && contentWords(phrase).size >= 2 &&
    !exclusions.some((value) => matchQuote(value, phrase).length))
}

function locate(section, question, category, forAi) {
  const listening = category === '聽力'
  const matching = category === 'Section B'
  const block = section.blocks?.find((item) => item.id === question.blockId)
  const field = listening ? 'transcript' : 'text'
  const text = block?.[field]
  if (!text?.trim()) return { reason: listening ? '缺聽力原文' : '缺閱讀原文' }
  if (listening && /^听力录音音频已在上方/.test(text.trim())) return { reason: '聽力原文為占位文字' }
  const related = section.questions.filter((q) => q.blockId === block.id)
  const first = Math.min(...related.map((q) => q.number))
  const body = listening ? text : text.split(new RegExp('\\n\\s*' + first + '\\s*[.．]\\s+(?=[A-Z])'))[0]
  const answer = question.answer?.trim().toUpperCase()
  const explanation = (question.explanation ?? '').split(/排除干扰|错误选项|全文翻译|【避错】|【原文定位·自动匹配】|【正确选项】|【标注】|[A-D]\s*[）)]\s*(?:将|與|与|利用|源于|偷换|混淆|歪曲|只是|均)/)[0]
  const option = question.options?.find((choice) => choice.key === answer)?.text ?? ''
  const stem = (question.stem ?? '').split(/[（(]/)[0]
  const scoped = matching ? matchingParagraph(body, answer) : passageSentences(body, explanation, listening)
  // OCR hard wraps can shift apparent paragraph numbers. Keep a few global candidates for those cases.
  const pool = forAi && !matching && !listening ? passageSentences(body, '', false) : scoped
  const candidates = pool.filter((candidate) => candidate.quote.length <= 550 && tokens(candidate.quote).length >= 5 &&
    !candidate.numbers.some((n) => n !== question.number && related.some((q) => q.number === n)))
  const ordered = rank(candidates, matching ? stem : option)
  const [best, second] = ordered
  if (!best || !answer || question.unanswerable) return { reason: '缺少可定位的段落、句子或答案', candidate: best?.quote }
  const clarification = explanation.split(/详解\s*[：:]?|精析[】\]]|锁定答案[】\]]/).slice(1).join('\n')
  const quoted = [...explanationQuotes(explanation, stem, option), ...explanationQuotes(clarification, stem, option)]
    .flatMap((phrase) => {
      const hits = matchQuote(body, phrase)
      const hitsInScope = hits.filter((hit) => candidates.some((c) => c.start < hit.end && c.end > hit.start))
      if (hitsInScope.length !== 1) return []
      const covered = candidates.filter((c) => c.start < hitsInScope[0].end && c.end > hitsInScope[0].start)
      return covered.length <= 2 ? covered.map((c) => ({
        ...c, length: tokens(phrase).length, clarified: clarification.includes(phrase),
      })) : []
    }).sort((a, b) => Number(b.clarified) - Number(a.clarified) || b.length - a.length)
  const shortlist = quoted.filter((item) => {
    const row = ordered.find((candidate) => candidate.start === item.start)
    return item.length >= 6 && (!listening || item.length >= 12 || row.shared >= 1) ||
      row.shared >= 2 || matching && item.clarified && item.length >= 4
  })
  const marked = ordered.filter((candidate) => candidate.numbers.includes(question.number))
  const paragraph = new Set(scoped.map((candidate) => candidate.paragraph))
  const hinted = !listening && (matching || paragraph.size === 1 && /段/.test(explanation))
    ? sentenceHints(explanation, scoped).filter((item) => candidates.some(({ start }) => start === item.start)) : []
  if (forAi) {
    const lexical = rank(candidates, stem + ' ' + option)
    const optionScores = new Map(ordered.map((item) => [item.start, item.score]))
    const adjacent = new Set(marked.flatMap((item) => {
      const index = pool.findIndex((sentence) => sentence.start === item.start)
      return [pool[index - 1]?.start, pool[index + 1]?.start, pool[index + 2]?.start]
    }))
    const strong = new Set([...shortlist, ...marked, ...hinted].map((item) => item.start))
    const preferred = new Set(scoped.map((item) => item.start))
    const paragraphBonus = preferred.size < pool.length ? 0.10 : 0
    const ranked = lexical.map((item) => ({
      ...item,
      score: Math.max(item.score, optionScores.get(item.start) * 0.85) +
        (strong.has(item.start) ? 0.36 : adjacent.has(item.start) ? 0.22 : 0) +
        (preferred.has(item.start) ? paragraphBonus : 0)
    })).sort((a, b) => b.score - a.score).slice(0, 5)
    return {
      option,
      source: text,
      candidates: ranked.map(({ start, end, quote, score }) => ({
        blockId: block.id, field, start, end, quote, score
      }))
    }
  }
  let selected = shortlist.filter((item) => item.length === shortlist[0].length && item.clarified === shortlist[0].clarified)
  if (matching && shortlist[0]?.clarified && /对应|對應|同义|同義/.test(clarification)) {
    const distinctQuotes = [...new Map(shortlist.filter((item) => item.clarified).map((item) => [item.start, item])).values()]
    if (distinctQuotes.length === 2) selected = distinctQuotes
  }
  if (matching && selected.length === 1 && /先说\s*明[\s\S]{0,100}随后/.test(explanation)) {
    const secondQuote = shortlist.find((item) => item.start > selected[0].start)
    if (secondQuote) selected.push(secondQuote)
  }
  let confidence = '高（解析引文）'
  const namedPerson = stem.match(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g) ?? []
  const hintSupported = hinted.some((item) => ordered.some((row) => row.start === item.start && row.shared >= 2))
  const hintMatchesQuote = selected.length && selected.every((item) => hinted.some((hint) => hint.start === item.start))
  if (hinted.length && hinted.length <= 2 &&
    (matching || /第.{1,6}段|首段|末段|最后一段|最後一段/.test(explanation) &&
      namedPerson.every((name) => pool.some((item) => matchQuote(item.quote, name).length))) &&
    (hintMatchesQuote || !selected.length && (hintSupported || marked.some((item) => hinted.some((hint) => hint.start === item.start))))) {
    selected = hinted
    confidence = '中（解析句序）'
  }
  if (!selected.length && marked.length === 1 && (matching || marked[0].shared >= 2 ||
    new RegExp('句\\s*[（(]\\s*' + question.number + '\\s*[）)]').test(explanation) &&
    (marked[0].shared >= 1 || tokens(marked[0].quote).length >= 12))) {
    selected = marked
    confidence = '高（原文題號）'
  }
  if (!selected.length && best.shared >= (matching ? 3 : 4) &&
      best.score >= (matching ? 0.56 : 0.65) && best.score - (second?.score ?? 0) >= 0.16) {
    selected = [best]
    confidence = '中（詞重疊）'
  }
  const bestWords = contentWords(best.quote)
  const substantive = [...contentWords(option)].filter((token) => !/^(?:year|recent|industry)$/.test(token) && bestWords.has(token))
  if (!selected.length && !matching && !listening && /段/.test(explanation) && paragraph.size === 1 && substantive.length >= 2) {
    const [located, alternative] = rank(candidates, stem + ' ' + option)
    if (located.start === best.start && located.shared >= 4 && located.score >= 0.55 &&
        located.score - (alternative?.score ?? 0) >= 0.20) {
      selected = [located]
      confidence = '中（段落提示及詞重疊）'
    }
  }
  if (matching && selected.length === 1) {
    const first = pool.findIndex((candidate) => candidate.start === selected[0].start)
    const adjacent = candidates.find((candidate) => candidate === pool[first - 1])
    const connectsBack = /這兩處|这两处|两处信/.test(explanation) &&
      /^(?:Meeting this|This demand|This means|That means)/i.test(selected[0].quote)
    const supplements = /[继繼]而指出/.test(explanation) &&
      ordered.some((row) => row.start === adjacent?.start && row.shared >= 2)
    if (adjacent && (connectsBack || supplements)) {
      selected = [adjacent, selected[0]]
    }
    const next = pool[first + 1]
    if (selected.length === 1 && candidates.includes(next) && /[紧緊]接[着著]的第二句/.test(clarification) && first === 0) {
      selected.push(next)
    }
  }
  if (!selected.length) return { reason: '引文或詞重疊不足', candidate: best.quote }
  if (!matching) {
    const numberKeys = (source) => [...source.replace(marker, '').matchAll(/\b\d{2,}(?:[.,]\s*\d{3}\b)*/g)]
      .map((m) => m[0].replace(/\D/g, ''))
    const expected = numberKeys(option)
    const present = (items) => expected.every((number) => items.some((item) => numberKeys(item.quote).includes(number)))
    if (!present(selected)) {
      const next = pool[pool.findIndex((item) => item.start === selected[0].start) + 1]
      if (listening && confidence === '高（原文題號）' && selected.length === 1 &&
          candidates.includes(next) && present([next])) selected.push(next)
      else return { reason: '候選句的數字無法佐證正確選項', candidate: selected[0].quote }
    }
  }
  const distinct = [...new Map(selected.map((item) => [item.start, item])).values()]
  if (distinct.length > 2) return { reason: '引文指向多句', candidate: best.quote }
  return {
    confidence,
    evidence: distinct.sort((a, b) => a.start - b.start).map(({ start, end, quote }) => ({
      blockId: block.id, field, start, end, quote
    }))
  }
}

export function* reviewRows(exam, forAi = false) {
  for (const section of exam.sections) {
    for (const question of section.questions ?? []) {
      const category = section.type === 'listening' && question.kind === 'single-choice' ? '聽力'
        : section.type === 'reading' && question.kind === 'matching' ? 'Section B'
          : section.type === 'reading' && question.kind === 'single-choice' ? 'Section C' : null
      if (category && (!forAi || !Object.hasOwn(question, 'evidence'))) {
        yield { category, question, ...locate(section, question, category, forAi) }
      }
    }
  }
}

export function checkExam(exam) {
  const errors = []
  for (const section of exam.sections) {
    for (const question of section.questions ?? []) {
      if (!Object.hasOwn(question, 'evidence')) continue
      if (!Array.isArray(question.evidence)) {
        errors.push(question.id + ' evidence must be an array')
        continue
      }
      for (const entry of question.evidence) {
        const { blockId, field, start, end, quote } = entry ?? {}
        const block = section.blocks?.find((item) => item.id === blockId)
        const source = field === 'text' || field === 'transcript' ? block?.[field] : undefined
        if (typeof source !== 'string' || !Number.isInteger(start) || !Number.isInteger(end) ||
          start < 0 || start >= end || end > source.length || quote !== source.slice(start, end)) {
          errors.push(question.id + ' invalid evidence for ' + blockId + '/' + field + ' [' + start + ', ' + end + ')')
        }
      }
    }
  }
  return errors
}

function withEvidence(raw, rows) {
  const byId = new Map(rows.map(({ question, evidence }) => [question.id, { question, evidence }]))
  const updated = new Set()
  // The exam fixtures use ten spaces for question properties. Preserve every other line verbatim.
  const result = raw.replace(/^ {10}"id": "([^"]+)",\r?\n[\s\S]*?(?=^ {8}\},?\r?$)/gm, (body, id) => {
    const row = byId.get(id)
    if (!row) return body
    if (updated.has(id)) throw new Error('Duplicate question ' + id)
    updated.add(id)
    const newline = body.includes('\r\n') ? '\r\n' : '\n'
    const formatted = JSON.stringify(row.evidence, null, 2).replace(/\n/g, newline + ' '.repeat(10))
    return body.slice(0, -newline.length) + ',' + newline + '          "evidence": ' + formatted + newline
  })
  if (updated.size !== byId.size) throw new Error('Unexpected question layout')
  return result
}

export function persistEvidence(changes) {
  for (const { path, result } of changes) {
    const temporary = path + '.' + process.pid + '.tmp'
    writeFileSync(temporary, result, { flag: 'wx' })
    renameSync(temporary, path)
  }
}

export function addEvidence(exam, raw, rows) {
  for (const { question, evidence } of rows) {
    if (Object.hasOwn(question, 'evidence') || !evidence?.length) throw new Error('Expected new evidence for ' + question.id)
  }
  const result = withEvidence(raw, rows)
  for (const { question, evidence } of rows) question.evidence = evidence
  const parsed = JSON.parse(result)
  if (JSON.stringify(parsed) !== JSON.stringify(exam)) throw new Error('Unexpected exam changes in ' + exam.id)
  const errors = checkExam(parsed)
  if (errors.length) throw new Error(errors.join('\n'))
  return result
}

function main(mode, set = 'cet6') {
  if (mode !== '--check' && mode !== '--write') throw new Error('Usage: node scripts/cet6-evidence.mjs --check|--write [cet6|cet4]')
  if (!/^cet[46]$/.test(set)) throw new Error('Unknown set: ' + set)
  const examsDir = fileURLToPath(new URL('../content/' + set + '/exams/', import.meta.url))
  if (!existsSync(examsDir)) return console.log('content/' + set + ' 不存在，略过')
  const files = readdirSync(examsDir).filter((name) => name.endsWith('.json')).sort()
  const errors = []
  const changes = []
  for (const name of files) {
    const path = join(examsDir, name)
    const raw = readFileSync(path, 'utf8')
    const exam = JSON.parse(raw)
    if (mode === '--check') {
      errors.push(...checkExam(exam))
      continue
    }
    const rows = [...reviewRows(exam)].filter(({ question, evidence }) => !Object.hasOwn(question, 'evidence') && evidence)
    const result = addEvidence(exam, raw, rows)
    if (result !== raw) changes.push({ path, result })
  }
  if (errors.length) throw new Error(errors.join('\n'))
  persistEvidence(changes)
  console.log('CET-' + set.slice(3) + ' evidence: ' + files.length + ' exams checked, ' + changes.length + ' files written')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv[2], process.argv[3])
