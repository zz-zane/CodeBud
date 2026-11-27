import { createRouter, createWebHashHistory } from 'vue-router'

import type { CetLevel } from '../../../shared/cet6'
import { lastCetLevel } from '../lib/cet-level'

declare module 'vue-router' {
  interface RouteMeta {
    bare?: boolean
    cetLevel?: CetLevel
    /** 页面自己管理滚动（主区无 padding、overflow hidden），如 /ai 的对话 + 底部输入 */
    fullBleed?: boolean
  }
}

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/today' },
    { path: '/learn', redirect: '/today' },
    { path: '/today', name: 'today', component: () => import('../views/TodayView.vue') },
    { path: '/ai', name: 'ai', component: () => import('../views/AiWorkspaceView.vue'), meta: { fullBleed: true } },
    { path: '/study', name: 'study', component: () => import('../views/StudyView.vue') },
    { path: '/courses', name: 'courses', component: () => import('../views/CoursesView.vue') },
    { path: '/lesson/:id', name: 'lesson', component: () => import('../views/LessonDetailView.vue') },
    { path: '/practice', name: 'practice', component: () => import('../views/PracticeView.vue') },
    { path: '/cet', redirect: () => `/${lastCetLevel()}` },
    { path: '/cet6', name: 'cet6', component: () => import('../views/Cet6View.vue'), meta: { cetLevel: 'cet6' } },
    { path: '/cet6/vocab', name: 'cet6-vocab', component: () => import('../views/Cet6VocabView.vue') },
    { path: '/cet6/:id', name: 'cet6-exam', component: () => import('../views/Cet6ExamView.vue'), meta: { fullBleed: true, cetLevel: 'cet6' } },
    { path: '/cet4', name: 'cet4', component: () => import('../views/Cet6View.vue'), meta: { cetLevel: 'cet4' } },
    { path: '/cet4/:id', name: 'cet4-exam', component: () => import('../views/Cet6ExamView.vue'), meta: { fullBleed: true, cetLevel: 'cet4' } },
    { path: '/playground', name: 'playground', component: () => import('../views/PlaygroundView.vue') },
    { path: '/favorites', name: 'favorites', component: () => import('../views/FavoritesView.vue') },
    { path: '/memo', name: 'memo', component: () => import('../views/MemoView.vue') },
    { path: '/review', name: 'review', component: () => import('../views/ReviewView.vue') },
    { path: '/overview', name: 'overview', component: () => import('../views/OverviewView.vue') },
    { path: '/settings', name: 'settings', component: () => import('../views/SettingsView.vue') },
    // 已退役娱乐/云端路由平滑重定向
    { path: '/challenge', redirect: '/practice' },
    { path: '/warehouse', redirect: '/overview' },
    { path: '/leaderboard', redirect: '/overview' },
    { path: '/login', redirect: '/settings' }
  ]
})

export default router
