export const VIDEO_NARRATION_ENABLED_KEY = 'codebud.video.narration.enabled'
export const VIDEO_NARRATION_VOICE_KEY = 'codebud.video.narration.voice'
export const VIDEO_NARRATION_RATE_KEY = 'codebud.video.narration.rate'

export interface VideoNarrator {
  speak(text: string, rate: number): Promise<void>
  cancel(): void
}

export function readVideoPreference(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

export function writeVideoPreference(key: string, value: string): void {
  try { localStorage.setItem(key, value) } catch { /* storage may be unavailable */ }
}

export function chineseVoices(): SpeechSynthesisVoice[] {
  return typeof window !== 'undefined' && window.speechSynthesis
    ? window.speechSynthesis.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith('zh'))
    : []
}

export function createVideoNarrator(): VideoNarrator {
  let finish: (() => void) | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  const cancel = (): void => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel()
    const done = finish
    finish = undefined
    done?.()
  }
  return {
    cancel,
    speak(text, rate) {
      cancel()
      return new Promise<void>((resolve) => {
        finish = resolve
        const complete = (): void => {
          if (finish !== resolve) return
          finish = undefined
          resolve()
        }
        const voices = chineseVoices()
        const voiceName = readVideoPreference(VIDEO_NARRATION_VOICE_KEY)
        const voice = voices.find((item) => item.voiceURI === voiceName) ?? voices[0]
        if (readVideoPreference(VIDEO_NARRATION_ENABLED_KEY) !== 'false' && voice && typeof SpeechSynthesisUtterance !== 'undefined') {
          const utterance = new SpeechSynthesisUtterance(text)
          utterance.voice = voice
          utterance.rate = rate
          utterance.onend = complete
          utterance.onerror = complete
          window.speechSynthesis.speak(utterance)
        } else {
          timer = setTimeout(complete, Math.max(1500, Array.from(text).length * 220) / rate)
        }
      })
    }
  }
}
