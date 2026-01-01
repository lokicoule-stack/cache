import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryStore, memoryStore, CacheEntry } from '@/index'
import { runSyncStoreContract } from '../../support/store-contract'

function createEntry(value: unknown, staleTime = 60000): CacheEntry {
  return CacheEntry.create(value, { staleTime })
}

// Run contract tests
runSyncStoreContract('MemoryStore', () => new MemoryStore())

describe('MemoryStore', () => {
  let store: MemoryStore

  beforeEach(() => {
    store = new MemoryStore({ maxItems: 3 })
  })

  it('can be created with factory function', () => {
    const s = memoryStore({ maxItems: 10 })
    expect(s).toBeInstanceOf(MemoryStore)
  })

  describe('LRU eviction', () => {
    it('evicts oldest when maxItems reached', () => {
      store.set('a', createEntry('a'))
      store.set('b', createEntry('b'))
      store.set('c', createEntry('c'))
      store.set('d', createEntry('d')) // Should evict 'a'

      expect(store.get('a')).toBeUndefined()
      expect(store.get('b')).toBeDefined()
      expect(store.get('c')).toBeDefined()
      expect(store.get('d')).toBeDefined()
    })

    it('updates LRU order on get', () => {
      store.set('a', createEntry('a'))
      store.set('b', createEntry('b'))
      store.set('c', createEntry('c'))

      // Access 'a' to make it recently used
      store.get('a')

      // Add 'd' - should evict 'b' (least recently used)
      store.set('d', createEntry('d'))

      expect(store.get('a')).toBeDefined()
      expect(store.get('b')).toBeUndefined()
      expect(store.get('c')).toBeDefined()
      expect(store.get('d')).toBeDefined()
    })
  })

  describe('maxSize', () => {
    it('respects maxSize constraint', () => {
      store = new MemoryStore({ maxSize: 100 })

      // Each entry is roughly 50 bytes (estimated)
      store.set('a', createEntry('x'.repeat(30)))
      store.set('b', createEntry('x'.repeat(30)))
      store.set('c', createEntry('x'.repeat(30))) // Should trigger eviction

      // At least one entry should be evicted
      const count = [store.get('a'), store.get('b'), store.get('c')].filter(Boolean).length
      expect(count).toBeLessThan(3)
    })
  })

  describe('name property', () => {
    it('has correct name', () => {
      expect(store.name).toBe('memory')
    })
  })
})
