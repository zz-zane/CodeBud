import { describe, expect, it } from 'vitest'
import { directionOf, isDetailRoute, parentRouteOf, routeDepth, slideKind } from '../phone-nav'
import { NAV_ITEMS, isNavActive, navGroupOf, navSections, phoneTabItems } from '../nav-items'
import { KB_OPEN_THRESHOLD, computeKbInset, installKeyboardInset, isKbOpen, type KbWindow } from '../keyboard-inset'
import { createScrollMemory } from '../scroll-memory'

describe('页面切换方向（history.state.position）', () => {
  it('变大 = 前进，变小 = 后退，相等或未知 = 无', () => {
    expect(directionOf(3, 4)).toBe('fwd')
    expect(directionOf(4, 3)).toBe('back')
    expect(directionOf(3, 3)).toBe('none')
    expect(directionOf(undefined, 3)).toBe('none')
    expect(directionOf(3, null)).toBe('none')
    expect(directionOf('3', 4)).toBe('none')
  })
  it('标签 ↔ 标签一律即时，进入 / 离开详情才滑动', () => {
    expect(slideKind('fwd', '/ai', '/study')).toBe('none')
    expect(slideKind('back', '/cet6', '/review')).toBe('none')
    expect(slideKind('fwd', '/courses', '/lesson/c-1')).toBe('fwd')
    expect(slideKind('back', '/lesson/c-1', '/courses')).toBe('back')
    expect(slideKind('fwd', '/cet6', '/cet6/vocab')).toBe('fwd')
    expect(slideKind('fwd', '/cet6', '/cet6/2024-06-1')).toBe('fwd')
    expect(slideKind('none', '/courses', '/lesson/c-1')).toBe('none')
  })
})

describe('路由层级与父级', () => {
  it('顶层 0、列表 1、详情 2', () => {
    for (const p of ['/today', '/courses', '/ai', '/study', '/practice', '/cet6', '/review', '/overview', '/settings']) expect(routeDepth(p)).toBe(0)
    for (const p of ['/memo', '/favorites', '/playground', '/cet6/vocab']) expect(routeDepth(p)).toBe(1)
    expect(routeDepth('/lesson/c-1')).toBe(2)
    expect(routeDepth('/cet6/2024-06-1')).toBe(2)
    expect(isDetailRoute('/lesson/c-1')).toBe(true)
    expect(isDetailRoute('/ai')).toBe(false)
  })
  it('没有应用内历史时的返回去处', () => {
    expect(parentRouteOf('/lesson/c-1')).toBe('/courses')
    expect(parentRouteOf('/cet6/vocab')).toBe('/cet6')
    expect(parentRouteOf('/cet6/2024-06-1')).toBe('/cet6')
    expect(parentRouteOf('/memo')).toBe('/overview')
    expect(parentRouteOf('/somewhere-else')).toBe('/today')
  })
})

describe('主导航分组（侧栏与标签栏共用）', () => {
  it('分组映射', () => {
    expect(navGroupOf('/today')).toBe('today')
    expect(navGroupOf('/courses')).toBe('courses')
    expect(navGroupOf('/ai')).toBe('ai')
    expect(navGroupOf('/study')).toBe('study')
    expect(navGroupOf('/playground')).toBe('practice')
    expect(navGroupOf('/cet6/2024-06-1')).toBe('cet6')
    expect(navGroupOf('/memo')).toBe('overview')
    expect(navGroupOf('/lesson/c-1')).toBe('courses')
    expect(navGroupOf('/settings')).toBeNull()
    expect(isNavActive({ key: 'cet6' }, '/cet6/vocab')).toBe(true)
  })
  it('标签栏按 key 取 今天 / 课程 / 练习 / 复习 / AI，六级、资料库、进度留在抽屉', () => {
    expect(phoneTabItems().map((i) => i.key)).toEqual(['today', 'courses', 'practice', 'review', 'ai'])
    expect(NAV_ITEMS.map((i) => i.key)).toEqual(['today', 'courses', 'practice', 'review', 'cet6', 'study', 'ai', 'overview'])
  })
  it('分组是数据：每天做的 5 项 | 分隔线 | 资料库 / AI / 进度', () => {
    expect(navSections().map((sec) => sec.map((i) => i.key))).toEqual([
      ['today', 'courses', 'practice', 'review', 'cet6'],
      ['study', 'ai', 'overview']
    ])
  })
})

describe('键盘高度', () => {
  it('= 布局高 − 可视高 − 顶部偏移，下限 0', () => {
    expect(computeKbInset(844, 844, 0)).toBe(0)
    expect(computeKbInset(844, 520, 0)).toBe(324)
    expect(computeKbInset(844, 520, 40)).toBe(284)
    expect(computeKbInset(800, 900, 0)).toBe(0)
    expect(computeKbInset(NaN, 500, 0)).toBe(0)
  })
  it('双指放大造成的可视视口缩小不算键盘', () => {
    expect(computeKbInset(844, 400, 0, 2)).toBe(0)
  })
  it('超过 120px 才算 kb-open', () => {
    expect(KB_OPEN_THRESHOLD).toBe(120)
    expect(isKbOpen(120)).toBe(false)
    expect(isKbOpen(121)).toBe(true)
    expect(isKbOpen(0)).toBe(false)
  })
  it('installKeyboardInset：随 visualViewport 更新变量与 kb-open，卸载后清掉', () => {
    const vv = Object.assign(new EventTarget(), { height: 844, offsetTop: 0, scale: 1 })
    const vars = new Map<string, string>()
    const classes = new Set<string>()
    let queued: (() => void) | null = null
    const win: KbWindow = {
      innerHeight: 844,
      visualViewport: vv,
      requestAnimationFrame: (cb) => {
        queued = cb
        return 1
      },
      cancelAnimationFrame: () => {
        queued = null
      }
    }
    const root = {
      style: {
        setProperty: (k: string, v: string) => void vars.set(k, v),
        removeProperty: (k: string) => void vars.delete(k)
      },
      classList: {
        toggle: (c: string, force?: boolean) => {
          if (force) classes.add(c)
          else classes.delete(c)
          return !!force
        },
        remove: (c: string) => void classes.delete(c)
      }
    }
    const off = installKeyboardInset(win, root)
    expect(vars.get('--mi-kb-inset')).toBe('0px')
    expect(classes.has('kb-open')).toBe(false)

    vv.height = 520
    vv.dispatchEvent(new Event('resize'))
    vv.dispatchEvent(new Event('scroll')) // 同一帧内的多次事件只排一次
    expect(queued).not.toBeNull()
    queued!()
    expect(vars.get('--mi-kb-inset')).toBe('324px')
    expect(classes.has('kb-open')).toBe(true)

    vv.height = 800
    vv.dispatchEvent(new Event('resize'))
    queued!()
    expect(vars.get('--mi-kb-inset')).toBe('44px')
    expect(classes.has('kb-open')).toBe(false)

    off()
    expect(vars.has('--mi-kb-inset')).toBe(false)
    vv.height = 400
    vv.dispatchEvent(new Event('resize'))
    expect(vars.has('--mi-kb-inset')).toBe(false)
  })
  it('没有 visualViewport 时什么都不做', () => {
    const off = installKeyboardInset(
      { innerHeight: 800, requestAnimationFrame: () => 0, cancelAnimationFrame: () => {} },
      {
        style: {
          setProperty: () => {
            throw new Error('不该写')
          },
          removeProperty: () => {}
        },
        classList: { toggle: () => false, remove: () => {} }
      }
    )
    expect(() => off()).not.toThrow()
  })
})

describe('滚动位置记忆', () => {
  it('记住离开时的位置；没记过或在顶部返回 0', () => {
    const m = createScrollMemory()
    m.save('/courses', 420.4)
    expect(m.get('/courses')).toBe(420)
    expect(m.get('/other')).toBe(0)
    m.save('/courses', 0)
    expect(m.get('/courses')).toBe(0)
  })
  it('超出容量时丢最久没动过的', () => {
    const m = createScrollMemory(2)
    m.save('a', 1)
    m.save('b', 2)
    m.save('a', 3) // a 变新
    m.save('c', 4)
    expect(m.size).toBe(2)
    expect(m.get('b')).toBe(0)
    expect(m.get('a')).toBe(3)
    expect(m.get('c')).toBe(4)
  })
})
