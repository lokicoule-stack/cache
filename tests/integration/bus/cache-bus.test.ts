import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { MessageBus, MemoryTransport } from '@lokiverse/bus'
import { createCacheManager, CacheManager, createDefaultMemory, type CacheBusSchema } from '@/index'
import { FakeL2Store } from '@test/fake-store'

describe('cache bus integration', () => {
  let transport: MemoryTransport
  let bus1: MessageBus<CacheBusSchema>
  let bus2: MessageBus<CacheBusSchema>
  let manager1: CacheManager
  let manager2: CacheManager
  let memory1: ReturnType<typeof createDefaultMemory>
  let memory2: ReturnType<typeof createDefaultMemory>
  let sharedL2: FakeL2Store

  beforeEach(async () => {
    // Shared transport for cross-instance communication
    transport = new MemoryTransport()

    // Two bus instances on same transport
    bus1 = new MessageBus<CacheBusSchema>({ transport })
    bus2 = new MessageBus<CacheBusSchema>({ transport })

    // Shared L2, separate L1s (simulates distributed cache)
    sharedL2 = new FakeL2Store()
    memory1 = createDefaultMemory()
    memory2 = createDefaultMemory()

    await sharedL2.connect()

    // Two cache managers connected via bus
    manager1 = createCacheManager({
      drivers: {
        memory: memory1,
        redis: sharedL2,
      },
      stores: { main: ['redis'] },
      staleTime: '1m',
      bus: bus1,
    })

    manager2 = createCacheManager({
      drivers: {
        memory: memory2,
        redis: sharedL2,
      },
      stores: { main: ['redis'] },
      staleTime: '1m',
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

    expect(memory1.get('main:shared-key')).toBeDefined()
    expect(memory2.get('main:shared-key')).toBeDefined()

    // Instance 1 deletes (triggers bus event)
    await manager1.delete('shared-key')

    // Wait for bus propagation
    await new Promise((r) => setTimeout(r, 50))

    // Instance 2's L1 should be cleared
    expect(memory2.get('main:shared-key')).toBeUndefined()
  })

  it('publishClear clears L1 on all instances', async () => {
    const cache1 = manager1.use()
    const cache2 = manager2.use()

    // Populate both instances
    await cache1.set('key-1', 'value-1')
    await cache2.set('key-2', 'value-2')

    expect(memory1.get('main:key-1')).toBeDefined()
    expect(memory2.get('main:key-2')).toBeDefined()

    // Clear from instance 1
    await manager1.clear()

    // Wait for bus propagation
    await new Promise((r) => setTimeout(r, 50))

    // Both L1s should be cleared
    expect(memory1.get('main:key-1')).toBeUndefined()
    expect(memory2.get('main:key-2')).toBeUndefined()
  })

  it('publishInvalidateTags invalidates tagged entries on other instance', async () => {
    const cache1 = manager1.use()
    const cache2 = manager2.use()

    // Both instances explicitly set with same tags (tags are local to each instance)
    await cache1.set('user:1', 'alice', { tags: ['users'] })
    await cache2.set('user:1', 'alice', { tags: ['users'] })

    expect(memory1.get('main:user:1')).toBeDefined()
    expect(memory2.get('main:user:1')).toBeDefined()

    // Instance 1 invalidates tags
    await manager1.invalidateTags(['users'])

    // Wait for bus propagation
    await new Promise((r) => setTimeout(r, 50))

    // Instance 2's tagged entries should be cleared
    expect(memory2.get('main:user:1')).toBeUndefined()
  })
})
