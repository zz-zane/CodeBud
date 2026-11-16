import type { ExplainerVideo, VideoScene } from '../../../shared/video'
import type { VideoNarrator } from './video-narrator'

export type VideoPlaybackState = 'idle' | 'playing' | 'paused' | 'ended'
export interface VideoPlaybackSnapshot {
  state: VideoPlaybackState
  sceneIndex: number
  stepIndex: number
  rate: number
}

const stepCount = (scene: VideoScene): number => scene.kind === 'card' ? 1 : scene.steps.length

export class VideoEngine {
  private snapshot: VideoPlaybackSnapshot = { state: 'idle', sceneIndex: 0, stepIndex: 0, rate: 1 }
  private revision = 0
  private timer: ReturnType<typeof setTimeout> | undefined
  private releaseDelay: (() => void) | undefined

  constructor(readonly video: ExplainerVideo, private narrator: VideoNarrator, private notify: (snapshot: VideoPlaybackSnapshot) => void) {}

  getSnapshot(): VideoPlaybackSnapshot { return { ...this.snapshot } }

  private publish(): void { this.notify(this.getSnapshot()) }

  private stopCurrent(): void {
    this.revision++
    this.narrator.cancel()
    if (this.timer !== undefined) clearTimeout(this.timer)
    this.timer = undefined
    this.releaseDelay?.()
    this.releaseDelay = undefined
  }

  private async run(revision: number): Promise<void> {
    const { sceneIndex, stepIndex, rate } = this.snapshot
    const scene = this.video.scenes[sceneIndex]
    if (!scene) { this.snapshot.state = 'ended'; this.publish(); return }
    const text = scene.kind === 'card' ? scene.say : scene.steps[stepIndex]?.say
    if (text === undefined) { this.advance(); return }
    await this.narrator.speak(text, rate)
    if (revision !== this.revision || this.snapshot.state !== 'playing') return
    await new Promise<void>((resolve) => {
      this.releaseDelay = resolve
      this.timer = setTimeout(resolve, 350)
    })
    if (revision !== this.revision || this.snapshot.state !== 'playing') return
    this.releaseDelay = undefined
    this.timer = undefined
    this.advance()
  }

  private advance(): void {
    let { sceneIndex, stepIndex } = this.snapshot
    stepIndex++
    while (sceneIndex < this.video.scenes.length && stepIndex >= stepCount(this.video.scenes[sceneIndex])) {
      sceneIndex++; stepIndex = 0
    }
    if (sceneIndex >= this.video.scenes.length) { this.stopCurrent(); this.snapshot.state = 'ended'; this.publish(); return }
    this.snapshot.sceneIndex = sceneIndex
    this.snapshot.stepIndex = stepIndex
    this.publish()
    if (this.snapshot.state === 'playing') void this.run(this.revision)
  }

  play(): void {
    if (this.snapshot.state === 'playing') return
    if (this.snapshot.state === 'ended') { this.snapshot.sceneIndex = 0; this.snapshot.stepIndex = 0 }
    this.snapshot.state = 'playing'; this.publish(); void this.run(this.revision)
  }

  pause(): void {
    if (this.snapshot.state !== 'playing') return
    this.stopCurrent(); this.snapshot.state = 'paused'; this.publish()
  }

  seek(sceneIndex: number, stepIndex = 0): void {
    if (!Number.isInteger(sceneIndex) || !Number.isInteger(stepIndex)) return
    const scene = this.video.scenes[sceneIndex]
    if (!scene || stepIndex < 0 || stepIndex >= stepCount(scene)) return
    const playing = this.snapshot.state === 'playing'
    this.stopCurrent()
    this.snapshot.sceneIndex = sceneIndex; this.snapshot.stepIndex = stepIndex
    if (this.snapshot.state === 'ended') this.snapshot.state = 'paused'
    this.publish()
    if (playing) void this.run(this.revision)
  }

  next(): void {
    const { sceneIndex, stepIndex } = this.snapshot
    const scene = this.video.scenes[sceneIndex]
    if (!scene) return
    if (stepIndex + 1 < stepCount(scene)) this.seek(sceneIndex, stepIndex + 1)
    else if (sceneIndex + 1 < this.video.scenes.length) this.seek(sceneIndex + 1)
    else { this.stopCurrent(); this.snapshot.state = 'ended'; this.publish() }
  }

  previous(): void {
    const { sceneIndex, stepIndex } = this.snapshot
    if (stepIndex > 0) this.seek(sceneIndex, stepIndex - 1)
    else if (sceneIndex > 0) this.seek(sceneIndex - 1, stepCount(this.video.scenes[sceneIndex - 1]) - 1)
  }

  setRate(rate: number): void {
    if (![0.75, 1, 1.25, 1.5].includes(rate)) return
    const playing = this.snapshot.state === 'playing'
    this.stopCurrent(); this.snapshot.rate = rate; this.publish()
    if (playing) void this.run(this.revision)
  }

  dispose(): void { this.stopCurrent() }
}
