import { describe, it, expect } from 'vitest'
import { createCacheManager } from '@/manager'
import { createConnectedL2 } from '../support/factories/driver'
import { createLoader } from '../support/factories/loader'
import { setupTestTimers } from '../support/setup'
import { advanceTime } from '../support/time'

setupTestTimers()

describe('CacheManager - Initialization', () => {
  it('creates manager with default memory store', async () => {
    const manager = createCacheManager()

    await manager.set('key', 'value')
    expect(await manager.get('key')).toBe('value')
  })

  it('creates manager with custom drivers', async () => {
    const redis = await createConnectedL2('redis')
    const manager = createCacheManager({
      drivers: { redis },
      stores: { main: ['redis'] },
    })

    await manager.set('key', 'value')
    expect(redis.size).toBe(1)
  })

  it('creates multiple stores', async () => {
    const redis = await createConnectedL2('redis')
    const postgres = await createConnectedL2('postgres')

    const manager = createCacheManager({
      drivers: { redis, postgres },
      stores: {
        sessions: ['redis'],
        analytics: ['postgres'],
      },
    })

    const sessions = manager.use('sessions')
    const analytics = manager.use('analytics')

    await sessions.set('session:1', { token: 'abc' })
    await analytics.set('event:1', { type: 'click' })

    expect(redis.size).toBe(1)
    expect(postgres.size).toBe(1)
  })
})

describe('CacheManager - Store Access', () => {
  it('returns default store when no name specified', () => {
    const manager = createCacheManager()
    const cache = manager.use()

    expect(cache).toBeDefined()
  })

  it('returns named store', async () => {
    const redis = await createConnectedL2('redis')
    const manager = createCacheManager({
      drivers: { redis },
      stores: { custom: ['redis'] },
    })

    const cache = manager.use('custom')
    expect(cache).toBeDefined()
  })

  it('throws when accessing non-existent store', () => {
    const manager = createCacheManager()

    expect(() => manager.use('nonexistent')).toThrow()
  })
})

describe('CacheManager - Basic Operations', () => {
  it.each([
    ['string', 'value'],
    ['number', 42],
    ['object', { nested: true }],
  ])('stores and retrieves %s values', async (_, value) => {
    const manager = createCacheManager()
    await manager.set('key', value)
    expect(await manager.get('key')).toEqual(value)
  })

  it('deletes entries', async () => {
    const manager = createCacheManager()
    await manager.set('key', 'value')

    const deleted = await manager.delete('key')

    expect(deleted).toBe(1)
    expect(await manager.get('key')).toBeUndefined()
  })

  it('checks key existence', async () => {
    const manager = createCacheManager()

    expect(await manager.has('key')).toBe(false)
    await manager.set('key', 'value')
    expect(await manager.has('key')).toBe(true)
  })

  it('clears all entries', async () => {
    const manager = createCacheManager()
    await manager.set('a', 1)
    await manager.set('b', 2)

    await manager.clear()

    expect(await manager.get('a')).toBeUndefined()
    expect(await manager.get('b')).toBeUndefined()
  })
})

describe('CacheManager - getOrSet', () => {
  it('calls loader on miss', async () => {
    const manager = createCacheManager()
    const loader = createLoader('loaded')

    const result = await manager.getOrSet('key', loader)

    expect(result).toBe('loaded')
    expect(loader).toHaveBeenCalledOnce()
  })

  it('returns cached value without calling loader', async () => {
    const manager = createCacheManager()
    await manager.set('key', 'cached')
    const loader = createLoader('loaded')

    const result = await manager.getOrSet('key', loader)

    expect(result).toBe('cached')
    expect(loader).not.toHaveBeenCalled()
  })

  it('forces fresh fetch when fresh: true', async () => {
    const manager = createCacheManager()
    await manager.set('key', 'stale')
    const loader = createLoader('fresh')

    const result = await manager.getOrSet('key', loader, { fresh: true })

    expect(result).toBe('fresh')
    expect(loader).toHaveBeenCalledOnce()
  })
})

describe('CacheManager - Tags', () => {
  it('invalidates entries by tags', async () => {
    const manager = createCacheManager()
    await manager.set('user:1', 'Alice', { tags: ['users'] })
    await manager.set('user:2', 'Bob', { tags: ['users'] })
    await manager.set('settings', 'dark', { tags: ['config'] })

    const deleted = await manager.invalidateTags(['users'])

    expect(deleted).toBe(2)
    expect(await manager.get('user:1')).toBeUndefined()
    expect(await manager.get('user:2')).toBeUndefined()
    expect(await manager.get('settings')).toBe('dark')
  })
})

describe('CacheManager - Time-to-Live', () => {
  it('respects global staleTime', async () => {
    const manager = createCacheManager({ staleTime: 100 })
    await manager.set('key', 'value')

    advanceTime(50)
    expect(await manager.get('key')).toBe('value')
  })

  it('respects gcTime', async () => {
    const manager = createCacheManager({ staleTime: 50, gcTime: 100 })
    await manager.set('key', 'value')

    advanceTime(75) // Past stale, before GC
    expect(await manager.get('key')).toBe('value')

    advanceTime(30) // Past GC
    expect(await manager.get('key')).toBeUndefined()
  })
})

describe('CacheManager - Lifecycle', () => {
  it('connects to all drivers', async () => {
    const redis = await createConnectedL2('redis')
    const manager = createCacheManager({
      drivers: { redis },
      stores: { main: ['redis'] },
    })

    await manager.connect()
    // Should not throw
  })

  it('disconnects from all drivers', async () => {
    const redis = await createConnectedL2('redis')
    const manager = createCacheManager({
      drivers: { redis },
      stores: { main: ['redis'] },
    })

    await manager.disconnect()
    // Should not throw
  })
})

describe('CacheManager - Multi-Store', () => {
  it('isolates stores from each other', async () => {
    const redis = await createConnectedL2('redis')
    const postgres = await createConnectedL2('postgres')

    const manager = createCacheManager({
      drivers: { redis, postgres },
      stores: {
        store1: ['redis'],
        store2: ['postgres'],
      },
    })

    const s1 = manager.use('store1')
    const s2 = manager.use('store2')

    await s1.set('key', 'value1')
    await s2.set('key', 'value2')

    expect(await s1.get('key')).toBe('value1')
    expect(await s2.get('key')).toBe('value2')
  })
})
