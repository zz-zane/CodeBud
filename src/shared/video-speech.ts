import { VIDEO_COPY } from './video-copy'
const SYMBOLS: Record<string, string> = {
  '->': VIDEO_COPY.SPEAK_ARROW, '==': VIDEO_COPY.SPEAK_EQ_EQ, '!=': VIDEO_COPY.SPEAK_NOT_EQ, '<=': VIDEO_COPY.SPEAK_LTE, '>=': VIDEO_COPY.SPEAK_GTE,
  '++': VIDEO_COPY.SPEAK_PLUS_PLUS, '--': VIDEO_COPY.SPEAK_MINUS_MINUS, '&&': VIDEO_COPY.SPEAK_AND, '||': VIDEO_COPY.SPEAK_OR,
  '*': VIDEO_COPY.SPEAK_STAR, '&': VIDEO_COPY.SPEAK_ADDRESS, '=': VIDEO_COPY.SPEAK_EQ, '+': VIDEO_COPY.SPEAK_PLUS, '-': VIDEO_COPY.SPEAK_MINUS, '/': VIDEO_COPY.SPEAK_DIVIDE,
  '<': VIDEO_COPY.SPEAK_LT, '>': VIDEO_COPY.SPEAK_GT, '%': VIDEO_COPY.SPEAK_PERCENT, '!': VIDEO_COPY.SPEAK_NOT
}

export function speechText(say: string): string {
  return say.replace(/`([^`]+)`/g, (_, code: string) =>
    code.replace(/->|==|!=|<=|>=|\+\+|--|&&|\|\||[*&=+\-/<>%!]/g, symbol =>
      ` ${SYMBOLS[symbol]} `
    ).replace(/\s+/g, ' ').trim()
  )
}
