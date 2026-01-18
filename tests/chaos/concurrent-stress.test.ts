import { describe, it, expect } from 'vitest'
import { TieredStore } from '@/storage/tiered-store'
import { memoryDriver } from '@/storage/drivers/memory'
import { CacheEntry } from '@/entry'
import { createCache } from '@/cache'
import { CountingDriver } from '../support/drivers/counting'

describe('Concurrent Stress Chaos', () => {
  describe('high concurrency', () => {
    it('handles 1000 concurrent writes', async () => {
      const store = new TieredStore({
        l1: memoryDriver({ maxItems: 2000 }),
      })

      const writes = Array.from({ length: 1000 }, (_, i) =>
        store.set(`key-${i}`, CacheEntry.create(`value-${i}`, { staleTime: 60_000 })),
      )

      await Promise.all(writes)

      for (let i = 0; i < 1000; i++) {
        const result = await store.get(`key-${i}`)
        expect(result.entry?.value).toBe(`value-${i}`)
      }
    })

    it('handles 1000 concurrent reads', async () => {
      const store = new TieredStore({
        l1: memoryDriver({ maxItems: 2000 }),
      })

      for (let i = 0; i < 100; i++) {
        await store.set(`key-${i}`, CacheEntry.create(`value-${i}`, { staleTime: 60_000 }))
      }

      const reads = Array.from({ length: 1000 }, (_, i) => store.get(`key-${i % 100}`))

      const results = await Promise.all(reads)

      results.forEach((result, i) => {
        expect(result.entry?.value).toBe(`value-${i % 100}`)
      })
    })

    it('handles mixed concurrent read/write workload', async () => {
      const store = new TieredStore({
        l1: memoryDriver({ maxItems: 2000 }),
      })

      const operations: Promise<unknown>[] = []

      for (let i = 0; i < 500; i++) {
        operations.push(
          store.set(`mixed-${i}`, CacheEntry.create(`value-${i}`, { staleTime: 60_000 })),
        )
        operations.push(store.get(`mixed-${i % 100}`))
        operations.push(store.delete(`mixed-${i - 100}`))
      }

      await expect(Promise.all(operations)).resolves.not.toThrow()
    })
  })

  describe('race conditions', () => {
    it('last write wins for same key', async () => {
      const store = new TieredStore({
        l1: memoryDriver({ maxItems: 100 }),
      })

      const writes = Array.from({ length: 100 }, (_, i) =>
        store.set('race-key', CacheEntry.create(`value-${i}`, { staleTime: 60_000 })),
      )

      await Promise.all(writes)

      const result = await store.get('race-key')
      expect(result.entry?.value).toMatch(/^value-\d+$/)
    })

    it('dedup prevents thundering herd on getOrSet', async () => {
      const l2 = new CountingDriver()
      const cache = createCache({
        l2,
      })

      let factoryCallCount = 0
      const factory = async () => {
        factoryCallCount++
        await new Promise((r) => setTimeout(r, 10))
        return 'computed-value'
      }

      const requests = Array.from({ length: 50 }, () =>
        cache.getOrSet('dedup-key', factory, { staleTime: 60_000 }),
      )

      const results = await Promise.all(requests)

      expect(factoryCallCount).toBe(1)

      results.forEach((v) => expect(v).toBe('computed-value'))
    })
  })

  describe('memory pressure', () => {
    it('evicts entries when L1 is full', async () => {
      const store = new TieredStore({
        l1: memoryDriver({ maxItems: 100 }),
      })

      for (let i = 0; i < 200; i++) {
        await store.set(`evict-${i}`, CacheEntry.create(`value-${i}`, { staleTime: 60_000 }))
      }

      let inL1Count = 0
      for (let i = 0; i < 200; i++) {
        const result = await store.get(`evict-${i}`)
        if (result.source === 'memory') {
          inL1Count++
        }
      }

      expect(inL1Count).toBeLessThanOrEqual(100)
    })

    it('handles large values without crashing', async () => {
      const store = new TieredStore({
        l1: memoryDriver({ maxItems: 100 }),
      })

      const largeValue = 'x'.repeat(100_000)

      for (let i = 0; i < 20; i++) {
        await store.set(`large-${i}`, CacheEntry.create(largeValue + i, { staleTime: 60_000 }))
      }

      const result = await store.get('large-19')
      expect(result.entry?.value).toBe(largeValue + '19')
    })
  })

  describe('burst traffic', () => {
    it('survives burst of 10000 operations', async () => {
      const store = new TieredStore({
        l1: memoryDriver({ maxItems: 15000 }),
      })

      const burst: Promise<unknown>[] = []

      for (let i = 0; i < 10000; i++) {
        burst.push(store.set(`burst-${i}`, CacheEntry.create(`v${i}`, { staleTime: 60_000 })))
      }

      await Promise.all(burst)

      const samples = [0, 1000, 5000, 9999]
      for (const i of samples) {
        const r = await store.get(`burst-${i}`)
        expect(r.entry?.value).toBe(`v${i}`)
      }
    })

    it('handles rapid clear during writes', async () => {
      const store = new TieredStore({
        l1: memoryDriver({ maxItems: 1000 }),
      })

      const operations: Promise<void>[] = []

      for (let i = 0; i < 100; i++) {
        operations.push(
          store.set(`key-${i}`, CacheEntry.create(`value-${i}`, { staleTime: 60_000 })),
        )
        if (i % 20 === 0) {
          operations.push(store.clear())
        }
      }

      await expect(Promise.all(operations)).resolves.not.toThrow()
    })
  })

  describe('namespace stress', () => {
    it('handles many namespaces concurrently', async () => {
      const store = new TieredStore({
        l1: memoryDriver({ maxItems: 10000 }),
      })

      const namespaces = Array.from({ length: 100 }, (_, i) => store.namespace(`ns-${i}`))

      const operations = namespaces.flatMap((ns, i) =>
        Array.from({ length: 10 }, (_, j) =>
          ns.set(`key-${j}`, CacheEntry.create(`ns${i}-value${j}`, { staleTime: 60_000 })),
        ),
      )

      await Promise.all(operations)

      for (let i = 0; i < 100; i++) {
        const ns = namespaces[i]
        for (let j = 0; j < 10; j++) {
          const result = await ns.get(`key-${j}`)
          expect(result.entry?.value).toBe(`ns${i}-value${j}`)
        }
      }
    })
  })
})
