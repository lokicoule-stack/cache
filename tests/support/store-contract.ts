import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { CacheEntry, type SyncDriver, type AsyncDriver } from '@/index'

function createTestEntry(value: unknown, staleTime = 60000): CacheEntry {
  return CacheEntry.create(value, { staleTime })
}

/**
 * Contract tests for SyncDriver implementations.
 * Every SyncDriver must pass these tests.
 */
export function runSyncDriverContract(name: string, createDriver: () => SyncDriver): void {
  describe(`SyncDriver contract: ${name}`, () => {
    let driver: SyncDriver

    beforeEach(() => {
      driver = createDriver()
      driver.clear()
    })

    it('returns undefined for missing key', () => {
      expect(driver.get('missing')).toBeUndefined()
    })

    it('returns value after set', () => {
      const entry = createTestEntry('hello')
      driver.set('key', entry)
      const result = driver.get('key')
      expect(result?.value).toEqual(entry.value)
    })

    it('overwrites existing value', () => {
      driver.set('key', createTestEntry('first'))
      driver.set('key', createTestEntry('second'))
      expect(driver.get('key')?.value).toBe('second')
    })

    it('delete returns true for existing key', () => {
      driver.set('key', createTestEntry('value'))
      expect(driver.delete('key')).toBe(true)
      expect(driver.get('key')).toBeUndefined()
    })

    it('delete returns false for missing key', () => {
      expect(driver.delete('missing')).toBe(false)
    })

    it('clear removes all entries', () => {
      driver.set('a', createTestEntry(1))
      driver.set('b', createTestEntry(2))
      driver.clear()
      expect(driver.get('a')).toBeUndefined()
      expect(driver.get('b')).toBeUndefined()
    })

    it('has returns true for existing key', () => {
      driver.set('key', createTestEntry('value'))
      expect(driver.has('key')).toBe(true)
    })

    it('has returns false for missing key', () => {
      expect(driver.has('missing')).toBe(false)
    })

    it('deleteMany removes multiple keys', () => {
      driver.set('a', createTestEntry(1))
      driver.set('b', createTestEntry(2))
      driver.set('c', createTestEntry(3))
      const count = driver.deleteMany?.(['a', 'c', 'missing']) ?? 0
      expect(count).toBe(2)
      expect(driver.get('b')).toBeDefined()
    })

    it('getMany returns multiple entries', () => {
      driver.set('a', createTestEntry(1))
      driver.set('b', createTestEntry(2))
      const results = driver.getMany?.(['a', 'b', 'missing']) ?? undefined
      expect(results?.size).toBe(2)
      expect(results?.get('a')?.value).toBe(1)
      expect(results?.get('b')?.value).toBe(2)
    })
  })
}

/**
 * Contract tests for AsyncDriver implementations.
 * Every AsyncDriver must pass these tests.
 */
export function runAsyncDriverContract(
  name: string,
  createDriver: () => AsyncDriver,
  options?: { skipLifecycle?: boolean },
): void {
  describe(`AsyncDriver contract: ${name}`, () => {
    let driver: AsyncDriver

    beforeEach(async () => {
      driver = createDriver()
      if (!options?.skipLifecycle) {
        await driver.connect?.()
      }
      await driver.clear()
    })

    afterEach(async () => {
      if (!options?.skipLifecycle) {
        await driver?.disconnect?.()
      }
    })

    it('returns undefined for missing key', async () => {
      expect(await driver.get('missing')).toBeUndefined()
    })

    it('returns value after set', async () => {
      const entry = createTestEntry('hello')
      await driver.set('key', entry)
      const result = await driver.get('key')
      expect(result?.value).toEqual(entry.value)
    })

    it('overwrites existing value', async () => {
      await driver.set('key', createTestEntry('first'))
      await driver.set('key', createTestEntry('second'))
      expect((await driver.get('key'))?.value).toBe('second')
    })

    it('delete returns true for existing key', async () => {
      await driver.set('key', createTestEntry('value'))
      expect(await driver.delete('key')).toBe(true)
      expect(await driver.get('key')).toBeUndefined()
    })

    it('delete returns false for missing key', async () => {
      expect(await driver.delete('missing')).toBe(false)
    })

    it('clear removes all entries', async () => {
      await driver.set('a', createTestEntry(1))
      await driver.set('b', createTestEntry(2))
      await driver.clear()
      expect(await driver.get('a')).toBeUndefined()
      expect(await driver.get('b')).toBeUndefined()
    })

    it('has returns true for existing key', async () => {
      await driver.set('key', createTestEntry('value'))
      expect(await driver.has('key')).toBe(true)
    })

    it('has returns false for missing key', async () => {
      expect(await driver.has('missing')).toBe(false)
    })

    it('deleteMany removes multiple keys', async () => {
      await driver.set('a', createTestEntry(1))
      await driver.set('b', createTestEntry(2))
      await driver.set('c', createTestEntry(3))
      const count = (await driver.deleteMany?.(['a', 'c', 'missing'])) ?? 0
      expect(count).toBe(2)
      expect(await driver.get('b')).toBeDefined()
    })

    it('getMany returns multiple entries', async () => {
      await driver.set('a', createTestEntry(1))
      await driver.set('b', createTestEntry(2))
      const results = (await driver.getMany?.(['a', 'b', 'missing'])) ?? undefined
      expect(results?.size).toBe(2)
      expect(results?.get('a')?.value).toBe(1)
      expect(results?.get('b')?.value).toBe(2)
    })
  })
}
