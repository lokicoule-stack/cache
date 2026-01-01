import { describe, it, expect, beforeEach, vi } from 'vitest'

import { createCache, CacheEntry } from '@/index'
import { FakeL1Store } from '@test/fake-store'

describe('stale-while-revalidate', () => {
  let l1: FakeL1Store

  beforeEach(() => {
    l1 = new FakeL1Store()
  })

  it('returns stale immediately with timeout: 0', async () => {
    const cache = createCache({ l1, staleTime: 50 })

    // Set value that will become stale quickly
    l1.set('key', CacheEntry.create('stale-value', { staleTime: 1, gcTime: 10000 }))
    await new Promise((r) => setTimeout(r, 10))

    const loader = vi.fn().mockImplementation(
      () => new Promise((r) => setTimeout(() => r('fresh-value'), 100)),
    )

    const result = await cache.getOrSet('key', loader, { timeout: 0 })

    expect(result).toBe('stale-value')
    expect(loader).toHaveBeenCalled()
  })

  it('loader executes in background with timeout: 0', async () => {
    const cache = createCache({ l1, staleTime: 50 })

    l1.set('key', CacheEntry.create('stale-value', { staleTime: 1, gcTime: 10000 }))
    await new Promise((r) => setTimeout(r, 10))

    let loaderCompleted = false
    const loader = vi.fn().mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 50))
      loaderCompleted = true
      return 'fresh-value'
    })

    await cache.getOrSet('key', loader, { timeout: 0 })

    expect(loaderCompleted).toBe(false)

    // Wait for loader to complete
    await new Promise((r) => setTimeout(r, 100))

    expect(loaderCompleted).toBe(true)
  })

  it('caches fresh value after background refresh', async () => {
    const cache = createCache({ l1, staleTime: 1000 })

    l1.set('key', CacheEntry.create('stale-value', { staleTime: 1, gcTime: 10000 }))
    await new Promise((r) => setTimeout(r, 10))

    let resolveLoader: (v: string) => void
    const loaderPromise = new Promise<string>((r) => {
      resolveLoader = r
    })
    const loader = vi.fn().mockImplementation(() => loaderPromise)

    await cache.getOrSet('key', loader, { timeout: 0 })

    // Resolve the background loader and wait for it to store
    resolveLoader!('fresh-value')
    await new Promise((r) => setTimeout(r, 50))

    // Next get should return fresh value without loader
    const loader2 = vi.fn().mockResolvedValue('should-not-call')
    const result = await cache.getOrSet('key', loader2)

    expect(result).toBe('fresh-value')
    expect(loader2).not.toHaveBeenCalled()
  })

  it('waits for loader with timeout > 0 if fast enough', async () => {
    const cache = createCache({ l1, staleTime: 50 })

    l1.set('key', CacheEntry.create('stale-value', { staleTime: 1, gcTime: 10000 }))
    await new Promise((r) => setTimeout(r, 10))

    const loader = vi.fn().mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 30))
      return 'fresh-value'
    })

    // Timeout long enough to wait for loader
    const result = await cache.getOrSet('key', loader, { timeout: 100 })

    expect(result).toBe('fresh-value')
  })

  it('returns stale when timeout exceeded', async () => {
    const cache = createCache({ l1, staleTime: 50 })

    l1.set('key', CacheEntry.create('stale-value', { staleTime: 1, gcTime: 10000 }))
    await new Promise((r) => setTimeout(r, 10))

    const loader = vi.fn().mockImplementation(
      () => new Promise((r) => setTimeout(() => r('fresh-value'), 200)),
    )

    // Short timeout
    const result = await cache.getOrSet('key', loader, { timeout: 10 })

    expect(result).toBe('stale-value')
  })

  it('waits for loader without timeout option', async () => {
    const cache = createCache({ l1, staleTime: 50 })

    l1.set('key', CacheEntry.create('stale-value', { staleTime: 1, gcTime: 10000 }))
    await new Promise((r) => setTimeout(r, 10))

    const loader = vi.fn().mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 30))
      return 'fresh-value'
    })

    // No timeout: waits for loader
    const result = await cache.getOrSet('key', loader)

    expect(result).toBe('fresh-value')
  })
})
