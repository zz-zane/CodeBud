import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createRouter, createMemoryHistory } from 'vue-router'
import {
  isAppRoutePath,
  canNavigateBack,
  canNavigateForward,
  useAppHistory
} from '../app-history'

describe('app-history navigation module', () => {
  const routes = [
    { path: '/', redirect: '/learn' },
    { path: '/learn', name: 'learn', component: { template: '<div>Learn</div>' } },
    { path: '/courses', name: 'courses', component: { template: '<div>Courses</div>' } },
    { path: '/lesson/:id', name: 'lesson', component: { template: '<div>Lesson</div>' } },
    { path: '/memo', name: 'memo', component: { template: '<div>Memo</div>' } },
    { path: '/settings', name: 'settings', component: { template: '<div>Settings</div>' } }
  ]

  let router = createRouter({
    history: createMemoryHistory(),
    routes
  })

  beforeEach(() => {
    router = createRouter({
      history: createMemoryHistory(),
      routes
    })
  })

  describe('isAppRoutePath', () => {
    it('rejects invalid, empty, or non-string targets', () => {
      expect(isAppRoutePath(null)).toBe(false)
      expect(isAppRoutePath(undefined)).toBe(false)
      expect(isAppRoutePath('')).toBe(false)
      expect(isAppRoutePath('   ')).toBe(false)
      expect(isAppRoutePath(123)).toBe(false)
      expect(isAppRoutePath({})).toBe(false)
    })

    it('rejects external URLs and blank pages', () => {
      expect(isAppRoutePath('https://example.com')).toBe(false)
      expect(isAppRoutePath('http://127.0.0.1:3000')).toBe(false)
      expect(isAppRoutePath('about:blank')).toBe(false)
      expect(isAppRoutePath('chrome://version')).toBe(false)
      expect(isAppRoutePath('#')).toBe(false)
    })

    it('accepts app paths and hash route strings', () => {
      expect(isAppRoutePath('/learn', router)).toBe(true)
      expect(isAppRoutePath('#/learn', router)).toBe(true)
      expect(isAppRoutePath('/courses', router)).toBe(true)
      expect(isAppRoutePath('#/courses', router)).toBe(true)
      expect(isAppRoutePath('/lesson/py-01', router)).toBe(true)
      expect(isAppRoutePath('#/memo', router)).toBe(true)
    })

    it('rejects unknown or unmatched routes when router is provided', () => {
      expect(isAppRoutePath('/non-existent-page-xyz', router)).toBe(false)
      expect(isAppRoutePath('#/non-existent-page-xyz', router)).toBe(false)
    })
  })

  describe('canNavigateBack & canNavigateForward', () => {
    it('returns false for empty or non-object history state', () => {
      expect(canNavigateBack(null, router)).toBe(false)
      expect(canNavigateBack(undefined, router)).toBe(false)
      expect(canNavigateBack('state', router)).toBe(false)
      expect(canNavigateForward(null, router)).toBe(false)
      expect(canNavigateForward({}, router)).toBe(false)
    })

    it('correctly evaluates initial load state with null back and forward', () => {
      const state = { back: null, current: '/learn', forward: null, position: 0 }
      expect(canNavigateBack(state, router)).toBe(false)
      expect(canNavigateForward(state, router)).toBe(false)
    })

    it('detects available back route', () => {
      const state = { back: '/learn', current: '/courses', forward: null, position: 1 }
      expect(canNavigateBack(state, router)).toBe(true)
      expect(canNavigateForward(state, router)).toBe(false)
    })

    it('detects available forward route', () => {
      const state = { back: null, current: '/learn', forward: '/courses', position: 0 }
      expect(canNavigateBack(state, router)).toBe(false)
      expect(canNavigateForward(state, router)).toBe(true)
    })

    it('detects bidirectional availability', () => {
      const state = { back: '/learn', current: '/courses', forward: '/memo', position: 1 }
      expect(canNavigateBack(state, router)).toBe(true)
      expect(canNavigateForward(state, router)).toBe(true)
    })

    it('rejects illegal or external targets in back/forward state', () => {
      const badState = { back: 'https://malicious.com', current: '/learn', forward: 'about:blank' }
      expect(canNavigateBack(badState, router)).toBe(false)
      expect(canNavigateForward(badState, router)).toBe(false)
    })
  })

  describe('useAppHistory controller', () => {
    let mockState: any
    let mockWindow: any

    beforeEach(() => {
      mockState = { back: null, current: '/learn', forward: null }
      mockWindow = {
        history: {
          get state() {
            return mockState
          }
        },
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }
    })

    it('initializes with accurate initial state', async () => {
      await router.push('/learn')
      const controller = useAppHistory(router, {
        getState: () => mockState,
        windowTarget: mockWindow
      })
      controller.syncHistoryState()

      expect(controller.canGoBack.value).toBe(false)
      expect(controller.canGoForward.value).toBe(false)

      controller.destroy()
    })

    it('safely guards goBack and goForward when not available', async () => {
      const backSpy = vi.spyOn(router, 'back')
      const forwardSpy = vi.spyOn(router, 'forward')

      const controller = useAppHistory(router, {
        getState: () => mockState,
        windowTarget: mockWindow
      })
      controller.syncHistoryState()

      controller.goBack()
      expect(backSpy).not.toHaveBeenCalled()

      controller.goForward()
      expect(forwardSpy).not.toHaveBeenCalled()

      controller.destroy()
    })

    it('calls router.back and router.forward when valid history state is present', async () => {
      const backSpy = vi.spyOn(router, 'back').mockImplementation(() => {})
      const forwardSpy = vi.spyOn(router, 'forward').mockImplementation(() => {})

      mockState = { back: '/learn', forward: '/courses' }

      const controller = useAppHistory(router, {
        getState: () => mockState,
        windowTarget: mockWindow
      })
      controller.syncHistoryState()

      expect(controller.canGoBack.value).toBe(true)
      expect(controller.canGoForward.value).toBe(true)

      controller.goBack()
      expect(backSpy).toHaveBeenCalledTimes(1)

      controller.goForward()
      expect(forwardSpy).toHaveBeenCalledTimes(1)

      controller.destroy()
    })

    it('cleans up listeners on destroy', async () => {
      const controller = useAppHistory(router, {
        getState: () => mockState,
        windowTarget: mockWindow
      })
      controller.destroy()
      expect(mockWindow.removeEventListener).toHaveBeenCalledWith('popstate', expect.any(Function))
    })

    it('rechecks the current target before navigating rather than trusting stale button state', () => {
      const back = vi.spyOn(router, 'back').mockImplementation(() => {})
      const forward = vi.spyOn(router, 'forward').mockImplementation(() => {})
      mockState = { back: '/learn', forward: '/courses' }
      const controller = useAppHistory(router, { getState: () => mockState, windowTarget: mockWindow })
      mockState = { back: 'about:blank', forward: 'https://example.com' }
      controller.goBack()
      controller.goForward()
      expect(back).not.toHaveBeenCalled()
      expect(forward).not.toHaveBeenCalled()
      controller.destroy()
    })
  })
})
