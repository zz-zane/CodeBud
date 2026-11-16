/**
 * config.json 的**字段注册表** —— 一个字段一处定义（docs/28 §1.1）。
 *
 * 【它取代了什么】同一个字段此前在三个地方手写三遍：`config-migrate.ts`（读盘）、
 * `config-merge.ts` 的 `toPublicConfig`（出主进程）和 `mergeConfigPayload`（保存），
 * 靠注释提醒「三处必须同步」。现在每个字段在 `CONFIG_FIELDS` 里一条，
 * 三个入口函数只是遍历它。
 *
 * 【加字段 = 编译器催你】`CONFIG_FIELDS` 的类型是映射类型：往 `AppConfig` 加字段而不
 * 写这里的条目就编译不过。`version`（schema 版本）与 `envCache`（主进程写穿的缓存）
 * **不听渲染层**，由三个入口函数直接处理，不进注册表。
 *
 * 【为什么取值边界与小助手也放这里】它们是「一份合法的配置长什么样」的一部分，
 * 读（迁移）与写（保存）两侧必须共用**同一份**，各写一遍就是两处漂移。
 * 这里不 import `config-migrate.ts` / `config-merge.ts`，二者都从本文件取，
 * 并把既有导出转出，既有引用点一行不用改 —— 也因此不会绕出循环 import。
 *
 * ⚠️ 本文件在 `src/` 下、被文案闸门扫，**字符串一律英文**（给开发者看的），
 *    中文只出现在注释里。
 */
import {
  DEFAULT_APP_CONFIG,
  LANG_OF_CODE,
  emptyIdePaths,
  type AppConfig,
  type ConfigSavePayload,
  type LangOfCode,
  type AiProviderPreset,
  type PublicAppConfig
} from './types'
import { IDE_PRODUCTS, UNIVERSAL_IDE_PRODUCTS, ideNameOf } from './ide-profiles'
import { normalizeLayout } from './layout'

/**
 * 运行超时的合法区间（秒）。
 *
 * 【为什么定义在 schema 这一侧】这是 **schema 的取值边界**，
 * 和版本号是一类东西：它描述「一份合法的配置长什么样」。迁移要用它来钳老数据，
 * 保存要用它来钳新输入——**两处必须是同一个区间**，所以只能有一份定义。
 * `config-migrate.ts` / `config-merge.ts` 从本文件转出，保持既有引用点不变。
 */
export const MIN_TIMEOUT_SEC = 1
export const MAX_TIMEOUT_SEC = 60

/**
 * 音效音量的合法区间（百分比）。
 *
 * 和超时那对一样，**定义在 schema 这一侧、由读写两侧共用**：
 * 迁移要用它钳老数据，保存要用它钳新输入。两份定义就是两处漂移，
 * 而症状是"设置页能拨到 80、重启之后是 100"这种没人会去查的东西。
 */
export const MIN_SFX_VOLUME = 0
export const MAX_SFX_VOLUME = 100

/** 手机连接端口的合法区间（非特权端口起，到 16 位上限）；读写两侧共用 */
export const MIN_REMOTE_PORT = 1024
export const MAX_REMOTE_PORT = 65535

/** 端口：非整数 / 非数字给默认，越界钳回区间 */
export function clampRemotePort(v: unknown): number {
  if (typeof v !== 'number' || !Number.isInteger(v)) return DEFAULT_APP_CONFIG.remote.port
  return Math.min(Math.max(v, MIN_REMOTE_PORT), MAX_REMOTE_PORT)
}

export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback
}

/** 秒数：先过 `Number.isFinite`，再钳区间。**NaN 必须在这里被挡死**，理由见 runTimeoutSec 条目 */
function seconds(v: unknown, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback
  return Math.min(Math.max(Math.round(v), MIN_TIMEOUT_SEC), MAX_TIMEOUT_SEC)
}

/**
 * 音量百分比：先过 `Number.isFinite`，再**四舍五入 + 钳进区间**。
 *
 * 【为什么是 `export`，而不是在本文件里自己用】和上面那对 MIN/MAX 同源：
 * 这是「一份 0~100 的整数」这件事的**唯一实现**。`expose` 在交给
 * 渲染进程之前要过第二道，那道必须和读盘这道逐字节同行为 —— 各写一遍的话，
 * 某天有人只改了其中一边（比如这边加了四舍五入），症状就是
 * 「从老文件迁出来是整数、保存一次之后变成 79.99999」，没人会去查。
 *
 * 【为什么每一道都不能省】
 *   · `Number.isFinite`：`NaN` 和 `Infinity` 能穿过 `Math.min`/`Math.max`
 *     （NaN 跟谁比都是 false，`Math.max(NaN, 0)` 还是 NaN）。而 `NaN` 一旦
 *     进到 `gain.gain.value = NaN`，那一路音效就**永远不响**，且不报错 ——
 *     表现是"点了没声音"，查的时候会先去怀疑音频文件。和 `seconds()` 同一个洞。
 *   · 四舍五入：0~100 的整数是**给用户看的数**，落盘时留着 79.99999 会让
 *     界面显示和文件内容对不上。
 *   · 钳区间：写坏的值（手改配置文件写成 500）必须在**读**的时候就拉回来，
 *     否则 500% 会变成增益 5 倍 —— 一耳朵是爆音，第二耳朵是客户投诉。
 */
export function clampVolume(v: unknown, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback
  return Math.min(Math.max(Math.round(v), MIN_SFX_VOLUME), MAX_SFX_VOLUME)
}

/** 非空字符串才算数；空的、纯空白的、非字符串一律退回 fallback */
function text(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : fallback
}

/**
 * v8 → v9 的分派：单个 `nativeIdePath` 拆成每语言四键 `nativeIdePaths`。
 *
 * 【为什么不能闭着眼睛四键全填】旧值只是一枚**没有语言信息**的选择。
 * 主人实测的病就是「一个程序开所有语言，总有一半乱码」——四键全填等于把
 * 病原样搬进新结构。所以按认出来的产品名分派（主人 2026-10-01 拍板）：
 *   1. 新字段已在文件里 → 逐键取值。这是**幂等**的保证：第二遍迁移走这
 *      一类，旧单值即使还在文件里也被无视；用户手改坏了某个键也会自愈
 *      成 ''（text 的脏值语义正好是这里要的）。
 *   2. 认出的产品是**通用编辑器**（VS Code / VSCodium / Cursor）→ 四键
 *      全空（"自动"）。它们什么语言都能开，正因如此旧值不锁任何槽位，
 *      退位给「打开时按语言现检现荐」；装了什么就在推荐表里被选中，
 *      行为不会丢。
 *   3. 认出的产品是**专用工具**（Dev-C++ → c/cpp、PyCharm → python……）
 *      → 只填它画像里的 langs，其余留空走自动推荐。
 *   4. 认不出的 exe（用户自己挑的、不在白名单里）→ 四键全填。那是
 *      **用户的显式选择**，我们没有依据把它扩大成"自动"；写盘编码走
 *      按语言回退（ide-profiles 的 defaultEncodingOf），和升级前逐字节
 *      一致，不比现在差。产品名认得但画像表缺条目（白名单与画像表漂移
 *      时才会发生）也按这一类处理——宁可按"保留"，也不静默丢掉用户的
 *      显式选择。
 *
 * 【空串】旧值是空的 / 纯空白 / 非字符串（`text` 退回 fallback）→ 四键
 * 全空。方向同 nativeRunEnabled：**绝不替用户猜一个默认安装路径**。
 */
function migrateIdePaths(raw: Record<string, unknown>): Record<LangOfCode, string> {
  const next = emptyIdePaths()
  const cur = raw.nativeIdePaths
  if (isObject(cur)) {
    for (const lang of LANG_OF_CODE) next[lang] = text(cur[lang], '')
    return next
  }
  const legacy = text(raw.nativeIdePath, '')
  if (legacy === '') return next
  const product = ideNameOf(legacy)
  const profile = product ? IDE_PRODUCTS[product] : undefined
  if (!product || !profile) {
    for (const lang of LANG_OF_CODE) next[lang] = legacy
    return next
  }
  if (UNIVERSAL_IDE_PRODUCTS.includes(product)) return next
  for (const lang of profile.langs) next[lang] = legacy
  return next
}

/**
 * 把配置里的**每语言 IDE 路径表**读成「恒四键、值必字符串」的形状。
 *
 * 【为什么不 trim】这里的读口原样透传才是**如实**的（用户手改文件写了
 * 个带空格的路径，读出来就该是它）；trim 是写口（`pickIdePaths`）的职责，
 * 分工和旧版单值时代完全一样。类型检查逐键做、退化值落成 ''——
 * '' 就是「该语言没配置」的合法表示。
 */
function readIdePaths(v: unknown): Record<LangOfCode, string> {
  const src = isObject(v) ? v : {}
  const out = emptyIdePaths()
  for (const lang of LANG_OF_CODE) {
    out[lang] = typeof src[lang] === 'string' ? (src[lang] as string) : ''
  }
  return out
}

/**
 * apiKey 的三态合并 —— **这个函数的每一条分支都有一条单测钉着**。
 *
 * | incoming | 结果 | 谁会造成这种情况 |
 * |---|---|---|
 * | `null` | 清空 | 用户点了设置页的「清除 Key」 |
 * | `undefined` | 保持原样 | 某条通道只想改别的字段，压根没带 ai |
 * | 非空字符串 | 换成它（**去掉首尾空白**） | 用户粘贴了一个 Key 并保存 |
 * | `''` / 全空白 | 保持原样 | 界面上那个框天生就是空的（它拿不到真 Key） |
 *
 * 【最后一行是整件事的关键】渲染进程**永远不知道真 Key 是什么**，
 * 所以它保存时带回来的必然是个空串。要是把空串当成「用户想清空」，
 * 那么**每保存一次别的设置，Key 就没了** —— 用户会以为 Key 会自己过期。
 * 想清空必须走 `null`，那是个界面能表达、而真实 Key 不可能是的值。
 *
 * 【为什么要 trim】从网页上复制 Key 时，**极易**连带选中一个换行或空格。
 * 带 `\n` 的 Key 会让 fetch 在设置请求头时直接抛错（header 值不许含换行），
 * 而那个异常会被归类成「连不上网」—— 用户会去查路由器，方向全错。
 * 在这一层 trim 掉，代价是零，省掉的是一整类查不出来的问题。
 */
function nextApiKey(current: string, incoming: string | null | undefined): string {
  if (incoming === null) return ''
  if (incoming === undefined) return current
  const trimmed = incoming.trim()
  return trimmed === '' ? current : trimmed
}

/**
 * 读一个文本字段：**空值算「没改」，不算「清空」**。
 *
 * 为什么和 apiKey 不一样、不做「空 = 删」：
 * baseUrl 和 model 一清空，下一次请求就会发到一个不存在的地址。
 * 而用户在输入框里误按全选+删除、或者粘贴了个空内容，是很容易发生的事 ——
 * 那时候**保留原值**（继续能用）比**真的清空**（功能坏掉，且用户不知道是自己弄的）要好。
 * 想恢复默认值，再把默认值打回去就行了，这条路一直开着。
 *
 * 非字符串**抛错而不是回退**：那是调用方类型写错了，悄悄糊过去只会把 bug 藏起来。
 */
function pickText(incoming: unknown, fallback: string): string {
  if (incoming === undefined || incoming === null) return fallback
  if (typeof incoming !== 'string') throw new Error('invalid config payload')
  const trimmed = incoming.trim()
  return trimmed === '' ? fallback : trimmed
}

/**
 * 读**每语言 IDE 路径表**：逐键沿用单值时代的三态语义，恒输出四键全新对象。
 *
 * 【三态（逐键各来一遍）】
 *  | incoming | 结果 |
 *  |---|---|
 *  | `''` / 全空白 | **清空该键**（该语言回到「自动」，打开时现检现荐） |
 *  | `undefined` / `null` | 保持该键现状 |
 *  | 非空字符串 | 换成它（去掉首尾空白） |
 *  | 其他类型 | **抛错** |
 *
 * 【为什么 `''` 必须算「清空」—— 和上面 pickText 恰好的反方向】
 * pickText 的「空=没改」是替 baseUrl / model 定的：它们一清空下一次请求就
 * 发到不存在的地址，用户误按全选+删除时保留原值更安全。而本地 IDE 路径
 * 不是这种字段：
 *   · 它有一个**合法的"空"**（默认值就是 ''，空 = 未配置 = 按钮给引导）；
 *   · 渲染层**恒持有全量值**（不像 apiKey 真值只在主进程 —— 那边渲染层
 *     永远只能带空串回来，所以必须把空当"没改"）—— 界面上那个框显示什么，
 *     保存回来的就是什么，空串只有一种来路：用户把它删了 / 点了「清除」。
 * 想清空必须能清空：套用「空=没改」，用户删了路径一保存它又回来了，
 * 而且没有别的路能删掉它 —— 和 apiKey 当初必须补一个 `null` 是同一个教训。
 *
 * 【undefined / null 保持现状】那是「这次载荷没带这个键」的防御：
 * 类型上四个键都必填，但测试夹具经 `as` 转换、或未来的新调用方都可能缺它 ——
 * 缺字段时猜"用户想清空"会把一个设置静默毁掉，听现有的才是安全侧。
 * 整表 undefined / null 同理（四键全部保持现状）。非对象（字符串/数字/数组）
 * **抛错**：调用方类型写错了，糊过去只会把 bug 藏起来。
 *
 * 【为什么输出必须是全新对象】渲染层那份 `nativeIdePaths` 是 Vue 的响应式
 * 代理，`structuredClone` 一碰就炸（settings store 有专门的回归闸）；即便
 * 拿到的是普通对象，返回入参引用也会让「写盘的那份」和「来源那份」悄悄
 * 共用同一个对象。现造一个四键普通对象，两个病一起省掉。
 */
function pickIdePaths(
  incoming: unknown,
  fallback: Record<LangOfCode, string>
): Record<LangOfCode, string> {
  if (incoming === undefined || incoming === null) return { ...fallback }
  if (!isObject(incoming)) throw new Error('invalid config payload')
  const out = emptyIdePaths()
  for (const lang of LANG_OF_CODE) {
    const v = incoming[lang]
    if (v === undefined || v === null) out[lang] = fallback[lang]
    else if (typeof v === 'string') out[lang] = v.trim()
    else throw new Error('invalid config payload')
  }
  return out
}

/** 注册表条目的键：`version` / `envCache` 由三个入口函数直接处理 */
export type ConfigFieldKey = Exclude<keyof AppConfig, 'version' | 'envCache'>

export interface ConfigField<K extends ConfigFieldKey> {
  /** 读盘：把 config.json 里这个键的原始值（可能缺失/被手改坏）搬成合法值。幂等。 */
  read(raw: unknown, file: Record<string, unknown>): AppConfig[K]
  /** 出主进程：交给渲染进程的形状（第二道保险 + 整树新造）。 */
  expose(value: AppConfig[K]): PublicAppConfig[K]
  /** 保存：config:save 载荷里这个键的入参并进现有值。缺省 = 听现有的；类型错 = 抛。 */
  merge(incoming: unknown, current: AppConfig[K]): AppConfig[K]
}

export const CONFIG_FIELDS: { [K in ConfigFieldKey]: ConfigField<K> } = {
  reviewEnabled: {
    read: (raw) => bool(raw, DEFAULT_APP_CONFIG.reviewEnabled),
    expose: (v) => v,
    merge(incoming) {
      if (typeof incoming !== 'boolean') throw new Error('invalid config payload')
      return incoming
    }
  },
  runTimeoutSec: {
    read: (raw) => seconds(raw, DEFAULT_APP_CONFIG.runTimeoutSec),
    expose: (v) => v,
    merge(incoming) {
      if (typeof incoming !== 'number' || !Number.isFinite(incoming)) {
        throw new Error('invalid config payload')
      }
      return Math.min(Math.max(Math.round(incoming), MIN_TIMEOUT_SEC), MAX_TIMEOUT_SEC)
    }
  },
  soundEnabled: {
    // ── v1 → v2 的那一行 ────────────────────────────────────────────
    // 老配置里没有这个字段，`bool` 会给出 true：**升级上来的用户默认开着音效**。
    // 和全新安装保持一致——没道理让「先装的人」和「后装的人」听到不一样的东西。
    read: (raw) => bool(raw, true),
    // 写成 `!== false` 而不是原样透传，是**第二道保险**：
    // soundEnabled 的补齐已经在 migrateConfig 里做过了（readConfig 是唯一读口），
    // 正常路径上它一定是个布尔。但这里是「交给渲染进程」的最后一道闸门，
    // 一旦某个未来的读路径漏了迁移，渲染进程拿到的会是 undefined ——
    // 而 undefined 在设置页那个开关上渲染成「关着」，用户会以为音效自己没了。
    // 一句比较换掉这一类静默走样，划算。
    expose: (v) => v !== false,
    // 缺省时**听现有的**，不是听默认值。理由和 `layout` 的 `?? current.layout` 一样：
    // 「没带这个字段」和「明确要关掉音效」是两件事，混成一件的后果是
    // **保存一次别的设置，音效就被悄悄打开了**（或者被关掉）。
    // 类型上它是必填的，但这里是写盘前的最后一道 —— 类型拦不住运行时的残缺载荷。
    merge: (incoming, current) => (typeof incoming === 'boolean' ? incoming : current !== false)
  },
  sfxVolume: {
    // ── v4 → v5 的那一行 ────────────────────────────────────────────
    // 老配置里没有这个字段，`volume` 会给出 100：**升级上来的用户听到的音量和
    // 昨天一模一样**。方向同 soundEnabled（默认值是"软件的性子"，不是"别动用户
    // 已有的东西"）—— 只不过它的性子里本来就写着 100%。
    // 钳区间和 NaN 都得在这儿挡住：这是**读**的唯一入口，放进去就再也拦不住了。
    read: (raw) => clampVolume(raw, DEFAULT_APP_CONFIG.sfxVolume),
    // 第二道钳位，理由和 soundEnabled 完全同源：正常路径上它已经被
    // migrateConfig 钳过一次了，但万一某个未来的读路径漏了迁移，渲染进程拿到的
    // 会是 undefined 或者一个越界值。**两种走样都是静默的**：
    //   · undefined 进 `<input type="range">` = 值非法，浏览器回落到**轨道中点**，
    //     于是"我的音量自己变成一半了"，而且关掉再重开还是这样；
    //   · 500 进增益就是 5 倍，一耳朵爆音（第二耳朵是投诉）。
    // 一句 clamp 换掉这一类，和上面那几行是同一笔账。
    expose: (v) => clampVolume(v, DEFAULT_APP_CONFIG.sfxVolume),
    // 「缺省时听现有的」—— 机制就在第二个参数上：`clampVolume` 遇到非数字
    // （含 undefined）会**原样退回 fallback**，而这里 fallback 给的是 current。
    // 所以「没带这个字段」和「带了个越界值」走的是同一条路，两个都是"以现有为准"，
    // 正好是我们想要的：用户没改音量，就不该被任何一次别的保存改掉。
    // ⚠️ 别"顺手简化"成 `incoming ?? current` —— 那会漏掉
    // 区间钳位，而越界值一旦写进文件，下次启动就是 5 倍增益的爆音。
    merge: (incoming, current) => clampVolume(incoming, current)
  },
  nativeRunEnabled: {
    // ── v3 → v4 的那一行 ────────────────────────────────────────────
    // 老配置里没有这个字段，`bool` 会给出 false：**升级上来的用户保持关着**。
    // **反于 soundEnabled** —— 音效默认开是「软件的性子」，
    // 而这条会把用户代码交给**他自己 PATH 里那个**编译器去跑（版本可能和课文
    // 讲的不一样），还会让每次点运行多一个弹窗。这种开关只能由用户自己打开。
    read: (raw) => bool(raw, DEFAULT_APP_CONFIG.nativeRunEnabled),
    // ⚠️ **必须是 `=== true`，不能写成 `!== false`** —— 这是本次改动里
    // 风险最高的一行，写反的后果与上面两处**方向相反**：
    // soundEnabled 写 `!== false` 是「漏迁移时别静音」，因为它的默认值是 true；
    // 而这个字段的默认值是 false，`!== false` 会让**从没要求过的人**
    // 静默走上用户自己的外壳（每跑一次弹一次窗、换一个编译器）——
    // 用户没开过这个开关，却发现自己机器上的 gcc 被调起来了。
    // 一句比较的差别，两种默认值的字段必须各写各的。有专门单测钉着极性。
    expose: (v) => v === true,
    // 「缺省时听现有的」，和 soundEnabled 一样 —— 「没带这个字段」与
    // 「明确要关掉原生模式」是两件事，混成一件的后果是：用户保存一次别的设置，
    // 原生模式被悄悄打开（或关掉）。
    // 取现有值时同样用 `=== true`：老配置（这个字段还不存在）必须是**关**。
    merge: (incoming, current) => (typeof incoming === 'boolean' ? incoming : current === true)
  },
  nativeRunQuiet: {
    // ── v7 → v8 的那一行 ────────────────────────────────────────────
    // 老配置里没有这个字段，`bool` 会给出 false：**升级上来的用户保持
    // 「每跑一次问一句」** —— 那正是升级前的行为。方向同 nativeRunEnabled
    // （默认值是"别动用户已有的东西"）：默认 true 的话，一个从没勾过
    // 「不再提醒」的用户会发现弹窗自己没了、代码被交给另一个编译器，
    // 全程无提示。「替用户省掉一次确认」只能由用户在弹窗里自己点头。
    read: (raw) => bool(raw, DEFAULT_APP_CONFIG.nativeRunQuiet),
    // 同 nativeRunEnabled 的极性（默认 false），所以也是 `=== true`：
    // 漏迁移的 undefined 必须读成「继续每次询问」——写成 `!== false` 的话，
    // 弹窗会静默消失、代码被交给用户自己的编译器，方向和「不敢替用户
    // 打开原生模式」这套规矩完全一致。
    expose: (v) => v === true,
    // 和 nativeRunEnabled 同一套：「缺省时听现有的」，取现有值时同样 `=== true`
    // 定死极性 —— 老配置（这个字段还不存在）必须是 false（继续每次都问）。
    merge: (incoming, current) => (typeof incoming === 'boolean' ? incoming : current === true)
  },
  nativeIdePaths: {
    // ── v8 → v9 的那一行 ────────────────────────────────────────────
    // 单个 nativeIdePath 拆成「每语言一键」的四键表（分派规则写在上面
    // migrateIdePaths 的函数头上，所以这里要看整份文件而不是单个键）。
    // 空/坏值 → 四键全空，方向同 nativeRunEnabled：升级上来的用户保持未配置，
    // 点「打开」时按语言现检现荐，而不是替他把旧值钉死到某几门语言头上。
    read: (_raw, file) => migrateIdePaths(file),
    // 第二道保险，同上面 soundEnabled 一族：正常路径上它已被 migrateConfig
    // 整形成四键字符串表，但万一某个未来的读路径漏了迁移，渲染进程拿到的
    // 会是 undefined —— 设置页那四个输入框绑上去看着像「没配置」（其实是
    // 类型错的），而渲染层的分支里一句 `.trim()` 就能把整个设置页炸掉。
    // readIdePaths 恒输出四键、值必是字符串，降级成 '' 是**如实**的
    // （'' 就是「该语言没配置」的合法表示）。
    expose: readIdePaths,
    // 每语言路径表走 pickIdePaths —— ⚠️ 逐键继承 pickPath 的三态语义：
    // **`''` 算「清空该键」**（该语言回到「自动」），不是「没改」（方向和
    // pickText 正好相反）。整表缺字段的防御也在它里边。
    merge: pickIdePaths
  },
  favWrongToBook: {
    // ── v5 → v6 的那一行 ────────────────────────────────────────────
    // 老配置里没有这个字段，`bool` 会给出 true：**收藏练习答错照样进错题本**。
    // 方向同 soundEnabled（默认值是"软件的性子"、不是"别动用户已有的东西"）——
    // 全应用每一种练习答错都进，收藏练习没有理由在升级的一瞬间变成例外。
    read: (raw) => bool(raw, DEFAULT_APP_CONFIG.favWrongToBook),
    // 和上面 soundEnabled 同型（默认值是 true 的布尔），所以极性也照它写 `!== false`：
    // 漏迁移时给 true（「答错就记」是全应用的既有性子），而不是把开关静默关掉 ——
    // 关掉的样子是「在收藏里错了一串题，错题本里一条都没有」，用户根本不会往设置上想。
    expose: (v) => v !== false,
    // 和 soundEnabled 一套：「缺省时听现有的」，且取现有值时同样要**定死极性** ——
    // 老配置（这个字段还不存在）必须是 true（答错就记），`!== false` 正好给到它。
    // 写成 `=== true` 就反了：没带这个字段的一次无关保存，会把用户开着的行为静默关掉。
    merge: (incoming, current) => (typeof incoming === 'boolean' ? incoming : current !== false)
  },
  layout: {
    // layout 走和当年完全相同的补齐逻辑，行为不变，只是从此有了版本记录
    // ── v10 → v11 的那一行 ────────────────────────────────────────────
    // 老配置里没有 `sidebarOpen`，`normalizeLayout` 补 true：**升级上来的用户
    // 第一眼和升级前一模一样**。方向同 rightPanelOpen —— 绝不把「文件里没有
    // 这个字段」当成「用户关掉了它」；收起只能由用户自己拖出来或点按钮点出来。
    // ── v17 → v18 的那一段 ───────────────────────────────────────────
    // sidebarRail（左栏三态「open → rail → hidden」的中间态，图标窄栏）同走
    // normalizeLayout 就地补 false：老配置读出来 = 正常宽度的左栏，**与升级前
    // 逐字节同行为**（rail 是用户亲手按出来/拖出来的形态，升级不能替他做）。
    // 同一道归一化还把「关着还带 rail」的脏组合钳掉（收起与窄栏互斥）——
    // 无独立迁移段，本条注释即迁移记录。
    read: (raw) => normalizeLayout(raw),
    // 过一道 normalizeLayout，**不是原样透传**：老配置文件里没有这一节
    // （它是加 layout 字段之前写下的），直接给渲染进程一个 undefined，
    // App.vue 那边会在算 pane 尺寸时炸掉。补齐逻辑统一放在 shared/layout.ts。
    expose: (v) => normalizeLayout(v),
    // `?? current` —— 入参**整节没带**时听现有的，和「空值算没改」是同一套规矩。
    // 归一化那一步同时干两件事：补上老配置里缺的字段，以及把越界值钳回来。
    // 越界必须钳：这是**写盘前**最后一道，写进去就再也改不回来了。
    merge: (incoming, current) => normalizeLayout(incoming ?? current)
  },
  remote: {
    // ── v21 → v22 的那一行 ───────────────────────────────────────────
    // 老配置里没有这个字段：读成「关 + 默认端口」。必须用 `=== true`：服务一打开，
    // 局域网内的设备就能连到电脑，缺字段绝不能当成「开着」。无独立迁移步骤，本条即迁移记录。
    read(raw) {
      const r = isObject(raw) ? raw : {}
      return { enabled: r.enabled === true, port: clampRemotePort(r.port) }
    },
    expose: (v) => ({ enabled: v?.enabled === true, port: clampRemotePort(v?.port) }),
    // 缺省 = 听现有的；给了就必须是对象（类型错 = 抛，一个字节不写）
    merge(incoming, current) {
      if (incoming === undefined) return current
      if (!isObject(incoming)) throw new Error('invalid config payload')
      return {
        enabled: typeof incoming.enabled === 'boolean' ? incoming.enabled : current.enabled,
        port: incoming.port === undefined ? current.port : clampRemotePort(incoming.port)
      }
    }
  },
  ai: {
    read(raw) {
      const ai = isObject(raw) ? raw : {}
      return {
        // ⚠️ 原样带过去。**不要 trim、不要校验、不要「顺手规范化」** ——
        // 这个字段不是我们写进去的，用户从 DeepSeek 后台复制什么就是什么。
        // 真需要 trim 的地方在保存入口（上面的 nextApiKey），那里有单测盯着。
        apiKey: typeof ai.apiKey === 'string' ? ai.apiKey : '',
        baseUrl: text(ai.baseUrl, DEFAULT_APP_CONFIG.ai.baseUrl),
        model: text(ai.model, DEFAULT_APP_CONFIG.ai.model),
        protocol: ai.protocol === 'anthropic' ? 'anthropic' : 'openai',
        provider:
          typeof ai.provider === 'string' &&
          ['deepseek', 'openai', 'anthropic', 'custom'].includes(ai.provider)
            ? (ai.provider as AiProviderPreset)
            : 'deepseek',
        // ── v19 → v20 的那一行 ────────────────────────────────────────
        // 老配置里没有这个字段。**必须用 `=== true`，不能写 `!== false`**：
        // 它的默认值是 false（AI 花用户自己的余额，只能由用户主动授权）。
        // 写成 `!== false` 的话，一份从没配过这个字段的老配置会静默打开 AI 出题，
        // 用户会在不知情的情况下开始消耗 Token —— 正是这次要防的事。
        dynamicEnabled: ai.dynamicEnabled === true
      }
    },
    expose: (v) => ({
      hasKey: v.apiKey.trim() !== '',
      baseUrl: v.baseUrl,
      model: v.model,
      protocol: v.protocol ?? 'openai',
      provider: v.provider ?? 'deepseek',
      // Same polarity rule as nativeRunEnabled: default false, so `=== true`.
      // An old config with no field must read as "off", never silently opt in
      // to spending the user's own API balance.
      dynamicEnabled: v.dynamicEnabled === true
    }),
    merge(incoming, current) {
      if (!isObject(incoming)) throw new Error('invalid config payload')
      const ai = incoming as ConfigSavePayload['ai']
      return {
        apiKey: nextApiKey(current.apiKey, ai.apiKey),
        baseUrl: pickText(ai.baseUrl, current.baseUrl),
        model: pickText(ai.model, current.model),
        protocol:
          ai.protocol === 'anthropic'
            ? 'anthropic'
            : ai.protocol === 'openai'
              ? 'openai'
              : current.protocol ?? 'openai',
        provider:
          ai.provider === 'openai' ||
          ai.provider === 'anthropic' ||
          ai.provider === 'custom' ||
          ai.provider === 'deepseek'
            ? ai.provider
            : current.provider ?? 'deepseek',
        // Missing field means "keep what is on disk" (same rule as soundEnabled),
        // and the fallback uses `=== true` so an old config stays off.
        dynamicEnabled:
          typeof ai.dynamicEnabled === 'boolean' ? ai.dynamicEnabled : current.dynamicEnabled === true
      }
    }
  },
  learning: {
    read(raw) {
      const l = isObject(raw) ? raw : {}
      return {
        explainMode: l.explainMode === 'video' ? 'video' : 'text',
        reviewStrategy: l.reviewStrategy === 'sprint' ? 'sprint' : 'standard'
      }
    },
    expose: (v) => ({
      explainMode: v?.explainMode === 'video' ? 'video' : 'text',
      reviewStrategy: v?.reviewStrategy === 'sprint' ? 'sprint' : 'standard'
    }),
    merge(incoming, current) {
      if (incoming === undefined) return current
      if (!isObject(incoming)) throw new Error('invalid config payload')
      return {
        explainMode:
          incoming.explainMode === 'video' || incoming.explainMode === 'text'
            ? incoming.explainMode
            : current.explainMode,
        reviewStrategy:
          incoming.reviewStrategy === 'sprint' || incoming.reviewStrategy === 'standard'
            ? incoming.reviewStrategy
            : current.reviewStrategy
      }
    }
  },
  update: {
    read: (raw) => ({
      auto: isObject(raw) ? bool(raw.auto, true) : true
    }),
    expose: (v) => ({
      auto: v?.auto !== false
    }),
    merge(incoming, current) {
      if (incoming === undefined) return current
      if (!isObject(incoming)) throw new Error('invalid config payload')
      return {
        auto: typeof incoming.auto === 'boolean' ? incoming.auto : current.auto
      }
    }
  }
}

/** 注册表键表（遍历用）；顺序即注册表书写顺序 */
export const CONFIG_FIELD_KEYS = Object.keys(CONFIG_FIELDS) as ConfigFieldKey[]
