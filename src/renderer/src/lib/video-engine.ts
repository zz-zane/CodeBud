import { speechText, type ExplainerVideo, type VideoAct, type VideoStep } from '../../../shared/video'
import type { VideoNarrator } from './video-narrator'

export type VideoPlaybackState = 'idle' | 'playing' | 'paused' | 'asking' | 'ended'
export interface VideoPlaybackSnapshot { state: VideoPlaybackState; sceneIndex: number; stepIndex: number; rate: number }

export function resolveStepActions(act: VideoAct, step: VideoStep): { follow?: string; open: string[] } {
  const arrow = step.fly && step.arrows.find(a => (a.to === step.fly!.from || a.to === step.fly!.to) && step.cells.some(c => c.id === a.from))
  const pointers = new Set(step.arrows.map(a => a.from))
  const automatic = act.skin === 'locker' && step.fly ? [step.fly.from, step.fly.to].filter(id => step.cells.some(c => c.id === id) && !pointers.has(id)) : []
  return { follow: step.follow ?? arrow?.from, open: [...new Set([...(step.open ?? []), ...automatic])] }
}
export class VideoEngine {
  private snapshot: VideoPlaybackSnapshot = { state: 'idle', sceneIndex: 0, stepIndex: 0, rate: 1 }
  private revision = 0
  private timer: ReturnType<typeof setTimeout> | undefined
  private release: (() => void) | undefined
  private answered = new Set<string>()
  constructor(readonly video: ExplainerVideo, private narrator: VideoNarrator, private notify: (snapshot: VideoPlaybackSnapshot) => void, private animate: () => Promise<void> = async () => {}) {}
  getSnapshot(): VideoPlaybackSnapshot { return { ...this.snapshot } }
  private publish(): void { this.notify(this.getSnapshot()) }
  private stop(): void { this.revision++; this.narrator.cancel(); if (this.timer !== undefined) clearTimeout(this.timer); this.timer = undefined; this.release?.(); this.release = undefined }
  private key(): string { return `${this.snapshot.sceneIndex}:${this.snapshot.stepIndex}` }
  private async run(revision: number): Promise<void> {
    const step = this.video.acts[this.snapshot.sceneIndex]?.steps[this.snapshot.stepIndex]
    if (!step) { this.snapshot.state = 'ended'; this.publish(); return }
    if (step.ask && !this.answered.has(this.key())) { this.snapshot.state = 'asking'; this.publish(); return }
    await Promise.all([this.animate(), this.narrator.speak(speechText(step.say), this.snapshot.rate)])
    if (revision !== this.revision || this.snapshot.state !== 'playing') return
    await new Promise<void>(resolve => { this.release = resolve; this.timer = setTimeout(resolve, 350) })
    if (revision !== this.revision || this.snapshot.state !== 'playing') return
    this.release = undefined; this.timer = undefined; this.advance()
  }
  private advance(): void {
    let { sceneIndex, stepIndex } = this.snapshot
    stepIndex++
    while (sceneIndex < this.video.acts.length && stepIndex >= this.video.acts[sceneIndex].steps.length) { sceneIndex++; stepIndex = 0 }
    if (sceneIndex >= this.video.acts.length) { this.stop(); this.snapshot.state = 'ended'; this.publish(); return }
    this.snapshot.sceneIndex = sceneIndex; this.snapshot.stepIndex = stepIndex; this.publish()
    if (this.snapshot.state === 'playing') void this.run(this.revision)
  }
  reveal(): void { if (this.snapshot.state !== 'asking') return; this.answered.add(this.key()); this.snapshot.state = 'playing'; this.publish(); void this.run(this.revision) }
  play(): void {
    if (this.snapshot.state === 'playing' || this.snapshot.state === 'asking') return
    if (this.snapshot.state === 'ended') { this.snapshot.sceneIndex = 0; this.snapshot.stepIndex = 0; this.answered.clear() }
    this.snapshot.state = 'playing'; this.publish(); void this.run(this.revision)
  }
  pause(): void { if (this.snapshot.state !== 'playing') return; this.stop(); this.snapshot.state = 'paused'; this.publish() }
  seek(sceneIndex: number, stepIndex = 0): void {
    if (!Number.isInteger(sceneIndex) || !Number.isInteger(stepIndex) || !this.video.acts[sceneIndex]?.steps[stepIndex]) return
    const playing = this.snapshot.state === 'playing' || this.snapshot.state === 'asking'
    this.stop(); this.snapshot.sceneIndex = sceneIndex; this.snapshot.stepIndex = stepIndex
    const question = this.video.acts[sceneIndex].steps[stepIndex].ask && !this.answered.has(this.key())
    this.snapshot.state = question ? 'asking' : playing ? 'playing' : 'paused'; this.publish()
    if (this.snapshot.state === 'playing') void this.run(this.revision)
    else if (this.snapshot.state === 'paused') void this.animate()
  }
  next(): void { const { sceneIndex, stepIndex } = this.snapshot; if (this.video.acts[sceneIndex]?.steps[stepIndex + 1]) this.seek(sceneIndex, stepIndex + 1); else if (this.video.acts[sceneIndex + 1]?.steps.length) this.seek(sceneIndex + 1); else { this.stop(); this.snapshot.state = 'ended'; this.publish() } }
  previous(): void { const { sceneIndex, stepIndex } = this.snapshot; if (stepIndex > 0) this.seek(sceneIndex, stepIndex - 1); else if (sceneIndex > 0) this.seek(sceneIndex - 1, this.video.acts[sceneIndex - 1].steps.length - 1) }
  setRate(rate: number): void { if (![0.75, 1, 1.25, 1.5].includes(rate)) return; const playing = this.snapshot.state === 'playing'; this.stop(); this.snapshot.rate = rate; this.publish(); if (playing) void this.run(this.revision) }
  dispose(): void { this.stop() }
}
