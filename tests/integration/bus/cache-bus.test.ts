import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { MemoryTransport } from '@lokiverse/bus'
import { createCacheManager, type GenericCacheManager, createDefaultMemory } from '@/index'
import { FakeL2Store } from '@test/fake-store'

describe('cache bus integration', () => {
  let manager1: GenericCacheManager
  let manager2: GenericCacheManager
  let memory1: ReturnType<typeof createDefaultMemory>
  let memory2: ReturnType<typeof createDefaultMemory>
  let sharedL2: FakeL2Store

  beforeEach(async () => {
    const transport = new MemoryTransport()

    sharedL2 = new FakeL2Store()
    memory1 = createDefaultMemory()
    memory2 = createDefaultMemory()

    await sharedL2.connect()

    manager1 = createCacheManager({
      drivers: {
        memory: memory1,
        redis: sharedL2,
      },
      stores: { main: ['redis'] },
      staleTime: '1m',
      bus: { transport },
    })

    manager2 = createCacheManager({
      drivers: {
        memory: memory2,
        redis: sharedL2,
      },
      stores: { main: ['redis'] },
      staleTime: '1m',
      bus: { transport },
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

    await cache1.set('shared-key', 'value')
    await cache2.getOrSet('shared-key', () => 'should-not-call')

    expect(memory1.get('main:shared-key')).toBeDefined()
    expect(memory2.get('main:shared-key')).toBeDefined()

    await manager1.delete('shared-key')

    await new Promise((r) => setTimeout(r, 50))

    expect(memory2.get('main:shared-key')).toBeUndefined()
  })

  it('publishClear clears L1 on all instances', async () => {
    const cache1 = manager1.use()
    const cache2 = manager2.use()

    await cache1.set('key-1', 'value-1')
    await cache2.set('key-2', 'value-2')

    expect(memory1.get('main:key-1')).toBeDefined()
    expect(memory2.get('main:key-2')).toBeDefined()

    await manager1.clear()

    await new Promise((r) => setTimeout(r, 50))

    expect(memory1.get('main:key-1')).toBeUndefined()
    expect(memory2.get('main:key-2')).toBeUndefined()
  })

  it('publishInvalidateTags invalidates tagged entries on other instance', async () => {
    const cache1 = manager1.use()
    const cache2 = manager2.use()

    await cache1.set('user:1', 'alice', { tags: ['users'] })
    await cache2.set('user:1', 'alice', { tags: ['users'] })

    expect(memory1.get('main:user:1')).toBeDefined()
    expect(memory2.get('main:user:1')).toBeDefined()

    await manager1.invalidateTags(['users'])

    await new Promise((r) => setTimeout(r, 50))

    expect(memory2.get('main:user:1')).toBeUndefined()
  })
})
