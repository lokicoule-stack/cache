import { describe, it, expect, beforeEach } from 'vitest'

import { createCache, CacheEntry } from '@/index'
import { FakeL1Store, FakeL2Store } from '@test/fake-store'

describe('circuit breaker resilience', () => {
  let l1: FakeL1Store
  let l2: FakeL2Store

  beforeEach(async () => {
    l1 = new FakeL1Store()
    l2 = new FakeL2Store()
    await l2.connect()
  })

  it('opens circuit after L2 failure', async () => {
    const cache = createCache({
      l1,
      l2,
      staleTime: '1m',
      circuitBreakerDuration: 100,
    })

    // Seed L2 with data
    await l2.set('key', CacheEntry.create('remote-value', { staleTime: 60000 }))

    // Simulate failure
    l2.simulateFailure(true)

    // This should trigger circuit open
    await cache.get('key')

    // Restore L2
    l2.simulateFailure(false)

    // Circuit is open: should not find value even though it's in L2
    const result = await cache.get('key')

    expect(result).toBeUndefined()
  })

  it('uses L1 only during open circuit', async () => {
    const cache = createCache({
      l1,
      l2,
      staleTime: '1m',
      circuitBreakerDuration: 100,
    })

    // Put value in L1
    l1.set('key', CacheEntry.create('local-value', { staleTime: 60000 }))

    // Put different value in L2
    await l2.set('key', CacheEntry.create('remote-value', { staleTime: 60000 }))

    // Trigger circuit open
    l2.simulateFailure(true)
    await cache.get('other-key')
    l2.simulateFailure(false)

    // Should get L1 value (circuit open, L2 skipped)
    const result = await cache.get('key')

    expect(result).toBe('local-value')
  })

  it('recovers after circuit break duration', async () => {
    const cache = createCache({
      l1,
      l2,
      staleTime: '1m',
      circuitBreakerDuration: 50, // Short duration for test
    })

    // Seed L2 only
    await l2.set('key', CacheEntry.create('remote-value', { staleTime: 60000 }))

    // Trigger circuit open
    l2.simulateFailure(true)
    await cache.get('key')
    l2.simulateFailure(false)

    // Circuit open: can't reach L2
    expect(await cache.get('key')).toBeUndefined()

    // Wait for circuit to close
    await new Promise((r) => setTimeout(r, 100))

    // Should reach L2 now
    const result = await cache.get('key')

    expect(result).toBe('remote-value')
  })

  it('backfills L1 after circuit recovers', async () => {
    const cache = createCache({
      l1,
      l2,
      staleTime: '1m',
      circuitBreakerDuration: 50,
    })

    // Seed L2 only
    await l2.set('key', CacheEntry.create('remote-value', { staleTime: 60000 }))
    expect(l1.size).toBe(0)

    // Trigger circuit open
    l2.simulateFailure(true)
    await cache.get('other')
    l2.simulateFailure(false)

    // Wait for recovery
    await new Promise((r) => setTimeout(r, 100))

    // Get from L2, should backfill L1
    await cache.get('key')

    expect(l1.get('key')?.value).toBe('remote-value')
  })
})
