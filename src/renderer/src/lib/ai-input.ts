export function shouldSendAiMessage(event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'ctrlKey' | 'altKey' | 'metaKey' | 'isComposing' | 'keyCode'>, composing: boolean): boolean {
  return event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey && !event.isComposing && event.keyCode !== 229 && !composing
}

 
export const PIN_THRESHOLD_PX = 48
export function isPinnedToBottom(scrollHeight: number, scrollTop: number, clientHeight: number): boolean {
  return scrollHeight - scrollTop - clientHeight < PIN_THRESHOLD_PX
}
