import type { ContentBundle, Lang } from '../../../shared/types'
import type { AlgoBundle } from '../stores/content'
import { LANG_LABEL, STAGE_LABEL } from './labels'

export type CourseCategory = Lang | 'algo'

export function courseGroups(bundle: ContentBundle, algo: AlgoBundle, category: CourseCategory, filter: string, hasLesson: (id: string) => boolean) {
  const q = filter.trim().toLowerCase()
  const match = (title: string) => !q || title.toLowerCase().includes(q)
  if (category === 'algo') {
    return algo.chapters.map(ch => ({
      key: ch.id, label: ch.title,
      items: ch.lessons.filter(l => match(l.title)).map(l => ({ ...l, available: l.hasContent && hasLesson(l.id) }))
    })).filter(g => g.items.length)
  }
  return bundle.outline.filter(m => m.lang === category).map(m => ({
    key: `${m.lang}-${m.stage}`, label: m.lang === 'common' ? LANG_LABEL.common : (STAGE_LABEL[m.stage] ?? String(m.stage)),
    items: m.lessons.filter(l => match(l.title)).map(l => ({ ...l, available: l.hasContent && hasLesson(l.id) }))
  })).filter(g => g.items.length)
}
