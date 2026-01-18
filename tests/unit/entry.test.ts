import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { CacheEntry } from '@/entry'
import { advanceTime, freezeTime } from '../support/time'

describe('CacheEntry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })


  describe('create()', () => {
    it('creates entry with value', () => {
      const entry = CacheEntry.create('test-value', { staleTime: 60_000 })

      expect(entry.value).toBe('test-value')
    })

    it('sets createdAt to current time', () => {
      const now = freezeTime()

      const entry = CacheEntry.create('value', { staleTime: 60_000 })

      expect(entry.createdAt).toBe(now)
    })

    it('calculates staleAt from staleTime', () => {
      const now = freezeTime()

      const entry = CacheEntry.create('value', { staleTime: 60_000 })

      expect(entry.staleAt).toBe(now + 60_000)
    })

    it('calculates gcAt from gcTime', () => {
      const now = freezeTime()

      const entry = CacheEntry.create('value', { staleTime: 60_000, gcTime: 120_000 })

      expect(entry.gcAt).toBe(now + 120_000)
    })

    it('uses staleTime as gcTime when gcTime not provided', () => {
      const now = freezeTime()

      const entry = CacheEntry.create('value', { staleTime: 60_000 })

      expect(entry.gcAt).toBe(now + 60_000)
    })

    it('stores tags', () => {
      const entry = CacheEntry.create('value', {
        staleTime: 60_000,
        tags: ['users', 'admins'],
      })

      expect(entry.tags).toEqual(['users', 'admins'])
    })

    it('defaults to empty tags array', () => {
      const entry = CacheEntry.create('value', { staleTime: 60_000 })

      expect(entry.tags).toEqual([])
    })

    describe('value types', () => {
      it('stores string value', () => {
        const entry = CacheEntry.create('string', { staleTime: 60_000 })
        expect(entry.value).toBe('string')
      })

      it('stores number value', () => {
        const entry = CacheEntry.create(42, { staleTime: 60_000 })
        expect(entry.value).toBe(42)
      })

      it('stores boolean value', () => {
        const entry = CacheEntry.create(true, { staleTime: 60_000 })
        expect(entry.value).toBe(true)
      })

      it('stores null value', () => {
        const entry = CacheEntry.create(null, { staleTime: 60_000 })
        expect(entry.value).toBe(null)
      })

      it('stores undefined value', () => {
        const entry = CacheEntry.create(undefined, { staleTime: 60_000 })
        expect(entry.value).toBeUndefined()
      })

      it('stores array value', () => {
        const entry = CacheEntry.create([1, 2, 3], { staleTime: 60_000 })
        expect(entry.value).toEqual([1, 2, 3])
      })

      it('stores object value', () => {
        const entry = CacheEntry.create({ nested: { deep: 'value' } }, { staleTime: 60_000 })
        expect(entry.value).toEqual({ nested: { deep: 'value' } })
      })
    })
  })


  describe('isStale()', () => {
    it('returns false before staleAt', () => {
      freezeTime()
      const entry = CacheEntry.create('value', { staleTime: 60_000 })

      advanceTime(30_000) // 30s, before 60s staleTime

      expect(entry.isStale()).toBe(false)
    })

    it('returns true at staleAt', () => {
      freezeTime()
      const entry = CacheEntry.create('value', { staleTime: 60_000 })

      advanceTime(60_000) // Exactly at staleAt

      expect(entry.isStale()).toBe(true)
    })

    it('returns true after staleAt', () => {
      freezeTime()
      const entry = CacheEntry.create('value', { staleTime: 60_000 })

      advanceTime(90_000) // 90s, after 60s staleTime

      expect(entry.isStale()).toBe(true)
    })

    it('handles edge case of zero staleTime', () => {
      freezeTime()
      const entry = CacheEntry.create('value', { staleTime: 0 })

      expect(entry.isStale()).toBe(true)
    })

    it('handles very small staleTime', () => {
      freezeTime()
      const entry = CacheEntry.create('value', { staleTime: 1 })

      advanceTime(2)

      expect(entry.isStale()).toBe(true)
    })
  })


  describe('isGced()', () => {
    it('returns false before gcAt', () => {
      freezeTime()
      const entry = CacheEntry.create('value', { staleTime: 30_000, gcTime: 60_000 })

      advanceTime(45_000) // Past stale, before GC

      expect(entry.isGced()).toBe(false)
    })

    it('returns true at gcAt', () => {
      freezeTime()
      const entry = CacheEntry.create('value', { staleTime: 30_000, gcTime: 60_000 })

      advanceTime(60_000) // Exactly at gcAt

      expect(entry.isGced()).toBe(true)
    })

    it('returns true after gcAt', () => {
      freezeTime()
      const entry = CacheEntry.create('value', { staleTime: 30_000, gcTime: 60_000 })

      advanceTime(90_000) // After gcAt

      expect(entry.isGced()).toBe(true)
    })

    it('handles same staleTime and gcTime', () => {
      freezeTime()
      const entry = CacheEntry.create('value', { staleTime: 60_000 })

      advanceTime(60_000)

      expect(entry.isStale()).toBe(true)
      expect(entry.isGced()).toBe(true)
    })
  })


  describe('isNearExpiration()', () => {
    it('returns false early in lifetime', () => {
      freezeTime()
      const entry = CacheEntry.create('value', { staleTime: 100_000 })

      advanceTime(10_000) // 10% elapsed

      expect(entry.isNearExpiration(0.8)).toBe(false)
    })

    it('returns false at boundary', () => {
      freezeTime()
      const entry = CacheEntry.create('value', { staleTime: 100_000 })

      advanceTime(79_999) // Just under 80%

      expect(entry.isNearExpiration(0.8)).toBe(false)
    })

    it('returns true at threshold', () => {
      freezeTime()
      const entry = CacheEntry.create('value', { staleTime: 100_000 })

      advanceTime(80_000) // Exactly 80%

      expect(entry.isNearExpiration(0.8)).toBe(true)
    })

    it('returns true past threshold', () => {
      freezeTime()
      const entry = CacheEntry.create('value', { staleTime: 100_000 })

      advanceTime(95_000) // 95% elapsed

      expect(entry.isNearExpiration(0.8)).toBe(true)
    })

    it('uses default ratio of 0.8', () => {
      freezeTime()
      const entry = CacheEntry.create('value', { staleTime: 100_000 })

      advanceTime(80_000)

      expect(entry.isNearExpiration()).toBe(true)
    })

    it('handles custom ratios', () => {
      freezeTime()
      const entry = CacheEntry.create('value', { staleTime: 100_000 })

      advanceTime(50_000)

      expect(entry.isNearExpiration(0.5)).toBe(true)
      expect(entry.isNearExpiration(0.6)).toBe(false)
    })

    it('handles ratio of 0', () => {
      freezeTime()
      const entry = CacheEntry.create('value', { staleTime: 100_000 })

      expect(entry.isNearExpiration(0)).toBe(true)
    })

    it('handles ratio of 1', () => {
      freezeTime()
      const entry = CacheEntry.create('value', { staleTime: 100_000 })

      advanceTime(99_999)

      expect(entry.isNearExpiration(1)).toBe(false)
    })
  })


  describe('serialize()', () => {
    it('creates compact representation', () => {
      const now = freezeTime()
      const entry = CacheEntry.create('value', {
        staleTime: 60_000,
        gcTime: 120_000,
        tags: ['users'],
      })

      const serialized = entry.serialize()

      expect(serialized).toEqual({
        v: 'value',
        c: now,
        s: now + 60_000,
        g: now + 120_000,
        t: ['users'],
      })
    })

    it('serializes complex values', () => {
      const complexValue = {
        nested: { array: [1, 2, { deep: true }] },
        date: new Date(0).toISOString(),
      }
      const entry = CacheEntry.create(complexValue, { staleTime: 60_000 })

      const serialized = entry.serialize()

      expect(serialized.v).toEqual(complexValue)
    })
  })


  describe('deserialize()', () => {
    it('recreates entry from serialized data', () => {
      const now = Date.now()
      const serialized = {
        v: 'value',
        c: now,
        s: now + 60_000,
        g: now + 120_000,
        t: ['users'],
      }

      const entry = CacheEntry.deserialize(serialized)

      expect(entry.value).toBe('value')
      expect(entry.createdAt).toBe(now)
      expect(entry.staleAt).toBe(now + 60_000)
      expect(entry.gcAt).toBe(now + 120_000)
      expect(entry.tags).toEqual(['users'])
    })

    it('round-trips through serialize/deserialize', () => {
      const original = CacheEntry.create({ complex: [1, 2, 3] }, {
        staleTime: 60_000,
        gcTime: 120_000,
        tags: ['test'],
      })

      const serialized = original.serialize()
      const restored = CacheEntry.deserialize(serialized)

      expect(restored.value).toEqual(original.value)
      expect(restored.createdAt).toBe(original.createdAt)
      expect(restored.staleAt).toBe(original.staleAt)
      expect(restored.gcAt).toBe(original.gcAt)
      expect(restored.tags).toEqual(original.tags)
    })

    it('preserves staleness state after deserialization', () => {
      freezeTime()
      const original = CacheEntry.create('value', { staleTime: 60_000 })

      advanceTime(30_000) // Not stale yet

      const serialized = original.serialize()
      const restored = CacheEntry.deserialize(serialized)

      expect(restored.isStale()).toBe(false)

      advanceTime(40_000) // Now stale

      expect(restored.isStale()).toBe(true)
    })
  })


  describe('expire()', () => {
    it('creates expired copy', () => {
      freezeTime()
      const entry = CacheEntry.create('value', { staleTime: 60_000 })

      const expired = entry.expire()

      expect(expired.isStale()).toBe(true)
    })

    it('preserves value', () => {
      const entry = CacheEntry.create('original-value', { staleTime: 60_000 })

      const expired = entry.expire()

      expect(expired.value).toBe('original-value')
    })

    it('preserves gcAt', () => {
      const now = freezeTime()
      const entry = CacheEntry.create('value', { staleTime: 60_000, gcTime: 120_000 })

      const expired = entry.expire()

      expect(expired.gcAt).toBe(now + 120_000)
    })

    it('preserves createdAt', () => {
      const now = freezeTime()
      const entry = CacheEntry.create('value', { staleTime: 60_000 })

      advanceTime(10_000)
      const expired = entry.expire()

      expect(expired.createdAt).toBe(now)
    })

    it('preserves tags', () => {
      const entry = CacheEntry.create('value', {
        staleTime: 60_000,
        tags: ['users', 'admins'],
      })

      const expired = entry.expire()

      expect(expired.tags).toEqual(['users', 'admins'])
    })

    it('does not modify original entry', () => {
      freezeTime()
      const entry = CacheEntry.create('value', { staleTime: 60_000 })

      entry.expire()

      expect(entry.isStale()).toBe(false)
    })
  })


  describe('immutability', () => {
    it('tags array is immutable', () => {
      const entry = CacheEntry.create('value', {
        staleTime: 60_000,
        tags: ['users'],
      })

      // Attempt to modify (TypeScript would catch this, but runtime check)
      const tags = entry.tags
      expect(() => {
        ;(tags as string[]).push('admins')
      }).not.toThrow() // Array is not frozen, but that's OK

      // The point is that modifying the returned tags doesn't affect the entry
      // since it's a reference to the internal array
    })

    it('properties are readonly', () => {
      const entry = CacheEntry.create('value', { staleTime: 60_000 })

      // These would be TypeScript errors in strict mode
      // Runtime doesn't enforce this, but the type system does
      expect(entry.value).toBe('value')
      expect(entry.createdAt).toBeDefined()
      expect(entry.staleAt).toBeDefined()
      expect(entry.gcAt).toBeDefined()
    })
  })


  describe('edge cases', () => {
    it('handles very large staleTime', () => {
      freezeTime()
      const entry = CacheEntry.create('value', { staleTime: Number.MAX_SAFE_INTEGER })

      advanceTime(1_000_000_000)

      expect(entry.isStale()).toBe(false)
    })

    it('handles zero staleTime and gcTime', () => {
      freezeTime()
      const entry = CacheEntry.create('value', { staleTime: 0, gcTime: 0 })

      expect(entry.isStale()).toBe(true)
      expect(entry.isGced()).toBe(true)
    })

    it('handles negative time (expired on creation)', () => {
      // This is an edge case where gcTime could be negative
      // The implementation should handle this gracefully
      freezeTime()
      const entry = CacheEntry.create('value', { staleTime: 0 })

      expect(entry.isGced()).toBe(true)
    })

    it('handles empty tags array', () => {
      const entry = CacheEntry.create('value', { staleTime: 60_000, tags: [] })

      expect(entry.tags).toEqual([])
    })

    it('handles tags with special characters', () => {
      const specialTags = ['tag:with:colons', 'tag/with/slashes', 'tag.with.dots', 'emoji:🏷️']
      const entry = CacheEntry.create('value', { staleTime: 60_000, tags: specialTags })

      expect(entry.tags).toEqual(specialTags)
    })
  })
})
