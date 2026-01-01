import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'
import { GenericContainer, type StartedTestContainer } from 'testcontainers'

import { createCache, MemoryDriver, RedisDriver, CacheEntry } from '@/index'
import { FakeL1Store, FakeL2Store } from '@test/fake-store'
import { isDockerAvailable } from '@test/docker'

const dockerAvailable = isDockerAvailable()

describe('tiered cache', () => {
  describe('with memory L2', () => {
    let l1: FakeL1Store
    let l2: FakeL2Store

    beforeEach(async () => {
      l1 = new FakeL1Store()
      l2 = new FakeL2Store()
      await l2.connect()
    })

    it('returns from L1 without checking L2', async () => {
      const cache = createCache({ l1, l2, staleTime: '1m' })

      // Put in L1 only
      l1.set('key', CacheEntry.create('l1-value', { staleTime: 60000 }))

      const result = await cache.get('key')

      expect(result).toBe('l1-value')
      expect(l2.size).toBe(0) // L2 never touched
    })

    it('falls through to L2 on L1 miss', async () => {
      const cache = createCache({ l1, l2, staleTime: '1m' })

      // Put in L2 only
      await l2.set('key', CacheEntry.create('l2-value', { staleTime: 60000 }))

      const result = await cache.get('key')

      expect(result).toBe('l2-value')
    })

    it('backfills L1 from L2 hit', async () => {
      const cache = createCache({ l1, l2, staleTime: '1m' })

      // Put in L2 only
      await l2.set('key', CacheEntry.create('l2-value', { staleTime: 60000 }))
      expect(l1.size).toBe(0)

      await cache.get('key')

      expect(l1.get('key')?.value).toBe('l2-value')
    })

    it('set writes to both L1 and L2', async () => {
      const cache = createCache({ l1, l2, staleTime: '1m' })

      await cache.set('key', 'value')

      expect(l1.get('key')?.value).toBe('value')
      expect((await l2.get('key'))?.value).toBe('value')
    })

    it('delete removes from both L1 and L2', async () => {
      const cache = createCache({ l1, l2, staleTime: '1m' })

      await cache.set('key', 'value')
      await cache.delete('key')

      expect(l1.get('key')).toBeUndefined()
      expect(await l2.get('key')).toBeUndefined()
    })

    it('namespace prefixes keys in both tiers', async () => {
      const cache = createCache({ l1, l2, staleTime: '1m' })
      const users = cache.namespace('users')

      await users.set('1', 'alice')

      expect(l1.keys()).toContain('users:1')
      expect(l2.keys()).toContain('users:1')
    })
  })

  describe.skipIf(!dockerAvailable)('with Redis L2', () => {
    let container: StartedTestContainer
    let redisUrl: string
    let l1: MemoryDriver
    let l2: RedisDriver

    beforeAll(async () => {
      container = await new GenericContainer('redis:7-alpine').withExposedPorts(6379).start()
      redisUrl = `redis://${container.getHost()}:${container.getMappedPort(6379)}`
    }, 60000)

    afterAll(async () => {
      await l2?.disconnect()
      await container?.stop()
    })

    beforeEach(async () => {
      l1 = new MemoryDriver()
      l2 = new RedisDriver({ url: redisUrl })
      await l2.connect()
      await l2.clear()
      l1.clear()
    })

    afterEach(async () => {
      await l2?.disconnect()
    })

    it('returns from L1 without checking Redis', async () => {
      const cache = createCache({ l1, l2, staleTime: '1m' })

      l1.set('key', CacheEntry.create('l1-value', { staleTime: 60000 }))

      const result = await cache.get('key')

      expect(result).toBe('l1-value')
    })

    it('falls through to Redis on L1 miss', async () => {
      const cache = createCache({ l1, l2, staleTime: '1m' })

      await l2.set('key', CacheEntry.create('redis-value', { staleTime: 60000 }))

      const result = await cache.get('key')

      expect(result).toBe('redis-value')
    })

    it('backfills L1 from Redis hit', async () => {
      const cache = createCache({ l1, l2, staleTime: '1m' })

      await l2.set('key', CacheEntry.create('redis-value', { staleTime: 60000 }))

      await cache.get('key')

      expect(l1.get('key')?.value).toBe('redis-value')
    })

    it('set writes to both L1 and Redis', async () => {
      const cache = createCache({ l1, l2, staleTime: '1m' })

      await cache.set('key', 'value')

      expect(l1.get('key')?.value).toBe('value')
      expect((await l2.get('key'))?.value).toBe('value')
    })

    it('delete removes from both L1 and Redis', async () => {
      const cache = createCache({ l1, l2, staleTime: '1m' })

      await cache.set('key', 'value')
      await cache.delete('key')

      expect(l1.get('key')).toBeUndefined()
      expect(await l2.get('key')).toBeUndefined()
    })
  })
})
