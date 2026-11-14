/**
 * 环境报告的**缓存保鲜规则**。
 *
 * 【这份规则是为了修一个真 bug —— 2026-09-13 主人验收时踩到的】
 * 检测结果缓存在 config.json 的 envCache 里、**没有过期时间**，
 * 而旧代码只在「连缓存都没有」时才重新检测。于是发生了这样一串事：
 *
 *     13:05  主人第一次开应用（那会儿确实没装 gcc/Java）→ 缓存把 c/cpp/java 记成「没找到」
 *     13:45  工具链装好了
 *     13:59  重启应用 —— **还是不重检**（缓存还在，`if (!report)` 不成立）
 *     →      点 C/C++/Java 三个示例，界面永远回「还没找到翻译官喵～去设置页装好环境」
 *
 * 也就是说：**明明装好了，应用却一口咬定没装，而且重启也治不好。**
 * 更糟的是报错文案让用户「去设置页装好环境」——而设置页读的是同一份缓存，说的是同一句谎话。
 *
 * 【规则】「找到了」可以信，「没找到」必须当场复核。
 *   ① 「找到了」不会自己变 —— 编译器不会长脚跑掉，重检它是白起进程；
 *   ② 「没找到」恰恰是**唯一会变的那一条** —— 用户装完东西就该立刻生效，
 *      不用等某个 TTL 到期，更不用重启应用。这正是 M5-05 的完成标准：
 *      「完成后自动重检；不重启应用即可用」；
 *   ③ 代价可控：四门全找到时一个进程都不起（纯查缓存，零开销）。
 *
 * 【为什么不用「按时间过期」】
 * TTL 要么短（用户还没装完就被反复重检，每次跑代码都白等）要么长（装完了还得干等），
 * 而「哪条结论会变」这件事我们本来就知道 —— 照它来，比拍一个时间准得多。
 */
import { LANG_OF_CODE, type EnvReport, type LangOfCode, type RunResult } from './types'
import { RUNNER } from './copy'

/** 空报告：四门语言都记「没找到」。每门一个新对象，别让四门共用同一个引用。 */
export function blankReport(): EnvReport {
  return {
    c: { found: false },
    cpp: { found: false },
    java: { found: false },
    python: { found: false }
  }
}

/**
 * 这份报告里，哪些语言的结论**必须当场复核**。
 * 规则：只认「没找到」不可信；「找到了」照用（理由见文件头）。
 *
 * @param report 缓存里的报告；没有缓存（undefined）时四门全部要查
 * @param only   只关心某一门语言时传它 —— 跑代码只用到目标语言，
 *               另外三门缺不缺跟这次运行没关系，没必要顺带查一遍
 */
export function langsToRecheck(report: EnvReport | undefined, only?: LangOfCode): LangOfCode[] {
  if (!report) return only === undefined ? [...LANG_OF_CODE] : [only]
  return LANG_OF_CODE.filter((l) => (only === undefined || l === only) && !report[l]?.found)
}

/**
 * 预检某门语言在缓存中的环境状态：
 * - 'ready': 缓存记录明确已找到 (found === true)
 * - 'missing': 缓存记录明确未找到 (found === false)，需由主进程进行带上限的复核
 * - 'unknown': 从未检测过或无该语言记录 (report 或 report[lang] 为 undefined)
 */
export function checkCachedEnv(
  report: EnvReport | undefined,
  lang: LangOfCode
): 'ready' | 'missing' | 'unknown' {
  if (!report || !report[lang]) return 'unknown'
  return report[lang].found ? 'ready' : 'missing'
}

/**
 * 构造缺少工具链时的即时结果（供前端拦截或主进程复核使用，不进排队）。
 */
export function envMissingResult(lang: LangOfCode, customMessage?: string): RunResult {
  return {
    ok: false,
    phase: 'compile',
    stdout: '',
    stderr: '',
    exitCode: null,
    timedOut: false,
    truncated: false,
    message: customMessage ?? RUNNER.ENV_MISSING(lang),
    envIssue: true,
    durationMs: 0
  }
}

/**
 * 判定晚到或后台完成的环境复核是否应该回写当前缓存：
 * - 若当前缓存未记录时间戳，或者本次复核启动时刻**严格晚于**当前缓存时间戳，允许写入；
 * - 否则（缓存更新，或**同一毫秒**）判定为旧结果，严禁覆盖。
 *
 * 【为什么同一毫秒要拒绝】`>=` 会让「设置页重新检测」与一次迟到复核落在同一毫秒时互相覆盖 ——
 * 那种情况下分不清谁先谁后，宁可留着设置页那份（用户主动按的），丢掉后台迟到的。
 */
export function shouldCommitEnvReport(currentAt: string | undefined, startedAt: number): boolean {
  if (!currentAt) return true
  const cachedAtMs = Date.parse(currentAt)
  if (Number.isNaN(cachedAtMs)) return true
  return startedAt > cachedAtMs
}
