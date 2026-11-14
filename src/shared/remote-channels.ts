/**
 * 手机连接的通道白名单（docs/29 §2-4）。**默认拒绝**：不在 `REMOTE_ALLOWED_KEYS` 里的通道，
 * 远程调用一律 403。新增 IPC 通道时 `remote-channels.test.ts` 会红，逼着在这里做一次有意识的决定：
 * 进白名单（手机可用）或进 `REMOTE_DENIED_KEYS`（仅电脑端）。
 *
 * 写成 `IPC` 的 key 列表而不是通道字符串：key 拼错编译不过，通道改名白名单自动跟着走。
 * 纯数据 + 纯函数，不 import 任何 Node / Electron 模块（渲染层也能安全 import）。
 */
import { IPC } from './ipc-channels'

type IpcKey = keyof typeof IPC

/** 手机可调用：学习 + AI 相关。`aiChatStream` / `configExternal` 是主进程推给设备的通道（只经事件流下发，没有 handler） */
export const REMOTE_ALLOWED_KEYS = [
  'profileGet', 'profileSave',
  'wrongbookGet', 'wrongbookRecord', 'wrongbookClear', 'wrongbookUpdate',
  'favoritesGet', 'favoritesSave',
  'memoGet', 'memoSave',
  'cet6GetState', 'cet6SaveRecord', 'cet6ResetRecord', 'cet6SetLastMode',
  'cet6VocabList', 'cet6VocabAdd', 'cet6VocabUpdate', 'cet6VocabRemove', 'cet6VocabLookup',
  'practiceRecord', 'practiceGet',
  'configGet',
  'aiGenerateQuestions', 'aiCancel',
  'challengeGet', 'challengeSave',
  'checkinSubmit',
  'configExternal',
  'aiChatSend', 'aiChatStream', 'aiChatCancel', 'aiSessionsGet', 'aiSessionsSave', 'aiSessionsChanged',
  'studyGetState', 'studySaveMemory', 'studyForgetMemory', 'studyUpdatePosition',
  'studySaveNote', 'studyArchiveNote', 'studyReadMaterial', 'studyGeneratePlan',
  'studySetTaskStatus', 'studyGetUsage', 'studyCreateHtmlPreview'
] as const satisfies readonly IpcKey[]

/**
 * 仅电脑端：会运行本机程序、弹系统对话框、写本机文件、改密钥 / 配置、探测环境、
 * 管理外部连接，或本身就是手机连接的管理口。
 */
export const REMOTE_DENIED_KEYS = [
  // 运行代码 / 本机 IDE / 导出文件 / 环境检测
  'runnerRun', 'runnerCancel', 'runnerOpenIde', 'runnerExportCode', 'runnerDetectIde',
  'exportMarkdown', 'envDetect',
  // 设置（含 API Key）与 AI 连接测试
  'configSave', 'aiTestConnection',
  // 六级音频目录选择（系统对话框）
  'cet6PickMediaRoot',
  // 研学：导入 / 导出（系统对话框）、外部连接（ACP，会启动本机程序）、数学计算（启动本机 Octave）
  'studyImportMaterials', 'studyExportVault', 'studySaveConnection', 'studyConnect',
  'studyAuthenticate', 'studyDisconnect', 'studySelectConnection', 'studySetModel', 'studyRemoveConnection', 'studyRunMath', 'studyDetectAgent', 'studyListModels',
  // 云结算
  'cloudChallengeSettle',
  // 手机连接自身的管理口（只有电脑上的设置页能调）
  'remoteGetStatus', 'remoteSetEnabled', 'remoteSetPort', 'remoteRevokeDevice',
  'remoteRevokeAll', 'remoteRegenerateCode'
] as const satisfies readonly IpcKey[]

const ALLOWED_CHANNELS: ReadonlySet<string> = new Set(REMOTE_ALLOWED_KEYS.map((k) => IPC[k]))

/** 通道是否在手机白名单里（未知通道 = false） */
export function isRemoteChannelAllowed(channel: unknown): boolean {
  return typeof channel === 'string' && ALLOWED_CHANNELS.has(channel)
}
