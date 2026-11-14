export function validChatExtras(effort: unknown, attachments: unknown): boolean {
  if (effort !== undefined && !['low', 'medium', 'high', 'xhigh'].includes(effort as string)) return false
  if (attachments === undefined) return true
  if (!Array.isArray(attachments) || attachments.length > 6) return false
  return attachments.every((value: unknown) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const file = value as Record<string, unknown>
    return Object.keys(file).every((key) => ['id', 'name', 'size', 'kind', 'textContent'].includes(key)) &&
      typeof file.id === 'string' && file.id.length > 0 && file.id.length <= 100 &&
      typeof file.name === 'string' && file.name.length > 0 && file.name.length <= 255 && !/[\\/\x00-\x1f\x7f]/.test(file.name) &&
      typeof file.size === 'number' && Number.isSafeInteger(file.size) && file.size >= 0 &&
      (file.kind === 'image' || file.kind === 'file') &&
      (file.textContent === undefined || (typeof file.textContent === 'string' && file.textContent.length <= 20000))
  })
}
