import { existsSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import type { Cet6Exam, Cet6Meta } from '../cet6'

const ROOT = join(__dirname, '..', '..', '..', 'content', 'cet4')
const has = existsSync(join(ROOT, 'index.json'))
const metas = has ? (JSON.parse(readFileSync(join(ROOT, 'index.json'), 'utf8')) as Cet6Meta[]) : []
const exams = metas.map((m) => JSON.parse(readFileSync(join(ROOT, m.file), 'utf8')) as Cet6Exam)

describe.skipIf(!has)('content/cet4 完整性（与六级同一套断言）', () => {
  it('每卷可解析，id 唯一，清单与文件一一对应', () => {
    expect(metas.length).toBeGreaterThan(0)
    expect(new Set(metas.map((m) => m.id)).size).toBe(metas.length)
    metas.forEach((m) => expect(existsSync(join(ROOT, m.file)), m.file).toBe(true))
    readdirSync(join(ROOT, 'exams')).forEach((f) => expect(metas.some((m) => m.file === `exams/${f}`)).toBe(true))
    metas.forEach((m, i) => {
      expect(m.id).toMatch(/^\d{4}-\d{2}-\d$/)
      expect(exams[i].id).toBe(m.id)
    })
  })

  it('答案在选项键内；词库 15 项且答案不重复；匹配题 10 题；听力 25 题', () => {
    const problems: unknown[] = []
    for (const exam of exams) {
      const count = (type: string, kind?: string) =>
        exam.sections.filter((s) => s.type === type).flatMap((s) => s.questions ?? []).filter((x) => !kind || x.kind === kind).length
      const n = count('listening')
      if (n > 0 && n !== 25) problems.push([exam.id, 'listening', n]) // 共用听力的卷没有听力题
      const hasReading = count('reading') > 0 // 共用阅读的卷无题
      if (hasReading && count('reading', 'matching') !== 10) problems.push([exam.id, 'matching', count('reading', 'matching')])
      if (!exam.sections.some((x) => x.type === 'writing' || x.type === 'translation')) problems.push([exam.id, 'no writing/translation'])
      for (const section of exam.sections) {
        const bank = (section.questions ?? []).filter((x) => x.kind === 'word-bank' && x.answer).map((x) => x.answer)
        if (new Set(bank).size !== bank.length) problems.push([exam.id, 'duplicate word-bank answers'])
        for (const x of section.questions ?? []) {
          const keys = (x.options ?? []).map((o) => o.key)
          if (x.kind !== 'essay' && x.kind !== 'translation' && x.answer && !keys.includes(x.answer)) problems.push([exam.id, x.number, 'answer'])
          if (x.kind === 'word-bank' && keys.length !== 15) problems.push([exam.id, x.number, 'bank size', keys.length])
        }
      }
    }
    expect(problems).toEqual([])
  })
})
