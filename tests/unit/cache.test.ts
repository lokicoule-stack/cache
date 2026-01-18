import { describe, it, expect, vi } from 'vitest'
import { createCache } from '@/cache'
import { createL1, createConnectedL2 } from '../support/factories/driver'
import { createLoader, createFailingLoader } from '../support/factories/loader'
import { setupTestTimers } from '../support/setup'
import { advanceTime } from '../support/time'

setupTestTimers()

describe('Cache - Basic Operations', () => {
  it.each([
    ['string', 'value'],
    ['number', 42],
    ['float', 3.14],
    ['boolean', true],
    ['null', null],
    ['array', [1, 2, 3]],
    ['object', { nested: { deep: true } }],
  ])('stores and retrieves %s values', async (_, value) => {
    const cache = createCache({ l1: createL1() })
    await cache.set('key', value)
    expect(await cache.get('key')).toEqual(value)
  })

  it('returns undefined for missing keys', async () => {
    const cache = createCache({ l1: createL1() })
    expect(await cache.get('missing')).toBeUndefined()
  })

  it('overwrites existing values', async () => {
    const cache = createCache({ l1: createL1() })
    await cache.set('key', 'first')
    await cache.set('key', 'second')
    expect(await cache.get('key')).toBe('second')
  })

  it('deletes entries', async () => {
    const cache = createCache({ l1: createL1() })
    await cache.set('key', 'value')
    const deleted = await cache.delete('key')
    expect(deleted).toBe(1)
    expect(await cache.get('key')).toBeUndefined()
  })

  it('deletes multiple entries', async () => {
    const cache = createCache({ l1: createL1() })
    await cache.set('a', 1)
    await cache.set('b', 2)
    await cache.set('c', 3)
    const deleted = await cache.delete('a', 'b')
    expect(deleted).toBe(2)
    expect(await cache.get('a')).toBeUndefined()
    expect(await cache.get('b')).toBeUndefined()
    expect(await cache.get('c')).toBe(3)
  })

  it('checks key existence', async () => {
    const cache = createCache({ l1: createL1() })
    expect(await cache.has('key')).toBe(false)
    await cache.set('key', 'value')
    expect(await cache.has('key')).toBe(true)
  })

  it('clears all entries', async () => {
    const cache = createCache({ l1: createL1() })
    await cache.set('a', 1)
    await cache.set('b', 2)
    await cache.clear()
    expect(await cache.get('a')).toBeUndefined()
    expect(await cache.get('b')).toBeUndefined()
  })
})

describe('Cache - Time-to-Live', () => {
  it('respects gcTime', async () => {
    const cache = createCache({ l1: createL1(), staleTime: 50, gcTime: 100 })
    await cache.set('key', 'value')

    advanceTime(75) // Past stale, before GC
    expect(await cache.get('key')).toBe('value')

    advanceTime(30) // Total 105ms - past GC
    expect(await cache.get('key')).toBeUndefined()
  })

  it('uses per-entry staleTime over default', async () => {
    const cache = createCache({ l1: createL1(), staleTime: 1000 })
    await cache.set('key', 'value', { staleTime: 50 })

    advanceTime(75)
    // Entry-specific staleTime (50ms) should be used
    const result = await cache.get('key')
    expect(result).toBe('value') // Stale but not GC'd yet
  })
})

describe('Cache - Clone Behavior', () => {
  it('returns reference by default', async () => {
    const cache = createCache({ l1: createL1() })
    const original = { nested: { value: 1 } }
    await cache.set('key', original)

    const retrieved = await cache.get<typeof original>('key')
    retrieved!.nested.value = 2

    expect((await cache.get<typeof original>('key'))!.nested.value).toBe(2)
  })

  it('returns deep clone when requested', async () => {
    const cache = createCache({ l1: createL1() })
    const original = { nested: { value: 1 } }
    await cache.set('key', original)

    const retrieved = await cache.get<typeof original>('key', { clone: true })
    retrieved!.nested.value = 2

    expect((await cache.get<typeof original>('key'))!.nested.value).toBe(1)
  })
})

describe('Cache - getOrSet', () => {
  it('calls loader on cache miss', async () => {
    const cache = createCache({ l1: createL1() })
    const loader = createLoader('loaded-value')

    const result = await cache.getOrSet('key', loader)

    expect(result).toBe('loaded-value')
    expect(loader).toHaveBeenCalledOnce()
  })

  it('returns cached value without calling loader', async () => {
    const cache = createCache({ l1: createL1() })
    await cache.set('key', 'cached')
    const loader = createLoader('loaded')

    const result = await cache.getOrSet('key', loader)

    expect(result).toBe('cached')
    expect(loader).not.toHaveBeenCalled()
  })

  it('passes AbortSignal to loader', async () => {
    const cache = createCache({ l1: createL1() })
    const loader = vi.fn((signal: AbortSignal) => {
      expect(signal).toBeInstanceOf(AbortSignal)
      return 'value'
    })

    await cache.getOrSet('key', loader)
    expect(loader).toHaveBeenCalledOnce()
  })

  it('forces fresh fetch when fresh: true', async () => {
    const cache = createCache({ l1: createL1() })
    await cache.set('key', 'stale')
    const loader = createLoader('fresh')

    const result = await cache.getOrSet('key', loader, { fresh: true })

    expect(result).toBe('fresh')
    expect(loader).toHaveBeenCalledOnce()
  })

  it('throws when loader fails', async () => {
    const cache = createCache({ l1: createL1() })
    const loader = createFailingLoader(new Error('Load failed'))

    await expect(cache.getOrSet('key', loader)).rejects.toThrow()
  })
})

describe('Cache - Stale-While-Revalidate', () => {
  it('calls loader when entry is stale', async () => {
    const cache = createCache({ l1: createL1(), staleTime: 100 })
    const loader = createLoader('fresh')

    await cache.set('key', 'original')
    advanceTime(150) // Past staleTime

    const result = await cache.getOrSet('key', loader)

    expect(result).toBe('fresh')
    expect(loader).toHaveBeenCalledOnce()
  })
})

describe('Cache - Tags', () => {
  it('invalidates entries by tags', async () => {
    const cache = createCache({ l1: createL1() })
    await cache.set('user:1', { name: 'Alice' }, { tags: ['users'] })
    await cache.set('user:2', { name: 'Bob' }, { tags: ['users'] })
    await cache.set('settings', { theme: 'dark' }, { tags: ['config'] })

    const deleted = await cache.invalidateTags(['users'])

    expect(deleted).toBe(2)
    expect(await cache.get('user:1')).toBeUndefined()
    expect(await cache.get('user:2')).toBeUndefined()
    expect(await cache.get('settings')).toEqual({ theme: 'dark' })
  })

  it('invalidates entries with multiple tags', async () => {
    const cache = createCache({ l1: createL1() })
    await cache.set('a', 1, { tags: ['tag1', 'tag2'] })
    await cache.set('b', 2, { tags: ['tag2'] })
    await cache.set('c', 3, { tags: ['tag3'] })

    await cache.invalidateTags(['tag2'])

    expect(await cache.get('a')).toBeUndefined()
    expect(await cache.get('b')).toBeUndefined()
    expect(await cache.get('c')).toBe(3)
  })
})

describe('Cache - Namespace', () => {
  it('creates isolated namespace', async () => {
    const cache = createCache({ l1: createL1() })
    const ns1 = cache.namespace('app1:')
    const ns2 = cache.namespace('app2:')

    await ns1.set('key', 'value1')
    await ns2.set('key', 'value2')

    expect(await ns1.get('key')).toBe('value1')
    expect(await ns2.get('key')).toBe('value2')
  })

  it('namespace does not affect parent', async () => {
    const cache = createCache({ l1: createL1() })
    const ns = cache.namespace('prefix:')

    await cache.set('key', 'parent')
    await ns.set('key', 'namespaced')

    expect(await cache.get('key')).toBe('parent')
    expect(await ns.get('key')).toBe('namespaced')
  })
})

describe('Cache - Pull (Get + Delete)', () => {
  it('returns and deletes value', async () => {
    const cache = createCache({ l1: createL1() })
    await cache.set('key', 'value')

    const pulled = await cache.pull('key')

    expect(pulled).toBe('value')
    expect(await cache.get('key')).toBeUndefined()
  })

  it('returns undefined for missing key', async () => {
    const cache = createCache({ l1: createL1() })
    expect(await cache.pull('missing')).toBeUndefined()
  })
})

describe('Cache - Lifecycle', () => {
  it('connects to drivers', async () => {
    const l2 = await createConnectedL2()
    const cache = createCache({ l1: createL1(), l2 })

    await cache.connect()
    // Should not throw
  })

  it('disconnects from drivers', async () => {
    const l2 = await createConnectedL2()
    const cache = createCache({ l1: createL1(), l2 })

    await cache.disconnect()
    // Should not throw
  })
})

describe('Cache - Concurrent Operations', () => {
  it('handles concurrent sets correctly', async () => {
    const cache = createCache({ l1: createL1() })

    await Promise.all([cache.set('a', 1), cache.set('b', 2), cache.set('c', 3)])

    expect(await cache.get('a')).toBe(1)
    expect(await cache.get('b')).toBe(2)
    expect(await cache.get('c')).toBe(3)
  })

  it('handles concurrent gets correctly', async () => {
    const cache = createCache({ l1: createL1() })
    await cache.set('key', 'value')

    const results = await Promise.all([cache.get('key'), cache.get('key'), cache.get('key')])

    expect(results).toEqual(['value', 'value', 'value'])
  })
})
