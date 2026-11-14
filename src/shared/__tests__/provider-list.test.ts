import { describe, expect, it } from 'vitest'
import { buildProviderList, composerOptionSet, currentProvider, findAntigravity, providerChipMode } from '../provider-list'
import type { StudyConnection } from '../study-companion'

const conn = (over: Partial<StudyConnection>): StudyConnection => ({ id: 'a', kind: 'antigravity', label: 'Antigravity', command: 'agy', args: ['acp'], status: 'ready', ...over })

describe('provider list', () => {
  it('puts the built-in API first and marks it current when no connection is active', () => {
    const list = buildProviderList({ connections: [conn({})], activeConnectionId: null, builtinLabel: '内置 API', builtinReady: false })
    expect(list.map(i => [i.id, i.current])).toEqual([[null, true], ['a', false]])
    expect(list[0]).toMatchObject({ kind: 'builtin', status: 'disconnected', selectable: true })
  })
  it('marks the active connection current, carries status and error, and blocks selecting one that is connecting', () => {
    const list = buildProviderList({ connections: [conn({ status: 'error', error: 'x' }), conn({ id: 'b', kind: 'custom', status: 'connecting' })], activeConnectionId: 'a', builtinLabel: 'B', builtinReady: true })
    expect(currentProvider(list).id).toBe('a')
    expect(list[1]).toMatchObject({ status: 'error', error: 'x', selectable: true })
    expect(list[2].selectable).toBe(false)
    expect(list[0]).toMatchObject({ current: false, status: 'ready' })
  })
  it('treats a dangling active id as the built-in API', () => {
    expect(currentProvider(buildProviderList({ connections: [], activeConnectionId: 'gone', builtinLabel: 'B', builtinReady: true })).id).toBeNull()
  })
  it('finds the antigravity connection and picks the option set by kind', () => {
    expect(findAntigravity([conn({ id: 'c', kind: 'custom' }), conn({})])?.id).toBe('a')
    expect(findAntigravity([])).toBeUndefined()
    expect(composerOptionSet({ kind: 'builtin' })).toBe('builtin')
    expect(composerOptionSet({ kind: 'antigravity' })).toBe('antigravity')
    for (const kind of ['claude', 'codex', 'custom'] as const) expect(composerOptionSet({ kind })).toBe('none')
  })
  it('chip mode: phone is read-only, one provider is static, two or more open a menu', () => {
    expect(providerChipMode({ isRemote: true, providerCount: 3 })).toBe('readonly')
    expect(providerChipMode({ isRemote: false, providerCount: 1 })).toBe('static')
    expect(providerChipMode({ isRemote: false, providerCount: 2 })).toBe('menu')
  })
})
