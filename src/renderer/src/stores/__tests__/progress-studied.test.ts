/**
 * markStudiedToday（docs/31 §2.1）：当天第一次完成学习动作时自动记一次打卡。
 * 钉三件事：幂等（同一天只调一次 IPC）、静默（不弹奖励 toast）、失败只留警告、不抛。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { DEFAULT_PROFILE, type CheckinSubmitResult } from '../../../../shared/types'
import { toasts } from '../../components/base/toast'
import { stubMiai } from './miai-stub'
import { useProgressStore } from '../progress'

const DAY = '2026-11-13'

function signedAs(day: string): CheckinSubmitResult {
  const checkin = { ...structuredClone(DEFAULT_PROFILE.checkin), days: [day], lastDate: day, streakDays: 1, totalDays: 1 }
  return { ok: true, awarded: true, streakReset: false, checkin, riceGranted: false, riceCredited: null, stamp: { epoch: 0, rev: 0 } }
}

async function ready() {
  const p = useProgressStore()
  await vi.waitFor(() => expect(p.loaded).toBe(true))
  return p
}

describe('progress.markStudiedToday', () => {
  beforeEach(() => setActivePinia(createPinia()))
  afterEach(() => vi.restoreAllMocks())

  it('第一次调 IPC 并换上主进程返回的签到状态，同一天第二次不再调', async () => {
    const log = stubMiai({ checkinResult: signedAs(DAY) })
    const p = await ready()
    await p.markStudiedToday(DAY)
    expect(log.checkinCalls).toEqual([DAY])
    expect(p.checkin.days).toEqual([DAY])
    expect(p.profile.stats.streakDays).toBe(1)
    await p.markStudiedToday(DAY)
    expect(log.checkinCalls).toEqual([DAY])
  })

  it('并发多次只发一次', async () => {
    const log = stubMiai({ checkinResult: signedAs(DAY) })
    const p = await ready()
    await Promise.all([p.markStudiedToday(DAY), p.markStudiedToday(DAY), p.markStudiedToday(DAY)])
    expect(log.checkinCalls).toEqual([DAY])
  })

  it('静默：不弹任何 toast', async () => {
    stubMiai({ checkinResult: signedAs(DAY) })
    const p = await ready()
    const before = toasts.length
    await p.markStudiedToday(DAY)
    expect(toasts.length).toBe(before)
  })

  it('IPC 失败：不抛、不弹窗，只留一条警告，之后还能重试', async () => {
    const log = stubMiai({ failCheckin: true })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const p = await ready()
    const before = toasts.length
    await expect(p.markStudiedToday(DAY)).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(1)
    expect(toasts.length).toBe(before)
    expect(p.checkin.days).toEqual([])
    log.failCheckin = false
    log.checkinResult = signedAs(DAY)
    await p.markStudiedToday(DAY)
    expect(p.checkin.days).toEqual([DAY])
  })

  it('标记一课已学会触发打卡，取消标记不会', async () => {
    const log = stubMiai({ checkinResult: signedAs(DAY) })
    const p = await ready()
    p.markLearned('common-01', false)
    expect(log.checkinCalls).toEqual([])
    p.markLearned('common-01', true)
    await vi.waitFor(() => expect(log.checkinCalls.length).toBe(1))
  })
})
