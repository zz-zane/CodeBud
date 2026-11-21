import { randomUUID } from 'node:crypto'
import { STUDY_TEXT } from '../../shared/study-copy'
import { CUSTOM_PLAN_MATERIAL, type StudyPlan, type StudyTask } from '../../shared/study-companion'
import { idInput, objectInput, textInput, type StudyStore } from './store'

const MAX_TASKS = 30
const STATUSES = ['todo', 'doing', 'done'] as const

function taskFields(data: Record<string, unknown>, isLesson?: (id: string) => boolean): Pick<StudyTask, 'title' | 'description' | 'lessonId'> {
  const title = textInput(data.title, 300).trim()
  if (!title) throw new Error(STUDY_TEXT.TASK_TITLE_REQUIRED)
  const description = data.description === undefined ? '' : textInput(data.description, 4000, true).trim()
  const out: Pick<StudyTask, 'title' | 'description' | 'lessonId'> = { title, description }
  if (data.lessonId !== undefined && data.lessonId !== '') {
    const lessonId = idInput(data.lessonId)
    if (isLesson && !isLesson(lessonId)) throw new Error(STUDY_TEXT.ACTION_LESSON_MISSING)
    out.lessonId = lessonId
  }
  return out
}

/**
 * 任务的增删改：任务页的「自定义任务」和 AI 助教的 study-actions 走同一个入口（同一套校验）。
 * 不动快照结构：自定义 / 对话里建的任务组用 materialId = CUSTOM_PLAN_MATERIAL，草稿流程照旧走 confirmStudyPlan。
 * 返回改动后的计划副本；删除计划返回 null。
 */
export function editStudyTasks(store: StudyStore, input: unknown, isLesson?: (id: string) => boolean): StudyPlan | null {
  const data = objectInput(input)
  const op = textInput(data.op, 30)
  if (op === 'create_plan') {
    const title = textInput(data.title, 300).trim()
    if (!title) throw new Error(STUDY_TEXT.PLAN_TITLE_REQUIRED)
    const rows = data.tasks === undefined ? [] : data.tasks
    if (!Array.isArray(rows) || rows.length > MAX_TASKS) throw new Error(STUDY_TEXT.PLAN_TASK_COUNT)
    const tasks: StudyTask[] = rows.map(row => ({ id: randomUUID(), status: 'todo', ...taskFields(objectInput(row), isLesson) }))
    const plan: StudyPlan = { id: randomUUID(), title, materialId: CUSTOM_PLAN_MATERIAL, tasks, createdAt: Date.now(), source: data.source === 'ai' ? 'ai' : 'manual', draft: false }
    store.update(state => { state.plans.push(plan) })
    return structuredClone(plan)
  }
  const planId = idInput(data.planId)
  return store.update(state => {
    const index = state.plans.findIndex(item => item.id === planId)
    if (index < 0) throw new Error(STUDY_TEXT.PLAN_MISSING)
    const plan = state.plans[index]
    if (op === 'delete_plan') { state.plans.splice(index, 1); return null }
    if (plan.draft) throw new Error(STUDY_TEXT.PLAN_IS_DRAFT)
    if (op === 'rename_plan') {
      const title = textInput(data.title, 300).trim()
      if (!title) throw new Error(STUDY_TEXT.PLAN_TITLE_REQUIRED)
      plan.title = title
    } else if (op === 'add_task') {
      if (plan.tasks.length >= MAX_TASKS) throw new Error(STUDY_TEXT.PLAN_TASK_COUNT)
      plan.tasks.push({ id: randomUUID(), status: 'todo', ...taskFields(data, isLesson) })
    } else if (op === 'update_task' || op === 'delete_task') {
      const taskId = idInput(data.taskId)
      const at = plan.tasks.findIndex(task => task.id === taskId)
      if (at < 0) throw new Error(STUDY_TEXT.TASK_MISSING)
      if (op === 'delete_task') plan.tasks.splice(at, 1)
      else {
        const task = plan.tasks[at]
        if (data.title !== undefined || data.description !== undefined || data.lessonId !== undefined) {
          Object.assign(task, taskFields({ title: data.title ?? task.title, description: data.description ?? task.description, lessonId: data.lessonId ?? task.lessonId }, isLesson))
        }
        if (data.status !== undefined) {
          if (!STATUSES.includes(data.status as StudyTask['status'])) throw new Error(STUDY_TEXT.STATE_TASK_STATUS_INVALID)
          task.status = data.status as StudyTask['status']
        }
      }
    } else throw new Error(STUDY_TEXT.ACTION_UNSUPPORTED)
    return structuredClone(plan)
  })
}
