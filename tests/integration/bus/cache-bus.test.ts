import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { MessageBus, MemoryTransport } from '@lokiverse/bus'
import { CacheManager, type CacheBusSchema } from '@/index'
import { FakeL1Store, FakeL2Store } from '@test/fake-store'

describe('cache bus integration', () => {
  let transport: MemoryTransport
  let bus1: MessageBus<CacheBusSchema>
  let bus2: MessageBus<CacheBusSchema>
  let manager1: CacheManager
  let manager2: CacheManager
  let local1: FakeL1Store
  let local2: FakeL1Store
  let remote: FakeL2Store

  beforeEach(async () => {
    // Shared transport for cross-instance communication
    transport = new MemoryTransport()

    // Two bus instances on same transport
    bus1 = new MessageBus<CacheBusSchema>({ transport })
    bus2 = new MessageBus<CacheBusSchema>({ transport })

    // Shared L2, separate L1s (simulates distributed cache)
    remote = new FakeL2Store()
    local1 = new FakeL1Store()
    local2 = new FakeL1Store()

    await remote.connect()

    // Two cache managers connected via bus
    manager1 = new CacheManager({
      default: 'main',
      stores: { main: { local: local1, remotes: [remote], staleTime: '1m' } },
      bus: bus1,
    })

    manager2 = new CacheManager({
      default: 'main',
      stores: { main: { local: local2, remotes: [remote], staleTime: '1m' } },
      bus: bus2,
    })

    await manager1.connect()
    await manager2.connect()
  })

  afterEach(async () => {
    await manager1.disconnect()
    await manager2.disconnect()
  })

  it('publishInvalidate clears L1 on other instance', async () => {
    const cache1 = manager1.use()
    const cache2 = manager2.use()

    // Both instances cache the same key
    await cache1.set('shared-key', 'value')
    await cache2.getOrSet('shared-key', () => 'should-not-call')

    expect(local1.size).toBe(1)
    expect(local2.size).toBe(1)

    // Instance 1 deletes (triggers bus event)
    await manager1.delete('shared-key')

    // Wait for bus propagation
    await new Promise((r) => setTimeout(r, 50))

    // Instance 2's L1 should be cleared
    expect(local2.size).toBe(0)
  })

  it('publishClear clears L1 on all instances', async () => {
    const cache1 = manager1.use()
    const cache2 = manager2.use()

    // Populate both instances
    await cache1.set('key-1', 'value-1')
    await cache2.set('key-2', 'value-2')

    expect(local1.size).toBe(1)
    expect(local2.size).toBe(1)

    // Clear from instance 1
    await manager1.clear()

    // Wait for bus propagation
    await new Promise((r) => setTimeout(r, 50))

    // Both L1s should be cleared
    expect(local1.size).toBe(0)
    expect(local2.size).toBe(0)
  })

  it('publishInvalidateTags invalidates tagged entries on other instance', async () => {
    const cache1 = manager1.use()
    const cache2 = manager2.use()

    // Both instances explicitly set with same tags (tags are local to each instance)
    await cache1.set('user:1', 'alice', { tags: ['users'] })
    await cache2.set('user:1', 'alice', { tags: ['users'] })

    expect(local1.size).toBe(1)
    expect(local2.size).toBe(1)

    // Instance 1 invalidates tags
    await manager1.invalidateTags(['users'])

    // Wait for bus propagation
    await new Promise((r) => setTimeout(r, 50))

    // Instance 2's tagged entries should be cleared
    expect(local2.size).toBe(0)
  })
})
