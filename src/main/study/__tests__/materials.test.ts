import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { StudyStore } from '../store'
import { exportStudyVault, generateStudyPlan, importStudyMaterial, readStudyMaterial, setStudyTaskStatus, confirmStudyPlan, discardStudyPlan } from '../materials'
import { studyContext } from '../../../shared/study-companion'

const root = resolve(tmpdir(), 'root-tests')
let dir: string
let store: StudyStore
beforeEach(() => { mkdirSync(root, { recursive: true }); dir = mkdtempSync(join(root, 'material-')); store = new StudyStore(join(dir, 'data')) })
afterEach(() => {
  if (!dir.startsWith(root + '\\') && !dir.startsWith(root + '/')) throw new Error('Invalid cleanup target')
  rmSync(dir, { recursive: true, force: true })
})

function makePdf(): Buffer {
  const stream = 'BT /F1 18 Tf 60 700 Td (Learning matrices) Tj ET'
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  ]
  let text = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(text)); text += `${index + 1} 0 obj\n${object}\nendobj\n` })
  const xref = Buffer.byteLength(text)
  text += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => String(offset).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return Buffer.from(text)
}

describe('materials, plans and knowledge', () => {
  it('extracts an actual PDF locally and retains its original bytes', async () => {
    const file = join(dir, 'book.pdf')
    const bytes = makePdf()
    writeFileSync(file, bytes)
    const material = await importStudyMaterial(store, file)
    expect(readStudyMaterial(store, material.id).text).toContain('Learning matrices')
    expect(readStudyMaterial(store, material.id).text).toContain('[第 1 页]')
    expect(readFileSync(join(store.directory, 'study-materials', material.id, 'original.pdf'))).toEqual(bytes)
    expect(new StudyStore(store.directory).read().materials[0]).toEqual(material)
  })

  it('grounds generated tasks in supplied source sections and persists task completion', async () => {
    const file = join(dir, 'book.md')
    writeFileSync(file, '# Matrices\nMatrix multiplication uses rows and columns.')
    const material = await importStudyMaterial(store, file)
    let prompt = ''
    const plan = await generateStudyPlan(store, { materialId: material.id, goal: 'Understand multiplication' }, async value => {
      prompt = value
      return JSON.stringify({ title: 'Matrices', tasks: [{ title: 'Multiply two small matrices', description: 'Write out row by column products and check the dimensions.', sourceRef: 'section-1' }] })
    })
    expect(prompt).toContain('Matrix multiplication uses rows and columns.')
    expect(prompt).toContain('不可信参考数据')
    expect(plan.draft).toBe(true)
    expect(studyContext(store.read())).not.toContain('Multiply two small matrices')
    setStudyTaskStatus(store, { planId: plan.id, taskId: plan.tasks[0].id, status: 'done' })
    expect(new StudyStore(store.directory).read().plans[0].tasks[0].status).toBe('done')
    await expect(generateStudyPlan(store, { materialId: material.id, goal: 'x' }, async () => JSON.stringify({ title: 'bad', tasks: [{ title: 'bad', description: 'bad', sourceRef: 'invented' }] }))).rejects.toThrow('未提供')
    expect(store.read().plans).toHaveLength(1)
  })

  it('confirms or discards draft plans without letting edits alter sourceRef or confirmed plans', async () => {
    const file = join(dir, 'plan.md')
    writeFileSync(file, '# Graphs\nBFS visits vertices level by level.')
    const material = await importStudyMaterial(store, file)
    const draft = await generateStudyPlan(store, { materialId: material.id, goal: 'Learn BFS' }, async () =>
      JSON.stringify({
        title: 'Initial Draft',
        tasks: [
          { title: 'Task A', description: 'Read section', sourceRef: 'section-1' },
          { title: 'Task B', description: 'Trace queue', sourceRef: 'section-1' }
        ]
      })
    )
    expect(draft.draft).toBe(true)
    expect(studyContext(store.read())).not.toContain('Task A')

    const confirmed = confirmStudyPlan(store, {
      planId: draft.id,
      title: 'Confirmed BFS Plan',
      tasks: [{ id: draft.tasks[0].id, title: 'Task A edited', description: 'Updated desc' }]
    })
    expect(confirmed.draft).toBe(false)
    expect(confirmed.title).toBe('Confirmed BFS Plan')
    expect(confirmed.tasks).toEqual([
      { ...draft.tasks[0], title: 'Task A edited', description: 'Updated desc', sourceRef: 'section-1' }
    ])
    expect(studyContext(store.read())).toContain('Task A edited')

    expect(() => confirmStudyPlan(store, { planId: draft.id, title: 'Again', tasks: confirmed.tasks })).toThrow()
    expect(() => discardStudyPlan(store, draft.id)).toThrow()

    const draft2 = await generateStudyPlan(store, { materialId: material.id, goal: 'Another' }, async () =>
      JSON.stringify({ title: 'Draft 2', tasks: [{ title: 'Drop me', description: 'Desc', sourceRef: 'section-1' }] })
    )
    discardStudyPlan(store, draft2.id)
    expect(store.read().plans).toHaveLength(1)
  })

  it('rejects unsupported, invalid UTF8, fake PDF and material path traversal', async () => {
    for (const [name, content] of [['evil.pdf', Buffer.from('not PDF')], ['bad.txt', Buffer.from([0xff, 0xfe])], ['run.exe', Buffer.from('x')]] as const) {
      const file = join(dir, name)
      writeFileSync(file, content)
      await expect(importStudyMaterial(store, file)).rejects.toThrow()
    }
    expect(() => readStudyMaterial(store, '../config')).toThrow()
    expect(store.read().materials).toEqual([])
  })

  it('edits, archives, restores and exports a note without erasing other files', () => {
    const first = store.saveNote({ title: 'Matrix notes', body: 'See [[Vectors]]', tags: ['math'] })
    store.archiveNote(first.id)
    expect(store.read().notes[0].archived).toBe(true)
    store.saveNote({ id: first.id, title: first.title, body: 'Updated [[Vectors]]', tags: first.tags })
    expect(new StudyStore(store.directory).read().notes[0].archived).toBe(false)
    const destination = join(dir, 'export')
    exportStudyVault(store, destination)
    const exported = join(destination, `${first.id}-${first.title}.md`)
    expect(existsSync(exported)).toBe(true)
    expect(readFileSync(exported, 'utf8')).toContain('Updated [[Vectors]]')
    expect(() => exportStudyVault(store, destination)).toThrow()
  })
})
