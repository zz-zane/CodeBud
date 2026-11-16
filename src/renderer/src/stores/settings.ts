/**
 * 设置 store：config.json 的渲染进程镜像。
 * 持久化走主进程（原子写）；环境检测（M5-01）主进程写穿缓存，这里同步内存态。
 * M6-04 再补 AI 测试连接 / 备份导入导出。
 */
import { ref, toRaw } from 'vue'
import { defineStore } from 'pinia'
import type {
  ConfigSavePayload,
  EnvReport,
  LangOfCode,
  PublicAppConfig
} from '../../../shared/types'
import { CURRENT_CONFIG_VERSION, DEFAULT_APP_CONFIG } from '../../../shared/types'
import { DATA_STORE } from '../../../shared/copy'
import { normalizeLayout, type LayoutConfig } from '../../../shared/layout'
import { langsToRecheck } from '../../../shared/env-cache'
import { toast } from '../components/base/toast'
import { TOAST } from '../lib/copy'

/**
 * 渲染进程这边的配置**天生就少一个字段**：`ai.apiKey`。主进程不会把它发过来。
 *
 * 不是「暂时没实现」，是**设计如此** —— 真 Key 只活在主进程里，界面只用
 * `ai.hasKey` 这个布尔来判断「配没配」。理由见 shared/types.ts。
 */
function defaultPublicConfig(): PublicAppConfig {
  const c = structuredClone(DEFAULT_APP_CONFIG)
  return toPublic(c)
}

/** 把一份完整配置裁成渲染进程能看的样子。**只用于本地兜底默认值** */
function toPublic(c: (typeof DEFAULT_APP_CONFIG)): PublicAppConfig {
  return {
    version: c.version,
    reviewEnabled: c.reviewEnabled,
    runTimeoutSec: c.runTimeoutSec,
    soundEnabled: c.soundEnabled,
    nativeRunEnabled: c.nativeRunEnabled,
    nativeRunQuiet: c.nativeRunQuiet,
    favWrongToBook: c.favWrongToBook,
    // 展开成新对象，不是原样引用 —— 理由同 save() 里那句（嵌套对象可能是
    // 响应式代理，进不了 structuredClone）。
    nativeIdePaths: { ...c.nativeIdePaths },
    sfxVolume: c.sfxVolume,
    remote: { ...c.remote },
    layout: normalizeLayout(c.layout),
    envCache: c.envCache,
    learning: { ...c.learning },
    update: { ...c.update },
    ai: {
      hasKey: c.ai.apiKey.trim() !== '',
      baseUrl: c.ai.baseUrl,
      model: c.ai.model,
      protocol: c.ai.protocol,
      provider: c.ai.provider,
      // 缺字段 = 关（老配置/坏负载都不能静默打开会花钱的开关）
      dynamicEnabled: c.ai.dynamicEnabled === true
    }
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const config = ref<PublicAppConfig>(defaultPublicConfig())
  const loaded = ref(false)
  const detecting = ref(false)

  async function load() {
    try { config.value = await window.miai.getConfig() }
    catch (error) {
      if (error instanceof Error && error.message.includes(DATA_STORE.UNREADABLE)) toast(DATA_STORE.UNREADABLE, 'error', 8000)
      throw error
    }
    loaded.value = true
    if (config.value.version > CURRENT_CONFIG_VERSION) toast(DATA_STORE.NEWER_VERSION, 'warn', 8000)
  }

  /**
   * 主进程自发改配置的推送落点（生产者是 app.ts 的 broadcastPublicConfig；
   * 订阅挂在 main.ts，通道说明见 IPC.configExternal）。
   *
   * 【为什么整份换上，而不是像 update 那样当 patch 合并】推送负载与
   * configGet 同形（主进程用 toPublicConfig 出的整份），它就是"最新真相" ——
   * 合并反而会把本地陈旧字段留在里面（主进程刚改掉的字段，
   * 本地旧值一拼回去等于白推）。用户正在编辑的其它输入（填了一半的 Key
   * 输入框等）都住在组件的本地 state 里，不在这份 config 里，换不掉。
   *
   * 【纯镜像，不回写】与 load() 同语义：只把 config.json 的当前内容搬进
   * 响应式镜像。这里**绝不调 save()** —— 推送到达后马上又 save 一遍，
   * 等于把主进程刚改的东西当渲染层编辑回写，两个写方来回拉锯。
   */
  function applyExternalConfig(pub: PublicAppConfig) {
    config.value = pub
  }

  async function update(patch: Partial<PublicAppConfig>) {
    // ⚠️ **展开的是 `toRaw(...)`，不是 `config.value`**。
    //
    // 展开一个响应式代理，顶层字段会变成原始值（看着没问题），但**嵌套的
    // `envCache` / `ai` 读出来仍然是代理**，于是这些代理被**存回了 ref**。
    // 从那一刻起，配置对象里就永久住着两个代理 —— 而 `toRaw` 只剥顶层，
    // 后面再怎么 toRaw 也救不回来，最后在 `ipcRenderer.invoke` 那里炸掉。
    //
    // 这是个「一次写错、之后每条路都坏」的坑：最初只有这一行有问题，
    // 但表现出来的是 save() 里那句 toRaw 仿佛没生效。找的时候要往上游看。
    config.value = { ...toRaw(config.value), ...patch }
    await save()
  }

  /**
   * 改布局（拖完分隔条、或收起/展开右栏时调）。
   *
   * 【为什么要单独开一个方法，而不是让调用方自己拼 `update({ layout })`】
   * 保存是**整份配置写盘**，所以 `layout` 这一节每次都必须完整带上。
   * 让调用方在 App.vue 里手拼对象，就会有「只想改宽度、结果没带 rightPanelOpen」
   * 这种写法 —— 漏掉的字段变成 `undefined` 存进文件，随即被 normalizeLayout
   * 当成非法值退回默认。表现出来是**「拖了宽度、不报错、重开又弹回去」**，
   * 而且只在「右栏当时是收着的」这种组合下才出现。收进 store 里，这条路就不存在。
   *
   * 传进来的 patch 过一道 normalizeLayout 再落地，越界值钳回来（和主进程同一条规矩，
   * 这里是第一道，那边写盘前是第二道）。
   */
  async function setLayout(patch: Partial<LayoutConfig>) {
    const cur = toRaw(config.value)
    await update({ layout: normalizeLayout({ ...cur.layout, ...patch }) })
  }

  /**
   * 改**某门语言**的本地 IDE 路径（练习场「打开」时的现检现荐也走这里落盘）。
   *
   * 【为什么不让调用方自己拼 update({ nativeIdePaths })】
   * ① 保存是**整份写盘**，四个键每次都得带上 —— 让调用方手拼，迟早有人只带
   *    改掉的那一键，其余三键被主进程的 pickIdePaths 当成「没改」而保留旧值；
   *    看着没事，其实全靠对面兜底才没事。
   * ② `config.value.nativeIdePaths` 是**嵌套的响应式对象**，直接塞进 patch 会在
   *    `ipcRenderer.invoke` 的结构化克隆那层炸掉 —— `update` 顶层的 toRaw 只剥
   *    一层，救不了嵌套的（见上面 update 的长注释）。在这里从 toRaw 现取现值、
   *    现造一个四键普通对象，两个坑一起绕开。
   */
  async function setIdePath(lang: LangOfCode, path: string): Promise<void> {
    const cur = toRaw(config.value)
    await update({ nativeIdePaths: { ...cur.nativeIdePaths, [lang]: path } })
  }

  /**
   * 写盘。**调用方一律走这里，别直接调 `window.miai.saveConfig`** ——
   * `ai.apiKey` 是三态（不传/`''`=不改、`null`=删、非空=设新的），
   * 这里默认**不带 apiKey**（= 不改），只有 `clearAiKey()` 会显式带 `null`。
   *
   * 【对照】`nativeIdePaths` 恰恰相反：**每次必须带全量值**（空串 = 清空该键，
   * 是它的一种合法来路）—— 两者别被「统一」成同一种写法，方向弄反各毁一半。
   *
   * 【为什么默认不带，而不是带上空串】效果上两者都是「不改」，但带上空串的话，
   * 将来哪天 main 那边的语义一改（把空串当成「清空」），**每一次保存别的设置
   * 都会把用户 Key 抹掉**，而且不报错。少带一个字段，这条路从一开始就不存在。
   */
  async function save(ai?: ConfigSavePayload['ai']) {
    const cur = toRaw(config.value)
    const payload: ConfigSavePayload = {
      version: cur.version,
      reviewEnabled: cur.reviewEnabled,
      runTimeoutSec: cur.runTimeoutSec,
      soundEnabled: cur.soundEnabled,
      nativeRunEnabled: cur.nativeRunEnabled,
      nativeRunQuiet: cur.nativeRunQuiet,
      favWrongToBook: cur.favWrongToBook,
      nativeIdePaths: { ...cur.nativeIdePaths },
      sfxVolume: cur.sfxVolume,
      layout: normalizeLayout(cur.layout),
      envCache: cur.envCache,
      learning: { ...cur.learning },
      update: { ...cur.update },
      ai: ai ?? {
        baseUrl: cur.ai.baseUrl,
        model: cur.ai.model,
        protocol: cur.ai.protocol,
        provider: cur.ai.provider,
        dynamicEnabled: cur.ai.dynamicEnabled === true
      }
    }

    // 手机浏览器：config:save 不在远程白名单里（它会写 API Key）。设置只在本次页面内生效，
    // 刷新后回到电脑上的值 —— 与其每次弹保存失败，不如明确不落盘（docs/29 §3.5）
    if (window.miai.isRemote) return

    try {
      await window.miai.saveConfig(payload)
    } catch (err) {
      toast(err instanceof Error && err.message.includes(DATA_STORE.NEWER_VERSION) ? DATA_STORE.NEWER_VERSION : TOAST.SETTINGS_SAVE_FAILED, 'error')
      throw err
    }
  }

  /** 改 AI 设置。**这里传的 apiKey 是「新 Key」或什么都不传，绝不会是空串** */
  async function updateAi(patch: Partial<ConfigSavePayload['ai']>) {
    const cur = toRaw(config.value.ai)
    await save({
      baseUrl: cur.baseUrl,
      model: cur.model,
      protocol: cur.protocol,
      provider: cur.provider,
      dynamicEnabled: cur.dynamicEnabled === true,
      ...patch
    })
  }

  /**
   * 清除 Key。**只有这一条路能真的删掉它** —— 传 `null` 而不是空串，
   * 因为空串的语义是「这次不改」（界面根本不知道真 Key，它保存时必然带回空串）。
   * 少了这条路，用户填错一次就再也删不掉了。
   */
  async function clearAiKey() {
    await save({
      baseUrl: config.value.ai.baseUrl,
      model: config.value.ai.model,
      protocol: config.value.ai.protocol,
      provider: config.value.ai.provider,
      dynamicEnabled: config.value.ai.dynamicEnabled === true,
      apiKey: null
    })
    config.value.ai.hasKey = false
  }

  /** 保存新 Key 之后调它，让界面立刻从「未配置」变成「已配置」 */
  function markKeySaved() {
    config.value.ai.hasKey = true
  }

  /** 重新检测本机编程环境（M5-01） */
  async function detectEnv(): Promise<EnvReport> {
    detecting.value = true
    try {
      const report = await window.miai.detectEnv()
      config.value.envCache = { report, at: new Date().toISOString() }
      return report
    } finally {
      detecting.value = false
    }
  }

  /**
   * 首次打开设置页：读配置；缓存里报「没找到」的语言一并复核。
   */
  async function ensureEnvCache(): Promise<void> {
    if (!loaded.value) await load()
    if (window.miai.isRemote) return // env:detect 不在手机白名单里
    if (langsToRecheck(config.value.envCache.report).length > 0) await detectEnv()
  }

  return {
    config,
    loaded,
    detecting,
    load,
    applyExternalConfig,
    update,
    setLayout,
    setIdePath,
    updateAi,
    clearAiKey,
    markKeySaved,
    detectEnv,
    ensureEnvCache
  }
})
