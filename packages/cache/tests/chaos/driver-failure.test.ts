import { describe, it, expect, beforeEach } from 'vitest'
import { TieredStore } from '@/storage/tiered-store'
import { memoryDriver } from '@/storage/drivers/memory'
import { CacheEntry } from '@/entry'
import { sleep } from '../support/time'
import { FailingDriver } from '../support/drivers/failing'

describe('Driver Failure Chaos', () => {
  let l2: FailingDriver
  let store: TieredStore

  beforeEach(() => {
    l2 = new FailingDriver()
    store = new TieredStore({
      l1: memoryDriver({ maxItems: 1000 }),
      l2: [l2],
      circuitBreakerThreshold: 3,
      circuitBreakerDuration: 1000,
    })
  })

  describe('circuit breaker', () => {
    it('opens after threshold failures', async () => {
      l2.setFailureMode('always')

      for (let i = 0; i < 5; i++) {
        await store.set(`key-${i}`, CacheEntry.create(`value-${i}`, { staleTime: 60_000 }))
      }

      for (let i = 5; i < 10; i++) {
        await store.set(`key-${i}`, CacheEntry.create(`value-${i}`, { staleTime: 60_000 }))
      }

      expect(l2.callCount).toBeLessThan(10)
    })

    it('falls back to L1 when circuit is open', async () => {
      await store.set('fallback-key', CacheEntry.create('original', { staleTime: 60_000 }))

      l2.setFailureMode('always')

      for (let i = 0; i < 5; i++) {
        await store.get(`nonexistent-${i}`)
      }

      const result = await store.get('fallback-key')

      expect(result.entry?.value).toBe('original')
      expect(result.source).toBe('memory')
    })
  })


  describe('graceful degradation', () => {
    it('continues operating with only L1 when L2 fails', async () => {
      l2.setFailureMode('always')

      await expect(
        store.set('key', CacheEntry.create('value', { staleTime: 60_000 })),
      ).resolves.not.toThrow()

      const result = await store.get('key')

      expect(result.entry?.value).toBe('value')
      expect(result.source).toBe('memory')
    })

    it('handles intermittent failures gracefully', async () => {
      l2.setFailureMode('intermittent', { rate: 0.7 })

      const results: boolean[] = []

      for (let i = 0; i < 50; i++) {
        try {
          await store.set(`key-${i}`, CacheEntry.create(`value-${i}`, { staleTime: 60_000 }))
          const r = await store.get(`key-${i}`)
          results.push(r.entry !== undefined)
        } catch {
          results.push(false)
        }
      }

      expect(results.every((r) => r)).toBe(true)
    })

    it('survives L2 being completely unavailable', async () => {
      l2.setFailureMode('always')

      for (let i = 0; i < 50; i++) {
        await store.set(`stress-${i}`, CacheEntry.create(`value-${i}`, { staleTime: 60_000 }))
      }

      for (let i = 0; i < 50; i++) {
        const result = await store.get(`stress-${i}`)
        expect(result.entry?.value).toBe(`value-${i}`)
      }
    })
  })

  describe('slow driver', () => {
    it('reads from L1 even when L2 is slow', async () => {
      await store.set('cached', CacheEntry.create('fast-value', { staleTime: 60_000 }))

      l2.setFailureMode('slow', { latency: 500 })

      const start = Date.now()
      const result = await store.get('cached')
      const elapsed = Date.now() - start

      expect(result.entry?.value).toBe('fast-value')
      expect(elapsed).toBeLessThan(50)
    })
  })

  describe('recovery scenarios', () => {
    it('resumes L2 writes after recovery', async () => {
      l2.setFailureMode('always')

      await store.set('before', CacheEntry.create('before-value', { staleTime: 60_000 }))

      l2.setFailureMode('none')

      await sleep(1500)

      await store.set('after', CacheEntry.create('after-value', { staleTime: 60_000 }))

      const l2Entry = await l2.get('after')
      expect(l2Entry?.value).toBe('after-value')
    })
  })
})
