import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryDriver, memoryDriver, CacheEntry } from '@/index'
import { runSyncDriverContract } from '../../support/store-contract'

function createEntry(value: unknown, staleTime = 60000): CacheEntry {
  return CacheEntry.create(value, { staleTime })
}

// Run contract tests
runSyncDriverContract('MemoryDriver', () => new MemoryDriver())

describe('MemoryDriver', () => {
  let driver: MemoryDriver

  beforeEach(() => {
    driver = new MemoryDriver({ maxItems: 3 })
  })

  it('can be created with factory function', () => {
    const d = memoryDriver({ maxItems: 10 })
    expect(d).toBeInstanceOf(MemoryDriver)
  })

  describe('LRU eviction', () => {
    it('evicts oldest when maxItems reached', () => {
      driver.set('a', createEntry('a'))
      driver.set('b', createEntry('b'))
      driver.set('c', createEntry('c'))
      driver.set('d', createEntry('d')) // Should evict 'a'

      expect(driver.get('a')).toBeUndefined()
      expect(driver.get('b')).toBeDefined()
      expect(driver.get('c')).toBeDefined()
      expect(driver.get('d')).toBeDefined()
    })

    it('updates LRU order on get', () => {
      driver.set('a', createEntry('a'))
      driver.set('b', createEntry('b'))
      driver.set('c', createEntry('c'))

      // Access 'a' to make it recently used
      driver.get('a')

      // Add 'd' - should evict 'b' (least recently used)
      driver.set('d', createEntry('d'))

      expect(driver.get('a')).toBeDefined()
      expect(driver.get('b')).toBeUndefined()
      expect(driver.get('c')).toBeDefined()
      expect(driver.get('d')).toBeDefined()
    })
  })

  describe('maxSize', () => {
    it('respects maxSize constraint', () => {
      driver = new MemoryDriver({ maxSize: 100 })

      // Each entry is roughly 50 bytes (estimated)
      driver.set('a', createEntry('x'.repeat(30)))
      driver.set('b', createEntry('x'.repeat(30)))
      driver.set('c', createEntry('x'.repeat(30))) // Should trigger eviction

      // At least one entry should be evicted
      const count = [driver.get('a'), driver.get('b'), driver.get('c')].filter(Boolean).length
      expect(count).toBeLessThan(3)
    })
  })

  describe('name property', () => {
    it('has correct name', () => {
      expect(driver.name).toBe('memory')
    })
  })
})
