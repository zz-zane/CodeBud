import { STUDY_TEXT } from '../../shared/study-copy'
import type { StudyQuota, StudyUsage, StudyUsageRecord } from '../../shared/study-companion'
import { StudyStore } from './store'

export interface ProviderUsage {
  inputTokens: number | null
  outputTokens: number | null
  cachedInputTokens: number | null
  totalTokens: number | null
}

function tokens(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null
}

export function normalizeProviderUsage(protocol: 'openai' | 'anthropic', data: Record<string, unknown>): ProviderUsage {
  const cache = tokens(protocol === 'anthropic' ? data.cache_read_input_tokens : data.prompt_cache_hit_tokens ?? (data.prompt_tokens_details as Record<string, unknown> | undefined)?.cached_tokens)
  const input = tokens(protocol === 'anthropic' ? data.input_tokens : data.prompt_tokens ?? data.input_tokens)
  const output = tokens(protocol === 'anthropic' ? data.output_tokens : data.completion_tokens ?? data.output_tokens)
  const creation = tokens(data.cache_creation_input_tokens)
  // Anthropic input excludes cache reads/writes; OpenAI prompt totals already include them.
  const inputTokens = protocol === 'anthropic' && input !== null ? input + (cache ?? 0) + (creation ?? 0) : input
  const totalTokens = tokens(data.total_tokens) ?? (inputTokens !== null && output !== null ? inputTokens + output : null)
  return { inputTokens, outputTokens: output, cachedInputTokens: cache, totalTokens }
}

export function normalizeAcpUsage(current: Record<string, unknown>, previous?: Record<string, unknown>): ProviderUsage {
  if (current.totalTokens === undefined) return normalizeProviderUsage('openai', current)
  const delta = (key: string): number | null => {
    const value = tokens(current[key])
    const before = previous ? tokens(previous[key]) : 0
    return value === null || before === null || value < before ? null : value - before
  }
  // ACP Usage is cumulative across its session; context-window notifications are not billing records.
  return { inputTokens: delta('inputTokens'), outputTokens: delta('outputTokens'), cachedInputTokens: delta('cachedReadTokens'), totalTokens: delta('totalTokens') }
}

export function recordStudyUsage(store: StudyStore, record: StudyUsageRecord): void {
  store.update(state => {
    state.usage ??= []
    const index = state.usage.findIndex(item => item.id === record.id)
    if (index >= 0) state.usage[index] = record
    else state.usage.push(record)
  })
}

export async function getStudyUsage(store: StudyStore, refresh: boolean, config: { provider: string; baseUrl: string; apiKey: string }): Promise<StudyUsage> {
  const quotas: StudyQuota[] = []
  const state = store.read()
  if (refresh && config.provider === 'deepseek' && new URL(config.baseUrl).origin === 'https://api.deepseek.com' && config.apiKey) {
    try {
      const response = await fetch('https://api.deepseek.com/user/balance', { headers: { Authorization: `Bearer ${config.apiKey}` }, redirect: 'error', signal: AbortSignal.timeout(12_000) })
      if (!response.ok) throw new Error(STUDY_TEXT.BALANCE_HTTP_ERROR(response.status))
      const data = await response.json() as { balance_infos?: Array<{ currency?: string; total_balance?: string }> }
      for (const row of data.balance_infos ?? []) {
        if (typeof row.total_balance !== 'string' || !row.total_balance.trim()) continue
        const remaining = Number(row.total_balance)
        if (!Number.isFinite(remaining) || remaining < 0 || typeof row.currency !== 'string') continue
        quotas.push({ provider: 'deepseek', label: STUDY_TEXT.BALANCE_LABEL, remaining, unit: row.currency, source: 'DeepSeek /user/balance', updatedAt: Date.now() })
      }
      if (!quotas.length) throw new Error(STUDY_TEXT.BALANCE_RESPONSE_INVALID)
    } catch (error) {
      quotas.push({ provider: 'deepseek', label: STUDY_TEXT.BALANCE_LABEL, remaining: null, unit: '', source: 'DeepSeek /user/balance', updatedAt: Date.now(), detail: error instanceof Error ? error.message : STUDY_TEXT.BALANCE_READ_FAILED })
    }
  }
  if (!quotas.length) quotas.push({ provider: config.provider, label: STUDY_TEXT.QUOTA_LABEL, remaining: null, unit: '', source: STUDY_TEXT.QUOTA_NOT_READ, updatedAt: Date.now(), detail: STUDY_TEXT.QUOTA_UNKNOWN_DETAIL })
  return { records: state.usage ?? [], quotas }
}
