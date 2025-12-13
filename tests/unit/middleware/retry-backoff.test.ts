import { describe, expect, it } from 'vitest'
import {
  exponentialBackoff,
  linearBackoff,
  fibonacciBackoff,
  withMaxDelay,
  withJitter,
} from '@/core/middleware/retry/retry-backoff'

describe('Retry Backoff Strategies', () => {
  const baseDelay = 100

  describe('strategy patterns', () => {
    it.each([
      ['exponential', exponentialBackoff, [100, 200, 400, 800, 1600]],
      ['linear', linearBackoff, [100, 100, 100, 100, 100]],
      ['fibonacci', fibonacciBackoff, [100, 100, 200, 300, 500]],
    ] as const)('%s backoff follows mathematical pattern', (_, strategy, expected) => {
      const results = [1, 2, 3, 4, 5].map((attempt) => strategy(attempt, baseDelay))

      expect(results).toEqual(expected)
    })
  })

  describe('modifiers', () => {
    it('withMaxDelay caps delay at specified maximum', () => {
      const capped = withMaxDelay(exponentialBackoff, 300)

      expect(capped(1, 100)).toBe(100)
      expect(capped(2, 100)).toBe(200)
      expect(capped(3, 100)).toBe(300) // Capped
      expect(capped(10, 100)).toBe(300) // Still capped
    })

    it('withJitter adds bounded randomness', () => {
      const jittered = withJitter(linearBackoff, 0.2)
      const results = Array.from({ length: 100 }, () => jittered(1, 100))

      // All results within bounds
      expect(results.every((r) => r >= 80 && r <= 120)).toBe(true)
      // Has variance (not all same)
      expect(new Set(results).size).toBeGreaterThan(1)
    })
  })

  describe('mathematical invariants', () => {
    it('exponential backoff doubles each attempt', () => {
      for (let attempt = 1; attempt < 10; attempt++) {
        const current = exponentialBackoff(attempt, 100)
        const next = exponentialBackoff(attempt + 1, 100)
        expect(next).toBe(current * 2)
      }
    })

    it('fibonacci backoff follows F(n) = F(n-1) + F(n-2)', () => {
      const results = [1, 2, 3, 4, 5, 6, 7].map((n) => fibonacciBackoff(n, 1))

      for (let i = 2; i < results.length; i++) {
        expect(results[i]).toBe(results[i - 1] + results[i - 2])
      }
    })

    it('linear backoff is constant', () => {
      const results = [1, 2, 3, 4, 5].map((n) => linearBackoff(n, 100))

      expect(new Set(results).size).toBe(1)
    })
  })
})
