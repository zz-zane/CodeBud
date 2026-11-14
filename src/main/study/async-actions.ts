import { STUDY_TEXT } from '../../shared/study-copy'
import type { StudyPlan } from '../../shared/study-companion'
import { STUDY_MAIN_SESSION_ID } from '../../shared/study-companion'
import { objectInput } from './store'

export async function runStudyAsyncActions(input: {
  text: string
  sessionId: string
  calculate(value: unknown): Promise<{ output: string; plots: string[] }>
  createPlan(value: unknown): Promise<StudyPlan>
}): Promise<string> {
  const matches = [...input.text.matchAll(/```study-actions\s*\n([\s\S]*?)\n```/g)]
  let output = ''
  let offset = 0
  let count = 0
  for (const match of matches) {
    output += input.text.slice(offset, match.index)
    offset = match.index! + match[0].length
    let actions: unknown[]
    try {
      const parsed: unknown = JSON.parse(match[1])
      if (!Array.isArray(parsed) || parsed.length > 4 || match[1].length > 200_000) throw new Error('invalid')
      actions = parsed
    } catch { output += match[0]; continue }
    const pending: unknown[] = []
    for (const raw of actions) {
      if (++count > 4) { output += STUDY_TEXT.ACTION_LIMIT_QUOTE; break }
      let action: Record<string, unknown>
      try { action = objectInput(raw) } catch { pending.push(raw); continue }
      if (action.type !== 'calculate' && action.type !== 'create_plan') { pending.push(raw); continue }
      try {
        if (action.type === 'calculate') {
          const result = await input.calculate(action)
          const safeOutput = result.output.replace(/`/g, '\u02cb').slice(0, 20_000)
          output += STUDY_TEXT.MATH_REPLY(safeOutput || STUDY_TEXT.MATH_NO_OUTPUT)
          for (const plot of result.plots) if (/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(plot)) output += STUDY_TEXT.MATH_PLOT(plot)
        } else {
          if (input.sessionId !== STUDY_MAIN_SESSION_ID) throw new Error(STUDY_TEXT.PLAN_MAIN_ONLY)
          const plan = await input.createPlan(action)
          output += STUDY_TEXT.PLAN_CREATED(plan.title.replace(/[\r\n]/g, ' '), plan.tasks.length)
        }
      } catch (error) { output += STUDY_TEXT.ACTION_FAILURE_QUOTE(error instanceof Error ? error.message : STUDY_TEXT.SETTINGS_RETRY) }
    }
    if (pending.length) output += '```study-actions\n' + JSON.stringify(pending) + '\n```'
  }
  return output + input.text.slice(offset)
}
