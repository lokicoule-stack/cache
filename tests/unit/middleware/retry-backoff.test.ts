import { describe, expect, it } from 'vitest'
import {
  exponentialBackoff,
  linearBackoff,
  fibonacciBackoff,
  withMaxDelay,
  withJitter,
} from '@/core/middleware/retry/retry-backoff'

describe('Retry Backoff', () => {
  const baseDelay = 100

  describe('strategies', () => {
    it.each([
      ['exponential', exponentialBackoff, [100, 200, 400, 800]],
      ['linear', linearBackoff, [100, 100, 100, 100]],
      ['fibonacci', fibonacciBackoff, [100, 100, 200, 300]],
    ])('%s backoff follows expected pattern', (_, strategy, expected) => {
      const results = [1, 2, 3, 4].map((attempt) => strategy(attempt, baseDelay))

      expect(results).toEqual(expected)
    })
  })

  describe('modifiers', () => {
    it('withMaxDelay caps the delay', () => {
      const capped = withMaxDelay(exponentialBackoff, 300)

      expect(capped(1, 100)).toBe(100)
      expect(capped(3, 100)).toBe(300)
      expect(capped(10, 100)).toBe(300)
    })

    it('withJitter adds randomness within bounds', () => {
      const jittered = withJitter(linearBackoff, 0.2)

      const results = Array.from({ length: 100 }, () => jittered(1, 100))

      expect(results.every((r) => r >= 80 && r <= 120)).toBe(true)
      expect(new Set(results).size).toBeGreaterThan(1)
    })
  })
})
