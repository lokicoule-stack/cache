import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { TieredStore } from '@/storage/tiered-store'
import { FakeL1Driver } from '../support/drivers/fake-l1'
import { FakeL2Driver } from '../support/drivers/fake-l2'
import { createEntry } from '../support/factories/entry'
import { advanceTime, freezeTime } from '../support/time'

describe('TieredStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('initialization', () => {
    it('creates store with L1 only', () => {
      const l1 = new FakeL1Driver()
      const store = new TieredStore({ l1 })

      expect(store.driverNames.l1).toBe('fake-l1')
      expect(store.driverNames.l2).toEqual([])
    })

    it('creates store with L2 only', () => {
      const l2 = new FakeL2Driver()
      const store = new TieredStore({ l2: [l2] })

      expect(store.driverNames.l1).toBeUndefined()
      expect(store.driverNames.l2).toEqual(['fake-l2'])
    })

    it('creates store with L1 and L2', () => {
      const l1 = new FakeL1Driver()
      const l2 = new FakeL2Driver()
      const store = new TieredStore({ l1, l2: [l2] })

      expect(store.driverNames.l1).toBe('fake-l1')
      expect(store.driverNames.l2).toEqual(['fake-l2'])
    })

    it('creates store with multiple L2 drivers', () => {
      const l1 = new FakeL1Driver()
      const redis = new FakeL2Driver({ name: 'redis' })
      const postgres = new FakeL2Driver({ name: 'postgres' })
      const store = new TieredStore({ l1, l2: [redis, postgres] })

      expect(store.driverNames.l2).toEqual(['redis', 'postgres'])
    })

    it('applies prefix', async () => {
      const l1 = new FakeL1Driver()
      const store = new TieredStore({ l1, prefix: 'myapp' })
      const entry = createEntry()

      await store.set('key', entry)

      expect(l1.keys()).toContain('myapp:key')
    })
  })

  describe('get()', () => {
    describe('L1 behavior', () => {
      it('returns entry from L1', async () => {
        const l1 = new FakeL1Driver()
        const store = new TieredStore({ l1 })
        const entry = createEntry({ value: 'l1-value' })

        await store.set('key', entry)

        const result = await store.get('key')

        expect(result.entry?.value).toBe('l1-value')
        expect(result.source).toBe('fake-l1')
      })

      it('returns undefined for missing key', async () => {
        const l1 = new FakeL1Driver()
        const store = new TieredStore({ l1 })

        const result = await store.get('missing')

        expect(result.entry).toBeUndefined()
      })

      it('filters out GC entries from L1', async () => {
        const l1 = new FakeL1Driver()
        const store = new TieredStore({ l1 })
        freezeTime()
        const entry = createEntry({ value: 'old', staleTime: 10, gcTime: 10 })

        await store.set('key', entry)
        advanceTime(20)

        const result = await store.get('key')

        expect(result.entry).toBeUndefined()
      })

      it('returns graced=true for stale L1 entries', async () => {
        const l1 = new FakeL1Driver()
        const store = new TieredStore({ l1 })
        freezeTime()
        const entry = createEntry({ value: 'stale', staleTime: 10, gcTime: 1000 })

        await store.set('key', entry)
        advanceTime(50)

        const result = await store.get('key')

        expect(result.graced).toBe(true)
      })
    })

    describe('L2 fallback', () => {
      it('falls back to L2 on L1 miss', async () => {
        const l1 = new FakeL1Driver()
        const l2 = new FakeL2Driver()
        const store = new TieredStore({ l1, l2: [l2] })
        const entry = createEntry({ value: 'l2-value' })

        await l2.set('key', entry)

        const result = await store.get('key')

        expect(result.entry?.value).toBe('l2-value')
        expect(result.source).toBe('fake-l2')
      })

      it('tries multiple L2 drivers in order', async () => {
        const l1 = new FakeL1Driver()
        const redis = new FakeL2Driver({ name: 'redis' })
        const postgres = new FakeL2Driver({ name: 'postgres' })
        const store = new TieredStore({ l1, l2: [redis, postgres] })
        const entry = createEntry({ value: 'postgres-value' })

        // Only set in postgres (second L2)
        await postgres.set('key', entry)

        const result = await store.get('key')

        expect(result.entry?.value).toBe('postgres-value')
        expect(result.source).toBe('postgres')
      })
    })

    describe('backfill', () => {
      it('backfills L1 from L2 hit', async () => {
        const l1 = new FakeL1Driver()
        const l2 = new FakeL2Driver()
        const store = new TieredStore({ l1, l2: [l2] })
        const entry = createEntry({ value: 'l2-value' })

        await l2.set('key', entry)

        await store.get('key')

        expect(l1.has('key')).toBe(true)
      })

      it('backfills earlier L2 layers', async () => {
        const redis = new FakeL2Driver({ name: 'redis' })
        const postgres = new FakeL2Driver({ name: 'postgres' })
        const store = new TieredStore({ l2: [redis, postgres] })
        const entry = createEntry({ value: 'postgres-value' })

        // Only in postgres
        await postgres.set('key', entry)

        await store.get('key')

        // Redis should be backfilled
        expect(redis.size).toBe(1)
      })
    })

    describe('with prefix', () => {
      it('applies prefix to key lookup', async () => {
        const l1 = new FakeL1Driver()
        const store = new TieredStore({ l1, prefix: 'users' })
        const entry = createEntry()

        await store.set('1', entry)

        const result = await store.get('1')

        expect(result.entry).toBeDefined()
        expect(l1.keys()).toContain('users:1')
      })
    })
  })

  describe('getMany()', () => {
    it('returns empty map for empty keys', async () => {
      const store = new TieredStore({})

      const result = await store.getMany([])

      expect(result.size).toBe(0)
    })

    it('returns all hits from L1', async () => {
      const l1 = new FakeL1Driver()
      const store = new TieredStore({ l1 })

      await store.set('a', createEntry({ value: 'a-value' }))
      await store.set('b', createEntry({ value: 'b-value' }))

      const result = await store.getMany(['a', 'b'])

      expect(result.size).toBe(2)
      expect(result.get('a')?.entry?.value).toBe('a-value')
      expect(result.get('b')?.entry?.value).toBe('b-value')
    })

    it('fills missing keys from L2', async () => {
      const l1 = new FakeL1Driver()
      const l2 = new FakeL2Driver()
      const store = new TieredStore({ l1, l2: [l2] })

      await store.set('a', createEntry({ value: 'a-value' }))
      await l2.set('b', createEntry({ value: 'b-from-l2' }))
      l1.deleteCalls.length = 0

      const result = await store.getMany(['a', 'b'])

      expect(result.size).toBe(2)
      expect(result.get('a')?.source).toBe('fake-l1')
      expect(result.get('b')?.source).toBe('fake-l2')
    })

    it('backfills L1 from L2 hits', async () => {
      const l1 = new FakeL1Driver()
      const l2 = new FakeL2Driver()
      const store = new TieredStore({ l1, l2: [l2] })

      await l2.set('key', createEntry({ value: 'l2-value' }))

      await store.getMany(['key'])

      expect(l1.has('key')).toBe(true)
    })
  })

  describe('set()', () => {
    it('writes to L1', async () => {
      const l1 = new FakeL1Driver()
      const store = new TieredStore({ l1 })
      const entry = createEntry()

      await store.set('key', entry)

      expect(l1.size).toBe(1)
    })

    it('writes to all L2 drivers', async () => {
      const redis = new FakeL2Driver({ name: 'redis' })
      const postgres = new FakeL2Driver({ name: 'postgres' })
      const store = new TieredStore({ l2: [redis, postgres] })
      const entry = createEntry()

      await store.set('key', entry)

      expect(redis.size).toBe(1)
      expect(postgres.size).toBe(1)
    })

    it('writes to both L1 and L2', async () => {
      const l1 = new FakeL1Driver()
      const l2 = new FakeL2Driver()
      const store = new TieredStore({ l1, l2: [l2] })
      const entry = createEntry()

      await store.set('key', entry)

      expect(l1.size).toBe(1)
      expect(l2.size).toBe(1)
    })

    it('applies prefix', async () => {
      const l1 = new FakeL1Driver()
      const store = new TieredStore({ l1, prefix: 'cache' })
      const entry = createEntry()

      await store.set('key', entry)

      expect(l1.keys()).toContain('cache:key')
    })

    it('registers tags', async () => {
      const l1 = new FakeL1Driver()
      const store = new TieredStore({ l1 })
      const entry = createEntry({ tags: ['users'] })

      await store.set('user:1', entry)

      const invalidated = await store.invalidateTags(['users'])

      expect(invalidated).toBeGreaterThan(0)
    })
  })

  // delete()

  describe('delete()', () => {
    it('returns 0 for empty keys', async () => {
      const store = new TieredStore({})

      const count = await store.delete()

      expect(count).toBe(0)
    })

    it('deletes from L1', async () => {
      const l1 = new FakeL1Driver()
      const store = new TieredStore({ l1 })

      await store.set('key', createEntry())
      await store.delete('key')

      expect(l1.has('key')).toBe(false)
    })

    it('deletes from all L2 drivers', async () => {
      const redis = new FakeL2Driver({ name: 'redis' })
      const postgres = new FakeL2Driver({ name: 'postgres' })
      const store = new TieredStore({ l2: [redis, postgres] })

      await store.set('key', createEntry())
      await store.delete('key')

      expect(redis.size).toBe(0)
      expect(postgres.size).toBe(0)
    })

    it('returns max deletion count', async () => {
      const l1 = new FakeL1Driver()
      const l2 = new FakeL2Driver()
      const store = new TieredStore({ l1, l2: [l2] })

      await store.set('a', createEntry())
      await store.set('b', createEntry())

      const count = await store.delete('a', 'b')

      expect(count).toBe(2)
    })

    it('unregisters tags', async () => {
      const l1 = new FakeL1Driver()
      const store = new TieredStore({ l1 })

      await store.set('user:1', createEntry({ tags: ['users'] }))
      await store.delete('user:1')

      const invalidated = await store.invalidateTags(['users'])

      expect(invalidated).toBe(0)
    })
  })

  describe('has()', () => {
    it('returns true if in L1', async () => {
      const l1 = new FakeL1Driver()
      const store = new TieredStore({ l1 })

      await store.set('key', createEntry())

      expect(await store.has('key')).toBe(true)
    })

    it('returns true if in L2', async () => {
      const l2 = new FakeL2Driver()
      const store = new TieredStore({ l2: [l2] })

      await l2.set('key', createEntry())

      expect(await store.has('key')).toBe(true)
    })

    it('returns false for missing key', async () => {
      const store = new TieredStore({})

      expect(await store.has('missing')).toBe(false)
    })

    it('checks L1 before L2', async () => {
      const l1 = new FakeL1Driver()
      const l2 = new FakeL2Driver()
      const store = new TieredStore({ l1, l2: [l2] })

      await store.set('key', createEntry())

      const result = await store.has('key')

      expect(result).toBe(true)
      expect(l2.getCalls).toHaveLength(0) // Should not query L2
    })
  })

  describe('clear()', () => {
    it('clears L1', async () => {
      const l1 = new FakeL1Driver()
      const store = new TieredStore({ l1 })

      await store.set('a', createEntry())
      await store.set('b', createEntry())
      await store.clear()

      expect(l1.size).toBe(0)
    })

    it('clears all L2 drivers', async () => {
      const redis = new FakeL2Driver({ name: 'redis' })
      const postgres = new FakeL2Driver({ name: 'postgres' })
      const store = new TieredStore({ l2: [redis, postgres] })

      await store.set('key', createEntry())
      await store.clear()

      expect(redis.size).toBe(0)
      expect(postgres.size).toBe(0)
    })

    it('clears tag index', async () => {
      const l1 = new FakeL1Driver()
      const store = new TieredStore({ l1 })

      await store.set('user:1', createEntry({ tags: ['users'] }))
      await store.clear()
      await store.set('user:2', createEntry({ tags: ['other'] }))

      const invalidated = await store.invalidateTags(['users'])

      expect(invalidated).toBe(0)
    })
  })

  describe('invalidateTags()', () => {
    it('deletes entries with matching tags', async () => {
      const l1 = new FakeL1Driver()
      const store = new TieredStore({ l1 })

      await store.set('user:1', createEntry({ tags: ['users'] }))
      await store.set('user:2', createEntry({ tags: ['users'] }))
      await store.set('post:1', createEntry({ tags: ['posts'] }))

      await store.invalidateTags(['users'])

      expect(l1.has('user:1')).toBe(false)
      expect(l1.has('user:2')).toBe(false)
      expect(l1.has('post:1')).toBe(true)
    })

    it('returns count of invalidated entries', async () => {
      const l1 = new FakeL1Driver()
      const store = new TieredStore({ l1 })

      await store.set('user:1', createEntry({ tags: ['users'] }))
      await store.set('user:2', createEntry({ tags: ['users'] }))

      const count = await store.invalidateTags(['users'])

      expect(count).toBe(2)
    })

    it('returns 0 when no tags match', async () => {
      const l1 = new FakeL1Driver()
      const store = new TieredStore({ l1 })

      await store.set('user:1', createEntry({ tags: ['users'] }))

      const count = await store.invalidateTags(['nonexistent'])

      expect(count).toBe(0)
    })

    it('invalidates from all L2 drivers', async () => {
      const l1 = new FakeL1Driver()
      const redis = new FakeL2Driver({ name: 'redis' })
      const store = new TieredStore({ l1, l2: [redis] })

      await store.set('user:1', createEntry({ tags: ['users'] }))

      await store.invalidateTags(['users'])

      expect(l1.size).toBe(0)
      expect(redis.size).toBe(0)
    })
  })

  describe('invalidateL1()', () => {
    it('removes keys from L1 only', async () => {
      const l1 = new FakeL1Driver()
      const l2 = new FakeL2Driver()
      const store = new TieredStore({ l1, l2: [l2] })

      await store.set('key', createEntry())

      store.invalidateL1('key')

      expect(l1.has('key')).toBe(false)
      expect(l2.size).toBe(1) // L2 untouched
    })

    it('handles empty keys', () => {
      const l1 = new FakeL1Driver()
      const store = new TieredStore({ l1 })

      // Should not throw
      store.invalidateL1()

      expect(l1.size).toBe(0)
    })

    it('handles missing L1', () => {
      const store = new TieredStore({})

      // Should not throw
      store.invalidateL1('key')
    })

    it('applies prefix', async () => {
      const l1 = new FakeL1Driver()
      const store = new TieredStore({ l1, prefix: 'cache' })

      await store.set('key', createEntry())

      store.invalidateL1('key')

      expect(l1.has('cache:key')).toBe(false)
    })
  })

  describe('clearL1()', () => {
    it('clears L1 only', async () => {
      const l1 = new FakeL1Driver()
      const l2 = new FakeL2Driver()
      const store = new TieredStore({ l1, l2: [l2] })

      await store.set('key', createEntry())

      store.clearL1()

      expect(l1.size).toBe(0)
      expect(l2.size).toBe(1) // L2 untouched
    })

    it('handles missing L1', () => {
      const store = new TieredStore({})

      // Should not throw
      store.clearL1()
    })
  })

  describe('namespace()', () => {
    it('creates store with additional prefix', async () => {
      const l1 = new FakeL1Driver()
      const store = new TieredStore({ l1 })
      const namespaced = store.namespace('users')

      await namespaced.set('1', createEntry())

      expect(l1.keys()).toContain('users:1')
    })

    it('combines with existing prefix', async () => {
      const l1 = new FakeL1Driver()
      const store = new TieredStore({ l1, prefix: 'cache' })
      const namespaced = store.namespace('users')

      await namespaced.set('1', createEntry())

      expect(l1.keys()).toContain('cache:users:1')
    })

    it('shares L1 driver', async () => {
      const l1 = new FakeL1Driver()
      const store = new TieredStore({ l1 })
      const namespaced = store.namespace('users')

      await store.set('global', createEntry())
      await namespaced.set('1', createEntry())

      expect(l1.size).toBe(2)
    })

    it('shares L2 drivers', async () => {
      const l2 = new FakeL2Driver()
      const store = new TieredStore({ l2: [l2] })
      const namespaced = store.namespace('users')

      await store.set('global', createEntry())
      await namespaced.set('1', createEntry())

      expect(l2.size).toBe(2)
    })
  })

  describe('circuit breaker', () => {
    it('opens after consecutive failures', async () => {
      const l2 = new FakeL2Driver()
      const store = new TieredStore({
        l2: [l2],
        circuitBreakerThreshold: 3,
        circuitBreakerDuration: 30_000,
      })

      l2.simulateFailure({ enabled: true })

      // Trigger failures
      for (let i = 0; i < 5; i++) {
        await store.get(`key${i}`)
      }

      l2.stopFailure()
      l2.setCalls.length = 0

      // Circuit should be open, L2 not called
      await store.set('test', createEntry())

      expect(l2.setCalls).toHaveLength(0)
    })

    it('closes after duration', async () => {
      const l2 = new FakeL2Driver()
      const store = new TieredStore({
        l2: [l2],
        circuitBreakerThreshold: 3,
        circuitBreakerDuration: 30_000,
      })

      l2.simulateFailure({ enabled: true })

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        await store.get(`key${i}`)
      }

      l2.stopFailure()

      // Wait for circuit to close
      advanceTime(31_000)

      const entry = createEntry({ value: 'test' })
      await store.set('after', entry)

      // Circuit should be closed, L2 should be called
      expect(l2.setCalls.length).toBeGreaterThan(0)
    })

    it('does not affect L1 operations', async () => {
      const l1 = new FakeL1Driver()
      const l2 = new FakeL2Driver()
      const store = new TieredStore({
        l1,
        l2: [l2],
        circuitBreakerThreshold: 3,
      })

      l2.simulateFailure({ enabled: true })

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        await store.set(`key${i}`, createEntry())
      }

      // L1 should still have entries
      expect(l1.size).toBe(5)
    })
  })

  describe('lifecycle', () => {
    describe('connect()', () => {
      it('connects all L2 drivers', async () => {
        const redis = new FakeL2Driver({ name: 'redis' })
        const postgres = new FakeL2Driver({ name: 'postgres' })
        const store = new TieredStore({ l2: [redis, postgres] })

        await store.connect()

        expect(redis.isConnected).toBe(true)
        expect(postgres.isConnected).toBe(true)
      })
    })

    describe('disconnect()', () => {
      it('disconnects all L2 drivers', async () => {
        const redis = new FakeL2Driver({ name: 'redis' })
        const postgres = new FakeL2Driver({ name: 'postgres' })
        const store = new TieredStore({ l2: [redis, postgres] })

        await store.connect()
        await store.disconnect()

        expect(redis.isConnected).toBe(false)
        expect(postgres.isConnected).toBe(false)
      })
    })
  })

  describe('edge cases', () => {
    it('handles store with no drivers', async () => {
      const store = new TieredStore({})

      const result = await store.get('key')

      expect(result.entry).toBeUndefined()
    })

    it('handles concurrent operations', async () => {
      const l1 = new FakeL1Driver()
      const l2 = new FakeL2Driver()
      const store = new TieredStore({ l1, l2: [l2] })

      const operations = Array.from({ length: 100 }, (_, i) =>
        store.set(`key:${i}`, createEntry({ value: `value:${i}` })),
      )

      await Promise.all(operations)

      expect(l1.size).toBe(100)
      expect(l2.size).toBe(100)
    })

    it('handles partial L2 failures gracefully', async () => {
      const redis = new FakeL2Driver({ name: 'redis' })
      const postgres = new FakeL2Driver({ name: 'postgres' })
      const store = new TieredStore({ l2: [redis, postgres] })

      redis.simulateFailure({ enabled: true })
      const entry = createEntry({ value: 'test' })

      // Should not throw, postgres should succeed
      await store.set('key', entry)

      expect(postgres.size).toBe(1)
    })
  })
})
