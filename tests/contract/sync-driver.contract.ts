/**
 * SyncDriver Contract Tests
 *
 * FAANG principle: Test interface compliance once, not in every consumer.
 * Run this against every sync driver to ensure consistent behavior.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

import type { SyncDriver } from '@/contracts/driver'
import { CacheEntry } from '@/entry'

function createTestEntry(value: unknown = 'test-value'): CacheEntry {
  return CacheEntry.create(value, { staleTime: 60_000 })
}

export function syncDriverContract(name: string, factory: () => SyncDriver): void {
  describe(`SyncDriver Contract: ${name}`, () => {
    let driver: SyncDriver

    beforeEach(() => {
      vi.useFakeTimers()
      driver = factory()
    })

    describe('get()', () => {
      it('returns undefined for missing key', () => {
        const result = driver.get('nonexistent')

        expect(result).toBeUndefined()
      })

      it('returns stored entry', () => {
        const entry = createTestEntry('stored-value')
        driver.set('key', entry)

        const result = driver.get('key')

        expect(result?.value).toBe('stored-value')
      })

      it('returns entry with correct metadata', () => {
        const entry = createTestEntry()
        driver.set('key', entry)

        const result = driver.get('key')

        expect(result?.createdAt).toBe(entry.createdAt)
        expect(result?.staleAt).toBe(entry.staleAt)
        expect(result?.gcAt).toBe(entry.gcAt)
      })
    })

    describe('getMany()', () => {
      it('returns empty map for missing keys', () => {
        if (!driver.getMany) return

        const result = driver.getMany(['a', 'b', 'c'])

        expect(result.size).toBe(0)
      })

      it('returns only existing keys', () => {
        if (!driver.getMany) return

        driver.set('a', createTestEntry('value-a'))
        driver.set('c', createTestEntry('value-c'))

        const result = driver.getMany(['a', 'b', 'c'])

        expect(result.size).toBe(2)
        expect(result.get('a')?.value).toBe('value-a')
        expect(result.get('c')?.value).toBe('value-c')
        expect(result.has('b')).toBe(false)
      })
    })

    describe('set()', () => {
      it('stores entry', () => {
        const entry = createTestEntry('value')

        driver.set('key', entry)

        expect(driver.get('key')).toBeDefined()
      })

      it('overwrites existing entry', () => {
        driver.set('key', createTestEntry('original'))
        driver.set('key', createTestEntry('updated'))

        expect(driver.get('key')?.value).toBe('updated')
      })

      it('stores various value types', () => {
        const values = ['string', 42, 3.14, true, null, [1, 2, 3], { nested: { deep: 'value' } }]

        values.forEach((value, i) => {
          driver.set(`key:${i}`, createTestEntry(value))
          expect(driver.get(`key:${i}`)?.value).toEqual(value)
        })
      })
    })

    describe('delete()', () => {
      it('returns false for missing key', () => {
        const result = driver.delete('nonexistent')

        expect(result).toBe(false)
      })

      it('returns true and removes existing key', () => {
        driver.set('key', createTestEntry())

        const result = driver.delete('key')

        expect(result).toBe(true)
        expect(driver.get('key')).toBeUndefined()
      })

      it('is idempotent (second delete returns false)', () => {
        driver.set('key', createTestEntry())

        driver.delete('key')
        const secondDelete = driver.delete('key')

        expect(secondDelete).toBe(false)
      })
    })

    describe('deleteMany()', () => {
      it('returns 0 for missing keys', () => {
        if (!driver.deleteMany) return

        const count = driver.deleteMany(['a', 'b', 'c'])

        expect(count).toBe(0)
      })

      it('returns count of deleted keys', () => {
        if (!driver.deleteMany) return

        driver.set('a', createTestEntry())
        driver.set('b', createTestEntry())

        const count = driver.deleteMany(['a', 'b', 'c'])

        expect(count).toBe(2)
      })

      it('removes all specified keys', () => {
        if (!driver.deleteMany) return

        driver.set('a', createTestEntry())
        driver.set('b', createTestEntry())

        driver.deleteMany(['a', 'b'])

        expect(driver.get('a')).toBeUndefined()
        expect(driver.get('b')).toBeUndefined()
      })
    })

    describe('has()', () => {
      it('returns false for missing key', () => {
        expect(driver.has('nonexistent')).toBe(false)
      })

      it('returns true for existing key', () => {
        driver.set('key', createTestEntry())

        expect(driver.has('key')).toBe(true)
      })

      it('returns false after delete', () => {
        driver.set('key', createTestEntry())
        driver.delete('key')

        expect(driver.has('key')).toBe(false)
      })
    })

    describe('clear()', () => {
      it('removes all entries', () => {
        driver.set('a', createTestEntry())
        driver.set('b', createTestEntry())
        driver.set('c', createTestEntry())

        driver.clear()

        expect(driver.has('a')).toBe(false)
        expect(driver.has('b')).toBe(false)
        expect(driver.has('c')).toBe(false)
      })

      it('is idempotent', () => {
        driver.set('key', createTestEntry())

        driver.clear()
        driver.clear() // Should not throw

        expect(driver.has('key')).toBe(false)
      })
    })

    describe('edge cases', () => {
      it('handles empty string key', () => {
        driver.set('', createTestEntry('empty-key'))

        expect(driver.get('')?.value).toBe('empty-key')
        expect(driver.has('')).toBe(true)
      })

      it('handles special characters in keys', () => {
        const specialKeys = ['key:colon', 'key/slash', 'key.dot', 'key space']

        specialKeys.forEach((key) => {
          driver.set(key, createTestEntry(key))
          expect(driver.get(key)?.value).toBe(key)
        })
      })
    })
  })
}
