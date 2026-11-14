import { expect, it } from 'vitest'
import { packagedDataDir } from '../data-path'

it('keeps unpacked data beside the actual executable', () => {
  expect(packagedDataDir('D:\\releases\\app\\MiAiCoding.exe')).toBe('D:\\releases\\app\\data')
  expect(packagedDataDir('D:\\releases\\app\\CodeBud.exe'))
    .toBe(packagedDataDir('D:\\releases\\app\\MiAiCoding.exe'))
})

it('keeps portable data beside the portable launcher rather than the extraction folder', () => {
  expect(packagedDataDir('D:\\temp\\extract\\app.exe', 'D:\\releases')).toBe('D:\\releases\\data')
})

it('uses an explicit isolated profile for real packaged QA', () => {
  expect(packagedDataDir('D:\\app\\app.exe', 'D:\\portable', 'D:\\checks\\qa-data'))
    .toBe('D:\\checks\\qa-data')
})
