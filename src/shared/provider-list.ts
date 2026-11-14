/**
 * Provider = 一个能回答问题的后端（docs/30 §1）：内置 API + 学习空间里的 ACP 连接。
 * 「当前 Provider」就是 `activeConnectionId`（null = 内置 API）。这里只放纯逻辑：列表视图模型、
 * 聊天框要显示哪些选项、手机端只读判定。
 */
import type { StudyConnection } from './study-companion'

export type ProviderStatus = StudyConnection['status']

export interface ProviderItem {
  /** null = 内置 API */
  id: string | null
  kind: 'builtin' | StudyConnection['kind']
  label: string
  status: ProviderStatus
  error?: string
  current: boolean
  /** 可被设为当前 Provider（连接中的不可再点） */
  selectable: boolean
}

export function buildProviderList(input: { connections: readonly StudyConnection[]; activeConnectionId: string | null; builtinLabel: string; builtinReady: boolean }): ProviderItem[] {
  const { connections, activeConnectionId } = input
  const activeKnown = activeConnectionId !== null && connections.some(c => c.id === activeConnectionId)
  const builtin: ProviderItem = { id: null, kind: 'builtin', label: input.builtinLabel, status: input.builtinReady ? 'ready' : 'disconnected', current: !activeKnown, selectable: true }
  return [builtin, ...connections.map((c): ProviderItem => ({
    id: c.id, kind: c.kind, label: c.label, status: c.status, ...(c.error ? { error: c.error } : {}),
    current: c.id === activeConnectionId, selectable: c.status !== 'connecting'
  }))]
}

export function currentProvider(list: readonly ProviderItem[]): ProviderItem {
  return list.find(item => item.current) ?? list[0]
}

/** 设置页里那一行固定的 Antigravity：优先取已存在的 antigravity 连接 */
export function findAntigravity(connections: readonly StudyConnection[]): StudyConnection | undefined {
  return connections.find(c => c.kind === 'antigravity')
}

/** 聊天框里 Provider 芯片的形态：手机只读；电脑上只有一个 Provider 时是静态标签，≥2 个时可点开菜单 */
export type ProviderChipMode = 'readonly' | 'static' | 'menu'
export function providerChipMode(input: { isRemote: boolean; providerCount: number }): ProviderChipMode {
  if (input.isRemote) return 'readonly'
  return input.providerCount >= 2 ? 'menu' : 'static'
}

/** 随 Provider 变化的选项：内置 API = 模型名（去设置）+ 视模型而定的推理强度；Antigravity = 模型族 + 强度；其余无 */
export type ComposerOptionSet = 'builtin' | 'antigravity' | 'none'
export function composerOptionSet(item: Pick<ProviderItem, 'kind'>): ComposerOptionSet {
  return item.kind === 'builtin' ? 'builtin' : item.kind === 'antigravity' ? 'antigravity' : 'none'
}
