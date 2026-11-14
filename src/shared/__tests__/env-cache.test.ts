import { describe, expect, it, vi } from 'vitest'
import { blankReport, checkCachedEnv, envMissingResult, langsToRecheck, shouldCommitEnvReport } from '../env-cache'
import { RUNNER } from '../copy'
import { LANG_OF_CODE, type EnvReport, type LangEnv, type LangOfCode } from '../types'

/**
 * 环境报告「缓存保鲜」的闸门。
 *
 * 【这个文件守的是什么】
 * 2026-09-13 主人验收时踩到一个真 bug：13:05 第一次开应用（那会儿确实没装 gcc/Java），
 * 缓存把 c/cpp/java 记成「没找到」；13:45 工具链装好了，**重启应用也不重检**，
 * 于是点 C/C++/Java 永远回「还没找到翻译官喵～」。装好了却一口咬定没装。
 *
 * 所以这里守的不是「函数返回了个数组」，而是两件相反方向的事：
 *   ① **报「没找到」的必须重查** —— 漏了就是主人那个 bug，装完也永远用不了；
 *   ② **报「找到了」的绝不重查** —— 多查了就是每次跑代码都白起几个进程，
 *      而且这条更隐蔽：功能照样对，只是白白慢，测试不盯就没人发现。
 */

const OK: LangEnv = { found: true, path: 'C:\\fake\\fake.exe', version: '1.0' }

/** 按「哪几门语言已装好」拼一份检测报告 */
function report(found: Partial<Record<LangOfCode, boolean>>): EnvReport {
  const base = blankReport()
  for (const lang of LANG_OF_CODE) {
    if (found[lang]) base[lang] = { ...OK }
  }
  return base
}

describe('blankReport：空报告', () => {
  it('四门语言都记「没找到」', () => {
    const b = blankReport()
    for (const lang of LANG_OF_CODE) {
      expect(b[lang].found, `${lang} 应该是没找到`).toBe(false)
    }
  })

  it('四门各是独立对象 —— 改一门不能顺带把另一门也改了', () => {
    const b = blankReport()
    b.c.found = true
    expect(b.cpp.found).toBe(false)
    expect(b.java.found).toBe(false)
    expect(b.python.found).toBe(false)
  })
})

describe('langsToRecheck：哪些结论必须当场复核', () => {
  it('没有缓存时，四门全部要查', () => {
    expect(langsToRecheck(undefined)).toEqual([...LANG_OF_CODE])
  })

  it('没有缓存 + 只关心一门时，只查那一门', () => {
    expect(langsToRecheck(undefined, 'python')).toEqual(['python'])
  })

  it('缓存里报「没找到」的语言必须重查（主人那次就是这样：只有 python 装好了）', () => {
    expect(langsToRecheck(report({ python: true }))).toEqual(['c', 'cpp', 'java'])
  })

  it('四门全都报「找到了」时，一个都不查 —— 跑代码不该白起进程', () => {
    expect(langsToRecheck(report({ c: true, cpp: true, java: true, python: true }))).toEqual([])
  })

  it('报「找到了」的语言永远不重查（防止有人把规则改成「每次都全量重检」）', () => {
    const mixed = langsToRecheck(report({ c: true, python: true }))
    expect(mixed).not.toContain('c')
    expect(mixed).not.toContain('python')
    expect(mixed).toEqual(['cpp', 'java'])
  })

  it('只关心一门时，另外几门缺不缺都不去查（跑 python 不该被缺 C 拖慢）', () => {
    expect(langsToRecheck(report({ python: true }), 'python')).toEqual([])
    expect(langsToRecheck(report({ c: true }), 'python')).toEqual(['python'])
  })

  it('只关心一门、而那门恰好已找到时，什么都不查', () => {
    expect(langsToRecheck(report({ c: true }), 'c')).toEqual([])
  })
})

describe('checkCachedEnv 运行前预检判据', () => {
  it('没有缓存或该语言从未检测过时返回 unknown（放行首次检测）', () => {
    expect(checkCachedEnv(undefined, 'python')).toBe('unknown')
    const partialReport = { python: { found: true } } as any
    expect(checkCachedEnv(partialReport, 'java')).toBe('unknown')
  })

  it('缓存明确记录已找到时返回 ready', () => {
    expect(checkCachedEnv(report({ java: true }), 'java')).toBe('ready')
  })

  it('缓存明确记录未找到时返回 missing（由主进程进行带上限的复核）', () => {
    expect(checkCachedEnv(report({ python: true }), 'java')).toBe('missing')
    expect(checkCachedEnv(blankReport(), 'c')).toBe('missing')
  })
})

describe('envMissingResult 缺少环境即时结果构造', () => {
  it('生成合法 RunResult：ok: false, phase: compile, envIssue: true 并附带猫咪引导文案', () => {
    const res = envMissingResult('java')
    expect(res.ok).toBe(false)
    expect(res.phase).toBe('compile')
    expect(res.envIssue).toBe(true)
    expect(res.timedOut).toBe(false)
    expect(res.message).toBe(RUNNER.ENV_MISSING('java'))
  })
})

describe('shouldCommitEnvReport 晚到复核回写防覆盖闸门（方案 B）', () => {
  it('当前缓存无时间戳时，允许回写', () => {
    expect(shouldCommitEnvReport(undefined, 1000)).toBe(true)
  })

  it('本次复核启动时刻晚于缓存时间戳时，允许回写（晚到结果安全写盘）', () => {
    const startedAt = 2000
    const olderCachedAt = new Date(1500).toISOString()
    expect(shouldCommitEnvReport(olderCachedAt, startedAt)).toBe(true)
  })

  it('同一毫秒时拒绝回写（分不清先后，宁可留设置页那份）', () => {
    const startedAt = 2000
    const sameCachedAt = new Date(2000).toISOString()
    expect(shouldCommitEnvReport(sameCachedAt, startedAt)).toBe(false)
  })

  it('本次复核启动时刻 < 缓存时间戳时，拒绝回写（旧结果不盖新结果）', () => {
    const startedAt = 2000
    // 在本次复核执行期间，设置页「重新检测」落盘了新时间戳（3000）
    const newerCachedAt = new Date(3000).toISOString()
    expect(shouldCommitEnvReport(newerCachedAt, startedAt)).toBe(false)
  })

  it('模拟晚到探测与防覆盖逻辑：超时后晚到的结果能写盘，且不覆盖更新的配置', async () => {
    let mockDisk = {
      envCache: {
        report: blankReport(),
        at: new Date(1000).toISOString()
      }
    }
    const mockBroadcast = vi.fn()

    const commitMock = (report: EnvReport, rechecked: LangOfCode[], startedAt?: number) => {
      if (rechecked.length === 0) return false
      if (startedAt !== undefined && !shouldCommitEnvReport(mockDisk.envCache?.at, startedAt)) {
        return false
      }
      mockDisk.envCache = { report, at: new Date().toISOString() }
      mockBroadcast()
      return true
    }

    // 场景 1：超时后晚到探测（启动时刻 2000 > 缓存时间戳 1000）成功回写
    const startedAt1 = 2000
    const foundReport = report({ java: true })
    const success = commitMock(foundReport, ['java'], startedAt1)
    expect(success).toBe(true)
    expect(mockDisk.envCache.report.java.found).toBe(true)
    expect(mockBroadcast).toHaveBeenCalledTimes(1)

    // 场景 2：设置页重检在时刻 5000 写入了新配置
    mockDisk.envCache.at = new Date(5000).toISOString()

    // 场景 3：另一个在时刻 3000 发起、但晚到的旧探测结果到达，启动时刻 3000 < 5000，必须被拒绝
    const startedAtOld = 3000
    const oldReport = report({ java: false })
    const rejected = commitMock(oldReport, ['java'], startedAtOld)
    expect(rejected).toBe(false)
    expect(mockDisk.envCache.report.java.found).toBe(true) // 保持新结果，未被旧结果覆盖
    expect(mockBroadcast).toHaveBeenCalledTimes(1) // 未发生二次无效广播
  })
})
