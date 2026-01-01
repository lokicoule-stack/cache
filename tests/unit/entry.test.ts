import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { CacheEntry } from '@/entry'

describe('CacheEntry', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  describe('create', () => {
    it('sets staleAt based on staleTime', () => {
      vi.setSystemTime(1000)

      const entry = CacheEntry.create('value', { staleTime: 500 })

      expect(entry.staleAt).toBe(1500)
    })

    it('sets gcAt to staleAt when gcTime not provided', () => {
      vi.setSystemTime(1000)

      const entry = CacheEntry.create('value', { staleTime: 500 })

      expect(entry.gcAt).toBe(1500)
    })

    it('sets gcAt based on gcTime when provided', () => {
      vi.setSystemTime(1000)

      const entry = CacheEntry.create('value', { staleTime: 500, gcTime: 1000 })

      expect(entry.gcAt).toBe(2000)
    })

    it('stores tags', () => {
      const entry = CacheEntry.create('value', { staleTime: 500, tags: ['users'] })

      expect(entry.tags).toEqual(['users'])
    })
  })

  describe('isStale', () => {
    it('returns false before staleAt', () => {
      vi.setSystemTime(1000)
      const entry = CacheEntry.create('value', { staleTime: 500 })

      vi.setSystemTime(1499)

      expect(entry.isStale()).toBe(false)
    })

    it('returns true at staleAt', () => {
      vi.setSystemTime(1000)
      const entry = CacheEntry.create('value', { staleTime: 500 })

      vi.setSystemTime(1500)

      expect(entry.isStale()).toBe(true)
    })
  })

  describe('isGced', () => {
    it('returns false before gcAt', () => {
      vi.setSystemTime(1000)
      const entry = CacheEntry.create('value', { staleTime: 500, gcTime: 1000 })

      vi.setSystemTime(1999)

      expect(entry.isGced()).toBe(false)
    })

    it('returns true at gcAt', () => {
      vi.setSystemTime(1000)
      const entry = CacheEntry.create('value', { staleTime: 500, gcTime: 1000 })

      vi.setSystemTime(2000)

      expect(entry.isGced()).toBe(true)
    })
  })

  describe('serialize/deserialize', () => {
    it('roundtrips correctly', () => {
      vi.setSystemTime(1000)
      const entry = CacheEntry.create('value', { staleTime: 500, gcTime: 1000, tags: ['a'] })

      const restored = CacheEntry.deserialize(entry.serialize())

      expect(restored.value).toBe('value')
      expect(restored.staleAt).toBe(1500)
      expect(restored.gcAt).toBe(2000)
      expect(restored.tags).toEqual(['a'])
    })
  })

  describe('expire', () => {
    it('makes entry immediately stale', () => {
      vi.setSystemTime(1000)
      const entry = CacheEntry.create('value', { staleTime: 500 })

      const expired = entry.expire()

      expect(expired.isStale()).toBe(true)
      expect(expired.value).toBe('value')
    })
  })
})
