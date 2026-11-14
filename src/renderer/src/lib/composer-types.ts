import { AI_ASSISTANT } from './copy'
import { createClientId } from './client-id'
import type { ReasoningEffort } from '../../../shared/types'
export type { ReasoningEffort } from '../../../shared/types'
export { showEffortForModel } from '../../../shared/ai-model-capabilities'

/**
 * 待发送附件。
 *
 * `path` 和图片预览仅在渲染层保留，不作为消息发送。
 * 预览仅保存在草稿，旧的 object URL 仍在移除时释放。
 */
export interface AiDraftAttachment {
  id: string
  name: string
  size: number
  kind: 'image' | 'file'
  /** 本地绝对路径；没有浏览器文件对象时它是唯一来源 */
  path?: string
  /** 仅图片：本地缩略图，不进入消息 */
  previewUrl?: string
  textContent?: string
}

/**
 * 文案一律取 AI_ASSISTANT —— copy.test.ts 禁止界面中文字符串散落在组件里，
 * 这个模块同样受约束（它虽然是 lib，但仍然产出界面文字）。
 */
export const REASONING_EFFORT_LABELS: Record<ReasoningEffort, { label: string; hint: string }> = {
  low: { label: AI_ASSISTANT.EFFORT_LOW, hint: AI_ASSISTANT.EFFORT_HINT_LOW },
  medium: { label: AI_ASSISTANT.EFFORT_MEDIUM, hint: AI_ASSISTANT.EFFORT_HINT_MEDIUM },
  high: { label: AI_ASSISTANT.EFFORT_HIGH, hint: AI_ASSISTANT.EFFORT_HINT_HIGH },
  xhigh: { label: AI_ASSISTANT.EFFORT_MAX, hint: AI_ASSISTANT.EFFORT_HINT_MAX }
}

export const REASONING_EFFORT_ORDER: ReasoningEffort[] = ['low', 'medium', 'high', 'xhigh']

export async function prepareDraftAttachment(file: File): Promise<AiDraftAttachment> {
  const image = file.type.startsWith('image/')
  let textContent: string | undefined
  let previewUrl: string | undefined
  // CSP 允许 data: 图片但不允许 blob:；限制大小，避免预览占用过多内存。
  if (image && file.size <= 1024 * 1024) {
    try {
      previewUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Invalid preview'))
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
    } catch { /* 无法预览时保留文件信息 */ }
  }
  if (!image && file.size <= 256 * 1024 && (file.type.startsWith('text/') || /\.(txt|md|c|h|cpp|java|py|json)$/i.test(file.name))) {
    try {
      const text = await file.text()
      const suffix = AI_ASSISTANT.ATTACH_TRUNCATED
      textContent = text.length > 12000 ? text.slice(0, 12000 - suffix.length) + suffix : text
    } catch { /* 内容读取失败时仅提供文件信息 */ }
  }
  return {
    id: createClientId(), name: file.name, size: file.size, kind: image ? 'image' : 'file',
    ...(textContent === undefined ? {} : { textContent }),
    previewUrl
  }
}

/** 把字节数格式化成人看的大小 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / 1024 ** i
  return `${value >= 10 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`
}
