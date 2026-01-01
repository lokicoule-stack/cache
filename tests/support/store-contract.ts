import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { CacheEntry, type SyncStore, type AsyncStore } from '@/index'

function createTestEntry(value: unknown, staleTime = 60000): CacheEntry {
  return CacheEntry.create(value, { staleTime })
}

/**
 * Contract tests for SyncStore implementations.
 * Every SyncStore must pass these tests.
 */
export function runSyncStoreContract(name: string, createStore: () => SyncStore): void {
  describe(`SyncStore contract: ${name}`, () => {
    let store: SyncStore

    beforeEach(() => {
      store = createStore()
      store.clear()
    })

    it('returns undefined for missing key', () => {
      expect(store.get('missing')).toBeUndefined()
    })

    it('returns value after set', () => {
      const entry = createTestEntry('hello')
      store.set('key', entry)
      const result = store.get('key')
      expect(result?.value).toEqual(entry.value)
    })

    it('overwrites existing value', () => {
      store.set('key', createTestEntry('first'))
      store.set('key', createTestEntry('second'))
      expect(store.get('key')?.value).toBe('second')
    })

    it('delete returns 1 for existing key', () => {
      store.set('key', createTestEntry('value'))
      expect(store.delete('key')).toBe(1)
      expect(store.get('key')).toBeUndefined()
    })

    it('delete returns 0 for missing key', () => {
      expect(store.delete('missing')).toBe(0)
    })

    it('clear removes all entries', () => {
      store.set('a', createTestEntry(1))
      store.set('b', createTestEntry(2))
      store.clear()
      expect(store.get('a')).toBeUndefined()
      expect(store.get('b')).toBeUndefined()
    })

    it('has returns true for existing key', () => {
      store.set('key', createTestEntry('value'))
      expect(store.has('key')).toBe(true)
    })

    it('has returns false for missing key', () => {
      expect(store.has('missing')).toBe(false)
    })
  })
}

/**
 * Contract tests for AsyncStore implementations.
 * Every AsyncStore must pass these tests.
 */
export function runAsyncStoreContract(
  name: string,
  createStore: () => AsyncStore,
  options?: { skipLifecycle?: boolean },
): void {
  describe(`AsyncStore contract: ${name}`, () => {
    let store: AsyncStore

    beforeEach(async () => {
      store = createStore()
      if (!options?.skipLifecycle) {
        await store.connect?.()
      }
      await store.clear()
    })

    afterEach(async () => {
      if (!options?.skipLifecycle) {
        await store?.disconnect?.()
      }
    })

    it('returns undefined for missing key', async () => {
      expect(await store.get('missing')).toBeUndefined()
    })

    it('returns value after set', async () => {
      const entry = createTestEntry('hello')
      await store.set('key', entry)
      const result = await store.get('key')
      expect(result?.value).toEqual(entry.value)
    })

    it('overwrites existing value', async () => {
      await store.set('key', createTestEntry('first'))
      await store.set('key', createTestEntry('second'))
      expect((await store.get('key'))?.value).toBe('second')
    })

    it('delete returns 1 for existing key', async () => {
      await store.set('key', createTestEntry('value'))
      expect(await store.delete('key')).toBe(1)
      expect(await store.get('key')).toBeUndefined()
    })

    it('delete returns 0 for missing key', async () => {
      expect(await store.delete('missing')).toBe(0)
    })

    it('clear removes all entries', async () => {
      await store.set('a', createTestEntry(1))
      await store.set('b', createTestEntry(2))
      await store.clear()
      expect(await store.get('a')).toBeUndefined()
      expect(await store.get('b')).toBeUndefined()
    })

    it('has returns true for existing key', async () => {
      await store.set('key', createTestEntry('value'))
      expect(await store.has('key')).toBe(true)
    })

    it('has returns false for missing key', async () => {
      expect(await store.has('missing')).toBe(false)
    })

    it('delete removes multiple keys', async () => {
      await store.set('a', createTestEntry(1))
      await store.set('b', createTestEntry(2))
      await store.set('c', createTestEntry(3))
      const count = await store.delete('a', 'c', 'missing')
      expect(count).toBe(2)
      expect(await store.get('b')).toBeDefined()
    })
  })
}
