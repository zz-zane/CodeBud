import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

const readView = (rel: string): string => readFileSync(join(__dirname, '..', '..', rel), 'utf8')

describe('学习闭环 UI 接线契约（docs/33 乙线）', () => {
  it('SettingsView 学习卡片接入学习方式与视频旁白三项设置', () => {
    const view = readView('views/SettingsView.vue')
    expect(view).toContain("SETTINGS.LEARNING_CARD_TITLE")
    expect(view).toContain("setExplainMode('text')")
    expect(view).toContain("setExplainMode('video')")
    expect(view).toContain("setReviewStrategy('standard')")
    expect(view).toContain("setReviewStrategy('sprint')")
    expect(view).toContain('REVIEW_STRATEGIES')
    expect(view).toContain('SETTINGS.NARRATOR_CARD_TITLE')
    expect(view).toContain('VIDEO_NARRATION_ENABLED_KEY')
    expect(view).toContain('VIDEO_NARRATION_VOICE_KEY')
    expect(view).toContain('VIDEO_NARRATION_RATE_KEY')
    expect(view).toContain('voiceURI')
    expect(view).not.toContain('TEMP_NARRATOR_STORAGE_KEYS')
    expect(view).toContain('speechSynthesis')
    expect(view).toContain('NARRATOR_RATES')
  })

  it('ReviewView 标题旁显示当前复习策略，App.vue 使用 weakLessonsByMastery', () => {
    const review = readView('views/ReviewView.vue')
    expect(review).toContain('REVIEW.STRATEGY_SPRINT')
    expect(review).toContain('REVIEW.STRATEGY_STANDARD')
    expect(review).toContain('data-testid="review-strategy"')

    const app = readView('App.vue')
    expect(app).toContain('weakLessonsByMastery')
    expect(app).toContain('usePracticeStore')
  })

  it('CoursesView 与 OverviewView 展示掌握度已掌握标记', () => {
    const courses = readView('views/CoursesView.vue')
    expect(courses).toContain('isLessonMastered')
    expect(courses).toContain('OVERVIEW.MASTERED_BADGE')

    const overview = readView('views/OverviewView.vue')
    expect(overview).toContain('isLessonMastered')
    expect(overview).toContain('OVERVIEW.MASTERED_BADGE')
  })

  it('Cet6ExamView 与 Cet6Panel 接入主观题 AI 估分卡片且仅提交后显示', () => {
    const panel = readView('components/cet6/Cet6Panel.vue')
    expect(panel).toContain('v-if="submitted" class="cet6-grade-section"')
    expect(panel).toContain('CET6.GRADE_BTN')
    expect(panel).toContain('CET6.GRADE_DISCLAIMER')
    expect(panel).toContain('cet6-grade-error')
    expect(readView('stores/cet6.ts')).toContain('CET6.GRADE_FAILED')

    const exam = readView('views/Cet6ExamView.vue')
    expect(exam).toContain('gradeSubjective')
  })

  it('StudyTasksTab 与 StudyMemoryTab 接入草稿确认、掌握度与记忆来源标签', () => {
    const tasks = readView('components/study/StudyTasksTab.vue')
    expect(tasks).toContain('STUDY_COPY.TASKS.DRAFT_BADGE')
    expect(tasks).toContain('study.confirmPlan')
    expect(tasks).toContain('study.discardPlan')
    expect(tasks).toContain('lessonMastery')
    expect(tasks).toContain('STUDY_COPY.TASKS.CONFIRM_COMPLETE_TITLE')

    const memory = readView('components/study/StudyMemoryTab.vue')
    expect(memory).toContain("r.startsWith('lesson:')")
    expect(memory).toContain("r.startsWith('chat:')")
    expect(memory).toContain("r === 'user'")
    expect(memory).toContain('STUDY_COPY.MEMORY.REF_NONE')
    expect(memory).toContain('/lesson/${lessonId}')
  })
})
