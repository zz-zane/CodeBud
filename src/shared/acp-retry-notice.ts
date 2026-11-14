/**
 * `agy acp` 重试时会把一行 `⚠ API error (attempt N): …`（含内部地址）当回答文本推过来。
 * 这里把这种「重试通知」行从回答流里剔除；只认这一个明确的行格式，正文里提到 error 的句子不受影响。
 * 纯逻辑，主进程 ACP 客户端逐块调用。
 */
const NOTICE_LINE = /^\s*⚠[ \t]*API error \(attempt \d+\):/
const STARTS_WITH_MARK = /^\s*⚠/

export class RetryNoticeFilter {
  /** 以 ⚠ 开头、还没等到换行的文本（通知可能被切在块的中间） */
  private held = ''
  private emitted = false
  /** 被丢弃的通知原文，只用来判断失败类型，绝不进界面 */
  dropped = ''

  push(chunk: string): string {
    let text = this.held + chunk
    this.held = ''
    let out = ''
    // shortcut: 只在块首识别；通知若出现在一个块的中段则不处理，真机样本未见此情形
    while (STARTS_WITH_MARK.test(text)) {
      const match = /^(\s*)(⚠[^\n]*)(\n|$)/.exec(text)
      if (!match) break
      if (match[3] === '') { this.held = text; return this.take(out) }
      if (!NOTICE_LINE.test(match[2])) break
      this.dropped += match[2] + '\n'
      if (this.emitted || out) out += match[1]
      text = text.slice(match[0].length)
    }
    return this.take(out + text)
  }

  /** 一轮结束：把还在等换行的文本放行，或当作通知丢弃 */
  flush(): string {
    const rest = this.held
    this.held = ''
    if (!rest) return ''
    if (NOTICE_LINE.test(rest)) { this.dropped += rest + '\n'; return '' }
    return this.take(rest)
  }

  private take(text: string): string {
    if (text) this.emitted = true
    return text
  }
}
