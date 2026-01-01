import { describe, it, expect } from 'vitest'

import { parseDuration, parseOptionalDuration } from '@/duration'

describe('parseDuration', () => {
  it('returns number as-is', () => {
    expect(parseDuration(1000)).toBe(1000)
  })

  it('parses milliseconds', () => {
    expect(parseDuration('500ms')).toBe(500)
  })

  it('parses seconds', () => {
    expect(parseDuration('5s')).toBe(5000)
  })

  it('parses minutes', () => {
    expect(parseDuration('2m')).toBe(120_000)
  })

  it('parses hours', () => {
    expect(parseDuration('1h')).toBe(3_600_000)
  })

  it('parses days', () => {
    expect(parseDuration('1d')).toBe(86_400_000)
  })

  it('throws on invalid format', () => {
    expect(() => parseDuration('invalid')).toThrow('Invalid duration')
  })
})

describe('parseOptionalDuration', () => {
  it('returns undefined for undefined', () => {
    expect(parseOptionalDuration(undefined)).toBeUndefined()
  })

  it('parses value when provided', () => {
    expect(parseOptionalDuration('1s')).toBe(1000)
  })
})
