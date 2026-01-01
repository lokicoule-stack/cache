import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest'
import { GenericContainer, type StartedTestContainer } from 'testcontainers'

import { createCache, MemoryStore, RedisStore, CacheEntry } from '@/index'
import { FakeL1Store, FakeL2Store } from '@test/fake-store'
import { isDockerAvailable } from '@test/docker'

const dockerAvailable = isDockerAvailable()

describe('tiered cache', () => {
  describe('with memory L2', () => {
    let local: FakeL1Store
    let remote: FakeL2Store

    beforeEach(async () => {
      local = new FakeL1Store()
      remote = new FakeL2Store()
      await remote.connect()
    })

    it('returns from L1 without checking L2', async () => {
      const cache = createCache({ local, remotes: [remote], staleTime: '1m' })

      // Put in L1 only
      local.set('key', CacheEntry.create('l1-value', { staleTime: 60000 }))

      const result = await cache.get('key')

      expect(result).toBe('l1-value')
      expect(remote.size).toBe(0) // L2 never touched
    })

    it('falls through to L2 on L1 miss', async () => {
      const cache = createCache({ local, remotes: [remote], staleTime: '1m' })

      // Put in L2 only
      await remote.set('key', CacheEntry.create('l2-value', { staleTime: 60000 }))

      const result = await cache.get('key')

      expect(result).toBe('l2-value')
    })

    it('backfills L1 from L2 hit', async () => {
      const cache = createCache({ local, remotes: [remote], staleTime: '1m' })

      // Put in L2 only
      await remote.set('key', CacheEntry.create('l2-value', { staleTime: 60000 }))
      expect(local.size).toBe(0)

      await cache.get('key')

      expect(local.get('key')?.value).toBe('l2-value')
    })

    it('set writes to both L1 and L2', async () => {
      const cache = createCache({ local, remotes: [remote], staleTime: '1m' })

      await cache.set('key', 'value')

      expect(local.get('key')?.value).toBe('value')
      expect((await remote.get('key'))?.value).toBe('value')
    })

    it('delete removes from both L1 and L2', async () => {
      const cache = createCache({ local, remotes: [remote], staleTime: '1m' })

      await cache.set('key', 'value')
      await cache.delete('key')

      expect(local.get('key')).toBeUndefined()
      expect(await remote.get('key')).toBeUndefined()
    })

    it('namespace prefixes keys in both tiers', async () => {
      const cache = createCache({ local, remotes: [remote], staleTime: '1m' })
      const users = cache.namespace('users')

      await users.set('1', 'alice')

      expect(local.keys()).toContain('users:1')
      expect(remote.keys()).toContain('users:1')
    })
  })

  describe.skipIf(!dockerAvailable)('with Redis L2', () => {
    let container: StartedTestContainer
    let redisUrl: string
    let local: MemoryStore
    let remote: RedisStore

    beforeAll(async () => {
      container = await new GenericContainer('redis:7-alpine').withExposedPorts(6379).start()
      redisUrl = `redis://${container.getHost()}:${container.getMappedPort(6379)}`
    }, 60000)

    afterAll(async () => {
      await remote?.disconnect()
      await container?.stop()
    })

    beforeEach(async () => {
      local = new MemoryStore()
      remote = new RedisStore({ url: redisUrl })
      await remote.connect()
      await remote.clear()
      local.clear()
    })

    afterEach(async () => {
      await remote?.disconnect()
    })

    it('returns from L1 without checking Redis', async () => {
      const cache = createCache({ local, remotes: [remote], staleTime: '1m' })

      local.set('key', CacheEntry.create('l1-value', { staleTime: 60000 }))

      const result = await cache.get('key')

      expect(result).toBe('l1-value')
    })

    it('falls through to Redis on L1 miss', async () => {
      const cache = createCache({ local, remotes: [remote], staleTime: '1m' })

      await remote.set('key', CacheEntry.create('redis-value', { staleTime: 60000 }))

      const result = await cache.get('key')

      expect(result).toBe('redis-value')
    })

    it('backfills L1 from Redis hit', async () => {
      const cache = createCache({ local, remotes: [remote], staleTime: '1m' })

      await remote.set('key', CacheEntry.create('redis-value', { staleTime: 60000 }))

      await cache.get('key')

      expect(local.get('key')?.value).toBe('redis-value')
    })

    it('set writes to both L1 and Redis', async () => {
      const cache = createCache({ local, remotes: [remote], staleTime: '1m' })

      await cache.set('key', 'value')

      expect(local.get('key')?.value).toBe('value')
      expect((await remote.get('key'))?.value).toBe('value')
    })

    it('delete removes from both L1 and Redis', async () => {
      const cache = createCache({ local, remotes: [remote], staleTime: '1m' })

      await cache.set('key', 'value')
      await cache.delete('key')

      expect(local.get('key')).toBeUndefined()
      expect(await remote.get('key')).toBeUndefined()
    })
  })
})
