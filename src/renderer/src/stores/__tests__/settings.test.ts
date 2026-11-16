/**
 * 设置 store 的存取（stores/settings.ts）
 *
 * 【这个文件在守什么】
 * 守的是**「保存设置」这个动作不会顺手伤到别的东西**。它有三个静默失效的方式：
 *
 *   1. **把用户的 Key 抹了**。渲染进程拿不到真 Key（只有 hasKey 布尔），
 *      所以它保存时必然带着「空」回来。这个「空」被当成「不改」还是「清空」，
 *      决定了用户会不会每改一次别的设置就丢一次 Key。
 *   2. **把 Key 又传回来了**。三态里最危险的是「某天有人为了类型对齐，
 *      把真 Key 从界面回传一遍」—— 那等于把 Key 重新暴露进渲染进程。
 *   3. **把别的字段清空了**。保存超时时间时如果把 baseUrl 带成空串，
 *      下一个请求就发到一个不存在的地址。
 *
 * 三条都不报错、不崩溃，全靠这里钉住。
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { isReactive, reactive } from 'vue'
import { useSettingsStore } from '../settings'
import { CURRENT_CONFIG_VERSION, emptyIdePaths, type ConfigSavePayload, type PublicAppConfig } from '../../../../shared/types'
import { DEFAULT_LAYOUT, SIDEBAR_MAX_SIZE } from '../../../../shared/layout'

/**
 * 主进程会发回来的那份（**注意：没有 apiKey**）。
 *
 * `version` 走 `CURRENT_CONFIG_VERSION` 而不是写死 1：这里模拟的是
 * 「`toPublicConfig()` 的产出」，而它产出的**永远是当前版本**（readConfig 先迁移）。
 * 写死一个数字，等下次 bump 时会变成一个和现实不符、却又没人会注意的假货。
 */
function publicConfig(over: Partial<PublicAppConfig> = {}): PublicAppConfig {
  return {
    version: CURRENT_CONFIG_VERSION,
    reviewEnabled: true,
    runTimeoutSec: 10,
    soundEnabled: true,
    // 新增字段要跟着补上：`PublicAppConfig` 是必填形状，漏了它 typecheck 会红。
    // 取值写 false（= 生产默认值）—— 写 true 会让这份夹具看起来像
    // 「主进程发回来的原生模式是开着的」，而默认是关，夹具得照默认写。
    nativeRunEnabled: false,
    // 同一条规矩（见上一行）：`nativeRunQuiet` 也是必填，取值照生产默认值
    // 写 false（继续每次询问）——写 true 会让这份夹具看起来像
    // 「主进程发回来的配置里已经勾过不再提醒」，而默认是没勾。
    nativeRunQuiet: false,
    // 同一条规矩（见上一行）：`favWrongToBook` 也是必填，取值照生产默认值写 true
    // ——「收藏练习答错照样进错题本」是全应用的既有性子，夹具写成别的就测不出
    // 「保存一次别的设置，这个开关被静默关掉」那类问题
    favWrongToBook: true,
    // 同类：`nativeIdePaths` 也是必填（v9 起是四键表），取值照生产默认值写
    // 四键全空（未配置）。写个假路径会让这份夹具看起来像「主进程发回来的
    // 配置里配好了本地 IDE」，而默认就是没配 —— 夹具得照默认写。
    nativeIdePaths: emptyIdePaths(),
    // 取值写 100（= 生产默认值，满音量）。夹具的作用是"照主进程会发回来的样子写"，
    // 所以这一项也得照默认值写，不能随手填个 50 图方便 —— 那样一来，
    // 「没拨过音量的用户保存一次别的设置，音量被改成 50」这类问题就永远测不出来。
    // 手机连接：必填，照生产默认值（关 + 默认端口）
    remote: { enabled: false, port: 17600 },
    sfxVolume: 100,
    layout: { ...DEFAULT_LAYOUT },
    envCache: {},
    learning: { explainMode: 'text', reviewStrategy: 'standard' },
    update: { auto: true },
    ai: { hasKey: false, baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat', dynamicEnabled: false },
    ...over
  }
}

/**
 * 装上假的 window.miai，记下每次 saveConfig 收到的入参。
 *
 * ⚠️ 这里**故意用 `structuredClone`**，不是随手写的。真实的
 * `ipcRenderer.invoke` 用的就是这个算法，而它**克隆不了 Vue 的响应式代理** ——
 * 会抛 `An object could not be cloned`。用同一个算法做假货，
 * 才能让「入参里混进了代理」这类问题在测试里就现形，而不是等用户点保存时才发现。
 * （这个 bug 真的存在过，就是这条抓出来的，详见 settings.ts 的 save()。）
 */
function stubMiai(cfg: PublicAppConfig = publicConfig()): ConfigSavePayload[] {
  const sent: ConfigSavePayload[] = []
  ;(globalThis as unknown as { window: unknown }).window = {
    miai: {
      getConfig: () => Promise.resolve(structuredClone(cfg)),
      saveConfig: (p: ConfigSavePayload) => {
        sent.push(structuredClone(p))
        return Promise.resolve()
      },
      detectEnv: () => Promise.resolve({})
    }
  }
  return sent
}

beforeEach(() => {
  setActivePinia(createPinia())
})

// ---------------------------------------------------------------- Key 不会被误伤

describe('改别的设置，绝不会碰到 Key', () => {
  it('**入参里根本没有 apiKey 这个字段**（不是空串 —— 是压根没有）', async () => {
    // 这是整件事的关键。空串和「没有」在 main 那边**语义相同**（都是不改），
    // 但带上空串留了一个后患：哪天 main 把空串改判成「清空」，
    // 每一次保存别的设置都会静默抹掉用户的 Key。少带一个字段，这条路就不存在。
    const sent = stubMiai()
    const s = useSettingsStore()
    await s.load()
    await s.update({ reviewEnabled: false })

    expect(sent).toHaveLength(1)
    expect('apiKey' in sent[0].ai).toBe(false)
  })

  it('保存超时时间也不会顺手清掉服务地址和模型', async () => {
    const sent = stubMiai()
    const s = useSettingsStore()
    await s.load()
    await s.update({ runTimeoutSec: 30 })

    expect(sent[0].ai).toEqual({
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat',
      dynamicEnabled: false
    })
    expect(sent[0].runTimeoutSec).toBe(30)
  })

  it('保存时**不会把 hasKey 带进入参** —— 它是返回体的字段，不该出现在入参里', async () => {
    const sent = stubMiai(publicConfig({ ai: { hasKey: true, baseUrl: 'x', model: 'y', dynamicEnabled: false } }))
    const s = useSettingsStore()
    await s.load()
    await s.update({ reviewEnabled: true })

    expect('hasKey' in sent[0].ai).toBe(false)
  })
})

// ---------------------------------------------------------------- 夜间模式

// ---------------------------------------------------------------- 音效音量
//
// 【这一节守什么】理由：`save()` 是**逐字段拼**出来的，
// 每加一个配置字段，最容易漏的就是它。漏了的话主进程会退回「保持现有」，
// 本次不坏事 —— 但文件里那个字段永远是缺的，而且"拨了音量重启又变回去"
// 这种问题要重启整个应用才看得见。
//
// ⚠️ 音量还多一种坏法，**布尔开关没有**：0 是合法值。用
// `cur.sfxVolume || 100` 之类的写法拼 payload，0 会被顶成 100 ——
// 用户拨到静音、重启，声音全回来了。

describe('音效音量：sfxVolume 必须真的被送出去', () => {
  it('拨到 40 → 入参里就是 40', async () => {
    const sent = stubMiai()
    const s = useSettingsStore()
    await s.load()
    await s.update({ sfxVolume: 40 })

    expect(sent).toHaveLength(1)
    expect(sent[0].sfxVolume).toBe(40)
  })

  it('★ 拨到 **0** → 入参里是 **0**，不是被当成「没带」而丢掉', async () => {
    // `||` / 真值性判断会把 0 变成"缺省"，于是一次静音存不下去。
    // `0` 和 `'0'` 都要区分：后者是字符串，主进程那边会被当脏值退回现有音量。
    const sent = stubMiai()
    const s = useSettingsStore()
    await s.load()
    await s.update({ sfxVolume: 0 })

    expect(sent[0].sfxVolume).toBe(0)
    expect(typeof sent[0].sfxVolume, '必须是数字 0，不能是字符串').toBe('number')
  })

  it('改**别的**设置时，当前音量也会一起带上（不是 undefined）', async () => {
    const sent = stubMiai(publicConfig({ sfxVolume: 35 }))
    const s = useSettingsStore()
    await s.load()
    await s.update({ reviewEnabled: false })

    expect(sent[0].sfxVolume).toBe(35)
  })

  it('改音量不会顺手把 Key 抹掉 / 把别的设置顶回默认（每加一条写入口都要再验一次）', async () => {
    const sent = stubMiai(publicConfig({ reviewEnabled: false }))
    const s = useSettingsStore()
    await s.load()
    await s.update({ sfxVolume: 20 })

    expect('apiKey' in sent[0].ai).toBe(false)
    expect(sent[0].reviewEnabled).toBe(false)
  })
})

// ---------------------------------------------------------------- 清除 Key

describe('清除 Key 是唯一能真的删掉它的路', () => {
  it('**发出去的是 null，不是空串**', async () => {
    // 空串的语义是「这次不改」（界面本来就不知道真 Key）。
    // 只有 null 能表达「我要删掉它」—— 少了这条路，用户填错一次就再也删不掉了。
    const sent = stubMiai()
    const s = useSettingsStore()
    await s.load()
    await s.clearAiKey()

    expect(sent[0].ai.apiKey).toBeNull()
  })

  it('清完之后界面立刻显示「未配置」（不用等重新读配置）', async () => {
    const sent = stubMiai(publicConfig({ ai: { hasKey: true, baseUrl: 'x', model: 'y', dynamicEnabled: false } }))
    const s = useSettingsStore()
    await s.load()
    expect(s.config.ai.hasKey).toBe(true)

    await s.clearAiKey()
    expect(s.config.ai.hasKey).toBe(false)
  })

  it('清 Key 不会连带清掉服务地址和模型', async () => {
    const sent = stubMiai(publicConfig({ ai: { hasKey: true, baseUrl: 'x', model: 'y', dynamicEnabled: false } }))
    const s = useSettingsStore()
    await s.load()
    await s.clearAiKey()

    expect(sent[0].ai.baseUrl).toBe('x')
    expect(sent[0].ai.model).toBe('y')
  })
})

// ---------------------------------------------------------------- 保存新 Key

describe('保存新 Key', () => {
  it('传什么发什么', async () => {
    const sent = stubMiai()
    const s = useSettingsStore()
    await s.load()
    await s.updateAi({ apiKey: 'sk-new-key' })

    expect(sent[0].ai.apiKey).toBe('sk-new-key')
  })

  it('改模型时**不会**把 Key 一起带上（那条路走不通，也不该走）', async () => {
    const sent = stubMiai(publicConfig({ ai: { hasKey: true, baseUrl: 'x', model: 'old', dynamicEnabled: false } }))
    const s = useSettingsStore()
    await s.load()
    await s.updateAi({ model: 'deepseek-reasoner' })

    expect(sent[0].ai.model).toBe('deepseek-reasoner')
    expect('apiKey' in sent[0].ai).toBe(false)
  })

  it('AI 动态出题开关能存下来，且**不会顺手带上 Key**', async () => {
    const sent = stubMiai(
      publicConfig({ ai: { hasKey: true, baseUrl: 'x', model: 'y', dynamicEnabled: false } })
    )
    const s = useSettingsStore()
    await s.load()
    await s.updateAi({ dynamicEnabled: true })

    expect(sent[0].ai.dynamicEnabled).toBe(true)
    expect('apiKey' in sent[0].ai).toBe(false)
  })

  it('`markKeySaved()` 让界面从「未配置」翻成「已配置」', async () => {
    // 不翻的话，用户填完 Key 点保存，界面上还写着「未配置」——
    // 他会以为没存进去，反复重填。
    stubMiai()
    const s = useSettingsStore()
    await s.load()
    expect(s.config.ai.hasKey).toBe(false)

    s.markKeySaved()
    expect(s.config.ai.hasKey).toBe(true)
  })
})

// ---------------------------------------------------------------- 能被 IPC 送出去

describe('入参必须能被结构化克隆（IPC 就靠它）', () => {
  it('**响应式代理克隆不了** —— 这是那个 bug 的成因，留在这里当证据', () => {
    // 先把这个「为什么」钉住：代理不是「有点怪」的对象，是**根本送不出去**。
    // 哪天有人看到 save() 里的 toRaw 觉得多余想删掉，这条会提醒他代价是什么。
    const proxy = reactive({ a: 1 })
    expect(() => structuredClone(proxy)).toThrow()
  })

  it('store 交出来的入参**是能克隆的纯对象**（三条路都验一遍）', async () => {
    const sent = stubMiai()
    const s = useSettingsStore()
    await s.load()

    // 每条路都走一遍：普通的改、改 AI、清 Key
    await s.update({ reviewEnabled: false })
    await s.updateAi({ model: 'x' })
    await s.clearAiKey()

    expect(sent).toHaveLength(3)
    // 假 saveConfig 内部已经克隆过一次了（克隆失败会直接抛），
    // 这里再显式验一次，是为了让「这条测试在守什么」读起来一目了然
    for (const p of sent) {
      expect(() => structuredClone(p)).not.toThrow()
    }
  })

  it('嵌套的 envCache 也不能是代理（代理藏在里层，顶层是看不出来的）', async () => {
    // 最容易漏的就是它：顶层字段是数字和布尔，读出来天然是原始值，
    // 看起来一切正常；而 envCache 是个对象，读出来是代理。
    const sent = stubMiai()
    const s = useSettingsStore()
    await s.load()
    await s.update({ reviewEnabled: true })

    expect(() => structuredClone(sent[0].envCache)).not.toThrow()
    expect(isReactive(sent[0].envCache)).toBe(false)
  })
})

// ---------------------------------------------------------------- 读配置

describe('读配置', () => {
  it('主进程给什么就用什么（界面不自己猜 hasKey）', async () => {
    stubMiai(publicConfig({ ai: { hasKey: true, baseUrl: 'https://proxy.local', model: 'x', dynamicEnabled: false } }))
    const s = useSettingsStore()
    await s.load()

    expect(s.config.ai.hasKey).toBe(true)
    expect(s.config.ai.baseUrl).toBe('https://proxy.local')
    expect(s.loaded).toBe(true)
  })

  it('**没 load 之前不许 save** —— 那会用默认值把用户的真实设置顶掉', async () => {
    // 这条不是在测「它坏了」，是在把一条**前提**写下来：
    // store 初值是 DEFAULT_APP_CONFIG，没 load 就 save 等于拿默认值覆盖真配置。
    // Key 不受影响（入参里没有它），但 baseUrl / 模型会被打回默认。
    const sent = stubMiai(publicConfig({ ai: { hasKey: true, baseUrl: 'https://proxy.local', model: 'x', dynamicEnabled: false } }))
    const s = useSettingsStore()

    await s.update({ runTimeoutSec: 30 }) // ← 故意不 load
    expect(sent[0].ai.baseUrl).toBe('https://api.deepseek.com') // 已经把真实值顶掉了

    // 所以调用方（设置页）必须**先 load 再改**。这条断言是给下一个人的告示牌。
  })
})

// ---------------------------------------------------------------- 三栏布局
//
// 【这一节守什么】
// `setLayout` 是「拖完分隔条」和「收起/展开右栏」唯一的写入口，而它坏掉的方式
// 全是静默的 —— 存进去的是整份配置，所以**漏一个字段就等于把那个字段重置成默认**：
//   - 拖个宽度，右栏莫名其妙被展开了
//   - 收个右栏，拖好的宽度被打回默认（用户会以为「宽度本来就存不住」）
// 两种都不报错，重开一次才能发现。

describe('改布局：存下去的那一节必须是完整的', () => {
  it('**五个键一个不少** —— 漏一个就等于把它重置成默认', async () => {
    const sent = stubMiai()
    const s = useSettingsStore()
    await s.load()

    await s.setLayout({ sidebarSize: 25 })
    expect(sent[0].layout).toEqual({
      sidebarSize: 25,
      sidebarOpen: true,
      sidebarRail: false,
      rightPanelSize: 22,
      rightPanelOpen: true
    })
  })

  it('只改宽度**不会顺手把右栏关掉**（漏字段最典型的翻车方式）', async () => {
    const sent = stubMiai()
    const s = useSettingsStore()
    await s.load()

    await s.setLayout({ sidebarSize: 20 })
    expect(sent[0].layout.rightPanelOpen).toBe(true)
  })

  it('**收起右栏不会把拖好的宽度打回默认**', async () => {
    // 这条是给用户看的那个承诺：宽度是拖出来的，不该被一次开合抹掉。
    const sent = stubMiai(
      publicConfig({
        layout: {
          sidebarSize: 27,
          sidebarOpen: true,
          sidebarRail: false,
          rightPanelSize: 30,
          rightPanelOpen: true
        }
      })
    )
    const s = useSettingsStore()
    await s.load()

    await s.setLayout({ rightPanelOpen: false })
    expect(sent[0].layout).toEqual({
      sidebarSize: 27,
      sidebarOpen: true,
      sidebarRail: false,
      rightPanelSize: 30,
      rightPanelOpen: false
    })
  })

  it('本地状态也跟着变 —— 不然拖完手一松，界面会弹回原处', async () => {
    stubMiai()
    const s = useSettingsStore()
    await s.load()

    await s.setLayout({ sidebarSize: 25, rightPanelOpen: false })
    expect(s.config.layout).toEqual({
      sidebarSize: 25,
      sidebarOpen: true,
      sidebarRail: false,
      rightPanelSize: 22,
      rightPanelOpen: false
    })
  })

  it('rail 标志走同一个入口存取（v18 三态）—— 其余四键原样带上，宽度不动', async () => {
    // ☰ 按钮的落点：App.vue 的 toggleSidebar 就是拿 sidebarTogglePatch(layout)
    // 来调 setLayout 的。这条钉住「补丁式入参 + 整份重建」这条链路对 rail 也成立 ——
    // 三个键里漏带一个（比如把 sidebarSize 落成默认）用户展开时就会发现宽度没了。
    const sent = stubMiai(
      publicConfig({
        layout: {
          sidebarSize: 27,
          sidebarOpen: true,
          sidebarRail: false,
          rightPanelSize: 30,
          rightPanelOpen: true
        }
      })
    )
    const s = useSettingsStore()
    await s.load()

    await s.setLayout({ sidebarRail: true })
    expect(sent[0].layout).toEqual({
      sidebarSize: 27,
      sidebarOpen: true,
      sidebarRail: true,
      rightPanelSize: 30,
      rightPanelOpen: true
    })
  })

  it('越界值在**进 IPC 之前**就被钳住（主进程那道是第二道，不该指望它兜底）', async () => {
    const sent = stubMiai()
    const s = useSettingsStore()
    await s.load()

    await s.setLayout({ sidebarSize: 999 })
    expect(sent[0].layout.sidebarSize).toBe(SIDEBAR_MAX_SIZE)
  })

  it('改布局**同样不碰 Key**（这个文件的主线，每加一条写入口都要再验一次）', async () => {
    const sent = stubMiai()
    const s = useSettingsStore()
    await s.load()

    await s.setLayout({ rightPanelOpen: false })
    expect('apiKey' in sent[0].ai).toBe(false)
  })

  it('**入参里混进了代理也能送出去** —— layout 是纯函数重建出来的新对象', async () => {
    // stubMiai 内部就是用 structuredClone 收的货，克隆不了会当场抛。
    // 这条钉住「setLayout 的入参没有把响应式对象原样带进去」。
    const sent = stubMiai()
    const s = useSettingsStore()
    await s.load()

    await expect(s.setLayout({ sidebarSize: 25 })).resolves.toBeUndefined()
    expect(() => structuredClone(sent[0].layout)).not.toThrow()
  })
})

// ---------------------------------------------------------------- 本地 IDE 路径
//
// 【这一节守什么】`save()` 是**逐字段拼**出来的（故意的，理由见它的注释），
// 每加一个配置字段，最容易漏的就是它。`nativeIdePaths`（v9：每语言四键）
// 的三种漏法都不报错：
//   · 改**别的**设置时漏带 → 主进程退回「保持现有」，本次不坏事，
//     但「每次必带全量值」这条规矩就名存实亡（和 theme / sfxVolume 同款用例）；
//   · 改**它自己**时漏带 → 用户点了「清除」也清不掉；
//   · 还有一条**和 apiKey 正好相反**的：它每次都必须带全量四键（哪怕值是空串）。
//     apiKey 带空串会留一个「哪天主进程改判就全量抹 Key」的后患；
//     nativeIdePaths 的空串是**用户的真实选择**（pickIdePaths 里 '' = 清空该键）——
//     少了它，清除按钮就是摆设。两条方向相反的规矩住在同一个 save() 里。
//
// 【setIdePath 为什么要单测】「打开时现检现荐」落盘走的就是它。它把
// `config.value.nativeIdePaths`（**嵌套响应式对象**）展开成新对象再送 ——
// 少展开一层的话，代理会一路混进 ipcRenderer.invoke 的结构化克隆，
// 表现为「检测到了程序、也"选了"，但配置一个字节没写进去」。

describe('本地 IDE 路径：和 apiKey 恰好相反 —— 每次都必须带上（v9 四键表）', () => {
  it('★ setIdePath 只改**一门**语言的格子，其余三键原值保住', async () => {
    // 覆盖写（只带改掉的那一键、或整表清空重来）会把另外三门语言
    // 配好的路径静默抹掉 —— 用户点一次「检测 C」，Java 那格就空了。
    const sent = stubMiai(
      publicConfig({
        nativeIdePaths: { c: '', cpp: 'D:\\old\\cpp.exe', java: 'D:\\old\\idea64.exe', python: '' }
      })
    )
    const s = useSettingsStore()
    await s.load()
    await s.setIdePath('c', 'C:\\Program Files (x86)\\Dev-Cpp\\devcpp.exe')

    expect(sent).toHaveLength(1)
    expect(sent[0].nativeIdePaths).toEqual({
      c: 'C:\\Program Files (x86)\\Dev-Cpp\\devcpp.exe',
      cpp: 'D:\\old\\cpp.exe',
      java: 'D:\\old\\idea64.exe',
      python: ''
    })
  })

  it('★ setIdePath 的入参能过 structuredClone（响应式代理不许混进去）', async () => {
    // stubMiai 内部就是用 structuredClone 收的货，克隆不了会当场抛 ——
    // 这条钉住「setIdePath 没有把 config.value.nativeIdePaths 直接塞进 patch」。
    // （顶层的 toRaw 剥不掉嵌套代理，这是真实踩过的坑，见 update() 的长注释。）
    const sent = stubMiai()
    const s = useSettingsStore()
    await s.load()

    await expect(s.setIdePath('java', 'D:\\tools\\idea64.exe')).resolves.toBeUndefined()
    expect(() => structuredClone(sent[0].nativeIdePaths)).not.toThrow()
    expect(sent[0].nativeIdePaths.java).toBe('D:\\tools\\idea64.exe')
  })

  it('★ 清空某键 → 送出的是**空串**，不是省略键（主进程靠空串执行「清空」）', async () => {
    // 省略键在主进程那边是「没改」（pickIdePaths 的逐键 undefined 分支），
    // 空串才是「清空」。这里送错，用户点「清除」后路径会一次次自己回来，
    // 而且没有别的路能删掉它。
    const sent = stubMiai(
      publicConfig({ nativeIdePaths: { ...emptyIdePaths(), java: 'D:\\tools\\idea64.exe' } })
    )
    const s = useSettingsStore()
    await s.load()
    await s.setIdePath('java', '')

    expect('java' in sent[0].nativeIdePaths).toBe(true)
    expect(sent[0].nativeIdePaths.java).toBe('')
    expect(sent[0].nativeIdePaths.cpp, '清 java 不该动到别的键').toBe('')
  })

  it('改**别的**设置时，四键**全量**一起带上（不是 undefined、不是缺键）', async () => {
    // 缺键会被主进程的 pickIdePaths 当成「没改」保留旧值 —— 单看这一次
    // 没坏事，但界面删掉的那一格会"复活"，且和渲染层"恒带全量"的规矩对不上。
    const given = {
      c: 'D:\\tools\\devcpp.exe',
      cpp: '',
      java: 'D:\\tools\\idea64.exe',
      python: ''
    }
    const sent = stubMiai(publicConfig({ nativeIdePaths: given }))
    const s = useSettingsStore()
    await s.load()
    await s.update({ reviewEnabled: false })

    expect(sent[0].nativeIdePaths).toEqual(given)
  })

  it('★ 与 apiKey 的对照：同一份入参里，一个**必须没有**、一个**必须带着**', async () => {
    // 这两条方向相反的规矩住在同一个 save() 里，最容易被人「统一」成一种：
    // 统一成 apiKey 那样（不带）→ 清除按钮失灵；
    // 统一成本字段这样（带上）→ 每次保存都回传一个空 Key（哪天主进程
    // 把空串改判成「清空」，用户的 Key 就每次保存被抹一遍）。
    const sent = stubMiai()
    const s = useSettingsStore()
    await s.load()
    await s.update({ reviewEnabled: true })

    expect('apiKey' in sent[0].ai, 'apiKey 绝不能出现在入参里').toBe(false)
    expect('nativeIdePaths' in sent[0], 'nativeIdePaths 每次都必须带上').toBe(true)
  })
})

// ---------------------------------------------------------------- 不再提醒
//
// 【这一节守什么】同 sfxVolume / nativeIdePaths 两节：`save()` 是
// 逐字段拼出来的，每加一个配置字段最容易漏的就是它。`nativeRunQuiet` 漏带的
// 后果尤其隐蔽：勾了「不再提醒」这一次会话内看着生效（弹窗里的 update 改了
// 内存态），**重启之后弹窗又回来了** —— 用户会以为这个勾选框是个摆设。

describe('不再提醒：nativeRunQuiet 必须真的被送出去', () => {
  it('勾上 → 入参里就是 true', async () => {
    const sent = stubMiai()
    const s = useSettingsStore()
    await s.load()
    await s.update({ nativeRunQuiet: true })

    expect(sent).toHaveLength(1)
    expect(sent[0].nativeRunQuiet).toBe(true)
  })

  it('设置页拨回「每次运行前询问」→ 送出**明确的 false**，不是省字段', async () => {
    // 「省略字段」的语义是「这次不改」。真省了的话，用户拨回来之后一重启
    // 又变回「不再提醒」——和「切回默认值被省字段」是同一个坑。
    const sent = stubMiai(publicConfig({ nativeRunQuiet: true }))
    const s = useSettingsStore()
    await s.load()
    await s.update({ nativeRunQuiet: false })

    expect(sent[0].nativeRunQuiet).toBe(false)
  })

  it('改**别的**设置时，当前值也一起带上（不是 undefined）', async () => {
    const sent = stubMiai(publicConfig({ nativeRunQuiet: true }))
    const s = useSettingsStore()
    await s.load()
    await s.update({ reviewEnabled: false })

    expect(sent[0].nativeRunQuiet).toBe(true)
  })
})

// ---------------------------------------------------------------- 外部配置推送（config:external）
//
// 【这一节守什么】主进程自己改了配置 → 广播 config:external → `applyExternalConfig`。
// 它坏掉的方式都不报错：
//   · 不整份换（比如只当 patch 合并、或者干脆忘了改）→ 设置页开关还是旧值，
//     和主进程刚落盘的事实自相矛盾，用户要重启才被拉取纠正；
//   · 顺手回写（收到推送后又 save 一遍）→ 把主进程刚落的盘当渲染层编辑
//     写回去，两个写方拉锯，甚至把推送内容重放成一次"用户保存"。

describe('外部配置推送：整份换上、绝不回写', () => {
  it('整份换上：字段跟着变，其余字段照单全收', async () => {
    stubMiai()
    const s = useSettingsStore()
    await s.load()
    expect(s.config.reviewEnabled).toBe(true)

    const next = publicConfig({ reviewEnabled: false, runTimeoutSec: 25 })
    s.applyExternalConfig(next)

    expect(s.config.runTimeoutSec).toBe(25)
    expect(s.config.reviewEnabled).toBe(false)
  })

  it('★ 绝不回写：推送到达后一条 saveConfig 都不发（两个写方不许拉锯）', async () => {
    const sent = stubMiai()
    const s = useSettingsStore()
    await s.load()

    s.applyExternalConfig(publicConfig())
    expect(sent).toHaveLength(0)
  })

  it('推送落地后，后续写入口拼的仍是新事实（镜像没有被写坏）', async () => {
    // 这条防的是"换上的对象形状不对"：镜像坏了的话，下一次任何保存
    //（这里是 update）拼出来的载荷会把 reviewEnabled 恢复成 true ——
    // 主进程刚改掉的设置被下一次无关保存悄悄改回去。
    const sent = stubMiai()
    const s = useSettingsStore()
    await s.load()

    s.applyExternalConfig(publicConfig({ reviewEnabled: false }))

    await s.update({ runTimeoutSec: 20 })
    expect(sent[0].reviewEnabled).toBe(false)
    expect(sent[0].runTimeoutSec).toBe(20)
  })
})
