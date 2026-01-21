import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import type { AsyncDriver } from '@/contracts/driver'
import { CacheEntry } from '@/entry'

function createTestEntry(value: unknown = 'test-value'): CacheEntry {
  return CacheEntry.create(value, { staleTime: 60_000 })
}

export interface AsyncDriverContractOptions {
  /**
   * Whether to use fake timers during tests.
   *
   * - `true`: Use fake timers (good for in-memory/fake drivers)
   * - `false`: Use real timers (REQUIRED for external I/O: Redis, DB, APIs)
   *
   * Default: false (FAANG principle: don't mock what you don't own)
   */
  useFakeTimers?: boolean
}

export function asyncDriverContract(
  name: string,
  factory: () => Promise<AsyncDriver>,
  cleanup?: () => Promise<void>,
  options: AsyncDriverContractOptions = {},
): void {
  const { useFakeTimers = false } = options

  describe(`AsyncDriver Contract: ${name}`, () => {
    let driver: AsyncDriver

    beforeEach(async () => {
      if (useFakeTimers) {
        vi.useFakeTimers()
      }
      driver = await factory()
    })

    afterEach(async () => {
      if (useFakeTimers) {
        vi.useRealTimers()
      }
      await cleanup?.()
    })

    describe('get()', () => {
      it('returns undefined for missing key', async () => {
        const result = await driver.get('nonexistent')

        expect(result).toBeUndefined()
      })

      it('returns stored entry', async () => {
        const entry = createTestEntry('stored-value')
        await driver.set('key', entry)

        const result = await driver.get('key')

        expect(result?.value).toBe('stored-value')
      })

      it('returns entry with correct metadata', async () => {
        const entry = createTestEntry()
        await driver.set('key', entry)

        const result = await driver.get('key')

        expect(result?.createdAt).toBe(entry.createdAt)
        expect(result?.staleAt).toBe(entry.staleAt)
        expect(result?.gcAt).toBe(entry.gcAt)
      })
    })

    describe('getMany()', () => {
      it('returns empty map for missing keys', async () => {
        if (!driver.getMany) return

        const result = await driver.getMany(['a', 'b', 'c'])

        expect(result.size).toBe(0)
      })

      it('returns only existing keys', async () => {
        if (!driver.getMany) return

        await driver.set('a', createTestEntry('value-a'))
        await driver.set('c', createTestEntry('value-c'))

        const result = await driver.getMany(['a', 'b', 'c'])

        expect(result.size).toBe(2)
        expect(result.get('a')?.value).toBe('value-a')
        expect(result.get('c')?.value).toBe('value-c')
        expect(result.has('b')).toBe(false)
      })
    })

    describe('set()', () => {
      it('stores entry', async () => {
        const entry = createTestEntry('value')

        await driver.set('key', entry)

        expect(await driver.get('key')).toBeDefined()
      })

      it('overwrites existing entry', async () => {
        await driver.set('key', createTestEntry('original'))
        await driver.set('key', createTestEntry('updated'))

        const result = await driver.get('key')
        expect(result?.value).toBe('updated')
      })

      it('stores various value types', async () => {
        const values = ['string', 42, 3.14, true, null, [1, 2, 3], { nested: { deep: 'value' } }]

        for (let i = 0; i < values.length; i++) {
          await driver.set(`key:${i}`, createTestEntry(values[i]))
          const result = await driver.get(`key:${i}`)
          expect(result?.value).toEqual(values[i])
        }
      })
    })

    describe('delete()', () => {
      it('returns false for missing key', async () => {
        const result = await driver.delete('nonexistent')

        expect(result).toBe(false)
      })

      it('returns true and removes existing key', async () => {
        await driver.set('key', createTestEntry())

        const result = await driver.delete('key')

        expect(result).toBe(true)
        expect(await driver.get('key')).toBeUndefined()
      })

      it('is idempotent (second delete returns false)', async () => {
        await driver.set('key', createTestEntry())

        await driver.delete('key')
        const secondDelete = await driver.delete('key')

        expect(secondDelete).toBe(false)
      })
    })

    describe('deleteMany()', () => {
      it('returns 0 for missing keys', async () => {
        if (!driver.deleteMany) return

        const count = await driver.deleteMany(['a', 'b', 'c'])

        expect(count).toBe(0)
      })

      it('returns count of deleted keys', async () => {
        if (!driver.deleteMany) return

        await driver.set('a', createTestEntry())
        await driver.set('b', createTestEntry())

        const count = await driver.deleteMany(['a', 'b', 'c'])

        expect(count).toBe(2)
      })

      it('removes all specified keys', async () => {
        if (!driver.deleteMany) return

        await driver.set('a', createTestEntry())
        await driver.set('b', createTestEntry())

        await driver.deleteMany(['a', 'b'])

        expect(await driver.get('a')).toBeUndefined()
        expect(await driver.get('b')).toBeUndefined()
      })
    })

    describe('has()', () => {
      it('returns false for missing key', async () => {
        expect(await driver.has('nonexistent')).toBe(false)
      })

      it('returns true for existing key', async () => {
        await driver.set('key', createTestEntry())

        expect(await driver.has('key')).toBe(true)
      })

      it('returns false after delete', async () => {
        await driver.set('key', createTestEntry())
        await driver.delete('key')

        expect(await driver.has('key')).toBe(false)
      })
    })

    describe('clear()', () => {
      it('removes all entries', async () => {
        await driver.set('a', createTestEntry())
        await driver.set('b', createTestEntry())
        await driver.set('c', createTestEntry())

        await driver.clear()

        expect(await driver.has('a')).toBe(false)
        expect(await driver.has('b')).toBe(false)
        expect(await driver.has('c')).toBe(false)
      })

      it('is idempotent', async () => {
        await driver.set('key', createTestEntry())

        await driver.clear()
        await driver.clear() // Should not throw

        expect(await driver.has('key')).toBe(false)
      })
    })

    describe('lifecycle', () => {
      it('connect() is idempotent', async () => {
        if (!driver.connect) return

        await driver.connect()
        await driver.connect()

        await driver.set('key', createTestEntry())
        expect(await driver.get('key')).toBeDefined()
      })

      it('disconnect() is idempotent', async () => {
        if (!driver.disconnect) return

        await driver.disconnect()
        await driver.disconnect()
      })
    })

    describe('edge cases', () => {
      it('handles empty string key', async () => {
        await driver.set('', createTestEntry('empty-key'))

        expect((await driver.get(''))?.value).toBe('empty-key')
        expect(await driver.has('')).toBe(true)
      })

      it('handles special characters in keys', async () => {
        const specialKeys = ['key:colon', 'key/slash', 'key.dot', 'key space']

        for (const key of specialKeys) {
          await driver.set(key, createTestEntry(key))
          const result = await driver.get(key)
          expect(result?.value).toBe(key)
        }
      })
    })
  })
}
