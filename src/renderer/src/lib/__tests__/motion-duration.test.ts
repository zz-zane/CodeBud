import { expect, it } from 'vitest'
import { durationMs } from '../motion-duration'

it.each([['.2s', 200], ['60ms', 60], [' .45s ', 450], ['0s', 0], ['', 180]])(
  'converts CSS duration %s to %s milliseconds', (raw, expected) => {
    expect(durationMs(raw, 180)).toBe(expected)
  }
)
