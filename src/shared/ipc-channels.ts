/**
 * IPC 通道名常量 —— main 与 renderer 的契约唯一真源。
 * 后续模块（env/runner/profile/practice/review/ai）的通道统一在这里追加，
 * 禁止在业务代码里写裸字符串。
 */
export const IPC = {
  profileGet: 'profile:get',
  profileSave: 'profile:save',
  wrongbookGet: 'wrongbook:get',
  wrongbookRecord: 'wrongbook:record',
  wrongbookClear: 'wrongbook:clear',
  /**
   * 用户**手动**动一条错题：软删 / 恢复 / 标知识点漏洞（学习闭环，2026-09-29）。
   *
   * 【为什么和 record / clear 分开】三条路的触发者不同：record 是答错记账、
   * clear 是答对毕业、这条是用户在列表里点的。并成一条的代价是
   * 「再错一次会不会复活」这类问题得把三种语义塞进一个入参里猜。
   *
   * 入参是一**批** `WrongUpdateItem`（`{key, patch}`）—— 单条操作传一个元素的数组。
   * 成批是为了「清空错题本」那种动作能一次请求做完，而不是发 N 条 IPC。
   * 返回**新列表**（渲染层直接拿它刷新快照，省一次 get 往返）。
   */
  wrongbookUpdate: 'wrongbook:update',
  /**
   * 收藏的题目（favorites.json，学习闭环）。
   *
   * 【为什么是「整份保存」而不是逐条增删】这个文件只有渲染层一个写方
   * （主进程不往里写任何东西，和 profile.json 同型），所以照 profile 那套
   * 载入 + 防抖整份保存就够，不需要给每条记录开一条通道。
   * ⚠️ 和它同名不同义的是 profile 里的**课级**收藏，见 types.ts 里那段注释。
   */
  favoritesGet: 'favorites:get',
  favoritesSave: 'favorites:save',
  /**
   * 大肥鱼备忘录（memo.json，P3 ②）。
   *
   * 【为什么也是「整份保存」】和收藏同型：文件只有渲染层一个写方
   * （主进程不往里写任何东西），载入 + 防抖整份保存就够，
   * 不给每条备忘单开一条通道。
   * 【和 favorites 的差别只在两端的性子】写口（`sanitizeMemo`）对坏形状
   * **抛错** —— 备忘是用户自己敲的字，丢一条的代价比丢一道收藏大得多。
   */
  memoGet: 'memo:get',
  memoSave: 'memo:save',
  /** 六级真题（cet6.json，docs/27 §2.2）：作答记录与音频目录。入口校验在 main/cet6.ts */
  cet6GetState: 'cet6:get-state',
  cet6SaveRecord: 'cet6:save-record',
  cet6ResetRecord: 'cet6:reset-record',
  cet6PickMediaRoot: 'cet6:pick-media-root',
  /** 目录页「练习 | 考试」的上次选择（docs/27 §8.1） */
  cet6SetLastMode: 'cet6:set-last-mode',
  /** 生词本（cet6-vocab.json，docs/27 §8.3）：主进程是唯一写方 */
  cet6VocabList: 'cet6:vocab-list',
  cet6VocabAdd: 'cet6:vocab-add',
  cet6VocabUpdate: 'cet6:vocab-update',
  cet6VocabRemove: 'cet6:vocab-remove',
  cet6VocabLookup: 'cet6:vocab-lookup',
  /**
   * 练习史（practice.json，学习闭环）。
   *
   * 【为什么 record 由主进程算 id、渲染层只交 {key, ok}】
   * 落盘的是「一次完成」的会话（id 自增、超上限丢最老），自增和裁剪是
   * 文件自己的事，放在写口一处做完；渲染层交上来的东西越少，
   * 能写坏文件的花样就越少（哨兵课号那条校验也在主进程，见 practice-merge.ts）。
   */
  practiceRecord: 'practice:record',
  practiceGet: 'practice:get',
  configGet: 'config:get',
  configSave: 'config:save',
  envDetect: 'env:detect',
  runnerRun: 'runner:run',
  runnerCancel: 'runner:cancel',
  aiGenerateQuestions: 'ai:generate-questions',
  aiTestConnection: 'ai:test-connection',
  /**
   * 掐掉正在飞的那个 AI 请求。
   *
   * 【为什么「取消」必须是一条真通道，而不是「界面不看了」】
   * 不 abort 的话，请求还在跑、token 还在烧、**用户的钱还在花** ——
   * 界面上却显示「已取消」，那是骗人。docs/04 硬规定 AI 等待中必须可取消。
   *
   * 通道不带参数，因为它只能表示「掐掉现在那个」——
   * 这要求主进程**同一时刻只允许一个 AI 请求在飞**（见 main/index.ts 的单飞逻辑）。
   * 要是有两个在飞，这一句「取消」就说不清是取消哪个了。
   */
  aiCancel: 'ai:cancel',

  /**
   * 读某一天的挑战批次 + 抽题要用的排除清单（见 types.ts 的 `ChallengeToday`）。
   * `day` 为 `null` 表示今天还没抽过题 —— **不是错误**。
   *
   * 【为什么不叫 `challenge:today`】
   * 「今天」是渲染进程算出来的（它才知道用户所在时区，见 shared/dates.ts），
   * 主进程只认一个日期字符串。主进程自己算「今天」的话，两边时区一旦不一致，
   * 会出现「抽的是今天的题、存的是昨天的档」这种查都没法查的问题。
   */
  challengeGet: 'challenge:get',
  /** 写回**一天**。合并进 days 并裁掉 30 天以外的，都在主进程做 */
  challengeSave: 'challenge:save',
  /**
   * 每日签到（P3 ①，2026-10-08）。
   *
   * 入参：`day: string`（'YYYY-MM-DD'，**渲染层算好带来** —— 同 challenge 的
   * 理由："今天"只有渲染层知道用户时区，主进程不自己算）。
   * 返回：`CheckinSubmitResult`（见 types.ts；成功形状，失败走 throw）。
   *
   * 【为什么签到必须是主进程一条通道，而不是渲染层自己写 profile】
   * 和发奖图同因（见 rewardsGrant）：`profile:save` 是渲染层整份保存、
   * **无条件丢弃**入参里的主进程所有字段。签到要写 `profile.checkin`，
   * 渲染层自己塞的话，下一次防抖保存就静默抹掉 —— "签了，但下次启动又没签过"。
   * 而且签到带着**发大白饭**的副作用：判重（days 里有没有这天）、写档、发饭
   * 三步必须在同一个进程里挨着做完，才能保证"重复请求不发第二碗饭"。
   */
  checkinSubmit: 'checkin:submit',
  exportMarkdown: 'dialog:export-markdown',
  /**
   * 用设置里配置的本地 IDE 打开一段代码（练习场「本地 IDE 打开」）。
   *
   * 入参 `{ lang, code }`；**exe 不在入参里** —— 主进程自己从配置现读
   * （安全边界：让渲染层传 exe 等于开一条「任意程序执行」通道，
   * 见 main/runner/native-ide.ts 文件头）。
   */
  runnerOpenIde: 'runner:open-ide',
  /**
   * 把一段代码导出成临时文件（练习场「导出并复制路径」）。
   * **只写盘、不碰剪贴板** —— 复制路径由渲染层自己做。
   */
  runnerExportCode: 'runner:export-code',
  /**
   * 自动探测本机装了哪些 IDE（设置页 / 练习场的「🔍 自动检测」）。
   *
   * 无入参；返回 `IdeDetectResult`（失败即值）。**不落盘、不改配置** ——
   * 选中哪一个由渲染层决定，写入照常走 `config:save`。主进程只负责「去找」，
   * 这样「探测」和「保存用户的选择」是两件事，各自的失败不会互相污染。
   */
  runnerDetectIde: 'runner:detect-ide',

  /**
   * 主进程 → 全部窗口：配置被**主进程自己**改了（载荷 `PublicAppConfig`）。
   *
   * 【为什么已有 config:get 还要这条推送】configGet 是拉取，只有调用方主动
   * 问才更新；设置页正开着时，主进程侧的改动（如环境检测结果写回 envCache）
   * 必须当场到达，否则页面显示的是旧值（下次拉取才被纠正）。
   *
   * 载荷过 `toPublicConfig`（与 configGet 同一出口，apiKey 照抹成 hasKey）——
   * 它是**主进程主动推**的配置，不是渲染层提交的回声。将来凡「主进程自发
   * 改配置」的入口都从这里广播一条，别再让渲染层猜。
   */
  configExternal: 'config:external',

  /**
   * 挑战结算入队（P10.x 上行接线）：渲染层把一天的挑战成绩交上来，主进程
   * **入队**（`.sync/pending-ops.json`）并触发一次上行，invoke 只回
   * `{queued}`（"排上了没有"）—— 网络结果不在这条通道上等（断网/未登录
   * 时排着，下次触达服务端再发；同一 dateKey 已在队 = queued:false）。
   * 载荷形状 = shared/cloud/dto.ts 的 ChallengeSettlePayload（**不许**带
   * submissionId/installId —— 那两个字段由主进程贴，见 pending-ops 注释）。
   */
  cloudChallengeSettle: 'cloud:challenge-settle',

  // ---------------------------------------------------------------- AI Assistant (2026-10-27)
  aiChatSend: 'ai:chat-send',
  aiChatStream: 'ai:chat-stream',
  aiChatCancel: 'ai:chat-cancel',
  aiSessionsGet: 'ai:sessions-get',
  aiSessionsSave: 'ai:sessions-save',
  aiSessionsChanged: 'ai:sessions-changed',
  studyGetState: 'study:get-state',
  studySaveMemory: 'study:save-memory',
  studyForgetMemory: 'study:forget-memory',
  studyUpdatePosition: 'study:update-position',
  studySaveNote: 'study:save-note',
  studyArchiveNote: 'study:archive-note',
  studyImportMaterials: 'study:import-materials',
  studyReadMaterial: 'study:read-material',
  studyGeneratePlan: 'study:generate-plan',
  studySetTaskStatus: 'study:set-task-status',
  studyExportVault: 'study:export-vault',
  studyGetUsage: 'study:get-usage',
  studySaveConnection: 'study:save-connection',
  studyConnect: 'study:connect',
  studyDetectAgent: 'study:detect-agent',
  studyListModels: 'study:list-models',
  studyAuthenticate: 'study:authenticate',
  studyDisconnect: 'study:disconnect',
  studySelectConnection: 'study:select-connection',
  studySetModel: 'study:set-model',
  studyRemoveConnection: 'study:remove-connection',
  studyRunMath: 'study:run-math',
  studyCreateHtmlPreview: 'study:create-html-preview',

  // ---------------------------------------------------------------- 手机连接（docs/29）
  // 全部仅电脑端：不在 shared/remote-channels.ts 白名单里，手机调用一律 403。
  /** 状态：开关 / 端口 / 是否在跑 / 监听错误 / 配对码 / 已配对设备 / 本机地址（只在服务开着时才枚举） */
  remoteGetStatus: 'remote:get-status',
  remoteSetEnabled: 'remote:set-enabled',
  remoteSetPort: 'remote:set-port',
  remoteRevokeDevice: 'remote:revoke-device',
  remoteRevokeAll: 'remote:revoke-all',
  /** 手动换一个新配对码 */
  remoteRegenerateCode: 'remote:regenerate-code'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
