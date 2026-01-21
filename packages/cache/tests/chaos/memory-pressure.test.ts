import { describe, it, expect } from 'vitest'
import { TieredStore } from '@/storage/tiered-store'
import { memoryDriver } from '@/storage/drivers/memory'
import { CacheEntry } from '@/entry'
import { createCache } from '@/cache'
import { sleep } from '../support/time'

describe('Memory Pressure Chaos', () => {
  describe('LRU eviction', () => {
    it('evicts least recently used entries first', async () => {
      const store = new TieredStore({
        l1: memoryDriver({ maxItems: 5 }),
      })

      for (let i = 0; i < 5; i++) {
        await store.set(`key-${i}`, CacheEntry.create(`value-${i}`, { staleTime: 60_000 }))
      }

      await store.get('key-0')
      await store.get('key-2')
      await store.get('key-4')

      await store.set('key-5', CacheEntry.create('value-5', { staleTime: 60_000 }))
      await store.set('key-6', CacheEntry.create('value-6', { staleTime: 60_000 }))

      expect((await store.get('key-0')).entry).toBeDefined()
      expect((await store.get('key-2')).entry).toBeDefined()
      expect((await store.get('key-4')).entry).toBeDefined()

      expect((await store.get('key-1')).entry).toBeUndefined()
      expect((await store.get('key-3')).entry).toBeUndefined()
    })

    it('updates LRU order on read access', async () => {
      const store = new TieredStore({
        l1: memoryDriver({ maxItems: 3 }),
      })

      await store.set('a', CacheEntry.create('a', { staleTime: 60_000 }))
      await store.set('b', CacheEntry.create('b', { staleTime: 60_000 }))
      await store.set('c', CacheEntry.create('c', { staleTime: 60_000 }))

      await store.get('a')

      await store.set('d', CacheEntry.create('d', { staleTime: 60_000 }))
      await store.set('e', CacheEntry.create('e', { staleTime: 60_000 }))

      expect((await store.get('a')).entry?.value).toBe('a')
      expect((await store.get('b')).entry).toBeUndefined()
      expect((await store.get('c')).entry).toBeUndefined()
    })
  })


  describe('TTL expiration', () => {
    it('expires entries after GC time', async () => {
      const store = new TieredStore({
        l1: memoryDriver({ maxItems: 100 }),
      })

      await store.set(
        'short-ttl',
        CacheEntry.create('value', { staleTime: 100, gcTime: 200 }),
      )

      expect((await store.get('short-ttl')).entry?.value).toBe('value')

      await sleep(250)

      expect((await store.get('short-ttl')).entry).toBeUndefined()
    })

    it('returns stale entries during grace period', async () => {
      const store = new TieredStore({
        l1: memoryDriver({ maxItems: 100 }),
      })

      await store.set(
        'stale-key',
        CacheEntry.create('value', { staleTime: 50, gcTime: 250 }),
      )

      await sleep(100)

      const result = await store.get('stale-key')

      expect(result.entry?.value).toBe('value')
      expect(result.graced).toBe(true)
    })

    it('handles mixed TTLs correctly', async () => {
      const store = new TieredStore({
        l1: memoryDriver({ maxItems: 100 }),
      })

      await store.set('short', CacheEntry.create('short', { staleTime: 50, gcTime: 100 }))
      await store.set('medium', CacheEntry.create('medium', { staleTime: 200, gcTime: 400 }))
      await store.set('long', CacheEntry.create('long', { staleTime: 500, gcTime: 1000 }))

      await sleep(150)

      expect((await store.get('short')).entry).toBeUndefined()
      expect((await store.get('medium')).entry?.value).toBe('medium')
      expect((await store.get('long')).entry?.value).toBe('long')

      await sleep(300)

      expect((await store.get('medium')).entry).toBeUndefined()
      expect((await store.get('long')).entry?.value).toBe('long')
    })
  })


  describe('mass expiration', () => {
    it('handles bulk expiration without blocking', async () => {
      const store = new TieredStore({
        l1: memoryDriver({ maxItems: 1000 }),
      })

      for (let i = 0; i < 100; i++) {
        await store.set(
          `expire-${i}`,
          CacheEntry.create(`value-${i}`, { staleTime: 50, gcTime: 50 }),
        )
      }

      await sleep(100)

      for (let i = 0; i < 100; i++) {
        const result = await store.get(`expire-${i}`)
        expect(result.entry).toBeUndefined()
      }
    })

    it('new writes work after mass expiration', async () => {
      const store = new TieredStore({
        l1: memoryDriver({ maxItems: 100 }),
      })

      for (let i = 0; i < 50; i++) {
        await store.set(
          `old-${i}`,
          CacheEntry.create(`old-${i}`, { staleTime: 50, gcTime: 50 }),
        )
      }

      await sleep(100)

      for (let i = 0; i < 50; i++) {
        await store.set(`new-${i}`, CacheEntry.create(`new-${i}`, { staleTime: 60_000 }))
      }

      for (let i = 0; i < 50; i++) {
        expect((await store.get(`new-${i}`)).entry?.value).toBe(`new-${i}`)
      }
    })
  })


  describe('SWR under memory pressure', () => {
    it('background refresh works under memory pressure', async () => {
      const cache = createCache({
        l1: memoryDriver({ maxItems: 10 }),
      })

      let refreshCount = 0
      const factory = async () => {
        refreshCount++
        await sleep(20)
        return `value-${refreshCount}`
      }

      const initialValue = await cache.getOrSet('swr-key', factory, { staleTime: 50, gcTime: 500 })
      expect(initialValue).toBe('value-1')
      expect(refreshCount).toBe(1)

      await sleep(100)

      const staleResult = await cache.getOrSet('swr-key', factory, {
        staleTime: 50,
        gcTime: 500,
        timeout: 0,
      })

      expect(staleResult).toBe('value-1')

      await sleep(50)

      expect(refreshCount).toBe(2)

      const freshResult = await cache.getOrSet('swr-key', factory, { staleTime: 50, gcTime: 500 })
      expect(freshResult).toBe('value-2')
    })
  })


  describe('edge cases', () => {
    it('handles zero-TTL entries', async () => {
      const store = new TieredStore({
        l1: memoryDriver({ maxItems: 100 }),
      })

      await store.set('zero-ttl', CacheEntry.create('value', { staleTime: 0, gcTime: 0 }))

      expect((await store.get('zero-ttl')).entry).toBeUndefined()
    })

    it('handles very long TTL entries', async () => {
      const store = new TieredStore({
        l1: memoryDriver({ maxItems: 100 }),
      })

      await store.set(
        'long-ttl',
        CacheEntry.create('value', { staleTime: 60 * 60 * 1000 }),
      )

      expect((await store.get('long-ttl')).entry?.value).toBe('value')
    })

    it('handles maxItems of 1', async () => {
      const store = new TieredStore({
        l1: memoryDriver({ maxItems: 1 }),
      })

      await store.set('a', CacheEntry.create('a', { staleTime: 60_000 }))
      await store.set('b', CacheEntry.create('b', { staleTime: 60_000 }))

      expect((await store.get('a')).entry).toBeUndefined()
      expect((await store.get('b')).entry?.value).toBe('b')
    })
  })
})
