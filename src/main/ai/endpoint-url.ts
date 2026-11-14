/**
 * 把用户填的 baseUrl 规范化成可直接请求的完整端点。
 *
 * 原先住在 `local-router.ts`（那套本地 CCR 代理已随 NativeHarness 上线退役），
 * 但这两个函数与路由无关 —— 它们只是 URL 拼接，deepseek.ts 与 native-harness.ts
 * 都还在用，所以搬出来独立一份。
 */

/** 规范化 OpenAI 兼容 chat/completions 完整 URL */
export function resolveOpenAiChatUrl(rawBase: string): string {
  const trimmed = (rawBase || '').trim().replace(/\/+$/, '')
  if (!trimmed) return 'https://api.deepseek.com/chat/completions'
  if (trimmed.endsWith('/chat/completions')) return trimmed
  if (trimmed.endsWith('/v1')) return `${trimmed}/chat/completions`
  return `${trimmed}/v1/chat/completions`
}

/** 规范化 Anthropic 兼容 messages 完整 URL */
export function resolveAnthropicMessagesUrl(rawBase: string): string {
  const trimmed = (rawBase || '').trim().replace(/\/+$/, '')
  if (!trimmed) return 'https://api.anthropic.com/v1/messages'
  if (trimmed.endsWith('/messages')) return trimmed
  if (trimmed.endsWith('/v1')) return `${trimmed}/messages`
  return `${trimmed}/v1/messages`
}
