import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  makeExamId,
  makeExamTitle,
  parseChoiceQuestions,
  parseDirMeta,
  parseKeysSection,
  parseSharedAudioTargetSet,
  sortMetas,
  unwrapLines,
} from './cet4-import.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

test('parseDirMeta parses single and combined directories', () => {
  assert.deepEqual(parseDirMeta('2024.12 第1套'), {
    dirName: '2024.12 第1套',
    year: 2024,
    month: 12,
    sets: [1],
    isCombined: false,
  })
  assert.deepEqual(parseDirMeta('2022.09 第2-3套'), {
    dirName: '2022.09 第2-3套',
    year: 2022,
    month: 9,
    sets: [2, 3],
    isCombined: true,
  })
  assert.equal(makeExamId(2024, 12, 1), '2024-12-1')
  assert.equal(makeExamTitle(2024, 12, 1), '2024年12月 第1套')
})

test('sortMetas orders year desc, month desc, set asc', () => {
  const sorted = sortMetas([
    { id: '2024-06-2', year: 2024, month: 6, set: 2 },
    { id: '2024-12-2', year: 2024, month: 12, set: 2 },
    { id: '2024-12-1', year: 2024, month: 12, set: 1 },
    { id: '2025-06-1', year: 2025, month: 6, set: 1 },
  ])
  assert.deepEqual(
    sorted.map((x) => x.id),
    ['2025-06-1', '2024-12-1', '2024-12-2', '2024-06-2']
  )
})

test('parseChoiceQuestions handles two-column A C B D layout and sorts options', () => {
  const raw = `
2. A) The importance of their service to the city.
C) The new proclamation issued early this week.
B) The number of riders they serve in the city.
D) The significance of the event to take place March 18.
`
  const qs = parseChoiceQuestions(raw, 1, 25)
  assert.deepEqual(
    qs.get(2).options.map((o) => o.key),
    ['A', 'B', 'C', 'D']
  )
  assert.equal(qs.get(2).options[1].text, 'The number of riders they serve in the city.')
})

test('parseKeysSection extracts question-answer pairs from multi-column KEYS', () => {
  const raw = `
KEYS
Part II
1
D
11
B
21
D
`
  const ans = parseKeysSection(raw)
  assert.equal(ans.get(1), 'D')
  assert.equal(ans.get(11), 'B')
  assert.equal(ans.get(21), 'D')
})

test('unwrapLines joins hard wraps cleanly without extra space between CJK', () => {
  assert.equal(unwrapLines('中国政府十分\n重视环境保护。\n\n第二段。'), '中国政府十分重视环境保护。\n\n第二段。')
  assert.equal(unwrapLines('Hello\nworld.'), 'Hello world.')
})

test('parseSharedAudioTargetSet extracts target set rather than self set', () => {
  const note3to1 = '本套（第3套）听力与第1套相同，没有单独的听力录音。\n请使用同场次「2026.06 第1套」文件夹中的 听力.mp3。'
  assert.equal(parseSharedAudioTargetSet(note3to1, 3), 1)
  const note3to2 = '本套（第3套）听力与第2套相同，没有单独的听力录音。\n请使用同场次「2024.12 第2套」文件夹中的 听力.mp3。'
  assert.equal(parseSharedAudioTargetSet(note3to2, 3), 2)
})

test('all generated CET-4 exams in content/cet4 satisfy the data contract', () => {
  const indexPath = path.join(ROOT, 'content', 'cet4', 'index.json')
  assert.equal(fs.existsSync(indexPath), true)
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'))
  assert.ok(index.length >= 1)

  const idSet = new Set(index.map((m) => m.id))
  assert.equal(idSet.size, index.length, 'duplicate exam ids in index.json')

  let totalObj = 0
  let totalVerified = 0

  for (let i = 0; i < index.length; i++) {
    const meta = index[i]
    assert.match(meta.id, /^\d{4}-\d{2}-\d$/)
    assert.equal(meta.file, `exams/${meta.id}.json`)
    if (i > 0) {
      const prev = index[i - 1]
      const ordered =
        prev.year * 100 + prev.month > meta.year * 100 + meta.month ||
        (prev.year === meta.year && prev.month === meta.month && prev.set < meta.set)
      assert.equal(ordered, true, `index order violated between ${prev.id} and ${meta.id}`)
    }

    const examPath = path.join(ROOT, 'content', 'cet4', meta.file)
    assert.equal(fs.existsSync(examPath), true, `missing ${meta.file}`)
    const exam = JSON.parse(fs.readFileSync(examPath, 'utf8'))
    assert.equal(exam.id, meta.id)
    assert.deepEqual(
      exam.sections.map((s) => s.type),
      ['writing', 'listening', 'reading', 'translation']
    )

    const listening = exam.sections[1]
    if (listening.sharedWithExamId) {
      assert.notEqual(listening.sharedWithExamId, exam.id, `${exam.id} shared listening must not point to itself`)
      assert.ok(idSet.has(listening.sharedWithExamId), `${exam.id} shared listening missing target`)
      assert.equal(listening.audio, null)
    } else {
      assert.ok(listening.audio?.src?.startsWith('source-media/'), `${exam.id} missing audio.src`)
      assert.deepEqual(
        listening.blocks.map((b) => b.title),
        [
          'News Report One',
          'News Report Two',
          'News Report Three',
          'Conversation One',
          'Conversation Two',
          'Passage One',
          'Passage Two',
          'Passage Three',
        ]
      )
      assert.equal(listening.questions.length, 25, `${exam.id} listening questions != 25`)
    }

    const reading = exam.sections[2]
    if (reading.sharedWithExamId) {
      assert.notEqual(reading.sharedWithExamId, exam.id, `${exam.id} shared reading must not point to itself`)
      assert.ok(idSet.has(reading.sharedWithExamId), `${exam.id} shared reading missing target`)
    } else {
      assert.equal(reading.questions.length, 30, `${exam.id} reading questions != 30`)
      const wordBank = reading.questions.filter((q) => q.kind === 'word-bank')
      assert.equal(wordBank.length, 10, `${exam.id} word-bank != 10`)
      const secABlock = reading.blocks.find((b) => b.id === 'reading-sec-a-passage')
      if (exam.status === 'ready') {
        for (const q of wordBank) {
          assert.equal(q.options.length, 15, `${exam.id} q${q.number} word-bank options != 15`)
          assert.ok(secABlock.text.includes(`__(${q.number})__`), `${exam.id} missing blank __(${q.number})__`)
        }
      }
      const matching = reading.questions.filter((q) => q.kind === 'matching')
      assert.equal(matching.length, 10, `${exam.id} matching != 10`)
      if (exam.status === 'ready') {
        const secBBlock = reading.blocks.find((b) => b.id === 'reading-sec-b-passage')
        const paraLabels = [...secBBlock.text.matchAll(/(?:^|\n)\[([A-T])\]\s+/g)].map((m) => m[1])
        assert.ok(paraLabels.length >= 5, `${exam.id} matching paragraphs < 5`)
      }
    }

    const objective = exam.sections
      .flatMap((s) => s.questions || [])
      .filter((q) => q.kind !== 'essay' && q.kind !== 'translation')
    for (const q of objective) {
      totalObj++
      if (q.verified) totalVerified++
      if (q.answer !== null && q.answer !== undefined) {
        assert.ok(
          q.options.some((o) => o.key === q.answer),
          `${exam.id} q${q.number} answer ${q.answer} not in options`
        )
      }
    }

    if (!reading.sharedWithExamId) {
      const wordBank = reading.questions.filter((q) => q.kind === 'word-bank')
      assert.equal(wordBank.length, 10, `${exam.id} word-bank count`)
      if (wordBank.every((q) => q.answer)) {
        const answers = wordBank.map((q) => q.answer)
        assert.equal(
          new Set(answers).size,
          10,
          `${exam.id} duplicate word-bank answers: ${answers.join(',')}`
        )
      }
    }

    if (exam.id.startsWith('2018-12-')) {
      for (const q of reading.questions) {
        assert.ok(q.explanation && q.explanation.trim().length > 0, `${exam.id} q${q.number} explanation empty`)
      }
    }
  }
  assert.ok(totalObj > 0 && totalVerified > 0)
})

test('generated CET-4 exams contain no leaked headers, table borders, or HTML tags', () => {
  const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'cet4', 'index.json'), 'utf8'))
  const forbidden = [
    /Questions \d+ (?:and|to) \d+ are based/,
    /#####/,
    /:---/,
    /---$/,
    /<div\b/i,
    /<\/?u>/i,
    /\uFFFD/,
  ]
  const checkStr = (examId, loc, val) => {
    if (!val || typeof val !== 'string') return
    for (const re of forbidden) {
      assert.equal(re.test(val), false, `${examId} ${loc} leaked ${re}: ${val.slice(0, 80)}`)
    }
  }
  for (const meta of index) {
    const exam = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'cet4', meta.file), 'utf8'))
    for (const sec of exam.sections) {
      for (const b of sec.blocks || []) {
        checkStr(exam.id, `block:${b.id}:text`, b.text)
        checkStr(exam.id, `block:${b.id}:transcript`, b.transcript)
        if (sec.type === 'listening' && b.transcript) {
          assert.equal(
            /(?:[（(]\s*(?:[1-9]|1\s*[0-9]|2\s*[0-5]|[lI][O0]|[lI]{2})(?:\s*[-–—.]\s*[1-9lI])?\s*[）)]|[［\[]\s*(?:[1-9]|1\d|2[0-5])(?:\s*[-–—]\s*[1-9])?\s*[］\]])/.test(
              b.transcript
            ),
            false,
            `${exam.id} ${b.id} transcript still contains question marker`
          )
        }
        checkStr(exam.id, `block:${b.id}:translation`, b.translation)
      }
      for (const q of sec.questions || []) {
        checkStr(exam.id, `q${q.number}:stem`, q.stem)
        checkStr(exam.id, `q${q.number}:answer`, q.answer)
        for (const o of q.options || []) {
          checkStr(exam.id, `q${q.number}:opt:${o.key}`, o.text)
        }
      }
    }
  }
})
