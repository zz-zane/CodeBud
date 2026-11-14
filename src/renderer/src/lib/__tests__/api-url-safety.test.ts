import { describe, expect, it } from 'vitest'
import { sendsKeyInPlainText } from '../api-url-safety'

describe('sendsKeyInPlainText', () => {
  it.each(['http://api.example.com/v1', 'http://192.168.1.5:8000', ' HTTP://Example.com '])('警告 %s', (u) => {
    expect(sendsKeyInPlainText(u)).toBe(true)
  })
  it.each(['https://api.deepseek.com', 'http://localhost:11434', 'http://app.localhost', 'http://127.0.0.1:8080/v1', 'http://[::1]:8000', '', 'not a url'])('不警告 %s', (u) => {
    expect(sendsKeyInPlainText(u)).toBe(false)
  })
})
