/* eslint-disable @typescript-eslint/require-await */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { withRetry } from '@/resilience/retry'

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('basic functionality', () => {
    it('returns result on first success', async () => {
      const fn = vi.fn(async () => 'result')

      const result = await withRetry(fn, { retries: 3 })

      expect(result).toBe('result')
      expect(fn).toHaveBeenCalledOnce()
    })

    it('accepts number as options (shorthand)', async () => {
      const fn = vi.fn(async () => 'result')

      const result = await withRetry(fn, 3)

      expect(result).toBe('result')
      expect(fn).toHaveBeenCalledOnce()
    })
  })

  describe('retry behavior', () => {
    it('retries on failure', async () => {
      let attempts = 0
      const fn = vi.fn(async () => {
        attempts++
        if (attempts < 3) {
          throw new Error('Temporary failure')
        }
        return 'success'
      })

      const promise = withRetry(fn, { retries: 3 })
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result).toBe('success')
      expect(attempts).toBe(3)
    })

    it('stops after max retries', async () => {
      const fn = vi.fn(async () => {
        throw new Error('Permanent failure')
      })

      let caughtError: Error | undefined
      const promise = withRetry(fn, { retries: 3 }).catch((e) => {
        caughtError = e
      })
      await vi.runAllTimersAsync()
      await promise

      expect(caughtError?.message).toBe('Permanent failure')
      expect(fn).toHaveBeenCalledTimes(4) // 1 initial + 3 retries
    })

    it('no retries when retries=0', async () => {
      const fn = vi.fn(async () => {
        throw new Error('Failure')
      })

      await expect(withRetry(fn, { retries: 0 })).rejects.toThrow('Failure')
      expect(fn).toHaveBeenCalledOnce()
    })
  })

  describe('exponential backoff', () => {
    it('uses default base delay of 100ms', async () => {
      const callTimes: number[] = []
      const fn = vi.fn(async () => {
        callTimes.push(Date.now())
        if (callTimes.length < 3) {
          throw new Error('Fail')
        }
        return 'success'
      })

      const promise = withRetry(fn, { retries: 3 })
      await vi.runAllTimersAsync()
      await promise

      expect(callTimes[1] - callTimes[0]).toBe(100) // First retry: 100ms
      expect(callTimes[2] - callTimes[1]).toBe(200) // Second retry: 200ms
    })

    it('uses custom base delay', async () => {
      const callTimes: number[] = []
      const fn = vi.fn(async () => {
        callTimes.push(Date.now())
        if (callTimes.length < 3) {
          throw new Error('Fail')
        }
        return 'success'
      })

      const promise = withRetry(fn, { retries: 3, baseDelay: 50 })
      await vi.runAllTimersAsync()
      await promise

      // First retry after 50ms, second after 100ms (50 * 2^1)
      expect(callTimes[1] - callTimes[0]).toBe(50)
      expect(callTimes[2] - callTimes[1]).toBe(100)
    })

    it('exponentially increases delay', async () => {
      const callTimes: number[] = []
      const fn = vi.fn(async () => {
        callTimes.push(Date.now())
        if (callTimes.length < 5) {
          throw new Error('Fail')
        }
        return 'success'
      })

      const promise = withRetry(fn, { retries: 5, baseDelay: 100 })
      await vi.runAllTimersAsync()
      await promise

      // Delays: 100, 200, 400, 800
      expect(callTimes[1] - callTimes[0]).toBe(100) // 100 * 2^0
      expect(callTimes[2] - callTimes[1]).toBe(200) // 100 * 2^1
      expect(callTimes[3] - callTimes[2]).toBe(400) // 100 * 2^2
      expect(callTimes[4] - callTimes[3]).toBe(800) // 100 * 2^3
    })
  })

  describe('error handling', () => {
    it('preserves original error on final failure', async () => {
      const fn = vi.fn(async () => {
        throw new Error('Original error message')
      })

      let caughtError: Error | undefined
      const promise = withRetry(fn, { retries: 2 }).catch((e) => {
        caughtError = e
      })
      await vi.runAllTimersAsync()
      await promise

      expect(caughtError?.message).toBe('Original error message')
    })
  })

  describe('edge cases', () => {
    it('handles immediate success after failures', async () => {
      let attempts = 0
      const fn = vi.fn(async () => {
        attempts++
        if (attempts === 1) {
          throw new Error('First attempt fails')
        }
        return 'immediate success'
      })

      const promise = withRetry(fn, { retries: 5 })
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result).toBe('immediate success')
      expect(attempts).toBe(2)
    })

    it('handles high retry count', async () => {
      let attempts = 0
      const fn = vi.fn(async () => {
        attempts++
        if (attempts < 10) {
          throw new Error('Keep trying')
        }
        return 'finally'
      })

      const promise = withRetry(fn, { retries: 10, baseDelay: 1 })
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result).toBe('finally')
      expect(attempts).toBe(10)
    })

    it('handles zero base delay', async () => {
      let attempts = 0
      const fn = vi.fn(async () => {
        attempts++
        if (attempts < 3) {
          throw new Error('Fail')
        }
        return 'success'
      })

      const promise = withRetry(fn, { retries: 3, baseDelay: 0 })
      await vi.runAllTimersAsync()
      const result = await promise

      expect(result).toBe('success')
    })

    it('handles null return value', async () => {
      const fn = vi.fn(async () => null)

      const result = await withRetry(fn, { retries: 1 })

      expect(result).toBeNull()
    })

    it('handles undefined return value', async () => {
      const fn = vi.fn(async () => undefined)

      const result = await withRetry(fn, { retries: 1 })

      expect(result).toBeUndefined()
    })
  })
})
