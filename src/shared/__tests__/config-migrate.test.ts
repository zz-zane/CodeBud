/**
 * config.json 的版本迁移（src/shared/config-migrate.ts）
 *
 * 【这个文件在守什么】
 * 迁移的输入是「**别人硬盘上那份我们没见过、也不该假设的**文件」，
 * 而它的失败方式几乎全是静默的 —— 没有崩溃、没有报错，只是某个设置悄悄变了样：
 *
 *   1. **Api Key 被抹掉**。用户在 DeepSeek 后台生成的 Key 只显示一次，
 *      丢了就得重新生成一把。而界面上 Key 那一栏**永远是空的**（设计如此，
 *      真 Key 只存在主进程），所以他**看不出是被我们弄丢的** ——
 *      只会觉得「这软件怎么老要重填」。
 *   2. **老配置读出来 `soundEnabled` 是 undefined**。`undefined` 在 `if` 里是假，
 *      于是**升级上来的老用户一开就是静音**，还找不到原因（开关显示是勾上的，
 *      因为复选框对 undefined 的处理是「不勾」…… 两处不一致时更好看）。
 *   3. **version 没被写上去**。那样每次读配置都得重迁一遍，
 *      而且事后分不出磁盘上那份是哪个年代的。
 *
 * ⚠️ 本文件在 `src/` 下、被文案闸门扫，字符串一律英文。
 */
import { describe, expect, it, vi } from 'vitest'
import { CONFIG_MIGRATIONS, MAX_TIMEOUT_SEC, MIN_TIMEOUT_SEC, migrateConfig } from '../config-migrate'
import { CONFIG_FIELDS } from '../config-schema'
import {
  CURRENT_CONFIG_VERSION,
  DEFAULT_APP_CONFIG,
  emptyIdePaths,
  type AppConfig
} from '../types'

/** 一份**当前版本**的完整配置，用来做「迁移不该改动已经对了的东西」的基线 */
const current = (): AppConfig => structuredClone(DEFAULT_APP_CONFIG)

// ---------------------------------------------------------------- 最要紧的一条

describe('apiKey **绝对不能**在迁移里丢掉', () => {
  it('老配置（v1，没有 soundEnabled）里的 Key 原样带过来', () => {
    // 这是整份迁移里唯一一条「弄错了会让用户真的损失东西」的规矩。
    // 别的字段错了顶多是显示不对，这个错了用户得再去后台生成一把 Key。
    const key = 'sk-0123456789abcdef0123456789abcdef'
    const out = migrateConfig({ version: 1, ai: { apiKey: key } })
    expect(out.ai.apiKey).toBe(key)
  })

  it('**不 trim**：前后带空格也一字不改地留着', () => {
    // 看起来像小事，其实不是。这个字段不是我们写进去的，用户从网页上复制
    // 什么就是什么。「顺手规范化」在这里是**把改动伪装成清理** ——
    // 万一某家的 Key 真允许这种形状，我们就在他没察觉的情况下换了它的值。
    // 真需要 trim 的地方是保存入口（config-merge 的 nextApiKey），那里有单测盯着。
    const out = migrateConfig({ ai: { apiKey: '  sk-padded  ' } })
    expect(out.ai.apiKey).toBe('  sk-padded  ')
  })

  it('反向验证：**空串也是合法值**，不能被 fallback 顶掉', () => {
    // 「没配 Key」和「配了一把空 Key」在存储上都是空串，迁移必须原样接受。
    // 少了这一条，上面那条「不 trim」用一个 `?? ''` 也能绿 ——
    // 而那会把空串当成缺失，语义就变了。
    expect(migrateConfig({ ai: { apiKey: '' } }).ai.apiKey).toBe('')
  })

  it('apiKey 不是字符串时退回空串（而不是把某个对象塞进去）', () => {
    // 手工编辑过的配置文件里什么都可能。塞一个非字符串进去，
    // 后面拼 Authorization 头的时候才会炸，那时已经离现场很远了。
    expect(migrateConfig({ ai: { apiKey: { nested: true } } }).ai.apiKey).toBe('')
  })

  it('`ai` 整节都不在（或不是对象）时**不崩**，给一节默认值', () => {
    for (const raw of [{ version: 1 }, { ai: null }, { ai: 'nope' }, { ai: [] }]) {
      const out = migrateConfig(raw)
      expect(out.ai.apiKey).toBe('')
      expect(out.ai.baseUrl).toBe(DEFAULT_APP_CONFIG.ai.baseUrl)
      expect(out.ai.model).toBe(DEFAULT_APP_CONFIG.ai.model)
    }
  })
})

// ---------------------------------------------------------------- v1 → v2

describe('v1 → v2：soundEnabled 那一行', () => {
  it('老配置里**根本没有这个字段** → 读出来是 true（音效默认开着）', () => {
    // 这是 `bool(raw.soundEnabled, true)` 里那个 `true` 存在的全部理由。
    // 写成 `false` 的话，升级上来的老用户一开就静音 —— 而他会以为功能坏了，
    // 因为开关在界面上是勾着的（复选框对 undefined 有自己的解读）。
    const out = migrateConfig({ version: 1, reviewEnabled: true })
    expect(out.soundEnabled).toBe(true)
  })

  it('用户**亲手关掉**的必须留住（不能被「默认即 true」顶回去）', () => {
    // 少这一条，上面那条用一个写死的 true 也能绿 —— 而那等于
    // 「每次启动都把用户的静音设置强行打开」。这两条必须同时在场才有意义。
    expect(migrateConfig({ version: 1, soundEnabled: false }).soundEnabled).toBe(false)
  })

  it('非布尔值退回 true，不把 `"false"` 这种字符串当真', () => {
    // JSON 里写 "false" 是个常见的手滑。当真的话 `if ("false")` 是**真**，
    // 静音开关会反着来 —— 静默的、方向相反的错误。
    expect(migrateConfig({ soundEnabled: 'false' }).soundEnabled).toBe(true)
    expect(migrateConfig({ soundEnabled: 0 }).soundEnabled).toBe(true)
    expect(migrateConfig({ soundEnabled: null }).soundEnabled).toBe(true)
  })

  it('产物**永远**是当前版本号，哪怕输入是 v1、或者压根没写 version', () => {
    // 不这么写的话迁完还是老版本号，下次读配置又得再迁一遍 ——
    // 而且磁盘上那份永远看起来像「没迁过」，事后没法判断。
    // 这里**故意不写 `toBe(2)`**：它和上一行验的是同一个表达式，一点判别力都不加，
    // 却会在每次 bump 时变成一个和现实不符、又没人会注意的假货。
    // （同一个坑在 stores/__tests__/settings.test.ts 里已经栽过一次，那边留了记录。）
    for (const raw of [{ version: 1 }, {}, { version: undefined }, { version: 'x' }]) {
      expect(migrateConfig(raw).version).toBe(CURRENT_CONFIG_VERSION)
    }
  })

  it('版本**比当前还新**时照常搬运，认识的字段全留住', () => {
    // 用户装过更新版本又装回旧版。另一种做法（整份拒绝、退回默认值）
    // 会把他**全部**设置清掉，比丢掉几个未来字段严重得多。
    const out = migrateConfig({ version: 99, soundEnabled: false, reviewEnabled: false })
    expect(out.soundEnabled).toBe(false)
    expect(out.reviewEnabled).toBe(false)
    expect(out.version).toBe(CURRENT_CONFIG_VERSION)
  })
})

// ---------------------------------------------------------------- v3 → v4

/**
 * v3 → v4：nativeRunEnabled 那一行。
 *
 * 【为什么这一条比 theme 那条还重】
 * theme 读错了，最坏是界面颜色不对 —— 看得见，改得回来。
 * 这个字段读错了，是**把用户的代码交给另一个程序去跑**，而且方向还可能相反：
 *   · 该关却读成开 → 从没要求过的人在不知情的情况下走了他的 shell，还每次多一个弹窗；
 *   · 该开却读成关 → 用户打开开关、重启，发现开关「自己关掉了」，功能像坏了。
 * 两种都不报错。所以下面「默认 false」和「亲手开的必须留住」**必须同时在场**，
 * 少任何一条，另一条都能用一个写死的值骗过去。
 */
describe('v3 → v4：nativeRunEnabled 那一行', () => {
  it('老配置里**根本没有这个字段** → 读出来是 false（升级上来的用户保持关着）', () => {
    // 这是 `bool(raw.nativeRunEnabled, false)` 里那个 `false` 存在的全部理由。
    // 写成 true 的话，每一个升级上来的用户——包括那些机器上压根没装编译器的——
    // 下次点运行都会撞上一个自己没开过的开关，然后拿到一句
    // “找不到 gcc”，而他从没要求过这件事。
    expect(migrateConfig({ version: 3 }).nativeRunEnabled).toBe(false)
    expect(DEFAULT_APP_CONFIG.nativeRunEnabled, '默认值本身也得是 false').toBe(false)
  })

  it('用户**亲手打开**的必须留住（不能被默认值顶回去）', () => {
    // 少这一条，上面那条用一个写死的 false 也能绿 —— 而那等于
    // 「每次启动都把原生模式关掉」，用户会以为开关存不住。
    expect(migrateConfig({ version: 3, nativeRunEnabled: true }).nativeRunEnabled).toBe(true)
    expect(migrateConfig({ version: 3, nativeRunEnabled: false }).nativeRunEnabled).toBe(false)
  })

  it('★ 非布尔值一律退回 **false**，`"false"` / `"true"` / 1 都不当真', () => {
    // 这组是本文件的红线所在。JSON 里写 `"false"` 是常见手滑，而 `if ("false")`
    // 是**真** —— 当真的话，一个写着 false 的值会把用户送上原生模式：
    // 方向相反、还静默。这条字段的错方向比 theme 那次更贵（那边只是颜色不对）。
    // 反过来，`1` / `"true"` 也不能当成开：用户没打开过的开关，不该由一份手改过的
    // 配置文件替他打开。**两个方向都退回 false**，没有例外。
    for (const bad of ['false', 'true', 1, 0, 'yes', [], {}, null, undefined]) {
      expect(
        migrateConfig({ nativeRunEnabled: bad }).nativeRunEnabled,
        `这个值被读成了 true，但它不是布尔 true：${String(bad)}`
      ).toBe(false)
    }
  })

  it('版本**比当前还新**时照常搬运（和 theme / soundEnabled 同一套规矩）', () => {
    expect(migrateConfig({ version: 99, nativeRunEnabled: true }).nativeRunEnabled).toBe(true)
    expect(migrateConfig({ version: 99 }).nativeRunEnabled).toBe(false)
  })
})

// ---------------------------------------------------------------- v4 → v5

/**
 * v4 → v5：sfxVolume 那一行。
 *
 * 【这一条的默认值方向和 soundEnabled **相同**，和 theme / nativeRunEnabled 相反】
 * 那个「方向」不是随便定的，它取决于**默认值是软件的性子，还是用户已有的东西**：
 *   · 音效默认开、音量默认 100% —— 是「这个软件本来就该响」；
 *   · 主题默认浅、原生模式默认关 —— 是「别动用户已有的东西 / 别替他做危险决定」。
 * 升级上来的老用户**听到的音量和昨天一模一样**（都是满的），所以他不会觉得
 * 这次升级动了什么 —— 这正是一条迁移该有的样子。
 */
describe('v4 → v5：sfxVolume 那一行', () => {
  it('老配置里**根本没有这个字段** → 读出来是 100（和升级前听到的一样响）', () => {
    // 给 0 的话，升级上来的用户会突然发现"整个软件没声音了"，
    // 而设置页那个开关明明是开着的 —— 他会去查音频驱动。
    expect(migrateConfig({ version: 4 }).sfxVolume).toBe(100)
    expect(DEFAULT_APP_CONFIG.sfxVolume, '默认值本身也得是满的').toBe(100)
  })

  it('★ 用户**亲手拨到 0**（静音）的必须留住 —— 0 是个正经的值，不是"没有值"', () => {
    // 这一条是这组里最容易写坏的地方：`raw.sfxVolume || 100` 这种写法会让
    // **0 变成 100**（0 是假值），于是用户每重启一次，静音就被还回来一次。
    // 他只会觉得"这个滑块存不住"。所以判断只能用 `Number.isFinite`，
    // 不能用真假值 —— 两行代码长得几乎一样，行为正好相反。
    expect(migrateConfig({ version: 4, sfxVolume: 0 }).sfxVolume).toBe(0)
    expect(migrateConfig({ version: 4, sfxVolume: 1 }).sfxVolume).toBe(1)
    expect(migrateConfig({ version: 4, sfxVolume: 50 }).sfxVolume).toBe(50)
  })

  it('越界值被钳进 [0, 100]（写进文件就晚了）', () => {
    // 500 会在播放时变成 5 倍增益 —— 一耳朵爆音。
    expect(migrateConfig({ sfxVolume: 999 }).sfxVolume).toBe(100)
    expect(migrateConfig({ sfxVolume: -30 }).sfxVolume).toBe(0)
  })

  it('小数四舍五入成整数（界面显示和文件内容必须对得上）', () => {
    expect(migrateConfig({ sfxVolume: 79.6 }).sfxVolume).toBe(80)
    expect(migrateConfig({ sfxVolume: 79.4 }).sfxVolume).toBe(79)
  })

  it('★ NaN / Infinity / 字符串 → 退回 **100**，**不是**被钳成 0', () => {
    // 和 runTimeoutSec 那条同一个道理：NaN 的意思是「这个值没意义」，
    // 不是「用户想要静音」。钳成 0 的话，一个手改坏的值会让整个软件**静默地**
    // 一点声音都没有，而用户只会去怀疑扬声器。
    // ⚠️ NaN **能穿过** `Math.min(Math.max(NaN, 0), 100)`（和谁比都是 false），
    // 所以 `Number.isFinite` 这一道不能省 —— 少了它，NaN 会被原样搬下去，
    // 最后写进 `gain.gain.value = NaN`，那一路音效**永远不响且不报错**。
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, '80', null, undefined, {}, []]) {
      expect(
        migrateConfig({ sfxVolume: bad }).sfxVolume,
        `这个值没有被退回默认：${String(bad)}`
      ).toBe(100)
    }
  })

  it('版本**比当前还新**时照常搬运（和上面几个字段同一套规矩）', () => {
    expect(migrateConfig({ version: 99, sfxVolume: 30 }).sfxVolume).toBe(30)
    expect(migrateConfig({ version: 99 }).sfxVolume).toBe(100)
  })
})

// ---------------------------------------------------------------- v5 → v6

/**
 * v5 → v6：favWrongToBook 那一行（收藏练习答错要不要进错题本）。
 *
 * 【默认值方向同 soundEnabled（给 true），和 theme / nativeRunEnabled 相反】
 * 判据还是那条：它是「软件的性子」还是「用户已有的东西」？
 * 全应用每一种练习答错都进错题本，收藏练习没有理由在升级的那一瞬间变成例外 ——
 * 所以老配置读出来必须是 true。写反的后果是**一部分用户的错题本从此悄悄少东西**，
 * 而他根本不会往设置上想（那个开关他从来没碰过）。
 */
describe('v5 → v6：favWrongToBook 那一行', () => {
  it('老配置里**根本没有这个字段** → 读出来是 true（答错照样进错题本）', () => {
    expect(migrateConfig({ version: 5 }).favWrongToBook).toBe(true)
    expect(DEFAULT_APP_CONFIG.favWrongToBook, '默认值本身也得是 true').toBe(true)
  })

  it('★ 用户**亲手关掉**的必须留住（不能被「默认即 true」顶回去）', () => {
    // 少这一条，上面那条用一个写死的 true 也能绿 —— 而那等于
    // 「每次启动都把用户关掉的开关又打开」。这一对必须同时在场才有意义
    expect(migrateConfig({ version: 5, favWrongToBook: false }).favWrongToBook).toBe(false)
  })

  it('非布尔值退回 true（`"false"` 这种字符串不当真）', () => {
    // 和 soundEnabled 那边同一个坑：`if ("false")` 是**真**，
    // 开关的方向会反着来 —— 静默的、方向相反的错误
    for (const bad of ['false', 0, 1, null, {}, []]) {
      expect(migrateConfig({ favWrongToBook: bad }).favWrongToBook, `这个值没被退回默认：${String(bad)}`).toBe(
        true
      )
    }
  })

  it('版本**比当前还新**时照常搬运（和上面几个字段同一套规矩）', () => {
    expect(migrateConfig({ version: 99, favWrongToBook: false }).favWrongToBook).toBe(false)
  })
})

// ---------------------------------------------------------------- v7 → v8

/**
 * v7 → v8：nativeRunQuiet 那一行（原生模式的「不再提醒」）。
 *
 * 【默认值方向同 nativeRunEnabled：给 false（继续每次都问）】
 * 判据还是那条：默认值是「软件的性子」还是「别动用户已有的东西」？
 * 「不再提醒」只有在用户**在弹窗里亲手勾过**之后才能成立 —— 它是对
 * 「每跑一次问一句」的豁免，不能让升级这个动作替他做。
 *
 * 【默认给 false 比看上去更要紧】true 的后果不是多问一句，而是**少问一句**：
 * 一个从没勾过不再提醒的用户，升级后弹窗自己没了，代码被交给另一个编译器跑，
 * 全程没有任何提示 —— 和 nativeRunEnabled「该关却读成开」是同一类事故
 * （那个方向的测试见 v3 → v4 那组）。
 */
describe('v7 → v8：nativeRunQuiet 那一行', () => {
  it('老配置里**根本没有这个字段** → 读出来是 false（升级上来的用户继续每次都问）', () => {
    expect(migrateConfig({ version: 7 }).nativeRunQuiet).toBe(false)
    expect(DEFAULT_APP_CONFIG.nativeRunQuiet, '默认值本身也得是 false').toBe(false)
  })

  it('用户**亲手勾过不再提醒**的必须留住（不能被默认值顶回去）', () => {
    // 少这一条，上面那条用一个写死的 false 也能绿 —— 而那等于
    // 「每次启动都把用户勾的『不再提醒』抹掉」，弹窗又冒出来了。
    expect(migrateConfig({ version: 7, nativeRunQuiet: true }).nativeRunQuiet).toBe(true)
    expect(migrateConfig({ version: 7, nativeRunQuiet: false }).nativeRunQuiet).toBe(false)
  })

  it('★ 非布尔值一律退回 **false**，`"false"` / `"true"` / 1 都不当真', () => {
    // 同 nativeRunEnabled 那组：JSON 里写 "false" 是常见手滑，而 `if ("false")`
    // 是**真**。当真的话，一个写着 false 的值会把弹窗静默关掉（= 替用户
    // 勾上了他从没勾过的「不再提醒」）。两个方向都退回 false，没有例外。
    for (const bad of ['false', 'true', 1, 0, 'yes', [], {}, null, undefined]) {
      expect(
        migrateConfig({ nativeRunQuiet: bad }).nativeRunQuiet,
        `这个值被读成了 true，但它不是布尔 true：${String(bad)}`
      ).toBe(false)
    }
  })

  it('版本**比当前还新**时照常搬运（和上面几个字段同一套规矩）', () => {
    expect(migrateConfig({ version: 99, nativeRunQuiet: true }).nativeRunQuiet).toBe(true)
    expect(migrateConfig({ version: 99 }).nativeRunQuiet).toBe(false)
  })
})

// ---------------------------------------------------------------- v8 → v9

/**
 * v8 → v9：单个 nativeIdePath 拆成每语言四键 nativeIdePaths。
 *
 * 【为什么值得这么多对照臂】旧值只是一枚**没有语言信息**的选择，而主人
 * 实测的病恰是「一个程序开所有语言、总有一半乱码」—— 闭着眼睛四键全填
 * 等于把病原样搬进新结构。分派口径（2026-10-01 拍板）：通用编辑器清空成
 * 「自动」、专用工具只填它画像里的语言、认不出的 exe 四键全填（那是用户的
 * 显式选择）。**通用编辑器与专用工具必须成对测** —— 只测一边的话，一个
 * 「四键全填」的简化实现也能全绿。
 */
describe('v8 → v9：nativeIdePath 拆成每语言四键', () => {
  it('老配置里**根本没有这个字段** → 四键全空（不替用户猜路径）', () => {
    // 方向同 nativeRunEnabled：升级上来的用户保持未配置，点「打开」时
    // 按语言现检现荐 —— 而不是替他把某个"常见安装路径"钉进四格里。
    expect(migrateConfig({ version: 8 }).nativeIdePaths).toEqual(emptyIdePaths())
    expect(DEFAULT_APP_CONFIG.nativeIdePaths, '默认值本身也是四键全空').toEqual(emptyIdePaths())
  })

  it('★ 空白串 / 非字符串 → 四键全空（空 = 未配置，不是"保留上次"）', () => {
    for (const bad of ['', '   ', '\t', 0, null, undefined, {}, []]) {
      expect(
        migrateConfig({ version: 8, nativeIdePath: bad }).nativeIdePaths,
        `这个值没被退回四键全空：${String(bad)}`
      ).toEqual(emptyIdePaths())
    }
  })

  it('★ 旧值 = Dev-C++（专用工具）→ 只填 c / cpp，java、python 留空走自动推荐', () => {
    // 旧值只是一枚"没有语言信息"的选择；Dev-C++ 的画像里只有 c/cpp，
    // 把它也填进 java/python 等于明知故犯地制造乱码。
    const p = 'C:\\Program Files (x86)\\Dev-Cpp\\devcpp.exe'
    expect(migrateConfig({ version: 8, nativeIdePath: p }).nativeIdePaths).toEqual({
      c: p,
      cpp: p,
      java: '',
      python: ''
    })
  })

  it('★ 对照臂：旧值 = VS Code（通用编辑器）→ 四键**全空**（退位给按语言推荐）', () => {
    // 和上一条成对：只测 Dev-C++ 的话，「四键全填」的简化实现也会绿。
    // 通用编辑器什么都开得了，正因如此旧值不锁任何槽位 —— 让每门语言
    // 各自去推荐表里选（装了什么用什么，行为不会丢）。
    const p = 'C:\\Users\\me\\AppData\\Local\\Programs\\Microsoft VS Code\\Code.exe'
    expect(migrateConfig({ version: 8, nativeIdePath: p }).nativeIdePaths).toEqual(emptyIdePaths())
    // 同族的另两个也必须被认出来（大小写不敏感这条路上各留一臂）
    expect(
      migrateConfig({ version: 8, nativeIdePath: 'D:/apps/VSCodium.exe' }).nativeIdePaths
    ).toEqual(emptyIdePaths())
    expect(migrateConfig({ version: 8, nativeIdePath: 'D:/apps/CURSOR.EXE' }).nativeIdePaths).toEqual(
      emptyIdePaths()
    )
  })

  it('旧值 = PyCharm → 只填 python；IntelliJ IDEA → 只填 java', () => {
    expect(migrateConfig({ version: 8, nativeIdePath: 'D:/apps/pycharm64.exe' }).nativeIdePaths).toEqual(
      { c: '', cpp: '', java: '', python: 'D:/apps/pycharm64.exe' }
    )
    expect(migrateConfig({ version: 8, nativeIdePath: 'D:/apps/idea64.exe' }).nativeIdePaths).toEqual({
      c: '',
      cpp: '',
      java: 'D:/apps/idea64.exe',
      python: ''
    })
  })

  it('★ 认不出的 exe（用户自己挑的程序）→ 四键全填（他的显式选择不许丢）', () => {
    // 和白名单外程序的编码回退（defaultEncodingOf）配套：四键全填 +
    // 按语言回退 = 升级前后逐字节一致，不比现在差。若"简化"成清空，
    // 用户会发现「我明明配过的程序，升级后点打开变成现检现荐了」。
    const p = 'D:/tools/my-editor.exe'
    expect(migrateConfig({ version: 8, nativeIdePath: p }).nativeIdePaths).toEqual({
      c: p,
      cpp: p,
      java: p,
      python: p
    })
  })

  it('旧值前后带空格 → 先 trim 再分发（同一条路径不许存成两个样）', () => {
    expect(
      migrateConfig({ version: 8, nativeIdePath: '  D:/tools/devcpp.exe  ' }).nativeIdePaths
    ).toEqual({ c: 'D:/tools/devcpp.exe', cpp: 'D:/tools/devcpp.exe', java: '', python: '' })
  })

  it('★ 新字段已在文件里 → 逐键取值，旧单值即使还在也被无视（幂等的机理）', () => {
    // 迁移的产出里有完整四键，第二遍迁移走这一类。旧字段若还在文件里
    // 却参与了判定，就会把用户 v9 之后改过的格子又按旧值覆盖回去。
    const out = migrateConfig({
      version: 8,
      nativeIdePath: 'C:/tools/devcpp.exe',
      nativeIdePaths: { c: '  C:/new.exe  ', cpp: '', python: 'C:/py.exe' }
    })
    expect(out.nativeIdePaths).toEqual({ c: 'C:/new.exe', cpp: '', java: '', python: 'C:/py.exe' })
  })

  it('新字段在、但逐键是脏值 → 该键落空，不崩、不塞对象', () => {
    // 手改坏了的文件：42 / {} / 纯空白都不是路径，各自落成 ''（text 的脏值语义）。
    const out = migrateConfig({
      nativeIdePaths: { c: 42, cpp: {}, java: '   ', python: 'C:/py.exe' }
    })
    expect(out.nativeIdePaths).toEqual({ c: '', cpp: '', java: '', python: 'C:/py.exe' })
  })

  it('新字段在、但根本不是对象（数组/字符串）→ 退回旧单值分派，而不是崩', () => {
    // isObject 把数组挡在外面，于是照旧单值那条路分发 —— Dev-C++ 的旧值
    // 正常落到 c/cpp。这里同时守住「坏形状不导致四键全空」这个方向。
    const p = 'C:/tools/devcpp.exe'
    const want = { c: p, cpp: p, java: '', python: '' }
    expect(migrateConfig({ version: 8, nativeIdePath: p, nativeIdePaths: [] }).nativeIdePaths).toEqual(want)
    expect(migrateConfig({ version: 8, nativeIdePath: p, nativeIdePaths: 'oops' }).nativeIdePaths).toEqual(
      want
    )
  })

  it('版本**比当前还新**时照常搬运（和上面几个字段同一套规矩）', () => {
    const p = 'C:/tools/devcpp.exe'
    expect(migrateConfig({ version: 99, nativeIdePath: p }).nativeIdePaths.c).toBe(p)
    expect(migrateConfig({ version: 99 }).nativeIdePaths).toEqual(emptyIdePaths())
  })

  it('幂等：带空格的旧值迁一次被 trim 并分发，再迁一次不再变', () => {
    const once = migrateConfig({ version: 8, nativeIdePath: '  D:/tools/devcpp.exe  ' })
    expect(once.nativeIdePaths.c).toBe('D:/tools/devcpp.exe')
    expect(migrateConfig(once)).toEqual(once)
  })
})

// ---------------------------------------------------------------- v17 → v18

/**
 * v17 → v18：layout 加 `sidebarRail`（左栏三态的中间态「图标窄栏」）。
 *
 * 【照旧没有独立迁移段】整块由 normalizeLayout 在迁移读口重建时一并补全
 * （config-migrate.ts 里「v17 → v18 的那一段」注释即迁移记录）。这一层的
 * 三个要点：① 老配置（v17 及以前从没见过这个键）补 false —— 升级第一眼
 * 与升级前一模一样；② 用户亲手按出来的 rail 留住；③ 脏组合
 * （open:false + rail:true，读不出来的第四种）在读口钳掉。
 */
describe('v17 → v18：layout.sidebarRail 补齐（左栏三态的中间态）', () => {
  it('v17 老配置（从没见过 sidebarRail）→ 补 false，其余键一个字不动', () => {
    const out = migrateConfig({
      version: 17,
      layout: { sidebarSize: 21, sidebarOpen: true, rightPanelSize: 24, rightPanelOpen: false }
    })
    expect(out.version).toBe(CURRENT_CONFIG_VERSION)
    expect(out.layout).toEqual({
      sidebarSize: 21,
      sidebarOpen: true,
      sidebarRail: false,
      rightPanelSize: 24,
      rightPanelOpen: false
    })
  })

  it('用户亲手收出来的 rail 必须留住（迁移不等于重置）', () => {
    const out = migrateConfig({
      version: 17,
      layout: { sidebarSize: 19, sidebarOpen: true, sidebarRail: true, rightPanelSize: 22, rightPanelOpen: true }
    })
    expect(out.layout.sidebarRail).toBe(true)
    expect(out.layout.sidebarSize).toBe(19)
  })

  it('脏组合（收起 + rail:true）→ rail 钳回 false（合法态只有三种）', () => {
    const out = migrateConfig({ version: 17, layout: { sidebarOpen: false, sidebarRail: true } })
    expect(out.layout.sidebarOpen).toBe(false)
    expect(out.layout.sidebarRail).toBe(false)
  })

  it('脏值（1 / "yes" / 对象）→ 回 false，**不是回 true**（方向与两个 Open 相反）', () => {
    for (const junk of [1, 'yes', 'true', {}]) {
      expect(
        migrateConfig({ version: 17, layout: { sidebarRail: junk } }).layout.sidebarRail,
        `这个值没被挡住：${String(junk)}`
      ).toBe(false)
    }
  })

  it('幂等：迁出来的配置再迁一遍逐字节不变', () => {
    const once = migrateConfig({ version: 17, layout: { sidebarRail: true, sidebarSize: 27 } })
    expect(migrateConfig(once)).toEqual(once)
  })
})

// ---------------------------------------------------------------- v19 → v20

/**
 * v19 → v20：ai 加 `dynamicEnabled`（AI 动态出题总开关）。
 *
 * 这条迁移的**全部风险都在默认值方向**：它决定用户会不会在不知情的情况下
 * 开始花自己的 Token。所以判据只有一条 —— 老配置 / 脏值 / 缺失一律 **false**，
 * 只有用户亲手存进来的布尔 true 才算数。
 */
describe('v19 → v20：AI 动态出题开关（默认关）', () => {
  it('v19 老配置（从没见过这个键）→ false', () => {
    const out = migrateConfig({
      version: 19,
      ai: { apiKey: 'sk-old', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' }
    })
    expect(out.version).toBe(CURRENT_CONFIG_VERSION)
    expect(out.ai.dynamicEnabled).toBe(false)
    expect(out.ai.apiKey).toBe('sk-old')
  })

  it('用户亲手打开的 true 必须留住', () => {
    expect(migrateConfig({ version: 20, ai: { dynamicEnabled: true } }).ai.dynamicEnabled).toBe(true)
  })

  it('脏值只认布尔 true：字符串 "true" / 1 / {} / null 全退回 false', () => {
    for (const junk of ['true', 1, {}, null, 'false']) {
      const out = migrateConfig({ version: 20, ai: { dynamicEnabled: junk } })
      expect(out.ai.dynamicEnabled, `这个值没被挡住：${String(junk)}`).toBe(false)
    }
  })

  it('幂等：迁出来的配置再迁一遍逐字节不变', () => {
    const once = migrateConfig({ version: 19, ai: { dynamicEnabled: true } })
    expect(migrateConfig(once)).toEqual(once)
  })
})

// ---------------------------------------------------------------- layout 欠账

describe('layout：借这次迁移把历史欠账收编', () => {
  it('老配置**没有 layout 这一节**时不崩，补出一份完整的', () => {
    // 这就是布局功能上线时那个「升级后第一次启动白屏」的坑：
    // 开发机上的配置是新的，永远复现不了。
    const out = migrateConfig({ version: 1 })
    expect(out.layout).toEqual(DEFAULT_APP_CONFIG.layout)
  })

  it('用户**亲手拖出来的宽度**必须留住（迁移不等于重置）', () => {
    // 迁移最容易犯的错就是「顺手 normalize 一下」把真实数据也洗掉了。
    // 这里断言的是「搬过去之后还是他拖的那个值」。
    //
    // 【⚠️ 这里刻意只写三个字段中的两个 —— 主区宽度**不存在**】
    // 我第一版把这个 fixture 写成了 `{ sidebarSize, mainSize, rightPanelSize }`，
    // 测试当场红了，查下来是**我记错了 schema**：`LayoutConfig` 里没有 mainSize，
    // 主区宽度由 `mainSizeOf()` 现算（`100 - 左 - 右`），因为它要撑住一条
    // 「三栏加起来正好 100」的不变量 —— 见 layout.ts 开头那段。
    // 留着这行注释是因为「拖出来的宽度会被存下来」这个说法**听起来就该存三个数**，
    // 下一个改这里的人多半也会这么记。
    //
    // 【v18 起这条断言补一个键】migrateConfig 走 normalizeLayout 重建整棵树，
    // v18 新加的 sidebarRail（三态标志）会被补成 false —— 这是**增量**，
    // 不是把老值洗掉：四个老键仍然逐一等于他拖出来的值。
    const dragged = { sidebarSize: 21, sidebarOpen: true, rightPanelSize: 24, rightPanelOpen: false }
    expect(migrateConfig({ version: 1, layout: dragged }).layout).toEqual({
      ...dragged,
      sidebarRail: false
    })
  })

  it('layout 里混着 NaN 时被 normalizeLayout 挡掉，不会落成一个塌掉的栏', () => {
    // NaN 能穿过 `Math.min(Math.max(...))`（和谁比都是 false），
    // 写进文件之后那一栏直接塌成 0，而配置已经改不回来了。
    const out = migrateConfig({ layout: { sidebarSize: NaN, rightPanelSize: '22' } })
    expect(Number.isFinite(out.layout.sidebarSize)).toBe(true)
    expect(Number.isFinite(out.layout.rightPanelSize)).toBe(true)
    expect(out.layout.sidebarSize).toBe(DEFAULT_APP_CONFIG.layout.sidebarSize)
    expect(out.layout.rightPanelSize).toBe(DEFAULT_APP_CONFIG.layout.rightPanelSize)
  })
})

// ---------------------------------------------------------------- 其余字段

describe('其余字段的兜底', () => {
  it('runTimeoutSec 被钳进 [MIN, MAX]，超范围的也不放行', () => {
    // 边界值和 MIN/MAX 常量绑在一起断言：哪天区间改了，这里会跟着变，
    // 不会变成一组「写着 1 和 60、实际早就不对了」的假绿。
    expect(migrateConfig({ runTimeoutSec: 999 }).runTimeoutSec).toBe(MAX_TIMEOUT_SEC)
    expect(migrateConfig({ runTimeoutSec: 0 }).runTimeoutSec).toBe(MIN_TIMEOUT_SEC)
    expect(migrateConfig({ runTimeoutSec: -5 }).runTimeoutSec).toBe(MIN_TIMEOUT_SEC)
    expect(migrateConfig({ runTimeoutSec: 10 }).runTimeoutSec).toBe(10)
  })

  it('runTimeoutSec 是 NaN / 字符串时退回默认值（**不是**被钳成 MIN）', () => {
    // 这两条路的区别很重要：NaN 是「这个值没意义」，不是「用户想要最小超时」。
    // 钳成 1 秒的话，学员每一段死循环代码都会在 1 秒后被掐断，
    // 而他以为是自己的程序跑不动。
    expect(migrateConfig({ runTimeoutSec: NaN }).runTimeoutSec).toBe(
      DEFAULT_APP_CONFIG.runTimeoutSec
    )
    expect(migrateConfig({ runTimeoutSec: '30' }).runTimeoutSec).toBe(
      DEFAULT_APP_CONFIG.runTimeoutSec
    )
  })

  it('baseUrl / model 是空白串时退回默认值（空串不能让 AI 请求发出去）', () => {
    const out = migrateConfig({ ai: { baseUrl: '   ', model: '' } })
    expect(out.ai.baseUrl).toBe(DEFAULT_APP_CONFIG.ai.baseUrl)
    expect(out.ai.model).toBe(DEFAULT_APP_CONFIG.ai.model)
  })

  it('envCache 不是对象时当空的重算一遍（代价只是多跑一次检测）', () => {
    for (const raw of [{ envCache: 'x' }, { envCache: [] }, { envCache: null }]) {
      expect(migrateConfig(raw).envCache).toEqual({})
    }
  })

  it('envCache 是对象时原样带过去（它是主进程写穿的缓存，值由 env:detect 保证）', () => {
    // 迁移**不检查**这个字段里面的形状。理由：它只可能是我们自己写的，
    // 而且检查的成本（要完整复刻 EnvCache 的校验）远大于收益（重算一次而已）。
    const cache = { at: 123, report: {} }
    expect(migrateConfig({ envCache: cache }).envCache).toEqual(cache)
  })
})

// ---------------------------------------------------------------- 坏输入

describe('输入整份坏掉时：给默认值，但**必须出声**', () => {
  it('不是对象（数组 / 字符串 / null）→ 默认配置 + console.warn', () => {
    // 铁律里明令禁止的是「静默重建」。重建可以，不许不留痕 ——
    // 不然用户报「我的设置全没了」时，日志里一个字都没有。
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      for (const raw of [null, undefined, 42, 'nope', []]) {
        expect(migrateConfig(raw)).toEqual(DEFAULT_APP_CONFIG)
      }
      expect(warn).toHaveBeenCalledTimes(5)
    } finally {
      warn.mockRestore()
    }
  })

  it('返回的是**深拷贝**：改产物不会污染 DEFAULT_APP_CONFIG', () => {
    // `DEFAULT_APP_CONFIG` 是模块级单例，全进程共用一份。
    // 不克隆的话，任何一次「拿到默认配置之后顺手改一改」都会**永久改掉默认值**，
    // 而且影响的是之后所有人的所有读取 —— 一个改坏、全局中毒。
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const out = migrateConfig(null)
      out.ai.apiKey = 'MUTATED'
      out.layout.sidebarSize = 999
      expect(DEFAULT_APP_CONFIG.ai.apiKey).toBe('')
      expect(DEFAULT_APP_CONFIG.layout).not.toEqual({ ...out.layout })
    } finally {
      warn.mockRestore()
    }
  })

  it('成功路径**不出声**（别把正常情况也喊成异常）', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      migrateConfig(current())
      migrateConfig({ version: 1 })
      expect(warn).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })
})

// ---------------------------------------------------------------- 幂等

describe('幂等：迁过的配置再迁一次**什么都不变**', () => {
  it('migrate(migrate(x)) === migrate(x)', () => {
    // 这条守的是「主进程每次读配置都会跑一遍迁移」这个事实。
    // 不幂等的话，用户每重启一次应用，某些值就漂移一点 ——
    // 而漂移是单向累积的，几天后配置就面目全非了。
    const once = migrateConfig({
      version: 1,
      reviewEnabled: false,
      layout: { sidebarSize: 20 },
      nativeIdePath: 'C:/tools/devcpp.exe',
      nativeRunQuiet: true
    })
    // 顺手钉住第一遍真的做了 v8 → v9 分发（不然后面那条相等断言
    // 对「压根没迁这个字段」的实现也会绿）
    expect(once.nativeIdePaths.c).toBe('C:/tools/devcpp.exe')
    expect(migrateConfig(once)).toEqual(once)
  })

  it('已经是对的了的一份配置，迁完还是它自己', () => {
    const cfg = current()
    expect(migrateConfig(cfg)).toEqual(cfg)
  })
})

// ---------------------------------------------------------------- v20 → v21 + 步骤表

/** 一份带着已移除三块（pet / wallpaper / splash）的 v20 文件，其余字段取非默认值 */
function v20File(): Record<string, unknown> {
  return {
    version: 20,
    reviewEnabled: false,
    runTimeoutSec: 33,
    soundEnabled: false,
    sfxVolume: 42,
    theme: 'dark',
    nativeRunEnabled: true,
    nativeRunQuiet: true,
    favWrongToBook: false,
    nativeIdePaths: { c: 'C:\ide\c.exe', cpp: '', java: 'C:\ide\j.exe', python: '' },
    layout: { ...DEFAULT_APP_CONFIG.layout, sidebarSize: 23 },
    ai: {
      apiKey: 'sk-0123456789abcdef0123456789abcdef',
      baseUrl: 'https://example.invalid/v1',
      model: 'm-1',
      protocol: 'anthropic',
      provider: 'custom',
      dynamicEnabled: true
    },
    envCache: { at: 123 },
    pet: { enabled: false, size: 500, corner: 'top-left', followMouse: false, hungryRoam: false },
    wallpaper: { enabled: true, dim: 60, selectedId: '3284636810' },
    splash: { enabled: true, pick: 'fixed', fixedFile: 'x.mp4' }
  }
}

describe('v20 → v21：pet / wallpaper / splash 三块被丢弃，其余原样', () => {
  it('一路升到当前版本、三个键消失，其余字段（含 ai.apiKey）逐项不变（v22 只多一个默认关的 remote，v23 丢掉 theme）', () => {
    const raw = v20File()
    const out = migrateConfig(raw) as unknown as Record<string, unknown>
    expect(out.version).toBe(23)
    expect(CURRENT_CONFIG_VERSION).toBe(23)
    for (const k of ['pet', 'wallpaper', 'splash']) expect(k in out, k).toBe(false)

    const { pet: _p, wallpaper: _w, splash: _s, theme: _t, version: _v, ...kept } = raw
    expect(out).toEqual({ ...kept, version: 23, remote: { enabled: false, port: 17600 } })
    expect((out.ai as { apiKey: string }).apiKey).toBe('sk-0123456789abcdef0123456789abcdef')
  })

  it('入参对象不被改动（步骤表只动浅拷贝）', () => {
    const raw = v20File()
    const snapshot = structuredClone(raw)
    migrateConfig(raw)
    expect(raw).toEqual(snapshot)
  })

  it('幂等：迁出来的结果再迁一次什么都不变', () => {
    const once = migrateConfig(v20File())
    expect(migrateConfig(structuredClone(once))).toEqual(once)
  })

  it('版本缺失 / 非数字 → 当 v1 跑全部步骤；比当前新 → 不跑任何步骤', () => {
    for (const version of [undefined, 'x', NaN, 0, 1.5, null]) {
      const out = migrateConfig({ version, pet: {}, wallpaper: {}, splash: {} }) as unknown as Record<string, unknown>
      expect(out.version, String(version)).toBe(CURRENT_CONFIG_VERSION)
      expect('pet' in out).toBe(false)
    }
    const spy = vi.spyOn(CONFIG_MIGRATIONS, 20)
    migrateConfig({ version: CURRENT_CONFIG_VERSION + 5 })
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('注册表与 AppConfig 的键集合一致', () => {
  it('CONFIG_FIELDS 的键 + version + envCache = DEFAULT_APP_CONFIG 的键', () => {
    const registry = [...Object.keys(CONFIG_FIELDS), 'version', 'envCache'].sort()
    expect(registry).toEqual(Object.keys(DEFAULT_APP_CONFIG).sort())
  })
})

// ---------------------------------------------------------------- v21 → v22：手机连接 remote

describe('v21 → v22：remote（手机连接）缺字段读成「关 + 默认端口」', () => {
  it('老文件没有 remote：读出来是关着的，ai.apiKey 与其它字段原样保留', () => {
    const raw: Record<string, unknown> = { ...v20File(), version: 21 }
    delete raw.pet
    delete raw.wallpaper
    delete raw.splash
    const out = migrateConfig(raw)
    expect(out.version).toBe(CURRENT_CONFIG_VERSION)
    expect(out.remote).toEqual({ enabled: false, port: 17600 })
    expect(out.ai.apiKey).toBe('sk-0123456789abcdef0123456789abcdef')
    expect(out.runTimeoutSec).toBe(33)
  })

  it('已有 remote 原样保留；脏值回默认；端口钳在 1024–65535', () => {
    const read = (remote: unknown): AppConfig['remote'] => migrateConfig({ version: 22, remote }).remote
    expect(read({ enabled: true, port: 20000 })).toEqual({ enabled: true, port: 20000 })
    expect(read({ enabled: 'yes', port: 'x' })).toEqual({ enabled: false, port: 17600 })
    expect(read({ enabled: true, port: 80 })).toEqual({ enabled: true, port: 1024 })
    expect(read({ enabled: true, port: 99999 })).toEqual({ enabled: true, port: 65535 })
    expect(read({ port: 1.5 }).port).toBe(17600)
    expect(read(null)).toEqual({ enabled: false, port: 17600 })
    expect(read(5)).toEqual({ enabled: false, port: 17600 })
  })

  it('注册表 expose / merge：缺省听现有的，类型错抛', () => {
    const f = CONFIG_FIELDS.remote
    const cur = { enabled: true, port: 18000 }
    expect(f.merge(undefined, cur)).toEqual(cur)
    expect(f.merge({ port: 18001 }, cur)).toEqual({ enabled: true, port: 18001 })
    expect(f.merge({ enabled: false }, cur)).toEqual({ enabled: false, port: 18000 })
    expect(f.merge({ port: 10 }, cur).port).toBe(1024)
    expect(() => f.merge('x', cur)).toThrow()
    expect(f.expose({ enabled: true, port: 5 })).toEqual({ enabled: true, port: 1024 })
  })
})

// ---------------------------------------------------------------- v22 → v23：暗色主题移除（丢弃 theme）

describe('v22 → v23：theme 被丢弃，其余字段（含 ai.apiKey）原样', () => {
  function v22File(): Record<string, unknown> {
    const { pet: _p, wallpaper: _w, splash: _s, ...rest } = v20File()
    return { ...rest, version: 22, theme: 'dark', remote: { enabled: true, port: 20000 } }
  }

  it('theme 键消失、版本 23，其余字段逐项不变', () => {
    const raw = v22File()
    const out = migrateConfig(raw) as unknown as Record<string, unknown>
    expect(out.version).toBe(23)
    expect('theme' in out).toBe(false)
    const { theme: _t, version: _v, ...kept } = raw
    expect(out).toEqual({ ...kept, version: 23 })
    expect((out.ai as { apiKey: string }).apiKey).toBe('sk-0123456789abcdef0123456789abcdef')
    expect(out.runTimeoutSec).toBe(33)
  })

  it('入参对象不被改动', () => {
    const raw = v22File()
    const snapshot = structuredClone(raw)
    migrateConfig(raw)
    expect(raw).toEqual(snapshot)
  })

  it('幂等：迁出来的结果再迁一次什么都不变', () => {
    const once = migrateConfig(v22File())
    expect(migrateConfig(structuredClone(once))).toEqual(once)
  })

  it('已经是 v23 的文件里残留 theme：不跑步骤，注册表也不认它（照样不出现）', () => {
    const out = migrateConfig({ ...v22File(), version: 23 }) as unknown as Record<string, unknown>
    expect('theme' in out).toBe(false)
  })
})
