import { handle } from '../ipc'
import { IPC } from '../../shared/ipc-channels'
import { createJsonStore } from '../store/json-store'
import { questionsWithCache, type AiCacheFile } from '../store/ai-cache'
import { refreshLangs } from '../env/detect'
import { enqueueRun } from '../runner/runner'
import { generateQuestions, testConnection, type AiDeps } from '../ai/deepseek'
import { gradeByRun } from '../../shared/run-grading'
import type { PoolItem } from '../../shared/challenge'
import type { AiGenerateInput, AiResult, GlossaryTerm } from '../../shared/types'
import type { MainFeature } from '../context'

function assertTerms(v: unknown): asserts v is GlossaryTerm[] {
  if (!Array.isArray(v)) throw new Error('invalid ai payload')
}

function assertAiGenerate(input: unknown): asserts input is AiGenerateInput {
  const i = input as AiGenerateInput | null
  if (!i || typeof i !== 'object') throw new Error('invalid ai payload')
  if (!Array.isArray(i.topics) || i.topics.length === 0) throw new Error('invalid ai payload')
  for (const t of i.topics) {
    if (!t || typeof t.lessonId !== 'string' || typeof t.title !== 'string') {
      throw new Error('invalid ai payload')
    }
    if (!Array.isArray(t.tags) || !Array.isArray(t.stems)) throw new Error('invalid ai payload')
  }
  if (typeof i.count !== 'number' || !Number.isInteger(i.count) || i.count < 1) {
    throw new Error('invalid ai payload')
  }
  if (typeof i.dateKey !== 'string') throw new Error('invalid ai payload')
  assertTerms(i.terms)
}

export const aiQuestionsFeature: MainFeature = {
  name: 'ai-questions',
  register(ctx) {
    const { readConfig, commitEnvReport } = ctx

    // AI 出题缓存（学习闭环阶段 7）：ai-cache.json —— 同一个问题只花一次钱。
    // **只有成功的响应才进来**（规矩在 store/ai-cache.ts 的 cachePut 抬头）；
    // 键是 prompt 的哈希，换模型/改提示词自动失效，不需要"清缓存"这个动作
    const aiCacheStore = createJsonStore<AiCacheFile>(ctx.storageDir, 'ai-cache.json')

    // ---------------------------------------------------------------- AI 单飞

    /**
     * 当前在飞的 AI 请求的取消控制器。`null` = 没有在飞的请求。
     *
     * 【为什么是单飞（同时只允许一个）】
     * `ai:cancel` 通道**不带参数** —— 它只能说「掐掉现在那个」。
     * 要是有两个请求同时在飞，这一句话就说不清掐的是哪个了。
     * 让「同时最多一个」成为不变式，取消才有无歧义的含义。
     *
     * 【新请求为什么直接顶掉旧的】
     * 旧的那个已经没人看了（界面同一处只会显示一个 spinner），但它的 token **还在烧**。
     * 不顶掉的话，它要一直跑到 30 秒超时才自己停 —— 用户的钱。
     * 顶掉之后旧请求会拿到 `canceled`，这是**如实报告**：它确实是被取消了。
     */
    let aiAbort: AbortController | null = null

    /**
     * 跑一次 AI 请求，顺便管好单飞与取消。
     *
     * 用 `try/finally` 把「谁清 aiAbort」写死在一处，而不是让每个 handler 自己记得清 ——
     * 忘了清的后果是**取消按钮偶尔会掐掉一个已经结束的请求**（无害），
     * 或者更糟：掐掉下一个请求（用户会看到莫名奇妙的「已取消」）。
     */
    async function withAi<T>(run: (deps: AiDeps) => Promise<AiResult<T>>): Promise<AiResult<T>> {
      aiAbort?.abort()
      const ac = new AbortController()
      aiAbort = ac
      try {
        return await run({
          // Electron 主进程自带全局 fetch（Node 18+ 的 undici），不用额外引库
          fetch: (url, init) => globalThis.fetch(url, init),
          getConfig: readConfig,
          signal: ac.signal
        })
      } finally {
        // 只有「自己还是当前那个」才清空 —— 否则会把后来者的控制器抹掉
        if (aiAbort === ac) aiAbort = null
      }
    }

    /**
     * 复核一道 AI 出的 `code` 题：**真的在本机跑一遍**，输出对上 `answer`（或任一
     * `accept`）才算通过。生成时就把关，而不是等学员答错才发现题目本身是错的。
     *
     * 【为什么走 enqueueRun 而不是直接 spawn】它和学员点「运行」是同一条链路：
     * 同一套编译参数、同一个队列、同一套输出解码。自己再造一条，两边的判分口径
     * 迟早漂移（`-std` 改一处、另一边没改，AI 题就会莫名全被丢）。
     *
     * 【没有编译器怎么办】`report[lang].found === false` 直接返回 false ——
     * 宁可这次一道 code 题都不出，也**不能把没验过的代码题端给用户**。
     * choice/fill 不受影响，照常返回。
     */
    async function verifyAiCodeQuestion(item: PoolItem): Promise<boolean> {
      const q = item.question
      if (q.type !== 'code') return true

      const cfg = readConfig(false)
      const { report, rechecked } = await refreshLangs(cfg.envCache.report, q.lang)
      // 统一通过 commitEnvReport 提交，内部自带重检判断与广播
      commitEnvReport(report, rechecked)
      if (!report[q.lang]?.found) return false

      const r = await enqueueRun(
        { lang: q.lang, code: q.code, stdin: '', timeoutSec: 5 },
        report
      )
      if (!r.ok) return false

      const expected = [q.answer, ...(q.accept ?? [])]
      return expected.some((want) => gradeByRun(want, r.stdout))
    }

    /*
     * 学习闭环阶段 7：出题前先查 ai-cache —— 每日复习补题和延展练习补题
     * 天天问的还是那几个老知识点，命中就是纯赚（token 是不问第二次的）。
     *
     * 查/问/存的编排全在 `questionsWithCache` 里（依赖注入、有单测）——
     * 这里只负责把主进程的三样东西接上去：磁盘 store、配置（模型名进缓存键）、
     * 以及**仍然走 withAi 的真生成**（单飞 + 取消的规矩一个字没少）。
     * 命中缓存时不经过 withAi：没发请求，就没有"在飞的请求"可取消。
     */
    handle(IPC.aiGenerateQuestions, (_e, input: AiGenerateInput) => {
      assertAiGenerate(input)
      const cfg = readConfig()
      return questionsWithCache({
        dynamicEnabled: cfg.ai.dynamicEnabled === true,
        model: cfg.ai.model,
        input,
        read: () => aiCacheStore.read(),
        write: (f) => aiCacheStore.write(f),
        now: () => new Date().toISOString(),
        generate: () =>
          withAi((deps) =>
            // verifyCode 只在**真生成**这条路上注入；命中缓存时用的就是当时
            // 已经验过的结果，不会再跑一遍编译器。
            generateQuestions({ ...deps, verifyCode: verifyAiCodeQuestion }, input)
          )
      })
    })

    handle(IPC.aiTestConnection, () => withAi((deps) => testConnection(deps)))

    /**
     * 取消。**没有请求在飞时调用它是安全的** —— abort 一个已经结束的控制器
     * 是空操作，这是 AbortController 保证的，不用额外判空。
     */
    handle(IPC.aiCancel, () => {
      aiAbort?.abort()
    })
  }
}
