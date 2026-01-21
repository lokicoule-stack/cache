export type Duration = number | string

const DURATION_REGEX = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w)$/i

const MULTIPLIERS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
}

/**
 * Parse a duration string or number to milliseconds
 *
 * @example
 * ```ts
 * parseDuration('5m')  // 300000
 * parseDuration('1h')  // 3600000
 * parseDuration(1000)  // 1000
 * ```
 *
 * @throws Error if duration format is invalid
 */
export function parseDuration(duration: Duration): number {
  if (typeof duration === 'number') {
    return duration
  }

  const match = duration.match(DURATION_REGEX)

  if (!match) {
    throw new Error(`Invalid duration format: "${duration}"`)
  }

  const [, value, unit] = match

  return parseFloat(value) * MULTIPLIERS[unit.toLowerCase()]
}

/**
 * Parse a duration, returning undefined for undefined input
 */
export function parseOptionalDuration(duration: Duration | undefined): number | undefined {
  if (duration === undefined) {
    return undefined
  }

  return parseDuration(duration)
}
