/**
 * `agy models` 给出的模型 id 形如 `gemini-3.8-flash-high`：末段 `-low|-medium|-high` 是强度，
 * 前面是「模型族」。拆成两半供聊天框的「模型 + 强度」选择器使用；不符合这个形状的 id 视为没有强度变体的单独模型族。
 * 纯逻辑。
 */
export type AgyStrength = 'low' | 'medium' | 'high'
export const AGY_STRENGTHS: readonly AgyStrength[] = ['low', 'medium', 'high']

export interface AgyModel { id: string; name: string }
export interface AgyFamily {
  /** 模型族 id（去掉强度后缀）；无强度变体时就是完整 id */
  family: string
  name: string
  /** 该族实际存在的强度 → 完整模型 id；无变体时为空 */
  variants: Partial<Record<AgyStrength, string>>
  /** 无变体时的完整模型 id */
  single?: string
}

const SUFFIX = /^(.+)-(low|medium|high)$/
const NAME_SUFFIX = /\s*\((low|medium|high)\)\s*$/i

export function splitAgyModelId(id: string): { family: string; strength: AgyStrength | null } {
  const match = SUFFIX.exec(id)
  return match ? { family: match[1], strength: match[2] as AgyStrength } : { family: id, strength: null }
}

export function joinAgyModelId(family: string, strength: AgyStrength | null): string {
  return strength ? `${family}-${strength}` : family
}

/** 按出现顺序把模型列表归并成模型族 */
export function groupAgyModels(models: readonly AgyModel[]): AgyFamily[] {
  const families = new Map<string, AgyFamily>()
  for (const model of models) {
    const { family, strength } = splitAgyModelId(model.id)
    let entry = families.get(family)
    if (!entry) { entry = { family, name: model.name.replace(NAME_SUFFIX, '').trim() || family, variants: {} }; families.set(family, entry) }
    if (strength) entry.variants[strength] = model.id
    else entry.single = model.id
  }
  return [...families.values()]
}

/** 该族可选的强度（固定 低 < 中 < 高 的顺序） */
export function strengthsOf(family: AgyFamily | undefined): AgyStrength[] {
  return family ? AGY_STRENGTHS.filter(s => family.variants[s]) : []
}

/** 选了某个族 + 想要的强度，返回要用的完整模型 id；想要的强度不存在时退到中档，再退到该族第一个 */
export function pickAgyModelId(family: AgyFamily, wanted: AgyStrength | null): string {
  const available = strengthsOf(family)
  if (!available.length) return family.single ?? family.family
  const strength = wanted && available.includes(wanted) ? wanted : available.includes('medium') ? 'medium' : available[0]
  return family.variants[strength]!
}

/** 当前模型 id 对应的族与强度；列表里没有（或没有保存模型）时 family 为 undefined */
export function currentAgySelection(models: readonly AgyModel[], modelId: string | undefined): { family: AgyFamily | undefined; strength: AgyStrength | null } {
  if (!modelId) return { family: undefined, strength: null }
  const { family: key, strength } = splitAgyModelId(modelId)
  const family = groupAgyModels(models).find(f => f.family === key)
  return { family, strength: family && strengthsOf(family).length ? strength : null }
}
