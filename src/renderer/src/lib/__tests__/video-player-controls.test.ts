import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { handlePlayerArrowKey, pickProgressSegment } from '../video-player-controls'

describe('VideoPlayer interactions', () => {
  it('进度条拖动：按 clientX 命中或就近匹配分段，且 VideoPlayer 绑定 pointerdown/move/up 暂停与恢复旁白', () => {
    const rects = [
      { act: 0, step: 0, left: 100, right: 140 },
      { act: 0, step: 1, left: 143, right: 183 },
      { act: 1, step: 0, left: 193, right: 233 }
    ]
    expect(pickProgressSegment(rects, 120)).toEqual({ act: 0, step: 0 })
    expect(pickProgressSegment(rects, 160)).toEqual({ act: 0, step: 1 })
    // 落在两幕间隙（183..193）时就近吸附
    expect(pickProgressSegment(rects, 190)).toEqual({ act: 1, step: 0 })

    const sfc = readFileSync(join(__dirname, '..', '..', 'components', 'domain', 'video', 'VideoPlayer.vue'), 'utf8')
    expect(sfc).toContain('@pointerdown="onProgressPointerDown"')
    expect(sfc).toContain('@pointermove="onProgressPointerMove"')
    expect(sfc).toContain('@pointerup="onProgressPointerUp"')
    expect(sfc).toContain('if (scrubWasPlaying) engine.pause()')
    expect(sfc).toContain("if (scrubWasPlaying && snapshot.value.state === 'paused') engine.play()")
  })

  it('猜一猜方向键：根节点处理 ← 回上一步、→ 跳过本题（不阻塞按钮焦点）', () => {
    const previous = vi.fn()
    const next = vi.fn()
    const skipAsk = vi.fn()
    const preventDefault = vi.fn()

    // 焦点在选项按钮上时，isEditableTarget 为 false，← 应触发 previous
    expect(handlePlayerArrowKey('ArrowLeft', {
      state: 'asking',
      isEditableTarget: false,
      preventDefault,
      previous,
      next,
      skipAsk
    })).toBe(true)
    expect(previous).toHaveBeenCalledTimes(1)
    expect(preventDefault).toHaveBeenCalledTimes(1)

    // asking 状态下按 → 跳过本题（不走 next，走 skipAsk）
    expect(handlePlayerArrowKey('ArrowRight', {
      state: 'asking',
      isEditableTarget: false,
      preventDefault,
      previous,
      next,
      skipAsk
    })).toBe(true)
    expect(skipAsk).toHaveBeenCalledTimes(1)
    expect(next).not.toHaveBeenCalled()

    // 可编辑输入区不拦截方向键
    expect(handlePlayerArrowKey('ArrowLeft', {
      state: 'playing',
      isEditableTarget: true,
      preventDefault,
      previous,
      next,
      skipAsk
    })).toBe(false)

    const sfc = readFileSync(join(__dirname, '..', '..', 'components', 'domain', 'video', 'VideoPlayer.vue'), 'utf8')
    expect(sfc).toContain('@keydown="onRootKeydown"')
  })
})
