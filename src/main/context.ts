/**
 * 主进程上下文（docs/28 §2）：被两个及以上功能共用的服务，由 `createMainContext` 一次造好。
 *
 * ⚠️ 本文件**模块顶层不许有副作用**（只有类型 / 函数声明）。app.ts 的启动时序是硬约束：
 * 调试端口 → scheme 特权 → 数据目录可写检查 → 才轮到构造 store / 服务。ES import 会被
 * 提升，顶层一旦构造东西就会跑在可写检查之前。所以一切构造都在 `createMainContext()` 里，
 * 由 app.ts 在原来那个位置显式调用。
 */
import { app, BrowserWindow, nativeTheme, safeStorage } from 'electron'
import { STUDY_TEXT } from '../shared/study-copy'
import { studyContext } from '../shared/study-companion'
import { StudyStore } from './study/store'
import { generateStudyPlan } from './study/materials'
import { recordStudyUsage } from './study/usage'
import { StudyConnections } from './study/acp'
import { STUDY_ACTION_INSTRUCTIONS } from './study/actions'
import { IPC } from '../shared/ipc-channels'
import { shouldCommitEnvReport } from '../shared/env-cache'
import type { EnvReport } from '../shared/types'
import { createJsonStore } from './store/json-store'
import { assertSupportedVersion } from '../shared/data-version'
import { createStores } from './store/stores'
import { DEVICE_FILE_VERSION, ensureDeviceFile, saveDeviceFile, type DeviceInfo } from './store/device'
import { toPublicConfig } from './store/config-merge'
import { migrateConfig } from '../shared/config-migrate'
import { createSecretStore } from './store/safe-storage'
import { NativeHarness } from './ai/native-harness'
import { buildAssistantSystemPrompt } from '../shared/ai-assistant-prompt'
import { createCloudChallengeClient, createCloudRiceClient, createPendingOpsStore, createRiceJournal, createSessionTokenStore, createUplink, resolveCloudBaseUrl, type AccountFlowDeps, type FetchLike } from './cloud'
import { readLegacyPetRice } from './cloud/legacy-pet-rice'
import type { AppConfig, LangOfCode, PublicAppConfig } from '../shared/types'
import { CURRENT_CONFIG_VERSION, DEFAULT_APP_CONFIG } from '../shared/types'
import type { JsonStore } from './store/json-store'
import type { SecretStore } from './store/safe-storage'
import type { Stores } from './store/stores'

export interface MainContextInput {
  /** `app.getPath('userData')`（便携版 = exe 旁 data/）：数据落点，app.ts 算好传入 */
  storageDir: string
  /**
   * `study-math.js` 的绝对路径。**必须由 app.ts 用它自己的 `__dirname` 算好传进来**：
   * 主进程有三个 rollup 入口，被搬走的代码可能落进别的输出目录的共享 chunk，
   * 在那里重算 `__dirname` 会指到错地方。
   */
  studyMathPath: string
  /**
   * 构建好的渲染层目录（含 index.html），手机连接的 HTTP 服务从这里出静态资源。
   * 同样由 app.ts 用自己的 `__dirname` 算好传入；开发模式（Vite dev server）下它指向的目录可能不存在。
   */
  rendererDir: string
}

/** 手机连接 HTTP 服务挂载的「静态资源」路由：由各功能在 register 里登记，服务按前缀转发 */
export type HttpAssetHandler = (req: {
  /** 去掉路由前缀后以 / 开头的剩余路径（未解码） */
  pathname: string
  method: string
  range: string | null
}) => Response | Promise<Response>

export interface MainContext {
  storageDir: string
  studyMathPath: string
  rendererDir: string
  /** 前缀（如 `/cet6/data/`）→ handler；手机连接服务在请求时才查，所以功能的注册顺序无关 */
  httpAssets: Map<string, HttpAssetHandler>
  /** 主进程自发推送配置时的额外接收方（手机连接的事件流）；返回取消函数 */
  addConfigSink(sink: (pub: PublicAppConfig) => void): () => void
  addChatSessionsSink(sink: () => void): () => void
  notifyChatSessionsChanged(): void
  /** 盒装 store（跟人走）：profile / wrongbook / favorites / practice / challenge / memo + box */
  stores: Stores
  /** config.json（设备级，不进盒） */
  configStore: JsonStore<AppConfig>
  secretStore: SecretStore
  /** 配置读口（唯一读 config.json 的地方，迁移挂在它上面） */
  readConfig(withSecret?: boolean): AppConfig
  readPublicConfig(): PublicAppConfig
  broadcastPublicConfig(): void
  commitEnvReport(report: EnvReport, rechecked: LangOfCode[], startedAt?: number): boolean
  device(): DeviceInfo
  /** study 与 ai-chat 共用 */
  study: {
    store: StudyStore
    connections: StudyConnections
    harness: NativeHarness
    lessonIds: Set<string>
    promptOnce(prompt: string, signal: AbortSignal, tag: string): Promise<string>
    generateLearningPlan(input: unknown, signal?: AbortSignal): ReturnType<typeof generateStudyPlan>
  }
  /** 云上行束：构造是急切的（账本 / 设备身份在启动时就读盘），所以在这里一次造好 */
  cloud: {
    settleQueue: ReturnType<typeof createPendingOpsStore>
    uplink: ReturnType<typeof createUplink>
    accountFlowDeps: AccountFlowDeps
  }
}

export interface MainFeature {
  name: string
  /** app ready 之后、建窗口之前调用一次：注册 IPC handler、装协议。 */
  register(ctx: MainContext): void
  /** before-quit 时调用：收子进程、停定时器。 */
  dispose?(): void
}

declare const __STUDY_LESSON_IDS__: string[]

export function createMainContext(input: MainContextInput): MainContext {
  const { storageDir, studyMathPath, rendererDir } = input
  const httpAssets = new Map<string, HttpAssetHandler>()
  const configSinks = new Set<(pub: PublicAppConfig) => void>()
  const chatSessionsSinks = new Set<() => void>()

  /**
   * 盒装存储（P10.1）：**跟人走**的六个文件全部经 StoreBox 路由。
   *
   * 【盒子怎么分】客人盒 = 数据目录（`storageDir`）本身 —— 老档案一个字节不搬
   * （收编语义的红线：客人档案在任何路径下都不移动）；账号盒在
   * `<数据目录>/accounts/<accountId>/` 下。切盒走 `box.switchTo(...)`（P10.5 接线）。
   *
   * 【谁不进盒】config.json（设备级设置，含 apiKey——永不同步）与 ai-cache.json
   * （本机算过的缓存，同步它没有意义）留在下面单独建；旧 pet.json
   * 同理（设备级，只在账本 genesis 时读一次）。device.json 也不是盒内文件 ——
   * 它是设备的身份证，一个设备一份（见 device() 的注释）。
   *
   * 各 store 的说明（profile 学习档案 / wrongbook 错题本信封 / challenge 每日挑战单独文件 /
   * favorites 题目收藏（和 profile.favorites 课级收藏同名不同义）/ practice 练习史 /
   * memo 备忘录）随 store 一起住在 store/stores.ts 与各 *-merge.ts 的头注释里。
   */
  // stores 对象本身要留给 P10.5 的账号流程（AccountFlowDeps.stores：收编/切盒/
  // 装账本都从它拿），故先命名再解构 —— 用具名对象拼一份假的只会在 store 加字段
  // 时静默漏掉一个键。
  const stores = createStores(storageDir)
  // box（P10.x 上行接线起在这里取）：大白饭账本与结算队列都按**当前盒目录**
  // 现读（客人盒 = 数据目录本身，账号盒在 accounts/<id>/ 下）；切盒时的
  // 账本 reload 与会话扫描在 P10.5 接线
  const { box } = stores

  // 设置（M5-01 环境缓存 / M6 设置页）：config.json —— **设备级，不进盒**（文件头有账）
  const configDisk = createJsonStore<AppConfig>(storageDir, 'config.json', {
    validate: value => !!value && typeof value === 'object' && !Array.isArray(value)
  })
  const configStore: JsonStore<AppConfig> = {
    read: () => configDisk.read(),
    write: (value) => {
      assertSupportedVersion(configDisk.read(), CURRENT_CONFIG_VERSION)
      configDisk.write(value)
    }
  }

  const secretStore = createSecretStore(storageDir)

  /**
   * 读配置，缺了就给一份默认的（**别把 DEFAULT_APP_CONFIG 直接交出去**，它是共享常量）。
   *
   * 【迁移为什么挂在这里】这是全项目**唯一**读 config.json 的地方
   * （`configStore.read()` 的其它调用点一个都没有）。铁律 6 要求「加字段就写迁移」，
   * 迁移要有个地方跑——挂在读口上，就**不存在「漏了某条路径没迁」这种可能**，
   * 因为所有路径都从这里过。
   *
   * 【为什么迁完要落一次盘】
   * 不落盘也能用（每次读重新迁一遍，结果一样）。但那样文件里的 `version`
   * 会**永远停在 1**，而内存里跑的是 v2 —— 将来排查问题时打开 config.json，
   * 看到的版本号和实际行为对不上，这类误导比多写一次盘贵得多。
   * 只在版本真的变了时才写，正常启动一次都不写。
   *
   * 写失败（磁盘满、没权限）**不阻塞读取**：这次用内存里迁好的配置照常干活，
   * 顶多下次读再迁一遍。迁移是幂等的，重复跑没有任何副作用。
   */
  function readConfig(withSecret = true): AppConfig {
    const raw = configStore.read()
    const cfg = raw === null ? structuredClone(DEFAULT_APP_CONFIG) : migrateConfig(raw)
    const newer = !!raw && typeof raw.version === 'number' && raw.version > CURRENT_CONFIG_VERSION
    if (newer) cfg.version = raw!.version

    if (withSecret && secretStore.hasKey()) {
      cfg.ai.apiKey = secretStore.getApiKey()
    } else if (withSecret && !newer && cfg.ai.apiKey && cfg.ai.apiKey.trim()) {
      secretStore.setApiKey(cfg.ai.apiKey)
      cfg.ai.apiKey = secretStore.getApiKey()
      try {
        configStore.write({ ...cfg, ai: { ...cfg.ai, apiKey: '' } })
      } catch {
        /* ignore */
      }
    }

    if (withSecret && !newer && raw && raw.version !== cfg.version) {
      try {
        configStore.write({ ...cfg, ai: { ...cfg.ai, apiKey: '' } })
      } catch {
        /* 落盘失败不影响本次使用，下次读会再迁一遍 */
      }
    }
    return cfg
  }

  // Settings must remain reachable when a saved key cannot be decrypted.
  function readPublicConfig(): PublicAppConfig {
    const cfg = readConfig(false)
    const pub = toPublicConfig(cfg)
    pub.ai.hasKey = secretStore.hasKey() || !!cfg.ai.apiKey.trim()
    try {
      if (!secretStore.isEncryptionAvailable()) throw new Error('unavailable')
      if (secretStore.hasKey()) secretStore.getApiKey()
    } catch {
      pub.ai.keyError = true
    }
    return pub
  }

  function notifyChatSessionsChanged(): void {
    for (const w of BrowserWindow.getAllWindows()) {
      if (!w.isDestroyed()) {
        try { w.webContents.send(IPC.aiSessionsChanged) } catch { /* window closed */ }
      }
    }
    for (const sink of chatSessionsSinks) {
      try { sink() } catch { /* one receiver must not block the others */ }
    }
  }

  function broadcastPublicConfig(): void {
    const pub = readPublicConfig()
    for (const w of BrowserWindow.getAllWindows()) {
      if (!w.isDestroyed()) {
        try {
          w.webContents.send(IPC.configExternal, pub)
        } catch {
          /* ignore */
        }
      }
    }
    for (const sink of configSinks) {
      try {
        sink(pub)
      } catch {
        /* 一个接收方出错不影响其它 */
      }
    }
  }

  function commitEnvReport(report: EnvReport, rechecked: LangOfCode[], startedAt?: number): boolean {
    if (rechecked.length === 0) return false
    const fresh = readConfig(false)
    if (startedAt !== undefined && !shouldCommitEnvReport(fresh.envCache?.at, startedAt)) {
      return false
    }
    fresh.envCache = { report, at: new Date().toISOString() }
    configStore.write(fresh)
    broadcastPublicConfig()
    return true
  }

  /**
   * 应用只有浅色（2026-11-13 起移除暗色主题）：把**原生层**钉死在浅色，一次性设置。
   * 不钉的话，Windows 开着深色模式时原生菜单 / 滚动条 / 窗口按钮会跟系统走成深色，
   * 压在我们的浅色界面上。窗口底色与按钮符号色见 `shared/theme.ts`，由 createWindow 直接使用。
   */
  nativeTheme.themeSource = 'light'

  /**
   * 设备身份（P10.1 第 2 项）：device.json 在**数据目录根**（不是盒内文件 ——
   * 一台设备一份，跟着盒搬家才是错的）。惰性建、记忆化；正常路径下
   * ensureDeviceFile 幂等（文件在就一个字节都不写，连 mtime 都不动）。
   *
   * 【建不出来怎么办】磁盘只读/权限异常时 ensureDeviceFile 会抛 —— 但那不该
   * 连坐 practice 的读（今天是能读的）。退回**本次进程内**的随机 id：uid 只需要
   * 唯一性（前缀把各台设备的数字 id 分开），它一样能把会话分开；而且那种磁盘上
   * uid 也写不进去（practice 的写口同样失败），不会留下"半真半假"的档。
   */
  let memoDevice: DeviceInfo | null = null
  function device(): DeviceInfo {
    if (memoDevice === null) {
      try {
        memoDevice = ensureDeviceFile(storageDir)
      } catch (err) {
        console.warn('[miai] device.json unavailable, using a volatile install id this session', err)
        memoDevice = {
          version: DEVICE_FILE_VERSION,
          installId: crypto.randomUUID(),
          clientLabel: 'device'
        }
      }
    }
    return memoDevice
  }

  // ---------------------------------------------------------------- 学习助手（study + ai-chat 共用）

  const studyStore = new StudyStore(storageDir)
  const studyConnections = new StudyConnections(studyStore)
  const studyLessonIds = new Set(__STUDY_LESSON_IDS__)

  const nativeHarness = new NativeHarness({
    getConfig: () => {
      const cfg = readConfig()
      return {
        protocol: cfg.ai.protocol ?? 'openai',
        baseUrl: cfg.ai.baseUrl,
        apiKey: cfg.ai.apiKey,
        model: cfg.ai.model || 'deepseek-chat',
        systemPrompt: buildAssistantSystemPrompt() + STUDY_ACTION_INSTRUCTIONS
      }
    }
  })

  async function promptOnce(prompt: string, signal: AbortSignal, tag: string): Promise<string> {
    const sessionId = `${tag}-${crypto.randomUUID()}`
    const state = studyStore.read()
    const ai = readConfig().ai
    const contextualPrompt = studyContext(state) + prompt
    if (state.activeConnectionId) {
      const connection = state.connections.find(item => item.id === state.activeConnectionId)
      const result = await studyConnections.prompt(sessionId, contextualPrompt, signal, () => {})
      if (result.usage) recordStudyUsage(studyStore, { ...result.usage, id: sessionId, at: Date.now(), provider: connection?.kind ?? 'acp', model: connection?.label ?? 'ACP', sessionId, source: 'acp-prompt-result' })
      return result.text
    }
    let round = 0
    const result = await nativeHarness.runTurn({ sessionId, prompt: contextualPrompt, timeoutMs: 90_000, signal, onUsage: usage => recordStudyUsage(studyStore, { ...usage, id: `${sessionId}-${round++}`, at: Date.now(), provider: ai.provider ?? 'custom', model: ai.model, sessionId, source: 'provider-sse' }) })
    if (!result.ok) throw new Error(STUDY_TEXT.PLAN_GENERATION_FAILED + result.reason)
    return result.data.text
  }

  async function generateLearningPlan(input: unknown, signal = new AbortController().signal) {
    return generateStudyPlan(studyStore, input, prompt => promptOnce(prompt, signal, 'study-plan'))
  }

  // ---------------------------------------------------------------- 云上行接线（P10.x）

  /**
   * 设备级大白饭序号分配器（rice-journal 的 nextSeq 出口）。
   *
   * 【语义】device.json.riceSeq = **已发出的最大序号**（0/缺省 = 还没发过号）。
   * 下一个 = max(riceSeq+1, 账本里本机最大 seq+1, 1) —— 三个来源取最大：
   *   · riceSeq+1：正常路径（设备记忆，跨启动单调）；
   *   · 账本最大+1：安全网 —— device.json 丢了/读坏时从账本恢复，绝不回卷
   *     （回卷 = 新条目撞服务端幂等键被当重放静默丢弃，饭就没了）；
   *   · 1：下界（seq 0 保留给 genesis，见 rice-journal 文件头）。
   * 【先发号落盘、后记账】号发出去就先写 device.json：发号之后、记账之前崩了，
   * 只烧掉一个号（空洞无害）；反过来（先记账后落号）崩在中间就会回卷。
   * 落号失败不抛：内存里 memoDevice 已带上新号，进程内仍单调；跨启动由账本
   * 安全网兜住（已落盘的条目在账本里，max+1 只会更大）。
   */
  function nextRiceSeq(ledgerMaxSeq: number): number {
    const dev = device()
    const next = Math.max((dev.riceSeq ?? 0) + 1, ledgerMaxSeq + 1, 1)
    memoDevice = { ...dev, riceSeq: next }
    try {
      saveDeviceFile(storageDir, memoDevice)
    } catch (err) {
      console.warn('[miai] failed to persist device rice seq', err)
    }
    return next
  }

  /**
   * 大白饭账本（docs/26 §6）：`<盒>/rice-ledger.json`，记一切饭变动。
   * 旧版把饭存在设备级 pet.json；genesis 只在建账时读它一次（legacy-pet-rice.ts），
   * 之后余额以账本为唯一事实。
   * 【装载时机】启动时 load 一次（建 genesis/读档）；切盒时由 P10.5 的会话
   * 接线再调 load() 换档（本模块不自己监听切盒，见 rice-journal 的 deps.dir 注释）。
   */
  const riceJournal = createRiceJournal({
    dir: () => box.currentDir(),
    installId: device().installId,
    nextSeq: nextRiceSeq,
    carriedRice: () => readLegacyPetRice(storageDir)
  })

  /** 挑战结算待办队列（`<盒>/.sync/pending-ops.json`）：断网/未登录时排着，触达再发 */
  const settleQueue = createPendingOpsStore(() => box.currentDir())

  /**
   * 云客户端共用的三件：baseUrl（启动时裁决一次）、token store、fetch。
   * 【token 的落盘实现（P10.5）】登录成功即把完整会话（safeStorage 加密）写进
   * `accounts/<sub>/session.bin`，重启由 restoreOnStartup 扫描接回；登出/换号清
   * 旧文件（「至多一份」不变式见 session-store.ts 文件头）。
   * safeStorage 直接传：Electron 的 isEncryptionAvailable/encryptString/
   * decryptString 与 SafeStorageLike 端口结构同形 —— 没有第二种实现要换，包一层
   * 适配器只是多一层间接。
   */
  const cloudBaseUrl = resolveCloudBaseUrl({ packaged: app.isPackaged, env: process.env })
  const cloudTokens = createSessionTokenStore({ baseDir: storageDir, safe: safeStorage })
  const cloudFetch: FetchLike = (url, init) => globalThis.fetch(url, init)

  const cloudRiceClient = createCloudRiceClient({
    baseUrl: cloudBaseUrl,
    fetch: cloudFetch,
    tokens: cloudTokens
  })
  const cloudChallengeClient = createCloudChallengeClient({
    baseUrl: cloudBaseUrl,
    fetch: cloudFetch,
    tokens: cloudTokens
  })

  /**
   * 上行 runner（流水推 → 流水拉 → 挑战结算，一趟跑完）。
   * 【触发节拍】启动一次 + 结算入队后一次（见 cloud:challenge-settle handler）——
   * 都是 fire-and-forget：未登录（客人盒）时 run() 零网络直接 skip。
   * 【为什么不在每次记账后触发】服务端 push 限流 6 次/时/账号；饭变动可以是
   * 秒级的（连答对几题），按记账触发就是拿限流当节拍器。渲染层的同步节拍
   * （P10.5 接线，按"每小时几次"设计）会再补上常规触发点。
   */
  const uplink = createUplink({
    box,
    journal: riceJournal,
    settleQueue,
    rice: cloudRiceClient,
    challenge: cloudChallengeClient,
    installId: device().installId,
    log: (line) => console.log(`[miai] uplink| ${line}`)
  })

  /**
   * 账号流程的依赖袋（P10.5）：激活（收编/直达）/ 干涸 / 启动恢复的唯一入口。
   * 【nextSeq 必须就是 nextRiceSeq 本体】收编 marker 与日常记账共用一个号池 ——
   * 分开两个池会撞号（撞号的条目被服务端幂等键当重放静默丢弃，饭就没了）。
   */
  const accountFlowDeps: AccountFlowDeps = {
    baseDir: storageDir,
    stores,
    journal: riceJournal,
    sessions: cloudTokens,
    safe: safeStorage,
    installId: device().installId,
    nextSeq: nextRiceSeq,
    log: (line) => console.log(`[miai] account| ${line}`)
  }

  return {
    storageDir,
    studyMathPath,
    rendererDir,
    httpAssets,
    addChatSessionsSink(sink) {
      chatSessionsSinks.add(sink)
      return () => { chatSessionsSinks.delete(sink) }
    },
    notifyChatSessionsChanged,
    addConfigSink(sink) {
      configSinks.add(sink)
      return () => {
        configSinks.delete(sink)
      }
    },
    stores,
    configStore,
    secretStore,
    readConfig,
    readPublicConfig,
    broadcastPublicConfig,
    commitEnvReport,
    device,
    study: {
      store: studyStore,
      connections: studyConnections,
      harness: nativeHarness,
      lessonIds: studyLessonIds,
      promptOnce,
      generateLearningPlan
    },
    cloud: { settleQueue, uplink, accountFlowDeps }
  }
}
