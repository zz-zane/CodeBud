import { expect, it, vi } from 'vitest'
import { createClientId } from '../client-id'
import { prepareDraftAttachment } from '../composer-types'

it('creates unique version 4 UUIDs and attachment IDs without secure-context APIs', async () => {
  const secureCrypto = globalThis.crypto
  vi.stubGlobal('crypto', { getRandomValues: secureCrypto.getRandomValues.bind(secureCrypto) })
  try {
    const ids = Array.from({ length: 128 }, createClientId)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    const attachment = await prepareDraftAttachment(new File(['hello'], 'notes.txt', { type: 'text/plain' }))
    expect(attachment.id).toHaveLength(36)
    expect(attachment.textContent).toBe('hello')
  } finally {
    vi.stubGlobal('crypto', secureCrypto)
  }
})
