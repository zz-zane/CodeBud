import { STUDY_TEXT } from './study-copy'

const QUOTED_SEGMENT_RE = /「[^」]*」|"[^"]*"|“[^”]*”/g

/**
 * 检查记忆文本是否包含绝对化禁用表述；
 * 引号（`「」`、`""`、`“”`）内的学员原话不计入拦截。
 */
export function hasBannedPhrase(text: string, userMessage = ''): boolean {
  const stripped = text.replace(QUOTED_SEGMENT_RE, (quoted) => userMessage.includes(quoted.slice(1, -1)) ? ' ' : quoted)
  return STUDY_TEXT.BANNED_MEMORY_PHRASES.some((phrase) => stripped.includes(phrase))
}
