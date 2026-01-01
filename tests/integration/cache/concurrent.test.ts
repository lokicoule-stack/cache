import { describe, it, expect, beforeEach, vi } from 'vitest'

import { createCache } from '@/index'
import { FakeL1Store, FakeL2Store } from '@test/fake-store'

describe('concurrent access', () => {
  let l1: FakeL1Store
  let l2: FakeL2Store

  beforeEach(async () => {
    l1 = new FakeL1Store()
    l2 = new FakeL2Store()
    await l2.connect()
  })

  it('deduplicates concurrent getOrSet for same key', async () => {
    const cache = createCache({ l1, l2, staleTime: '1m' })

    const loader = vi.fn().mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 50))
      return 'loaded-value'
    })

    const results = await Promise.all([
      cache.getOrSet('key', loader),
      cache.getOrSet('key', loader),
      cache.getOrSet('key', loader),
    ])

    expect(results).toEqual(['loaded-value', 'loaded-value', 'loaded-value'])
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('does not deduplicate different keys', async () => {
    const cache = createCache({ l1, staleTime: '1m' })

    const loader = vi.fn().mockResolvedValue('value')

    await Promise.all([
      cache.getOrSet('key-1', loader),
      cache.getOrSet('key-2', loader),
      cache.getOrSet('key-3', loader),
    ])

    expect(loader).toHaveBeenCalledTimes(3)
  })

  it('concurrent sets do not corrupt state', async () => {
    const cache = createCache({ l1, l2, staleTime: '1m' })

    await Promise.all(
      Array.from({ length: 100 }, (_, i) => cache.set(`key-${i}`, `value-${i}`)),
    )

    expect(l1.size).toBe(100)
    expect(l2.size).toBe(100)

    for (let i = 0; i < 100; i++) {
      expect(await cache.get(`key-${i}`)).toBe(`value-${i}`)
    }
  })

  it('concurrent deletes work correctly', async () => {
    const cache = createCache({ l1, l2, staleTime: '1m' })

    // Set up data
    await Promise.all(
      Array.from({ length: 50 }, (_, i) => cache.set(`key-${i}`, `value-${i}`)),
    )

    // Delete concurrently
    await Promise.all(
      Array.from({ length: 50 }, (_, i) => cache.delete(`key-${i}`)),
    )

    expect(l1.size).toBe(0)
    expect(l2.size).toBe(0)
  })

  it('clears pending dedup after loader completes', async () => {
    const cache = createCache({ l1, staleTime: '1m' })

    const loader1 = vi.fn().mockResolvedValue('first')
    const loader2 = vi.fn().mockResolvedValue('second')

    // First call
    await cache.getOrSet('key', loader1)
    expect(loader1).toHaveBeenCalledTimes(1)

    // Delete to clear cache
    await cache.delete('key')

    // Second call should use new loader
    const result = await cache.getOrSet('key', loader2)

    expect(result).toBe('second')
    expect(loader2).toHaveBeenCalledTimes(1)
  })
})
