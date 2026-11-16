/**
 * config.json 的**版本迁移** —— 铁律 6 的落地。
 *
 * 【铁律 6 说的是什么，为什么它不是形式主义】
 * `json-store.ts` 把 JSON 原样搬进搬出，**从头到尾不读 `version`**。
 * 所以老配置文件会带着老结构被新代码直接加载：新加的字段是 `undefined`，
 * 轻则功能异常，重则崩。而崩了之后走「解析失败 → 重建空结构」这条路，
 * **会静默清零用户的全部学习进度**。
 *
 * 本项目在这之前**一处迁移都没有**（`src/main/index.ts` 有一段注释专门
 * 记着这件事：当时为了躲开迁移，宁可多开一个 challenge.json）。加
 * `soundEnabled` 是第一次真的需要，所以这套东西是**新建**的，不是补的。
 *
 * 【历史欠账：layout】
 * `layout` 是加本机制之前新增的字段，它的补齐写在 `normalizeLayout()` 里，
 * 每次读配置时跑一遍——能用，但**文件里的 version 永远停在 1**，事后分不出
 * 一份配置是哪个年代的。这次一并收进迁移：v1 → v2 会经过 `normalizeLayout`，
 * 行为和老代码完全一致（不会把谁拖好的宽度弹回去），只是从此有了版本记录。
 *
 * 【为什么是纯函数】它要能被 Vitest 直接测。而这里最要命的几条
 * ——「apiKey 不能被抹掉」「老配置读出来 soundEnabled 必须是 true」——
 * 正好是最该被测试钉死、又最容易被一次「顺手简化」弄坏的东西。
 *
 * ⚠️ 本文件在 `src/` 下、被文案闸门扫，**字符串一律英文**（给开发者看的），
 *    中文只出现在注释里。
 */
import { CURRENT_CONFIG_VERSION, DEFAULT_APP_CONFIG, type AppConfig, type EnvCache } from './types'
import {
  CONFIG_FIELDS,
  CONFIG_FIELD_KEYS,
  MAX_SFX_VOLUME,
  MAX_TIMEOUT_SEC,
  MIN_SFX_VOLUME,
  MIN_TIMEOUT_SEC,
  clampVolume,
  isObject
} from './config-schema'

/**
 * 取值边界与 `clampVolume` 的定义在 `config-schema.ts`（schema 这一侧，读写两侧共用），
 * 这里只做转出，既有引用点（含 config-migrate.test.ts）一行不用改。
 */
export { MIN_TIMEOUT_SEC, MAX_TIMEOUT_SEC, MIN_SFX_VOLUME, MAX_SFX_VOLUME, clampVolume }

/**
 * 版本迁移步骤表（docs/28 §1.2）：键 = 起始版本 n；函数把 vn 的原始文件**就地**改成
 * v(n+1) 的形状（`migrateConfig` 传进来的是原始文件的浅拷贝，就地改不会碰调用方的对象）。
 *
 * 只有**结构性变更**（删字段 / 改名 / 拆分 / 合并）才需要在这里加一步；
 * 「加字段」只需要注册表条目的 `read` 对缺失值给默认。
 * v1 ~ v19 的历史变更全是加字段，或已由字段的 `read` 幂等处理（含 v8 → v9 的
 * `nativeIdePath` 拆分），不回填。
 */
export const CONFIG_MIGRATIONS: Record<number, (file: Record<string, unknown>) => void> = {
  // v20 → v21：桌宠 / 壁纸 / 开屏三块整体移除。其余字段（尤其 ai.apiKey）不动，
  // 由注册表的 read 照常搬运；三键丢掉后注册表不认识它们，本来也不会带进结果，
  // 这一步的意义是让「文件里那三块被丢弃」在迁移表里有明文记录。
  20: (file) => {
    delete file.pet
    delete file.wallpaper
    delete file.splash
  },
  // v22 → v23：暗色主题移除（应用只剩浅色），丢弃 `theme` 键；其余字段（含 ai.apiKey）不动。
  22: (file) => {
    delete file.theme
  },
  // v23 → v24：加 `learning`（学习方式与复习策略，docs/33 §B0）；缺字段补默认，其余字段不动。
  23: (file) => {
    const l = isObject(file.learning) ? file.learning : {}
    file.learning = {
      explainMode: l.explainMode === 'video' ? 'video' : 'text',
      reviewStrategy: l.reviewStrategy === 'sprint' ? 'sprint' : 'standard'
    }
  },
  // v24 → v25：加 `update`（自动更新开关，docs/34）；缺字段补默认 `{ auto: true }`，其余字段不动。
  24: (file) => {
    const u = isObject(file.update) ? file.update : {}
    file.update = {
      auto: typeof u.auto === 'boolean' ? u.auto : true
    }
  }
}

/**
 * 把任意一份「从 config.json 读出来的东西」搬成**当前版本**的完整配置。
 *
 * 【为什么入参类型是 `unknown` 而不是 `AppConfig`】
 * 因为它的全部意义就是「输入不一定长成 AppConfig」。写成 AppConfig 等于
 * 自欺欺人：真正的老文件里 `soundEnabled` 根本不存在，类型系统假装它在，
 * 调用方就会理所当然地直接读——那正是要防的事。
 *
 * 【几条不可动摇的规矩】
 *   1. **`ai.apiKey` 必须原样带过去**。抹掉它 = 用户重新去 DeepSeek 后台
 *      生成一次 Key，而且他不会知道是我们弄丢的。这一条有专门的单测。
 *   2. **逐字段搬运，不整体 spread**。spread 会把文件里那些我们不认识的
 *      垃圾字段一起带进内存，也会让「这个字段到底处理过没有」变得看不出来。
 *   3. **输入不是对象时给一份默认配置，并且出声**（`console.warn`）。
 *      铁律里明令禁止的就是「静默重建」——重建可以，不许不留痕。
 *
 * 【已知取舍：版本比当前还新时会发生什么】
 * 用户装过更新的版本又装回旧版时，`raw.version` 会大于当前版本。这里**不特殊处理**，
 * 照常走同一套搬运——结果是「认识的字段保留，不认识的字段丢掉」。
 * 不处理是有意的：另一种做法（整份拒绝、退回默认值）会把用户**全部**设置清掉，
 * 比丢掉几个未来字段严重得多。
 */
export function migrateConfig(raw: unknown): AppConfig {
  if (!isObject(raw)) {
    // 走到这里说明 config.json 里是个数组/字符串/null 之类的东西。
    // **必须出声**：这是「用户的配置文件坏了」，不是正常路径。
    console.warn('[miai] config.json is not an object, falling back to defaults')
    return structuredClone(DEFAULT_APP_CONFIG)
  }

  // 浅拷贝：步骤表就地改它，调用方手里的对象一个字节都不许动。
  const file: Record<string, unknown> = { ...raw }
  // 缺失 / 非数字 / 非整数的 version 一律当 v1（从头跑全部步骤）；比当前还新的不跑任何步骤。
  const from = Number.isInteger(file.version) && (file.version as number) >= 1 ? (file.version as number) : 1
  for (let n = from; n < CURRENT_CONFIG_VERSION; n++) CONFIG_MIGRATIONS[n]?.(file)

  const out: Record<string, unknown> = {
    // 无条件写成当前版本：迁移的产出**永远**是当前版本，这是它的定义。
    // 不写成 `raw.version`——那样迁完还是老版本号，下次读又得再迁一遍。
    version: CURRENT_CONFIG_VERSION
  }
  // 逐字段搬运（注册表里每个字段的 read），不整体 spread —— 理由见上面规矩 2
  for (const key of CONFIG_FIELD_KEYS) out[key] = CONFIG_FIELDS[key].read(file[key], file)
  // envCache 是主进程写穿的缓存，形状由 env:detect 保证。不是对象就当空的重算一遍，
  // 代价只是多跑一次环境检测，比带着一个坏形状往下走便宜得多。
  out.envCache = isObject(file.envCache) ? (file.envCache as Partial<EnvCache>) : {}
  // 键集合由注册表的映射类型 + 上面两行保证等于 AppConfig 的键集合（config-migrate.test.ts 有闸）
  return out as unknown as AppConfig
}
