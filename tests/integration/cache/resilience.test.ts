import { describe, it, expect, beforeEach } from 'vitest'

import { createCache, CacheEntry } from '@/index'
import { FakeL1Store, FakeL2Store } from '@test/fake-store'

describe('circuit breaker resilience', () => {
  let local: FakeL1Store
  let remote: FakeL2Store

  beforeEach(async () => {
    local = new FakeL1Store()
    remote = new FakeL2Store()
    await remote.connect()
  })

  it('opens circuit after L2 failure', async () => {
    const cache = createCache({
      local,
      remotes: [remote],
      staleTime: '1m',
      circuitBreakerDuration: 100,
    })

    // Seed L2 with data
    await remote.set('key', CacheEntry.create('remote-value', { staleTime: 60000 }))

    // Simulate failure
    remote.simulateFailure(true)

    // This should trigger circuit open
    await cache.get('key')

    // Restore L2
    remote.simulateFailure(false)

    // Circuit is open: should not find value even though it's in L2
    const result = await cache.get('key')

    expect(result).toBeUndefined()
  })

  it('uses L1 only during open circuit', async () => {
    const cache = createCache({
      local,
      remotes: [remote],
      staleTime: '1m',
      circuitBreakerDuration: 100,
    })

    // Put value in L1
    local.set('key', CacheEntry.create('local-value', { staleTime: 60000 }))

    // Put different value in L2
    await remote.set('key', CacheEntry.create('remote-value', { staleTime: 60000 }))

    // Trigger circuit open
    remote.simulateFailure(true)
    await cache.get('other-key')
    remote.simulateFailure(false)

    // Should get L1 value (circuit open, L2 skipped)
    const result = await cache.get('key')

    expect(result).toBe('local-value')
  })

  it('recovers after circuit break duration', async () => {
    const cache = createCache({
      local,
      remotes: [remote],
      staleTime: '1m',
      circuitBreakerDuration: 50, // Short duration for test
    })

    // Seed L2 only
    await remote.set('key', CacheEntry.create('remote-value', { staleTime: 60000 }))

    // Trigger circuit open
    remote.simulateFailure(true)
    await cache.get('key')
    remote.simulateFailure(false)

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
      local,
      remotes: [remote],
      staleTime: '1m',
      circuitBreakerDuration: 50,
    })

    // Seed L2 only
    await remote.set('key', CacheEntry.create('remote-value', { staleTime: 60000 }))
    expect(local.size).toBe(0)

    // Trigger circuit open
    remote.simulateFailure(true)
    await cache.get('other')
    remote.simulateFailure(false)

    // Wait for recovery
    await new Promise((r) => setTimeout(r, 100))

    // Get from L2, should backfill L1
    await cache.get('key')

    expect(local.get('key')?.value).toBe('remote-value')
  })
})
