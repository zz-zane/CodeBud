import { STUDY_TEXT } from '../../shared/study-copy'
import { randomUUID } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { extractText, getDocumentProxy } from 'unpdf'
import type { StudyMaterial, StudyPlan, StudyTask } from '../../shared/study-companion'
import { idInput, objectInput, StudyStore, textInput } from './store'

const MAX_FILE_BYTES = 25 * 1024 * 1024
const MAX_TEXT = 2_000_000

export async function importStudyMaterial(store: StudyStore, file: string): Promise<StudyMaterial> {
  if (!statSync(file).isFile() || statSync(file).size > MAX_FILE_BYTES) throw new Error(STUDY_TEXT.MATERIAL_FILE_TOO_LARGE)
  const extension = extname(file).toLowerCase()
  if (!['.md', '.txt', '.pdf'].includes(extension)) throw new Error(STUDY_TEXT.MATERIAL_FORMAT_UNSUPPORTED)
  const bytes = readFileSync(file)
  let text: string
  if (extension === '.pdf') {
    if (!bytes.subarray(0, 1024).includes(Buffer.from('%PDF-'))) throw new Error(STUDY_TEXT.MATERIAL_PDF_INVALID)
    const pdf = await getDocumentProxy(new Uint8Array(bytes), { useSystemFonts: false, disableFontFace: true, stopAtErrors: true })
    const timer = setTimeout(() => { void pdf.loadingTask.destroy() }, 30_000)
    try {
      if (pdf.numPages > 1200) throw new Error(STUDY_TEXT.MATERIAL_PAGES_TOO_MANY)
      const result = await extractText(pdf)
      text = (result.text as string[]).map((page, index) => STUDY_TEXT.MATERIAL_PAGE(index + 1, page)).join('\n\n')
      if (!(result.text as string[]).some(page => page.trim())) throw new Error(STUDY_TEXT.MATERIAL_OCR_REQUIRED)
    } finally { clearTimeout(timer); await pdf.loadingTask.destroy() }
  } else {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '')
  }
  if (!text.trim() || text.length > MAX_TEXT || text.includes('\0')) throw new Error(STUDY_TEXT.MATERIAL_TEXT_INVALID)
  const id = randomUUID()
  const dir = join(store.directory, 'study-materials', id)
  mkdirSync(dir, { recursive: true })
  copyFileSync(file, join(dir, `original${extension}`))
  writeFileSync(join(dir, 'content.txt'), text, 'utf8')
  const material: StudyMaterial = { id, name: basename(file), kind: extension.slice(1), charCount: text.length, createdAt: Date.now(), status: 'ready' }
  store.update(state => { state.materials.push(material) })
  return material
}

export function readStudyMaterial(store: StudyStore, value: unknown): { text: string } {
  const id = idInput(value)
  if (!store.read().materials.some(material => material.id === id && material.status === 'ready')) throw new Error(STUDY_TEXT.MATERIAL_NOT_READY)
  return { text: readFileSync(join(store.directory, 'study-materials', id, 'content.txt'), 'utf8') }
}

export function materialSections(text: string): Array<{ ref: string; text: string }> {
  const sections: Array<{ ref: string; text: string }> = []
  for (let offset = 0; offset < text.length; offset += 1800) {
    sections.push({ ref: `section-${sections.length + 1}`, text: text.slice(offset, offset + 1800) })
  }
  return sections
}

export async function generateStudyPlan(store: StudyStore, input: unknown, generate: (prompt: string) => Promise<string>): Promise<StudyPlan> {
  const data = objectInput(input)
  const materialId = idInput(data.materialId)
  const goal = textInput(data.goal, 2000)
  const material = store.read().materials.find(item => item.id === materialId)
  if (!material) throw new Error(STUDY_TEXT.MATERIAL_SELECT_FIRST)
  const sections = materialSections(readStudyMaterial(store, materialId).text)
  // Cover the whole book within a bounded prompt; never imply omitted text was read.
  const selected = sections.length <= 16 ? sections : Array.from({ length: 16 }, (_, n) => sections[Math.round(n * (sections.length - 1) / 15)])
  const prompt = STUDY_TEXT.PLAN_PROMPT(sections.length, selected.length, JSON.stringify({ material: material.name, goal, sections: selected }).replace(/</g, '\\u003c'))
  const raw = (await generate(prompt)).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let parsed: Record<string, unknown>
  try { parsed = objectInput(JSON.parse(raw)) } catch { throw new Error(STUDY_TEXT.PLAN_JSON_INVALID) }
  const title = textInput(parsed.title, 300)
  if (!Array.isArray(parsed.tasks) || parsed.tasks.length < 1 || parsed.tasks.length > 30) throw new Error(STUDY_TEXT.PLAN_TASK_COUNT)
  const references = new Set(selected.map(section => section.ref))
  const tasks: StudyTask[] = parsed.tasks.map(value => {
    const task = objectInput(value)
    const sourceRef = textInput(task.sourceRef, 100)
    if (!references.has(sourceRef)) throw new Error(STUDY_TEXT.PLAN_REFERENCE_INVALID)
    return { id: randomUUID(), title: textInput(task.title, 300), description: textInput(task.description, 4000), sourceRef, status: 'todo' }
  })
  const plan: StudyPlan = { id: randomUUID(), title, materialId, tasks, createdAt: Date.now(), source: 'ai', draft: true }
  store.update(state => { state.plans.push(plan) })
  return plan
}

export function confirmStudyPlan(store: StudyStore, input: unknown): StudyPlan {
  const data = objectInput(input)
  const planId = idInput(data.planId)
  const title = textInput(data.title, 300).trim()
  if (!Array.isArray(data.tasks) || data.tasks.length < 1 || data.tasks.length > 30) throw new Error(STUDY_TEXT.PLAN_TASK_COUNT)
  const seen = new Set<string>()
  const edits = data.tasks.map((value) => {
    const task = objectInput(value)
    const id = idInput(task.id)
    if (seen.has(id)) throw new Error(STUDY_TEXT.TASK_DUPLICATE_ID)
    seen.add(id)
    return { id, title: textInput(task.title, 300).trim(), description: textInput(task.description, 4000, true).trim() }
  })
  return store.update((state) => {
    const plan = state.plans.find((item) => item.id === planId)
    if (!plan) throw new Error(STUDY_TEXT.PLAN_MISSING)
    if (!plan.draft) throw new Error(STUDY_TEXT.PLAN_NOT_DRAFT)
    const byId = new Map(plan.tasks.map((task) => [task.id, task]))
    plan.tasks = edits.map((edit) => {
      const orig = byId.get(edit.id)
      if (!orig) throw new Error(STUDY_TEXT.TASK_MISSING)
      return { ...orig, title: edit.title, description: edit.description }
    })
    plan.title = title
    plan.draft = false
    return { ...plan, tasks: plan.tasks.map((task) => ({ ...task })) }
  })
}

export function discardStudyPlan(store: StudyStore, input: unknown): void {
  const planId = idInput(input)
  store.update((state) => {
    const index = state.plans.findIndex((item) => item.id === planId)
    if (index < 0) throw new Error(STUDY_TEXT.PLAN_MISSING)
    if (!state.plans[index].draft) throw new Error(STUDY_TEXT.PLAN_NOT_DRAFT)
    state.plans.splice(index, 1)
  })
}

export function setStudyTaskStatus(store: StudyStore, input: unknown): void {
  const data = objectInput(input)
  const planId = idInput(data.planId)
  const taskId = idInput(data.taskId)
  if (!['todo', 'doing', 'done'].includes(data.status as string)) throw new Error(STUDY_TEXT.TASK_STATUS_INVALID)
  store.update(state => {
    const task = state.plans.find(plan => plan.id === planId)?.tasks.find(item => item.id === taskId)
    if (!task) throw new Error(STUDY_TEXT.TASK_MISSING)
    task.status = data.status as StudyTask['status']
  })
}

export function exportStudyVault(store: StudyStore, directory: string): void {
  mkdirSync(directory, { recursive: true })
  for (const note of store.read().notes) {
    const title = note.title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[. ]+$/, '').slice(0, 80)
    const file = join(directory, `${note.id}-${title}.${note.format === 'html' ? 'html' : 'md'}`)
    const content = note.format === 'html' ? note.body : `# ${note.title}\n\n${note.body}\n\n<!-- tags: ${note.tags.join(', ')}; archived: ${!!note.archived} -->\n`
    writeFileSync(file, content, { encoding: 'utf8', flag: 'wx' })
  }
}
