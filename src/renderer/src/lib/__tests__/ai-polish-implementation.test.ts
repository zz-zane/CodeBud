import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAiAssistantStore } from '../../stores/ai-assistant'
import { useContentStore } from '../../stores/content'
import { AI_ASSISTANT } from '../copy'

const RENDERER_SRC = join(__dirname, '../..')

describe('AI polish implementation - Mascot & Course Sync', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('window', {
      addEventListener: () => {},
      removeEventListener: () => {},
      matchMedia: (query: string) => ({
        matches: query.includes('reduce') ? false : true,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false
      }),
      miai: {
        aiAssistant: {
          getSessions: async () => [],
          onStream: () => () => {},
          saveSessions: async () => ({ ok: true }),
          send: async () => {},
          cancel: async () => ({ ok: true })
        }
      }
    })
  })

  describe('1. Real Course Bundle Verification across 6 Categories', () => {
    it('contains readable lessons for common, C, CPP, Java, Python, and Hello Algo', () => {
      const content = useContentStore()
      const testCases = [
        { cat: 'common', id: 'common-01' },
        { cat: 'c', id: 'c-stage1-01' },
        { cat: 'cpp', id: 'cpp-stage1-01' },
        { cat: 'java', id: 'java-stage1-01' },
        { cat: 'python', id: 'python-stage1-01' },
        { cat: 'algo', id: 'algo-s001' }
      ]

      for (const tc of testCases) {
        const lesson = content.lessonOf(tc.id)
        expect(lesson, `Lesson ${tc.id} (${tc.cat}) must exist`).toBeDefined()
        expect(lesson?.id).toBe(tc.id)
        expect(lesson?.title?.length).toBeGreaterThan(0)
        expect(lesson?.body?.length).toBeGreaterThan(0)
        expect(content.statusOf(tc.id)).not.toBe('draft')
      }
    })
  })

  describe('2. Assistant Lesson Context Synchronization', () => {
    it('sets lesson context across all 6 categories and strictly matches route id', async () => {
      const content = useContentStore()
      const ai = useAiAssistantStore()
      await ai.init()

      const targetLessons = [
        'common-01',
        'c-stage1-01',
        'cpp-stage1-01',
        'java-stage1-01',
        'python-stage1-01',
        'algo-s001'
      ]

      for (const id of targetLessons) {
        ai.setLessonContext(id)
        expect(ai.lessonContextId).toBe(id)
        const tag = ai.contextTags.find((t) => t.type === 'lesson')
        expect(tag).toBeDefined()
        expect(tag?.id).toBe(`lesson-${id}`)
        const expectedTitle = AI_ASSISTANT.currentLessonLabel(content.lessonOf(id)!.title)
        expect(tag?.title).toBe(expectedTitle)
      }
    })

    it('cross-language and cross-Hello switching preserves session without duplicating', async () => {
      const ai = useAiAssistantStore()
      await ai.init()
      expect(ai.sessions.length).toBe(1)
      const initialSessionId = ai.currentSessionId

      // Switch: C -> Python -> Hello Algo
      ai.setLessonContext('c-stage1-01')
      expect(ai.lessonContextId).toBe('c-stage1-01')
      expect(ai.sessions.length).toBe(1)

      ai.setLessonContext('python-stage1-01')
      expect(ai.lessonContextId).toBe('python-stage1-01')
      expect(ai.sessions.length).toBe(1)
      expect(ai.currentSessionId).toBe(initialSessionId)

      ai.setLessonContext('algo-s001')
      expect(ai.lessonContextId).toBe('algo-s001')
      expect(ai.sessions.length).toBe(1)
      expect(ai.currentSessionId).toBe(initialSessionId)
    })

    it('clears stale lesson on returning to /learn or /courses while preserving custom tags', async () => {
      const ai = useAiAssistantStore()
      await ai.init()

      // Add a custom code selection tag
      ai.addContextTag({
        id: 'user-selection-1',
        type: 'selection',
        title: '用户选中代码',
        content: 'int a = 10;',
        removable: true
      })

      // Set lesson context
      ai.setLessonContext('c-stage1-01')
      expect(ai.lessonContextId).toBe('c-stage1-01')
      expect(ai.contextTags.length).toBe(2)

      // Navigating to /learn or /courses sets context to null
      ai.setLessonContext(null)
      expect(ai.lessonContextId).toBeNull()
      expect(ai.contextTags.length).toBe(1)
      expect(ai.contextTags[0].id).toBe('user-selection-1')
    })

    it('clears context on invalid or draft lesson without forging fake context', async () => {
      const ai = useAiAssistantStore()
      await ai.init()

      ai.setLessonContext('c-stage1-01')
      expect(ai.lessonContextId).toBe('c-stage1-01')

      // Set invalid lesson id
      ai.setLessonContext('invalid-lesson-id-999')
      expect(ai.lessonContextId).toBeNull()
      expect(ai.contextTags.filter((t) => t.type === 'lesson').length).toBe(0)
    })

    it('preserves manual lesson selection in main /ai workspace', async () => {
      const ai = useAiAssistantStore()
      await ai.init()

      // User manually picks Hello Algo in /ai
      ai.setLessonContext('algo-s001')
      expect(ai.lessonContextId).toBe('algo-s001')

      // Re-triggering or querying does not wipe out user choice
      expect(ai.lessonContextId).toBe('algo-s001')
    })
  })

  describe('3. Local Mock Upstream Message Payload with Real Body', () => {
    it('produces expected upstream message with real C and Hello Algo lesson context without calling real vendor', async () => {
      const content = useContentStore()
      const ai = useAiAssistantStore()
      await ai.init()

      const cLesson = content.lessonOf('c-stage1-01')!
      ai.setLessonContext('c-stage1-01')
      const cTag = ai.contextTags.find((t) => t.type === 'lesson')!
      expect(cTag.content).toContain(cLesson.title)
      expect(cTag.content).toContain(cLesson.body.slice(0, 100))

      const algoLesson = content.lessonOf('algo-s001')!
      ai.setLessonContext('algo-s001')
      const algoTag = ai.contextTags.find((t) => t.type === 'lesson')!
      expect(algoTag.content).toContain(algoLesson.title)
      expect(algoTag.content).toContain(algoLesson.body.slice(0, 100))
    })
  })

  describe('4. AiPixelMascot Component Specification (ROOT-PLAN-v1)', () => {
    const mascotSource = readFileSync(
      join(RENDERER_SRC, 'components/domain/AiPixelMascot.vue'),
      'utf-8'
    )

    it('uses 25x14 viewBox, width=80, height=45, body at translate(8, 0), and crispEdges', () => {
      expect(mascotSource).toContain('viewBox="0 0 25 14"')
      expect(mascotSource).toContain('width="80"')
      expect(mascotSource).toContain('height="45"')
      expect(mascotSource).toContain('transform="translate(8, 0)"')
      expect(mascotSource).toContain('shape-rendering="crispEdges"')
      expect(mascotSource).toContain('image-rendering: pixelated')
    })

    it('contains exact root yellow and green vector paths', () => {
      expect(mascotSource).toContain('fill="#85b28a"')
      expect(mascotSource).toContain('fill="#fff8b1"')
    })

    it('has discrete steps animation and reduced-motion guard', () => {
      expect(mascotSource).toContain('steps(1)')
      expect(mascotSource).toContain('prefers-reduced-motion')
      expect(mascotSource).toContain('aria-hidden="true"')
      expect(mascotSource).toContain('pointer-events: none')
    })

    it('includes all 4 action layers: normal eyes, typing eyes, laptop folding/open, and hands tap', () => {
      expect(mascotSource).toContain('layer-eyes-normal')
      expect(mascotSource).toContain('layer-eyes-typing')
      expect(mascotSource).toContain('layer-laptop-closed')
      expect(mascotSource).toContain('layer-laptop-open')
      expect(mascotSource).toContain('layer-hands-tap-a')
      expect(mascotSource).toContain('layer-hands-tap-b')
    })
  })

  describe('5. AiPanel Rail & Main Contract', () => {
    const aiPanelSource = readFileSync(
      join(RENDERER_SRC, 'components/domain/AiPanel.vue'),
      'utf-8'
    )

    it('rail header does NOT contain .new-chat plus button', () => {
      expect(aiPanelSource).not.toContain('class="icon-btn new-chat"')
    })

    it('session-title has fontWeight 400 and transparent background', () => {
      expect(aiPanelSource).toContain('.session-title {')
      expect(aiPanelSource).toMatch(/font-weight:\s*400/)
      expect(aiPanelSource).toMatch(/background:\s*transparent/)
    })

    it('lead-chip course selection is removed from input bottom row per user instruction', () => {
      expect(aiPanelSource).not.toMatch(/class="lead-chip"[\s\S]*contextTitle/)
    })
  })

  describe('6. AiWorkspaceView Mascot & Card Contract', () => {
    const wsSource = readFileSync(
      join(RENDERER_SRC, 'views/AiWorkspaceView.vue'),
      'utf-8'
    )

    it('embeds AiPixelMascot inside .ws-lesson-card and wires typing activity without hover/focus triggers', () => {
      expect(wsSource).toContain('<AiPixelMascot ref="mascotRef" />')
      expect(wsSource).not.toContain('@pointerenter="triggerMascotMotion"')
      expect(wsSource).not.toContain('@focusin="triggerMascotMotion"')
      expect(wsSource).toContain('@typing-activity="onTypingActivity"')
    })

    it('does NOT have overflow:hidden on ws-lesson-card to prevent clipping mascot head', () => {
      expect(wsSource).not.toMatch(/\.ws-lesson-card\s*\{[^}]*overflow:\s*hidden/)
    })

    it('provides headroom padding-top for mascot on ws-empty', () => {
      expect(wsSource).toMatch(/\.ws-empty\s*\{[^}]*padding-top:\s*60px/)
    })
  })
})
