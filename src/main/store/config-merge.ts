/**
 * config.json 的**合并**与**裁剪**（M6-04，纯函数，不碰文件也不碰 Electron）。
 *
 * 【为什么从 IPC handler 里抽出来】
 * 这段逻辑有两处「一旦错了就是静默损伤」的地方：
 *   1. **apiKey 是三态**，某天一次「顺手简化」就会把用户的 Key 悄悄抹掉；
 *   2. **Key 不能出主进程**，抹字段的时候容易顺手把界面需要的信息也抹了。
 * 放在 IPC handler 里的代码**根本没法单测**（要拖起整个 Electron），
 * 而这两件事恰恰是最需要被测试钉死的那一类。所以抽成纯函数，handler 只负责调用。
 *
 * ⚠️ 这个文件在 `src/` 下，被文案闸门扫 —— **不许出现中文**。
 */
import type { AppConfig, ConfigSavePayload, PublicAppConfig } from '../../shared/types'
import {
  CONFIG_FIELDS,
  CONFIG_FIELD_KEYS,
  type ConfigField,
  type ConfigFieldKey,
  MAX_SFX_VOLUME,
  MAX_TIMEOUT_SEC,
  MIN_SFX_VOLUME,
  MIN_TIMEOUT_SEC,
  isObject
} from '../../shared/config-schema'

/**
 * 运行超时的合法区间（秒）。
 *
 * 和 [runner.ts:314] 里那道 clamp 是**同一个区间**，这里是第一道、那里是第二道。
 * 两道的分工：这里拦住的是「配置被写坏」（写进文件就晚了，改不回来），
 * 那里拦住的是「单次请求自己带了越界的 timeoutSec」。
 *
 * 【为什么非拦不可】runner 那里写的是 `Math.min(Math.max(x, 1), 60)`，
 * 而 `NaN` **能穿过这个式子**（NaN 和谁比都是 false，`Math.max(NaN,1)` 还是 NaN）。
 * 于是 `NaN * 1000` → `setTimeout(fn, NaN)` → **当成 0 毫秒**，
 * 表现为「每一次运行都在瞬间被掐死」，而报错信息只会说超时，指向完全错误的方向。
 *
 * 【为什么从 config-schema 转出，而不是就地定义】迁移那边钳老数据时要用
 * **同一个区间**。两份定义就是两处漂移，而漂移的症状是「保存时能到 60 秒、
 * 从老文件迁移出来却是 30 秒」这种没人会去查的东西。所以定义搬去 shared，
 * 这里只做转出，既有引用点（含 config-merge.test.ts）一行不用改。
 */
export { MIN_TIMEOUT_SEC, MAX_TIMEOUT_SEC }

/**
 * 音效音量的合法区间（百分比）。
 *
 * 和超时那对是**同一个理由**：定义在 shared/config-schema（schema 那一侧），
 * 读（迁移老数据）和写（保存新输入）共用一份边界。这里只做转出。
 */
export { MIN_SFX_VOLUME, MAX_SFX_VOLUME }

/**
 * 把内部配置裁成**能交给渲染进程**的形状 —— **唯一的出口，别处不许直接返回 config**。
 *
 * 【为什么要有这么一个函数，而不是在 handler 里手写一遍】
 * 「Key 不出主进程」这条规矩，靠自觉是守不住的：将来新加一条通道、
 * 或者在别处再 `return configStore.read()`，就直接漏了。
 * 收成一个函数之后，**漏的办法只剩「故意绕过它」**，而绕过是能被 code review 看出来的。
 *
 * `hasKey` 是抹掉 apiKey 之后**必须补上**的那一点点信息，理由见 types.ts 里那段长注释。
 */
export function toPublicConfig(cfg: AppConfig): PublicAppConfig {
  const out: Record<string, unknown> = { version: cfg.version }
  // 每个字段的「第二道保险」都写在注册表条目的 expose 里（config-schema.ts）
  for (const key of CONFIG_FIELD_KEYS) {
    const field: ConfigField<ConfigFieldKey> = CONFIG_FIELDS[key]
    out[key] = field.expose(cfg[key])
  }
  out.envCache = cfg.envCache
  return out as unknown as PublicAppConfig
}

/**
 * 把 `config:save` 的入参合并进现有配置，返回**要写盘的新配置**。
 *
 * 入参非法时抛错（并且**一个字节都不写**）—— 和 runner:run 一样，
 * 这种情况属于「调用方写错了」，该炸得响亮，而不是猜一个默认值糊过去。
 *
 * 【哪些字段听入参的、哪些听现有的】
 * - `reviewEnabled` / `runTimeoutSec` / `soundEnabled` / `theme` / `sfxVolume`：听入参，
 *   这是用户真在设置页改的东西（`sfxVolume` 只在带了合法数字时才算「改了」）。
 * - `ai.apiKey`：**三态**，见 config-schema.ts 的 `nextApiKey`。
 * - `nativeIdePaths`：**逐键三态**，见 config-schema.ts 的 `pickIdePaths` —— 注意它的 `''` 是
 *   「清空该键」（该语言回到「自动」），和下面 baseUrl/model 的「空=没改」
 *   **方向相反**（理由都写在函数注释里）。
 * - `ai.baseUrl` / `ai.model`：听入参，但**空值算「没改」**（理由见 config-schema.ts 的 `pickText`）。
 * - `layout`：听入参，但**整节缺失算「没改」**，并且钳进合法区间（理由见下）。
 * - `envCache` / `version`：**一律听现有的**，理由见下。
 *
 * 【envCache 为什么不听入参】
 * 它不是用户在设置页编辑的东西，而是 env:detect **在主进程写穿**的。
 * 渲染进程手上那份是「读配置那一刻」的快照；如果用户开着设置页放了十分钟，
 * 这期间后台检测刷新过缓存，他再点一次保存就会**把新缓存顶回旧的** ——
 * 表现是「刚检测出来的编译器，过一会儿又变成没装」。这类回退极难复现。
 *
 * 【version 为什么不听入参】
 * 它是 schema 版本，归主进程管。让渲染进程能改它，等于把迁移逻辑的钥匙交出去。
 */
export function mergeConfigPayload(current: AppConfig, payload: ConfigSavePayload): AppConfig {
  if (!isObject(payload)) throw new Error('invalid config payload')

  const out: Record<string, unknown> = { version: current.version }
  // 非法入参在对应条目的 merge 里抛错；抛出时 out 只是个局部变量，一个字节都没写盘。
  for (const key of CONFIG_FIELD_KEYS) {
    const field: ConfigField<ConfigFieldKey> = CONFIG_FIELDS[key]
    out[key] = field.merge(payload[key], current[key])
  }
  out.envCache = current.envCache
  return out as unknown as AppConfig
}
