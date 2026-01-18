import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis'

import { RedisDriver } from '@/storage/drivers/redis'
import { CacheEntry } from '@/entry'
import { sleep } from '../../support/time'
import { isDockerAvailable } from '../../support/testcontainers'

const DOCKER_AVAILABLE = isDockerAvailable()

describe.skipIf(!DOCKER_AVAILABLE)('RedisDriver Integration', () => {
  let container: StartedRedisContainer
  let driver: RedisDriver

  beforeAll(async () => {
    container = await new RedisContainer('redis:7-alpine').start()
    const url = container.getConnectionUrl()

    driver = new RedisDriver({ url })
    await driver.connect()
  }, 10_000)

  afterAll(async () => {
    if (driver) {
      await driver.disconnect()
    }
    // Add a small delay to ensure all connections are closed
    await new Promise((resolve) => setTimeout(resolve, 100))
    if (container) {
      await container.stop()
    }
  }, 10_000)

  beforeEach(async () => {
    await driver.clear()
  })

  describe('Redis-specific behavior', () => {
    it('stores entry with TTL in Redis', async () => {
      const entry = CacheEntry.create('value', { staleTime: 60_000 })

      await driver.set('key', entry)

      const ttl = await getRedisTTL('key')
      expect(ttl).toBeGreaterThan(0)
      expect(ttl).toBeLessThanOrEqual(entry.gcAt - entry.createdAt)
    })

    it('entry expires after gcAt', async () => {
      const entry = CacheEntry.create('value', { staleTime: 50, gcTime: 100 })

      await driver.set('key', entry)

      await sleep(150)

      const result = await driver.get('key')
      expect(result).toBeUndefined()
    })

    it('handles concurrent writes', async () => {
      const writes = Array.from({ length: 100 }, (_, i) =>
        driver.set(`concurrent:${i}`, CacheEntry.create(`value-${i}`, { staleTime: 60_000 })),
      )

      await Promise.all(writes)

      const reads = await driver.getMany(Array.from({ length: 100 }, (_, i) => `concurrent:${i}`))

      expect(reads.size).toBe(100)
    })

    it('handles large values', async () => {
      const largeValue = 'x'.repeat(1_000_000) // 1MB string
      const entry = CacheEntry.create(largeValue, { staleTime: 60_000 })

      await driver.set('large', entry)

      const result = await driver.get('large')
      expect(result?.value).toBe(largeValue)
    })

    it('handles complex nested objects', async () => {
      const complexValue = {
        users: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          name: `User ${i}`,
          metadata: { created: new Date().toISOString(), tags: ['a', 'b', 'c'] },
        })),
        config: {
          nested: { deeply: { value: true } },
        },
      }
      const entry = CacheEntry.create(complexValue, { staleTime: 60_000 })

      await driver.set('complex', entry)

      const result = await driver.get('complex')
      expect(result?.value).toEqual(complexValue)
    })

    it('deleteMany removes multiple keys atomically', async () => {
      await Promise.all([
        driver.set('del:1', CacheEntry.create('v1', { staleTime: 60_000 })),
        driver.set('del:2', CacheEntry.create('v2', { staleTime: 60_000 })),
        driver.set('del:3', CacheEntry.create('v3', { staleTime: 60_000 })),
      ])

      const count = await driver.deleteMany(['del:1', 'del:2', 'del:3', 'del:missing'])

      expect(count).toBe(3)
      expect(await driver.has('del:1')).toBe(false)
      expect(await driver.has('del:2')).toBe(false)
      expect(await driver.has('del:3')).toBe(false)
    })

    it('getMany returns only existing entries', async () => {
      await driver.set('exists:1', CacheEntry.create('v1', { staleTime: 60_000 }))
      await driver.set('exists:2', CacheEntry.create('v2', { staleTime: 60_000 }))

      const results = await driver.getMany(['exists:1', 'exists:2', 'missing'])

      expect(results.size).toBe(2)
      expect(results.get('exists:1')?.value).toBe('v1')
      expect(results.get('exists:2')?.value).toBe('v2')
      expect(results.has('missing')).toBe(false)
    })
  })

  describe('connection handling', () => {
    it('throws when operating without connection', async () => {
      const disconnected = new RedisDriver({ url: container.getConnectionUrl() })

      await expect(disconnected.get('key')).rejects.toThrow('not connected')
    })

    it('reconnects after disconnect', async () => {
      const tempDriver = new RedisDriver({ url: container.getConnectionUrl() })
      try {
        await tempDriver.connect()
        await tempDriver.set('reconnect-test', CacheEntry.create('value', { staleTime: 60_000 }))

        await tempDriver.disconnect()
        await tempDriver.connect()

        const result = await tempDriver.get('reconnect-test')
        expect(result?.value).toBe('value')
      } finally {
        await tempDriver.disconnect()
      }
    })

    it('handles multiple connect calls (idempotent)', async () => {
      const tempDriver = new RedisDriver({ url: container.getConnectionUrl() })

      try {
        await tempDriver.connect()
        await tempDriver.connect() // Should not throw

        await tempDriver.set('key', CacheEntry.create('value', { staleTime: 60_000 }))
        expect(await tempDriver.get('key')).toBeDefined()
      } finally {
        await tempDriver.disconnect()
      }
    })
  })

  async function getRedisTTL(key: string): Promise<number> {
    // Execute redis-cli PTTL command inside the container
    const result = await container.exec(['redis-cli', 'PTTL', key])
    return parseInt(result.output.trim(), 10)
  }
})
