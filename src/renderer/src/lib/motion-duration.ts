/** CDS durations mix seconds and milliseconds; auto-animate expects milliseconds. */
export function durationMs(raw: string, fallback: number): number {
  const value = Number.parseFloat(raw)
  if (!Number.isFinite(value)) return fallback
  return raw.trim().endsWith('ms') ? value : value * 1000
}
