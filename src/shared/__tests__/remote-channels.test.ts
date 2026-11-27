import { describe, expect, it } from 'vitest'
import { IPC } from '../ipc-channels'
import { REMOTE_ALLOWED_KEYS, REMOTE_DENIED_KEYS, isRemoteChannelAllowed } from '../remote-channels'

/** 手写的「绝不能给手机」清单：独立于被测名单，改名单时这里是第二双眼睛 */
const MUST_STAY_DENIED = [
  'runnerRun', 'runnerCancel', 'runnerOpenIde', 'runnerExportCode', 'runnerDetectIde',
  'exportMarkdown', 'configSave', 'envDetect', 'cet6PickMediaRoot', 'cet4PickMediaRoot',
  'studyImportMaterials', 'studyExportVault', 'studySaveConnection', 'studyConnect',
  'studyAuthenticate', 'studyDisconnect', 'studySelectConnection', 'studySetModel', 'studyRemoveConnection', 'studyDetectAgent', 'studyListModels',
  'cloudChallengeSettle', 'videoGenerate', 'videoVerifyPrompt', 'videoVerifyAnswer',
  'remoteGetStatus', 'remoteSetEnabled', 'remoteSetPort', 'remoteRevokeDevice', 'remoteRevokeAll', 'remoteRegenerateCode'
]

const allKeys = Object.keys(IPC)
const allowed: readonly string[] = REMOTE_ALLOWED_KEYS
const denied: readonly string[] = REMOTE_DENIED_KEYS

describe('手机通道白名单', () => {
  it('名单里的每个 key 都在 IPC 里', () => {
    for (const k of [...allowed, ...denied]) expect(allKeys, k).toContain(k)
  })

  it('危险通道一个都不在白名单里（且都在拒绝名单里）', () => {
    for (const k of MUST_STAY_DENIED) {
      expect(allowed, k).not.toContain(k)
      expect(denied, k).toContain(k)
      expect(isRemoteChannelAllowed(IPC[k as keyof typeof IPC]), k).toBe(false)
    }
  })

  it('每个 IPC key 恰好在白名单与拒绝名单之一（新增通道必须做一次决定）', () => {
    const undecided = allKeys.filter((k) => !allowed.includes(k) && !denied.includes(k))
    expect(undecided, `这些通道还没决定手机能不能用：${undecided.join(', ')}`).toEqual([])
    const both = allKeys.filter((k) => allowed.includes(k) && denied.includes(k))
    expect(both).toEqual([])
    expect(new Set(allowed).size).toBe(allowed.length)
    expect(new Set(denied).size).toBe(denied.length)
  })

  it('isRemoteChannelAllowed：认通道名，未知 / 非字符串一律拒绝', () => {
    for (const key of ['videoCancel', 'videoList', 'videoDelete'] as const) {
      expect(isRemoteChannelAllowed(IPC[key]), key).toBe(true)
    }
    expect(isRemoteChannelAllowed(IPC.profileGet)).toBe(true)
    expect(isRemoteChannelAllowed(IPC.runnerRun)).toBe(false)
    expect(isRemoteChannelAllowed('profileGet')).toBe(false)
    expect(isRemoteChannelAllowed('nope:nope')).toBe(false)
    expect(isRemoteChannelAllowed(undefined)).toBe(false)
    expect(isRemoteChannelAllowed({})).toBe(false)
  })
})
