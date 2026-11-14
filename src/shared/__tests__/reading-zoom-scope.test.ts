import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, it } from 'vitest'
import { maskComments } from './mask-comments'

const ui = resolve(__dirname, '../../renderer/src')
const read = (file: string) => maskComments(readFileSync(resolve(ui, file), 'utf8'))

it('applies the saved factor to explicit reading text, never a page or dialog frame', () => {
  const css = read('styles/zoom.css')
  expect(css).not.toMatch(/(?:^|[;{])\s*zoom\s*:/)
  expect(css).not.toContain('main.content >')
  expect(css).toContain('.lesson-page .markdown-body { font-size: calc(var(--mi-fs-read) * var(--mi-zoom)); }')
  expect(css).toContain('.mi-code-editor .cm-editor { font-size: calc(var(--mi-fs-body) * var(--mi-zoom)); }')
  expect(css).toContain('.stem-text,.opt-text,.opt-letter')
  expect(css).toContain('.compare-col pre')
  expect(css).toContain('.demo-line,.demo-src,.demo-ln')
  expect(read('components/domain/quiz/QuizOverlay.vue')).not.toContain('mi-zoom-layer')
})

it('requests a fresh CodeMirror measure after reading font changes without resetting the preference', () => {
  expect(read('components/domain/CodeEditor.vue')).toContain(
    "watch(() => readingZoom.scale, () => view.value?.requestMeasure(), { flush: 'post' })"
  )
  const store = read('stores/zoom.ts')
  expect(store).toContain("const STORAGE_KEY = 'miai:zoom:v1'")
  expect(store).toContain('ref(readStored())')
})
