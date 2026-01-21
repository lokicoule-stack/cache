import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis'

import { TieredStore } from '@/storage/tiered-store'
import { memoryDriver } from '@/storage/drivers/memory'
import { RedisDriver } from '@/storage/drivers/redis'
import { CacheEntry } from '@/entry'
import { isDockerAvailable } from '../../support/testcontainers'

const DOCKER_AVAILABLE = isDockerAvailable()

describe.skipIf(!DOCKER_AVAILABLE)('TieredStore Integration', () => {
  let container: StartedRedisContainer
  let l2Driver: RedisDriver
  let store: TieredStore

  beforeAll(async () => {
    container = await new RedisContainer('redis:7-alpine').start()
    const url = container.getConnectionUrl()

    l2Driver = new RedisDriver({ url })
    await l2Driver.connect()
  }, 10_000)

  afterAll(async () => {
    if (l2Driver) {
      await l2Driver.disconnect()
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
    if (container) {
      await container.stop()
    }
  }, 10_000)

  beforeEach(async () => {
    vi.useRealTimers()
    await l2Driver.clear()
    store = new TieredStore({
      l1: memoryDriver({ maxSize: 1000 }),
      l2: [l2Driver],
    })
  }, 10_000)

  describe('write-through', () => {
    it('writes to both L1 and L2', async () => {
      const entry = CacheEntry.create('value', { staleTime: 60_000 })

      await store.set('key', entry)

      const l1Result = await store.get('key')
      expect(l1Result.entry?.value).toBe('value')
      expect(l1Result.source).toBe('memory')

      const l2Entry = await l2Driver.get('key')
      expect(l2Entry?.value).toBe('value')
    })

    it('delete removes from both L1 and L2', async () => {
      await store.set('key', CacheEntry.create('value', { staleTime: 60_000 }))

      await store.delete('key')

      const l1Result = await store.get('key')
      expect(l1Result.entry).toBeUndefined()

      const l2Entry = await l2Driver.get('key')
      expect(l2Entry).toBeUndefined()
    })

    it('clear removes from both layers', async () => {
      await store.set('a', CacheEntry.create('1', { staleTime: 60_000 }))
      await store.set('b', CacheEntry.create('2', { staleTime: 60_000 }))

      await store.clear()

      expect((await store.get('a')).entry).toBeUndefined()
      expect((await store.get('b')).entry).toBeUndefined()
      expect(await l2Driver.has('a')).toBe(false)
      expect(await l2Driver.has('b')).toBe(false)
    })
  })

  describe('backfill', () => {
    it('backfills L1 from L2 on cache miss', async () => {
      const entry = CacheEntry.create('from-l2', { staleTime: 60_000 })
      await l2Driver.set('backfill-key', entry)

      const result = await store.get('backfill-key')

      expect(result.entry?.value).toBe('from-l2')
      expect(result.source).toBe('redis')

      const secondResult = await store.get('backfill-key')
      expect(secondResult.source).toBe('memory')
    })

    it('does not backfill expired entries', async () => {
      const now = Date.now()
      vi.setSystemTime(now)

      try {
        const entry = CacheEntry.create('expired', { staleTime: 50, gcTime: 100 })
        await l2Driver.set('expired-key', entry)

        vi.setSystemTime(now + 150)

        const result = await store.get('expired-key')

        expect(result.entry).toBeUndefined()
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('namespace isolation', () => {
    it('namespaced stores have isolated keys', async () => {
      const ns1 = store.namespace('app1')
      const ns2 = store.namespace('app2')

      await ns1.set('key', CacheEntry.create('value1', { staleTime: 60_000 }))
      await ns2.set('key', CacheEntry.create('value2', { staleTime: 60_000 }))

      expect((await ns1.get('key')).entry?.value).toBe('value1')
      expect((await ns2.get('key')).entry?.value).toBe('value2')

      expect((await l2Driver.get('app1:key'))?.value).toBe('value1')
      expect((await l2Driver.get('app2:key'))?.value).toBe('value2')
    })

    it('nested namespaces work correctly', async () => {
      const nested = store.namespace('app').namespace('users')

      await nested.set('123', CacheEntry.create({ id: 123 }, { staleTime: 60_000 }))

      expect((await l2Driver.get('app:users:123'))?.value).toEqual({ id: 123 })
    })
  })

  describe('tag invalidation', () => {
    it('invalidates entries by tag across both layers', async () => {
      await store.set(
        'user:1',
        CacheEntry.create({ id: 1 }, { staleTime: 60_000, tags: ['users'] }),
      )
      await store.set(
        'user:2',
        CacheEntry.create({ id: 2 }, { staleTime: 60_000, tags: ['users'] }),
      )
      await store.set(
        'config',
        CacheEntry.create({ debug: true }, { staleTime: 60_000, tags: ['config'] }),
      )

      const count = await store.invalidateTags(['users'])

      expect(count).toBe(2)
      expect((await store.get('user:1')).entry).toBeUndefined()
      expect((await store.get('user:2')).entry).toBeUndefined()
      expect((await store.get('config')).entry?.value).toEqual({ debug: true })
    })

    it('invalidates multiple tags at once', async () => {
      await store.set('a', CacheEntry.create('a', { staleTime: 60_000, tags: ['tag1'] }))
      await store.set('b', CacheEntry.create('b', { staleTime: 60_000, tags: ['tag2'] }))
      await store.set('c', CacheEntry.create('c', { staleTime: 60_000, tags: ['tag1', 'tag2'] }))

      const count = await store.invalidateTags(['tag1', 'tag2'])

      expect(count).toBe(3)
    })
  })

  describe('batch operations', () => {
    it('getMany returns results from both layers', async () => {
      await store.set('l1l2:1', CacheEntry.create('both', { staleTime: 60_000 }))

      await l2Driver.set('l2only:1', CacheEntry.create('l2', { staleTime: 60_000 }))

      const results = await store.getMany(['l1l2:1', 'l2only:1', 'missing'])

      expect(results.size).toBe(2)
      expect(results.get('l1l2:1')?.source).toBe('memory')
      expect(results.get('l2only:1')?.source).toBe('redis')
      expect(results.has('missing')).toBe(false)
    })

    it('delete removes multiple keys', async () => {
      await store.set('del:1', CacheEntry.create('1', { staleTime: 60_000 }))
      await store.set('del:2', CacheEntry.create('2', { staleTime: 60_000 }))
      await store.set('keep', CacheEntry.create('keep', { staleTime: 60_000 }))

      const count = await store.delete('del:1', 'del:2')

      expect(count).toBe(2)
      expect((await store.get('del:1')).entry).toBeUndefined()
      expect((await store.get('del:2')).entry).toBeUndefined()
      expect((await store.get('keep')).entry?.value).toBe('keep')
    })
  })

  describe('stale entry handling', () => {
    it('returns graced flag for stale entries', async () => {
      const now = Date.now()
      vi.setSystemTime(now)

      try {
        const entry = CacheEntry.create('value', { staleTime: 1000, gcTime: 6000 })
        await store.set('stale-key', entry)

        vi.setSystemTime(now + 2000)

        const result = await store.get('stale-key')

        expect(result.entry?.value).toBe('value')
        expect(result.graced).toBe(true)
      } finally {
        vi.useRealTimers()
      }
    })
  })

  describe('performance', () => {
    it('handles 1000 concurrent operations', async () => {
      const operations: Promise<void>[] = []

      for (let i = 0; i < 1000; i++) {
        operations.push(
          store.set(`perf:${i}`, CacheEntry.create(`value-${i}`, { staleTime: 60_000 })),
        )
      }

      await Promise.all(operations)

      const samples = [0, 250, 500, 750, 999]
      for (const i of samples) {
        const result = await store.get(`perf:${i}`)
        expect(result.entry?.value).toBe(`value-${i}`)
      }
    }, 10_000)
  })
})
