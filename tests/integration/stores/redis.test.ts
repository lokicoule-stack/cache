import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { GenericContainer, type StartedTestContainer } from 'testcontainers'
import { RedisDriver, redisDriver, CacheEntry } from '@/index'
import { runAsyncDriverContract } from '../../support/store-contract'
import { isDockerAvailable } from '@test/docker'

function createEntry(value: unknown, staleTime = 60000): CacheEntry {
  return CacheEntry.create(value, { staleTime })
}

const dockerAvailable = isDockerAvailable()

describe.skipIf(!dockerAvailable)('RedisDriver', () => {
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
  runAsyncDriverContract('RedisDriver', () => new RedisDriver({ url: redisUrl }), {
    skipLifecycle: false,
  })

  describe('RedisDriver specifics', () => {
    let driver: RedisDriver

    beforeEach(async () => {
      driver = new RedisDriver({ url: redisUrl })
      await driver.connect()
      await driver.clear()
    })

    afterEach(async () => {
      await driver?.disconnect()
    })

    it('can be created with factory function', () => {
      const d = redisDriver({ url: redisUrl })
      expect(d).toBeInstanceOf(RedisDriver)
    })

    it('has correct name', () => {
      expect(driver.name).toBe('redis')
    })

    it('throws when not connected', async () => {
      const disconnected = new RedisDriver({ url: redisUrl })
      await expect(disconnected.get('key')).rejects.toThrow('not connected')
    })

    it('serializes complex objects', async () => {
      const entry = createEntry({ nested: { data: [1, 2, 3] } })
      await driver.set('key', entry)

      const result = await driver.get('key')
      expect(result?.value).toEqual({ nested: { data: [1, 2, 3] } })
    })

    it('deleteMany removes multiple keys', async () => {
      await driver.set('batch:1', createEntry(1))
      await driver.set('batch:2', createEntry(2))
      await driver.set('batch:3', createEntry(3))

      const deleted = await driver.deleteMany(['batch:1', 'batch:3'])
      expect(deleted).toBe(2)

      expect(await driver.get('batch:2')).toBeDefined()
      expect(await driver.get('batch:1')).toBeUndefined()
    })

    it('respects gcTime from entry', async () => {
      const entry = CacheEntry.create('short-lived', { staleTime: 50, gcTime: 100 })
      await driver.set('gc-key', entry)

      expect(await driver.get('gc-key')).toBeDefined()

      // Wait for gcTime + buffer
      await new Promise((r) => setTimeout(r, 200))

      expect(await driver.get('gc-key')).toBeUndefined()
    })
  })
})
