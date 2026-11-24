import { IPC } from './ipc-channels'
import type { StudyApi } from './study-companion'
import type { AiChatSendPayload, AiChatSession, AiChatStreamEvent, AiGenerateInput, AiResult, ChallengeDay, ChallengeToday, CheckinSubmitResult, ConfigSavePayload, EnvReport, ExportCodeResult, FavoritesFile, IdeDetectResult, IdeOpenResult, LangOfCode, MemoFile, MarkdownExportFile, MarkdownExportResult, PracticeFile, PracticeRecordInput, PublicAppConfig, RunRequest, RunResult, UserProfile, WrongBookEntry, WrongRecordItem, WrongUpdateItem } from './types'
import type { AiParseResult } from './ai-question'
import type { Cet6MediaStatus, Cet6Mode, Cet6Record, Cet6State } from './cet6'
import type { TodoFile } from './today-todo'
import type { Cet6LookupResult, Cet6VocabEntry, Cet6VocabGrade, Cet6VocabInput } from './cet6-vocab'
import type { BoxStamp, DocWriteResult, StampedDoc } from './doc-write'
import type { ChallengeSettlePayload } from './cloud/dto'
import type { RemoteStatus } from './remote-auth'
import type { ExplainerVideo, VideoGenerationInput, VideoGenerationResult, VideoProgress, VideoVerifyPrompt } from './video'
import type { UpdateSnapshot } from './update'

/**
 * 传输层：preload 用 ipcRenderer 实现，手机浏览器用 HTTP（POST /rpc + SSE /events）实现。
 * `window.miai` 的形状只在 `createMiaiApi` 这一处定义（docs/29 §3.1）。
 */
export interface MiaiTransport {
  invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T>
  /** 订阅主进程推送；返回退订函数 */
  on(channel: string, listener: (payload: unknown) => void): () => void
  /** 是否运行在手机浏览器里（经 HTTP 连到电脑）；渲染层判断「我在手机上」的唯一依据 */
  isRemote: boolean
}

/**
 * renderer 唯一能接触的系统能力白名单。
 * 后续所有新能力（env/runner/practice/review/ai）都在这里追加，
 * renderer 永远拿不到 ipcRenderer / node 原生对象。
 */
export function createMiaiApi(t: MiaiTransport) {
  const miai = {
  /** 是否在手机浏览器里（HTTP 传输）。桌面 preload 恒为 false */
  isRemote: t.isRemote,
  /** 手机连接管理（设置页「手机连接」用）。仅电脑端可用：不在远程白名单里，手机调用 403 */
  remoteAdmin: {
    getStatus: (): Promise<RemoteStatus> => t.invoke(IPC.remoteGetStatus),
    setEnabled: (enabled: boolean): Promise<RemoteStatus> => t.invoke(IPC.remoteSetEnabled, enabled),
    setPort: (port: number): Promise<RemoteStatus> => t.invoke(IPC.remoteSetPort, port),
    revokeDevice: (id: string): Promise<RemoteStatus> => t.invoke(IPC.remoteRevokeDevice, id),
    revokeAll: (): Promise<RemoteStatus> => t.invoke(IPC.remoteRevokeAll),
    regenerateCode: (): Promise<RemoteStatus> => t.invoke(IPC.remoteRegenerateCode)
  },
  /**
   * 读档案（P10.6 起**带戳**）：`data` 是档案本体（null = 还没建过），
   * `stamp` 是 `{epoch, rev}` —— 渲染层收着，下一次 `saveProfile` 原样带回。
   * 戳对不上（在途保存撞上账号切换 / 别的写口动过）主进程会拒写并回最新数据，
   * 由渲染层的本地写协议执行器做「重载 + 重放」（docs/21 §8.2）。
   */
  getProfile: (): Promise<StampedDoc<UserProfile | null>> => t.invoke(IPC.profileGet),
  /**
   * 整份存档案。**失败是值不是异常**：撞上条件写屏障时返回
   * `{ok:false, code, current, stamp}`（一个字节没写、current = 最新数据），
   * 不匹配时才抛（入参形状问题照旧抛）。`stamp` 不传 = 无条件下写（逃生口，
   * 只有明确知道自己在干嘛的调用点才用它）。
   */
  saveProfile: (
    profile: UserProfile,
    stamp?: BoxStamp | null
  ): Promise<DocWriteResult<UserProfile | null>> =>
    t.invoke(IPC.profileSave, profile, stamp),
  getWrongbook: (): Promise<WrongBookEntry[]> => t.invoke(IPC.wrongbookGet),
  /**
   * 记错题。收的是 `WrongRecordItem[]` 而不是 `string[]` ——
   * **AI 出的题必须把题目本体一起送来**：它不在任何一课里，光有 key
   * 就永远找不回原样，那是一条显示了题干、也消除不掉的死条目（理由见 shared/types.ts）。
   * 内置题**不要**带本体，主进程也会把它丢掉，免得变出第二份真源。
   *
   * 返回**这次「删过又答错」的键**（复活名单，通常为空数组）——
   * 调用方（finish()）拿它弹「这条你删过，又答错了喵」。这个信息只有主进程
   * 合并**之前**能看到（合并会把 removed 字段摘掉，见 findRevivedKeys 的注释），
   * 所以必须随回复带出来；老调用点忽略返回值即可。
   */
  recordWrongbook: (items: WrongRecordItem[]): Promise<string[]> =>
    t.invoke(IPC.wrongbookRecord, items),
  clearWrongbook: (keys: string[]): Promise<void> => t.invoke(IPC.wrongbookClear, keys),
  /**
   * 用户手动动一条错题：软删 / 恢复 / 标知识点漏洞（学习闭环）。
   *
   * 入参是**一批** `{key, patch}`（单条操作就传一个元素的数组）——
   * 「清空错题本」这种批量软删因此能一发做完，而不是 N 次 IPC。
   * 返回**新列表**：调用方直接拿它刷新，省一次 `getWrongbook` 往返，
   * 也就没有「写成功了、读到的还是旧的」这种竞态。
   */
  updateWrongbook: (updates: WrongUpdateItem[]): Promise<WrongBookEntry[]> =>
    t.invoke(IPC.wrongbookUpdate, updates),
  /**
   * 收藏的**题目**（favorites.json）。⚠️ 和 profile 里的**课级**收藏同名不同义：
   * 那个是「收藏的课程」（`UserProfile.favorites`），这个是「收藏的题目」。
   *
   * 整份读 / 整份存（和 profile 那套一样）：这个文件只有渲染层一个写方，
   * 不需要给每条记录开通道。主进程负责清洗（坏文件不丢用户数据）和校形。
   * P10.6 起读写都带条件写戳（形状同 getProfile / saveProfile）。
   */
  getFavorites: (): Promise<StampedDoc<FavoritesFile>> => t.invoke(IPC.favoritesGet),
  saveFavorites: (
    file: FavoritesFile,
    stamp?: BoxStamp | null
  ): Promise<DocWriteResult<FavoritesFile>> => t.invoke(IPC.favoritesSave, file, stamp),
  /**
   * 大肥鱼备忘录（memo.json，P3 ②）。
   *
   * 整份读 / 整份存（和收藏那套一样）：这个文件只有渲染层一个写方。
   * 主进程负责清洗（坏文件不丢用户敲的字）和校形（写错就抛、零字节落盘）。
   *
   * 【为什么这次挂成 `memo.get` / `memo.save` 两个方法】备忘记的东西有两个性子
   * （代码 / 知识），将来同一个功能下多半还会长出别的动作（导出、导入）——
   * 从第一个口子起就给它一个命名空间，比以后从 `getMemoXxx` 改名便宜。
   * 这是全项目第一个命名空间式子对象，其余口子（getFavorites 那批）保持原样不动。
   */
  memo: {
    get: (): Promise<StampedDoc<MemoFile>> => t.invoke(IPC.memoGet),
    save: (file: MemoFile, stamp?: BoxStamp | null): Promise<DocWriteResult<MemoFile>> =>
      t.invoke(IPC.memoSave, file, stamp)
  },
  /** 「今天」页每日待办（today-todos.json） */
  todos: {
    get: (): Promise<TodoFile> => t.invoke(IPC.todosGet),
    save: (file: TodoFile): Promise<TodoFile> => t.invoke(IPC.todosSave, file)
  },
  /** 六级真题（docs/27）：作答记录 + 听力音频目录 */
  cet6: {
    getState: (): Promise<Cet6State> => t.invoke(IPC.cet6GetState),
    saveRecord: (examId: string, record: Cet6Record): Promise<void> => t.invoke(IPC.cet6SaveRecord, examId, record),
    resetRecord: (examId: string): Promise<void> => t.invoke(IPC.cet6ResetRecord, examId),
    pickMediaRoot: (): Promise<Cet6MediaStatus> => t.invoke(IPC.cet6PickMediaRoot),
    setLastMode: (mode: Cet6Mode): Promise<Cet6Mode> => t.invoke(IPC.cet6SetLastMode, mode),
    /** 生词本：前四个返回最新列表；lookup 调 AI 并写入 / 更新条目 */
    vocab: {
      list: (): Promise<Cet6VocabEntry[]> => t.invoke(IPC.cet6VocabList),
      add: (input: Cet6VocabInput): Promise<Cet6VocabEntry[]> => t.invoke(IPC.cet6VocabAdd, input),
      update: (id: string, patch: { mastered: boolean } | { grade: Cet6VocabGrade }): Promise<Cet6VocabEntry[]> => t.invoke(IPC.cet6VocabUpdate, id, patch),
      remove: (ids: string[]): Promise<Cet6VocabEntry[]> => t.invoke(IPC.cet6VocabRemove, ids),
      lookup: (input: Cet6VocabInput): Promise<Cet6LookupResult> => t.invoke(IPC.cet6VocabLookup, input)
    },
    gradeSubjective: (input: import('./cet6-grade').Cet6GradeRequest): Promise<import('./cet6-grade').Cet6GradeResponse> =>
      t.invoke(IPC.cet6GradeSubjective, input)
  },
  /**
   * 记一次**做完**的练习（中途退出不记，判分口径是「交完的卷才算数」）。
   *
   * 入参只报 `{mode, items: [{key, ok}]}`：课号由主进程从 key 里拆
   * （key 才是认题的凭据，两边各报一次就有两份真源，错哪份都不报错）。
   * 返回**新的练习史**——每日复习的加权要读它，调用方顺手就能把内存里那份换掉。
   */
  recordPractice: (input: PracticeRecordInput): Promise<PracticeFile> =>
    t.invoke(IPC.practiceRecord, input),
  getPractice: (): Promise<PracticeFile> => t.invoke(IPC.practiceGet),
  /**
   * 每日签到（P3 ①）。`day` 是**渲染层算好的** 'YYYY-MM-DD'（"今天"只有
   * 渲染层知道用户时区）；返回 `CheckinSubmitResult`：`awarded=false` =
   * 今天已经签过（幂等，什么都没发生）；`awarded=true` 但 `riceGranted=false`
   * = 签到记下了、大白饭没发出去；`riceGranted=true` 时看 `riceCredited`
   * （真进盒几碗，满仓时为 0；V1-42）决定播报哪句 —— 口径见 types.ts 的注释。
   * `streakReset=true` = 这次把一条连签断掉了（空转[2]）：播报要带一句
   * "从今天重新数起"，别让用户对着卡片从 30 变 1 自己猜。
   * 写盘失败会 throw —— 调用方必须 catch（否则界面卡在"正在签到"）。
   */
  checkinSubmit: (day: string): Promise<CheckinSubmitResult> =>
    t.invoke(IPC.checkinSubmit, day),
  /**
   * 读设置。**返回体里没有 apiKey**，只有一个 `hasKey` 布尔 ——
   * 真 Key 留在主进程，渲染进程从头到尾看不见它（理由见 shared/types.ts）。
   */
  getConfig: (): Promise<PublicAppConfig> => t.invoke(IPC.configGet),
  /**
   * 存设置。入参里的 `ai.apiKey` 是**三态**：
   * 不传 / `''` = 不改；`null` = 删；非空 = 设新的。
   * 所以这里收的是 `ConfigSavePayload` 而不是 `AppConfig` —— 类型上就写明了
   * 「你没带 Key 是正常的」，免得哪天有人为了类型对齐，把真 Key 从界面回传一次。
   */
  saveConfig: (config: ConfigSavePayload): Promise<void> =>
    t.invoke(IPC.configSave, config),
  detectEnv: (): Promise<EnvReport> => t.invoke(IPC.envDetect),
  /**
   * 编译并运行一段代码。**这是渲染层唯一能执行代码的入口**——
   * 编译、超时、杀进程这些事全在主进程做，渲染层拿到的是一个结果对象。
   *
   * 主进程会在两种情况下抛错（而不是返回 ok:false 的结果）：
   * 入参不合法、代码超过 200KB。所以调用方**必须 try/catch**，
   * 否则界面会卡在「正在运行中」不动。
   */
  runCode: (req: RunRequest): Promise<RunResult> => t.invoke(IPC.runnerRun, req),
  cancelRun: (): Promise<boolean> => t.invoke(IPC.runnerCancel),

  /** 让 AI 现场出题。回来的题**已经过校验、能直接判分**，坏数据在那边就丢掉了 */
  aiGenerateQuestions: (input: AiGenerateInput): Promise<AiResult<AiParseResult>> =>
    t.invoke(IPC.aiGenerateQuestions, input),

  /** 设置页的「测试连接」：一次验完 Key、服务地址、模型名三样 */
  aiTestConnection: (): Promise<AiResult<{ model: string }>> =>
    t.invoke(IPC.aiTestConnection),

  /**
   * 掐掉在飞的那个 AI 请求（真的 abort，不是假装不看了）。
   * 没有请求在飞时调用它是安全的，什么都不会发生。
   */
  aiCancel: (): Promise<void> => t.invoke(IPC.aiCancel),

  /**
   * 读某天的挑战批次**和抽题要用的排除清单**（见 types.ts 的 `ChallengeToday`）。
   *
   * 两个一起给，是因为抽题时两样都要用，而分两次拿会有个缝：
   * 中间记录被改了的话，「今天那批」和「排除清单」就来自两个时间点。
   * `day` 为 `null` 表示今天还没抽过 —— **不是错误**，该去抽一批新的。
   */
  getChallenge: (dateKey: string): Promise<ChallengeToday> =>
    t.invoke(IPC.challengeGet, dateKey),

  /**
   * 写回**一天**。合并进 `days` 并裁掉 30 天以外的都由主进程做，
   * 渲染进程不需要（也不该）知道文件整体有多大。
   *
   * 入参是**整天的快照**（抽完题存一次、做完题带着分数再存一次），
   * 不是增量 —— 增量合并要处理「字段这次没传是表示不改还是不想要了」，
   * 而这里根本没有那种歧义：一天的数据就那么多。
   */
  saveChallenge: (day: ChallengeDay): Promise<void> =>
    t.invoke(IPC.challengeSave, day),

  /** 导出 Markdown 文档到用户选择的本地目录 */
  exportMarkdown: (files: MarkdownExportFile[]): Promise<MarkdownExportResult> =>
    t.invoke(IPC.exportMarkdown, files),

  /**
   * 用本地 IDE 打开这段代码（exe **不在入参里**：主进程从配置现读）。
   * 返回值三态 unconfigured / missing / failed 的下一步各不相同，见 IdeOpenResult。
   *
   * `own`（2026-10-06）：这段代码是不是用户自己写的（渲染层种子比对的判定）。
   * 主进程用它决定要不要挂**编译观察**（native-watch）——
   * 官方示例代码原样打开/导出不挂表。缺省（不传）= false。
   */
  openInIde: (input: { lang: LangOfCode; code: string; own?: boolean }): Promise<IdeOpenResult> =>
    t.invoke(IPC.runnerOpenIde, input),

  /** 导出代码到临时文件，返回文件路径。**剪贴板由渲染层自己碰**（主进程不掺和） */
  exportCode: (input: { lang: LangOfCode; code: string; own?: boolean }): Promise<ExportCodeResult> =>
    t.invoke(IPC.runnerExportCode, input),

  /**
   * 自动检测本机装了哪些 IDE（设置页 / 练习场「🔍 自动检测」）。
   * **只探测、不保存** —— 选中哪一个后由渲染层照常走 saveConfig。
   */
  detectIde: (): Promise<IdeDetectResult> => t.invoke(IPC.runnerDetectIde),

  /**
   * 订阅「配置被主进程自己改了」的推送（`PublicAppConfig`，
   * 生产者是主进程的 broadcastPublicConfig——见 IPC.configExternal 的注释）。
   * 回调只收载荷、返回退订函数。
   * 载荷与 `getConfig()` 同形（apiKey 已抹成 hasKey），整份换上即可。
   */
  onConfigExternal: (cb: (cfg: PublicAppConfig) => void): (() => void) =>
    t.on(IPC.configExternal, (cfg) => cb(cfg as PublicAppConfig)),

  // ---- 云账号（P10.3 第一步，2026-10-10）
  //
  // **失败是值不是异常**：网络类结果一律走 `CloudResult<T>`（`{ok:true,data}`
  // 或 `{ok:false,failure:{code,...}}`）—— 跨 IPC 抛错误时 Electron 只带得走
  // message，code 会整个丢掉，而渲染层的下一步动作完全由 code 决定
  // （改密码 / 稍后再试 / 回登录页）。只有「我们传错了形状」主进程才抛。
  //
  // ⚠️ **token 不在这一层的任何出入参里**：注册/登录成功返回的是
  // `CloudAuthView`（服务端 AuthResponse 减掉 token），token 由主进程自己
  // 保管（P10.5 起是 safeStorage 加密的 session.bin，见 main/cloud/session-store.ts）
  // —— 渲染层连"看不见"都是类型保证的，不是口头约定。
  //
  // `session()` 的 `data` 为 null = 未登录（本地没令牌，或服务端判定令牌
  // 已死）；失败（NETWORK/TIMEOUT 等）时令牌**原样保留** —— 断网不等于被登出。
  cloud: {
    /**
     * 交一天的挑战成绩（结算入队；P10.x 上行接线）。主进程入队 + 触发一次
     * 上行，invoke 只回 `{queued}`（"排上了没有"）—— **网络结果不在这里等**：
     * 断网/未登录时排着，下次触达服务端再发；同一 dateKey 已在队 = queued:false
     * （不报错：收工 watcher 自己也有一次性守卫，这是第二道闸；P10.6 ⑤ 起
     * 补交通道同样把 queued:false 当"已在队 = 已交付"，据此写「已提交」标记）。
     * 载荷**不许**带 submissionId/installId（由主进程贴）；形状不合法主进程抛
     * （"我们自己传错了参数"才抛的先例，同 register/login）。
     */
    settleChallenge: (payload: ChallengeSettlePayload): Promise<{ queued: boolean }> =>
      t.invoke(IPC.cloudChallengeSettle, payload),
  },

  study: {
    createHtmlPreview: (html: string, opts?: { network?: boolean }): ReturnType<StudyApi['createHtmlPreview']> => t.invoke(IPC.studyCreateHtmlPreview, html, opts),
    getState: (): ReturnType<StudyApi['getState']> => t.invoke(IPC.studyGetState),
    saveMemory: (input: Parameters<StudyApi['saveMemory']>[0]): ReturnType<StudyApi['saveMemory']> => t.invoke(IPC.studySaveMemory, input),
    forgetMemory: (id: string): ReturnType<StudyApi['forgetMemory']> => t.invoke(IPC.studyForgetMemory, id),
    updatePosition: (input: Parameters<StudyApi['updatePosition']>[0]): ReturnType<StudyApi['updatePosition']> => t.invoke(IPC.studyUpdatePosition, input),
    saveNote: (input: Parameters<StudyApi['saveNote']>[0]): ReturnType<StudyApi['saveNote']> => t.invoke(IPC.studySaveNote, input),
    archiveNote: (id: string): ReturnType<StudyApi['archiveNote']> => t.invoke(IPC.studyArchiveNote, id),
    importMaterials: (): ReturnType<StudyApi['importMaterials']> => t.invoke(IPC.studyImportMaterials),
    readMaterial: (id: string): ReturnType<StudyApi['readMaterial']> => t.invoke(IPC.studyReadMaterial, id),
    generatePlan: (input: Parameters<StudyApi['generatePlan']>[0]): ReturnType<StudyApi['generatePlan']> => t.invoke(IPC.studyGeneratePlan, input),
    confirmPlan: (input: Parameters<StudyApi['confirmPlan']>[0]): ReturnType<StudyApi['confirmPlan']> => t.invoke(IPC.studyConfirmPlan, input),
    discardPlan: (planId: string): ReturnType<StudyApi['discardPlan']> => t.invoke(IPC.studyDiscardPlan, planId),
    setTaskStatus: (input: Parameters<StudyApi['setTaskStatus']>[0]): ReturnType<StudyApi['setTaskStatus']> => t.invoke(IPC.studySetTaskStatus, input),
    editTasks: (input: Parameters<StudyApi['editTasks']>[0]): ReturnType<StudyApi['editTasks']> => t.invoke(IPC.studyEditTasks, input),
    exportVault: (): ReturnType<StudyApi['exportVault']> => t.invoke(IPC.studyExportVault),
    getUsage: (refresh?: boolean): ReturnType<StudyApi['getUsage']> => t.invoke(IPC.studyGetUsage, refresh),
    saveConnection: (input: Parameters<StudyApi['saveConnection']>[0]): ReturnType<StudyApi['saveConnection']> => t.invoke(IPC.studySaveConnection, input),
    detectAgent: (): ReturnType<StudyApi['detectAgent']> => t.invoke(IPC.studyDetectAgent),
    listModels: (command: string): ReturnType<StudyApi['listModels']> => t.invoke(IPC.studyListModels, command),
    connect: (id: string): ReturnType<StudyApi['connect']> => t.invoke(IPC.studyConnect, id),
    authenticate: (input: Parameters<StudyApi['authenticate']>[0]): ReturnType<StudyApi['authenticate']> => t.invoke(IPC.studyAuthenticate, input),
    disconnect: (id: string): ReturnType<StudyApi['disconnect']> => t.invoke(IPC.studyDisconnect, id),
    setModel: (input: Parameters<StudyApi['setModel']>[0]): ReturnType<StudyApi['setModel']> => t.invoke(IPC.studySetModel, input),
    removeConnection: (id: string): ReturnType<StudyApi['removeConnection']> => t.invoke(IPC.studyRemoveConnection, id),
    selectConnection: (id: string | null): ReturnType<StudyApi['selectConnection']> => t.invoke(IPC.studySelectConnection, id),
    runMath: (input: Parameters<StudyApi['runMath']>[0]): ReturnType<StudyApi['runMath']> => t.invoke(IPC.studyRunMath, input)
  } satisfies StudyApi,

  // ---- AI Assistant (2026-10-27)
  aiAssistant: {
    send: (payload: AiChatSendPayload): Promise<void> =>
      t.invoke(IPC.aiChatSend, payload),
    cancel: (sessionId: string): Promise<{ ok: boolean }> =>
      t.invoke(IPC.aiChatCancel, sessionId),
    onStream: (cb: (event: AiChatStreamEvent) => void): (() => void) =>
      t.on(IPC.aiChatStream, (event) => cb(event as AiChatStreamEvent)),
    onSessionsChanged: (cb: () => void): (() => void) =>
      t.on(IPC.aiSessionsChanged, () => cb()),
    getSessions: (): Promise<AiChatSession[]> =>
      t.invoke(IPC.aiSessionsGet),
    saveSessions: (sessions: AiChatSession[]): Promise<{ ok: boolean }> =>
      t.invoke(IPC.aiSessionsSave, sessions)
  },
  video: {
    generate: (input: VideoGenerationInput): Promise<VideoGenerationResult> => t.invoke(IPC.videoGenerate, input),
    onProgress: (cb: (progress: VideoProgress) => void): (() => void) => t.on(IPC.videoProgress, (progress) => cb(progress as VideoProgress)),
    cancel: (requestId: string): Promise<{ ok: boolean }> => t.invoke(IPC.videoCancel, requestId),
    list: (): Promise<ExplainerVideo[]> => t.invoke(IPC.videoList),
    delete: (id: string): Promise<{ ok: boolean }> => t.invoke(IPC.videoDelete, id),
    onVerifyPrompt: (cb: (prompt: VideoVerifyPrompt) => void): (() => void) =>
      t.on(IPC.videoVerifyPrompt, (prompt) => cb(prompt as VideoVerifyPrompt)),
    answerVerify: (confirmationId: string, useNative: boolean | null): Promise<{ ok: boolean }> =>
      t.invoke(IPC.videoVerifyAnswer, confirmationId, useNative)
  },
  update: {
    getStatus: (): Promise<UpdateSnapshot> => t.invoke(IPC.updateGetStatus),
    check: (): Promise<UpdateSnapshot> => t.invoke(IPC.updateCheck),
    install: (): Promise<{ ok: boolean }> => t.invoke(IPC.updateInstall),
    onStatus: (cb: (snapshot: UpdateSnapshot) => void): (() => void) =>
      t.on(IPC.updateStatus, (snapshot) => cb(snapshot as UpdateSnapshot))
  }
}

  return miai
}

export type MiaiApi = ReturnType<typeof createMiaiApi>
