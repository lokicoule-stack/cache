import type { Duration } from './types'

const UNITS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
}

export function parseDuration(value: Duration): number {
  if (typeof value === 'number') {
    return value
  }

  const match = value.match(/^(\d+)(ms|s|m|h|d)$/)

  if (!match) {
    throw new Error(`Invalid duration: ${value}`)
  }

  const [, amount, unit] = match

  return parseInt(amount, 10) * UNITS[unit]
}

export function parseOptionalDuration(value?: Duration): number | undefined {
  return value === undefined ? undefined : parseDuration(value)
}
