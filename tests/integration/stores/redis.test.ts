import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { GenericContainer, type StartedTestContainer } from 'testcontainers'
import { RedisStore, redisStore, CacheEntry } from '@/index'
import { runAsyncStoreContract } from '../../support/store-contract'
import { isDockerAvailable } from '@test/docker'

function createEntry(value: unknown, staleTime = 60000): CacheEntry {
  return CacheEntry.create(value, { staleTime })
}

const dockerAvailable = isDockerAvailable()

describe.skipIf(!dockerAvailable)('RedisStore', () => {
  let container: StartedTestContainer
  let redisUrl: string

  beforeAll(async () => {
    container = await new GenericContainer('redis:7-alpine').withExposedPorts(6379).start()

    redisUrl = `redis://${container.getHost()}:${container.getMappedPort(6379)}`
  }, 60000)

  afterAll(async () => {
    await container?.stop()
  })

  // Run contract tests
  runAsyncStoreContract('RedisStore', () => new RedisStore({ url: redisUrl }), {
    skipLifecycle: false,
  })

  describe('RedisStore specifics', () => {
    let store: RedisStore

    beforeEach(async () => {
      store = new RedisStore({ url: redisUrl })
      await store.connect()
      await store.clear()
    })

    afterEach(async () => {
      await store?.disconnect()
    })

    it('can be created with factory function', () => {
      const s = redisStore({ url: redisUrl })
      expect(s).toBeInstanceOf(RedisStore)
    })

    it('has correct name', () => {
      expect(store.name).toBe('redis')
    })

    it('throws when not connected', async () => {
      const disconnected = new RedisStore({ url: redisUrl })
      await expect(disconnected.get('key')).rejects.toThrow('not connected')
    })

    it('serializes complex objects', async () => {
      const entry = createEntry({ nested: { data: [1, 2, 3] } })
      await store.set('key', entry)

      const result = await store.get('key')
      expect(result?.value).toEqual({ nested: { data: [1, 2, 3] } })
    })

    it('deletes multiple keys', async () => {
      await store.set('batch:1', createEntry(1))
      await store.set('batch:2', createEntry(2))
      await store.set('batch:3', createEntry(3))

      const deleted = await store.delete('batch:1', 'batch:3')
      expect(deleted).toBe(2)

      expect(await store.get('batch:2')).toBeDefined()
      expect(await store.get('batch:1')).toBeUndefined()
    })

    it('respects gcTime from entry', async () => {
      const entry = CacheEntry.create('short-lived', { staleTime: 50, gcTime: 100 })
      await store.set('gc-key', entry)

      expect(await store.get('gc-key')).toBeDefined()

      // Wait for gcTime + buffer
      await new Promise((r) => setTimeout(r, 200))

      expect(await store.get('gc-key')).toBeUndefined()
    })
  })
})
