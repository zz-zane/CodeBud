const LOOPBACK = /^(localhost|.+\.localhost|127(\.\d+){3}|\[::1\])$/i

/** http 明文发往非本机地址时，API Key 会被链路上的任何人看到 */
export function sendsKeyInPlainText(baseUrl: string): boolean {
  try {
    const url = new URL(baseUrl.trim())
    return url.protocol === 'http:' && !LOOPBACK.test(url.hostname)
  } catch {
    return false
  }
}
