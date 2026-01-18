/* eslint-disable @typescript-eslint/require-await */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { withSwr, type SwrResult } from '@/resilience/swr'
import { sleep } from '../../support/time'

describe('withSwr', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('basic functionality', () => {
    it('returns fresh result without stale value', async () => {
      const fn = vi.fn(async () => 'fresh')

      const result = await withSwr(fn)

      expect(result).toEqual({ value: 'fresh', stale: false })
      expect(fn).toHaveBeenCalledOnce()
    })

    it('passes AbortSignal to function', async () => {
      let receivedSignal: AbortSignal | undefined

      await withSwr(async (signal) => {
        receivedSignal = signal
        return 'value'
      })

      expect(receivedSignal).toBeInstanceOf(AbortSignal)
    })
  })

  describe('stale value handling', () => {
    it('returns fresh result when fetch succeeds before timeout', async () => {
      const fn = vi.fn(async () => {
        await sleep(50)
        return 'fresh'
      })

      const promise = withSwr(fn, { staleValue: 'stale', timeout: 100 })
      await vi.advanceTimersByTimeAsync(50)
      const result = await promise

      expect(result).toEqual({ value: 'fresh', stale: false })
    })

    it('returns stale value when fetch times out', async () => {
      const fn = vi.fn(async () => {
        await sleep(200)
        return 'fresh'
      })

      const promise = withSwr(fn, { staleValue: 'stale', timeout: 100 })
      await vi.advanceTimersByTimeAsync(100)
      const result = await promise

      expect(result).toEqual({ value: 'stale', stale: true })
    })

    it('returns stale value immediately with timeout=0', async () => {
      const fn = vi.fn(async () => 'fresh')

      const result = await withSwr(fn, { staleValue: 'stale', timeout: 0 })

      expect(result).toEqual({ value: 'stale', stale: true })
      expect(fn).not.toHaveBeenCalled()
    })

    it('handles undefined stale value', async () => {
      const fn = vi.fn(async () => {
        await sleep(200)
        return 'fresh'
      })

      const promise = withSwr(fn, { staleValue: undefined, timeout: 100 })
      await vi.advanceTimersByTimeAsync(100)
      const result = await promise

      expect(result).toEqual({ value: undefined, stale: true })
    })

    it('handles null stale value', async () => {
      const fn = vi.fn(async () => {
        await sleep(200)
        return 'fresh'
      })

      const promise = withSwr(fn, { staleValue: null, timeout: 100 })
      await vi.advanceTimersByTimeAsync(100)
      const result = await promise

      expect(result).toEqual({ value: null, stale: true })
    })
  })

  describe('timeout behavior', () => {
    it('does not timeout without timeout option', async () => {
      const fn = vi.fn(async () => {
        await sleep(1000)
        return 'eventually'
      })

      const promise = withSwr(fn, { staleValue: 'stale' })
      await vi.advanceTimersByTimeAsync(1000)
      const result = await promise

      expect(result).toEqual({ value: 'eventually', stale: false })
    })

    it('handles timeout slightly before fetch completes', async () => {
      const fn = vi.fn(async () => {
        await sleep(150) // Slightly after timeout
        return 'fresh'
      })

      const promise = withSwr(fn, { staleValue: 'stale', timeout: 100 })
      await vi.advanceTimersByTimeAsync(100)
      const result = await promise

      // Timeout should win
      expect(result.stale).toBe(true)
      expect(result.value).toBe('stale')
    })

    it('handles negative timeout as no timeout', async () => {
      const fn = vi.fn(async () => {
        await sleep(100)
        return 'fresh'
      })

      const promise = withSwr(fn, { staleValue: 'stale', timeout: -1 })
      await vi.advanceTimersByTimeAsync(100)
      const result = await promise

      // Negative timeout should be treated as no timeout
      expect(result).toEqual({ value: 'fresh', stale: false })
    })
  })

  describe('abortOnTimeout', () => {
    it('aborts signal when abortOnTimeout is true', async () => {
      let capturedSignal: AbortSignal | undefined

      const fn = vi.fn(async (signal: AbortSignal) => {
        capturedSignal = signal
        await sleep(200)
        return 'fresh'
      })

      const promise = withSwr(fn, {
        staleValue: 'stale',
        timeout: 100,
        abortOnTimeout: true,
      })

      await vi.advanceTimersByTimeAsync(100)
      await promise

      expect(capturedSignal?.aborted).toBe(true)
    })

    it('does not abort signal when abortOnTimeout is false', async () => {
      let capturedSignal: AbortSignal | undefined

      const fn = vi.fn(async (signal: AbortSignal) => {
        capturedSignal = signal
        await sleep(200)
        return 'fresh'
      })

      const promise = withSwr(fn, {
        staleValue: 'stale',
        timeout: 100,
        abortOnTimeout: false,
      })

      await vi.advanceTimersByTimeAsync(100)
      await promise

      expect(capturedSignal?.aborted).toBe(false)
    })

    it('abortOnTimeout defaults to false', async () => {
      let capturedSignal: AbortSignal | undefined

      const fn = vi.fn(async (signal: AbortSignal) => {
        capturedSignal = signal
        await sleep(200)
        return 'fresh'
      })

      const promise = withSwr(fn, {
        staleValue: 'stale',
        timeout: 100,
      })

      await vi.advanceTimersByTimeAsync(100)
      await promise

      expect(capturedSignal?.aborted).toBe(false)
    })
  })

  describe('backgroundRefresh', () => {
    it('calls backgroundRefresh on timeout=0', async () => {
      const backgroundRefresh = vi.fn(async () => 'refreshed')

      await withSwr(async () => 'fresh', {
        staleValue: 'stale',
        timeout: 0,
        backgroundRefresh,
      })

      expect(backgroundRefresh).toHaveBeenCalledOnce()
    })

    it('calls backgroundRefresh when abortOnTimeout is true', async () => {
      const backgroundRefresh = vi.fn(async () => 'refreshed')

      const promise = withSwr(
        async () => {
          await sleep(200)
          return 'fresh'
        },
        {
          staleValue: 'stale',
          timeout: 100,
          abortOnTimeout: true,
          backgroundRefresh,
        },
      )

      await vi.advanceTimersByTimeAsync(100)
      await promise

      expect(backgroundRefresh).toHaveBeenCalledOnce()
    })

    it('does not call backgroundRefresh on success', async () => {
      const backgroundRefresh = vi.fn(async () => 'refreshed')

      const result = await withSwr(async () => 'fresh', {
        staleValue: 'stale',
        timeout: 100,
        backgroundRefresh,
      })

      expect(result.stale).toBe(false)
      expect(backgroundRefresh).not.toHaveBeenCalled()
    })

    it('handles backgroundRefresh errors silently', async () => {
      const backgroundRefresh = vi.fn(async () => {
        throw new Error('Background refresh failed')
      })

      // Should not throw
      await withSwr(async () => 'fresh', {
        staleValue: 'stale',
        timeout: 0,
        backgroundRefresh,
      })

      expect(backgroundRefresh).toHaveBeenCalled()
    })
  })

  describe('without stale value', () => {
    it('waits for fresh value regardless of timeout', async () => {
      const fn = vi.fn(async () => {
        await sleep(500)
        return 'eventually fresh'
      })

      const promise = withSwr(fn, { timeout: 100 }) // No stale value
      await vi.advanceTimersByTimeAsync(500)
      const result = await promise

      expect(result).toEqual({ value: 'eventually fresh', stale: false })
    })

    it('propagates errors without stale value', async () => {
      const fn = vi.fn(async () => {
        throw new Error('Fetch failed')
      })

      await expect(withSwr(fn)).rejects.toThrow('Fetch failed')
    })
  })

  describe('type safety', () => {
    it('preserves value type', async () => {
      const numResult: SwrResult<number> = await withSwr(async () => 42)
      const strResult: SwrResult<string> = await withSwr(async () => 'hello')
      const objResult: SwrResult<{ id: number }> = await withSwr(async () => ({ id: 1 }))

      expect(numResult.value).toBe(42)
      expect(strResult.value).toBe('hello')
      expect(objResult.value).toEqual({ id: 1 })
    })
  })

  describe('edge cases', () => {
    it('handles empty options', async () => {
      const result = await withSwr(async () => 'value', {})

      expect(result).toEqual({ value: 'value', stale: false })
    })

    it('handles long timeout', async () => {
      const fn = vi.fn(async () => {
        await sleep(100)
        return 'fresh'
      })

      const promise = withSwr(fn, {
        staleValue: 'stale',
        timeout: 10_000, // Long but reasonable timeout
      })

      await vi.advanceTimersByTimeAsync(100)
      const result = await promise

      expect(result).toEqual({ value: 'fresh', stale: false })
    })

    it('handles synchronous function', async () => {
      const result = await withSwr(async () => 'sync')

      expect(result).toEqual({ value: 'sync', stale: false })
    })
  })
})
