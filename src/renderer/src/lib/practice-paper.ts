import { shuffled, shuffleOptions, type PaperEntry } from '../../../shared/quiz-paper'

/**
 * 按当前语言优先挑选题目（P1-6）：
 * 优先抽当前语言的题，不够或没有时由其他语言补充；同时洗牌和打乱选项。
 */
export function pickPrioritizedPaper<T extends PaperEntry & { lessonId: string }>(
  items: readonly T[],
  size: number,
  activeLang: string,
  langOfLesson: (lessonId: string) => string | undefined,
  rng: () => number = Math.random
): T[] {
  const n = Math.max(0, Math.min(Math.floor(size), items.length))
  const preferred: T[] = []
  const others: T[] = []
  for (const it of items) {
    const lang = langOfLesson(it.lessonId)
    if (lang === activeLang) {
      preferred.push(it)
    } else {
      others.push(it)
    }
  }
  const picked = [...shuffled(preferred, rng), ...shuffled(others, rng)].slice(0, n)
  return picked.map((it) => ({ ...it, question: shuffleOptions(it.question, rng) }))
}
