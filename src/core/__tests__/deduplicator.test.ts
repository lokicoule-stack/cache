import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Deduplicator } from '../deduplicator'
import { createDeduplicator } from '../deduplicator'

// ============================================================================
// Helpers
// ============================================================================

const sleep = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms))

const createMockFetch = <T>(value: T, delay = 0) => {
  const fn = vi.fn(async () => {
    if (delay > 0) await sleep(delay)
    return value
  })
  return fn
}

const createFailingFetch = (error: Error, delay = 0) => {
  const fn = vi.fn(async () => {
    if (delay > 0) await sleep(delay)
    throw error
  })
  return fn
}

// ============================================================================
// Tests
// ============================================================================

describe('createDeduplicator', () => {
  let dedup: Deduplicator

  beforeEach(() => {
    dedup = createDeduplicator()
  })

  describe('inflight strategy', () => {
    it('deduplicates concurrent requests', async () => {
      const fetch = createMockFetch('data', 50)

      const results = await Promise.all([
        dedup.get('key', fetch),
        dedup.get('key', fetch),
        dedup.get('key', fetch),
      ])

      expect(results).toEqual(['data', 'data', 'data'])
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    it('does not cache between sequential requests', async () => {
      const fetch = createMockFetch('data')

      await dedup.get('key', fetch)
      await dedup.get('key', fetch)

      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('deduplicates per key independently', async () => {
      const fetch1 = createMockFetch('data1', 50)
      const fetch2 = createMockFetch('data2', 50)

      const [result1, result2] = await Promise.all([
        dedup.get('key1', fetch1),
        dedup.get('key2', fetch2),
      ])

      expect(result1).toBe('data1')
      expect(result2).toBe('data2')
      expect(fetch1).toHaveBeenCalledTimes(1)
      expect(fetch2).toHaveBeenCalledTimes(1)
    })

    it('propagates errors to all concurrent waiters', async () => {
      const error = new Error('Fetch failed')
      const fetch = createFailingFetch(error, 50)

      const promises = [
        dedup.get('key', fetch),
        dedup.get('key', fetch),
        dedup.get('key', fetch),
      ]

      await expect(Promise.all(promises)).rejects.toThrow('Fetch failed')
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    it('allows retry after error', async () => {
      const error = new Error('Fetch failed')
      const failingFetch = createFailingFetch(error)
      const successFetch = createMockFetch('success')

      await expect(dedup.get('key', failingFetch)).rejects.toThrow()
      const result = await dedup.get('key', successFetch)

      expect(result).toBe('success')
      expect(failingFetch).toHaveBeenCalledTimes(1)
      expect(successFetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('swr strategy', () => {
    describe('cache behavior', () => {
      it('returns fresh cached data without refetching', async () => {
        const fetch1 = createMockFetch('v1')
        const fetch2 = createMockFetch('v2')

        await dedup.get('key', fetch1, { staleTime: 1000 })
        const result = await dedup.get('key', fetch2, { staleTime: 1000 })

        expect(result).toBe('v1')
        expect(fetch1).toHaveBeenCalledTimes(1)
        expect(fetch2).toHaveBeenCalledTimes(0)
      })

      it('returns stale data immediately and revalidates in background', async () => {
        const fetch1 = createMockFetch('v1')
        const fetch2 = createMockFetch('v2', 20)

        await dedup.get('key', fetch1, { staleTime: 100 })
        await sleep(150)

        const result = await dedup.get('key', fetch2, { staleTime: 100 })

        expect(result).toBe('v1')
        expect(fetch2).toHaveBeenCalledTimes(1)

        await sleep(50)
        const freshResult = await dedup.get('key', createMockFetch('v3'), { 
          staleTime: 1000 
        })
        expect(freshResult).toBe('v2')
      })

      it('deduplicates concurrent cache misses', async () => {
        const fetch = createMockFetch('data', 50)

        const results = await Promise.all([
          dedup.get('key', fetch, { staleTime: 1000 }),
          dedup.get('key', fetch, { staleTime: 1000 }),
          dedup.get('key', fetch, { staleTime: 1000 }),
        ])

        expect(results).toEqual(['data', 'data', 'data'])
        expect(fetch).toHaveBeenCalledTimes(1)
      })
    })

    describe('revalidation window', () => {
      it('prevents stampede with single revalidation for concurrent stale reads', async () => {
        const fetch1 = createMockFetch('v1')
        const fetch2 = createMockFetch('v2', 10)

        await dedup.get('key', fetch1, { staleTime: 50 })
        await sleep(100)

        await Promise.all([
          dedup.get('key', fetch2, { staleTime: 50, revalidateWindow: 1000 }),
          dedup.get('key', fetch2, { staleTime: 50, revalidateWindow: 1000 }),
          dedup.get('key', fetch2, { staleTime: 50, revalidateWindow: 1000 }),
        ])

        expect(fetch1).toHaveBeenCalledTimes(1)
        expect(fetch2).toHaveBeenCalledTimes(1)
      })

      it('allows revalidation after window expires', async () => {
        const fetch1 = createMockFetch('v1')
        const fetch2 = createMockFetch('v2', 10)
        const fetch3 = createMockFetch('v3', 10)

        await dedup.get('key', fetch1, { staleTime: 50 })
        await sleep(100)

        await dedup.get('key', fetch2, { staleTime: 50, revalidateWindow: 100 })
        await sleep(150)

        await dedup.get('key', fetch3, { staleTime: 50, revalidateWindow: 100 })

        expect(fetch2).toHaveBeenCalledTimes(1)
        expect(fetch3).toHaveBeenCalledTimes(1)
      })
    })

    describe('callbacks', () => {
      it('calls onRevalidate after successful background fetch', async () => {
        const onRevalidate = vi.fn()
        const fetch1 = createMockFetch('v1')
        const fetch2 = createMockFetch('v2', 20)

        await dedup.get('key', fetch1, { staleTime: 50, onRevalidate })
        await sleep(100)

        await dedup.get('key', fetch2, { staleTime: 50, onRevalidate })
        await sleep(50)

        expect(onRevalidate).toHaveBeenCalledWith('key', 'v2')
        expect(onRevalidate).toHaveBeenCalledTimes(1)
      })

      it('calls onError on background revalidation failure', async () => {
        const onError = vi.fn()
        const fetch1 = createMockFetch('v1')
        const error = new Error('Revalidation failed')
        const fetch2 = createFailingFetch(error, 20)

        await dedup.get('key', fetch1, { staleTime: 50, onError })
        await sleep(100)

        const result = await dedup.get('key', fetch2, { staleTime: 50, onError })
        
        expect(result).toBe('v1')
        await sleep(50)
        expect(onError).toHaveBeenCalledWith('key', error)
      })

      it('calls onError on cache miss failure', async () => {
        const onError = vi.fn()
        const error = new Error('Fetch failed')
        const fetch = createFailingFetch(error)

        await expect(
          dedup.get('key', fetch, { staleTime: 1000, onError })
        ).rejects.toThrow('Fetch failed')

        expect(onError).toHaveBeenCalledWith('key', error)
      })
    })

    describe('error handling', () => {
      it('returns stale data even when revalidation fails', async () => {
        const fetch1 = createMockFetch('v1')
        const error = new Error('Revalidation failed')
        const fetch2 = createFailingFetch(error, 20)

        await dedup.get('key', fetch1, { staleTime: 50 })
        await sleep(100)

        const result = await dedup.get('key', fetch2, { staleTime: 50 })

        expect(result).toBe('v1')
      })

      it('allows retry after revalidation error', async () => {
        const fetch1 = createMockFetch('v1')
        const error = new Error('Revalidation failed')
        const fetch2 = createFailingFetch(error, 20)
        const fetch3 = createMockFetch('v3', 20)

        await dedup.get('key', fetch1, { staleTime: 50 })
        await sleep(100)

        await dedup.get('key', fetch2, { staleTime: 50 })
        await sleep(50)

        await dedup.get('key', fetch3, { staleTime: 50 })
        await sleep(50)

        expect(fetch2).toHaveBeenCalledTimes(1)
        expect(fetch3).toHaveBeenCalledTimes(1)
      })

      it('throws error on cache miss failure', async () => {
        const error = new Error('Fetch failed')
        const fetch = createFailingFetch(error)

        await expect(
          dedup.get('key', fetch, { staleTime: 1000 })
        ).rejects.toThrow('Fetch failed')
      })
    })
  })

  describe('invalidation', () => {
    it('removes cached data for specific key', async () => {
      const fetch1 = createMockFetch('v1')
      const fetch2 = createMockFetch('v2')

      await dedup.get('key', fetch1, { staleTime: 1000 })
      dedup.invalidate('key')
      await dedup.get('key', fetch2, { staleTime: 1000 })

      expect(fetch1).toHaveBeenCalledTimes(1)
      expect(fetch2).toHaveBeenCalledTimes(1)
    })

    it('clears all cached data', async () => {
      const fetch1 = createMockFetch('v1')
      const fetch2 = createMockFetch('v2')

      await dedup.get('key1', fetch1, { staleTime: 1000 })
      await dedup.get('key2', fetch1, { staleTime: 1000 })

      dedup.invalidateAll()

      await dedup.get('key1', fetch2, { staleTime: 1000 })
      await dedup.get('key2', fetch2, { staleTime: 1000 })

      expect(fetch2).toHaveBeenCalledTimes(2)
    })
  })

  describe('strategy selection', () => {
    it('uses inflight when no staleTime', async () => {
      const fetch = createMockFetch('data')

      await dedup.get('key', fetch)
      await dedup.get('key', fetch)

      expect(fetch).toHaveBeenCalledTimes(2)
    })

    it('uses swr when staleTime is provided', async () => {
      const fetch = createMockFetch('data')

      await dedup.get('key', fetch, { staleTime: 1000 })
      await dedup.get('key', fetch, { staleTime: 1000 })

      expect(fetch).toHaveBeenCalledTimes(1)
    })

    it('uses swr even with staleTime of 0', async () => {
      const fetch = createMockFetch('data')

      await dedup.get('key', fetch, { staleTime: 0 })
      await dedup.get('key', fetch, { staleTime: 0 })

      expect(fetch).toHaveBeenCalledTimes(1)
    })
  })

  describe('performance', () => {
    it('handles 1000 concurrent inflight requests efficiently', async () => {
      const fetch = createMockFetch('data', 50)

      const start = Date.now()
      await Promise.all(
        Array.from({ length: 1000 }, () => dedup.get('key', fetch))
      )
      const duration = Date.now() - start

      expect(fetch).toHaveBeenCalledTimes(1)
      expect(duration).toBeLessThan(200)
    })

    it('handles 1000 stale reads without stampede', async () => {
      const fetch1 = createMockFetch('v1')
      const fetch2 = createMockFetch('v2', 10)

      await dedup.get('key', fetch1, { staleTime: 50 })
      await sleep(100)

      const results = await Promise.all(
        Array.from({ length: 1000 }, () =>
          dedup.get('key', fetch2, { staleTime: 50, revalidateWindow: 2000 })
        )
      )

      expect(results.every(r => r === 'v1')).toBe(true)
      expect(fetch2).toHaveBeenCalledTimes(1)
    })
  })
})