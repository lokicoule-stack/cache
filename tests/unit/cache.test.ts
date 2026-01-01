import { describe, it, expect, beforeEach, vi } from 'vitest'

import { createCache, type Cache } from '@/index'
import { FakeL1Store } from '../support/fake-store'

describe('Cache', () => {
  let l1: FakeL1Store
  let cache: Cache

  beforeEach(() => {
    l1 = new FakeL1Store()
    cache = createCache({ l1, staleTime: '1m' })
  })

  describe('get/set', () => {
    it('returns undefined for missing key', async () => {
      expect(await cache.get('missing')).toBeUndefined()
    })

    it('returns value after set', async () => {
      await cache.set('key', 'value')

      expect(await cache.get('key')).toBe('value')
    })
  })

  describe('getOrSet', () => {
    it('calls loader on miss', async () => {
      const loader = vi.fn().mockResolvedValue('computed')

      const result = await cache.getOrSet('key', loader)

      expect(result).toBe('computed')
      expect(loader).toHaveBeenCalledOnce()
    })

    it('returns cached value on hit', async () => {
      await cache.set('key', 'cached')
      const loader = vi.fn().mockResolvedValue('computed')

      const result = await cache.getOrSet('key', loader)

      expect(result).toBe('cached')
      expect(loader).not.toHaveBeenCalled()
    })

    it('passes AbortSignal to loader', async () => {
      let receivedSignal: AbortSignal | undefined

      await cache.getOrSet('key', (signal) => {
        receivedSignal = signal
        return 'value'
      })

      expect(receivedSignal).toBeInstanceOf(AbortSignal)
    })
  })

  describe('delete', () => {
    it('removes key', async () => {
      await cache.set('key', 'value')

      await cache.delete('key')

      expect(await cache.get('key')).toBeUndefined()
    })

    it('returns count of deleted keys', async () => {
      await cache.set('a', 1)
      await cache.set('b', 2)

      const count = await cache.delete('a', 'missing')

      expect(count).toBe(1)
    })
  })

  describe('namespace', () => {
    it('prefixes keys', async () => {
      const users = cache.namespace('users')

      await users.set('1', { name: 'Alice' })

      expect(l1.keys()).toContain('users:1')
    })

    it('isolates namespaced caches', async () => {
      const users = cache.namespace('users')
      const posts = cache.namespace('posts')

      await users.set('1', 'user')
      await posts.set('1', 'post')

      expect(await users.get('1')).toBe('user')
      expect(await posts.get('1')).toBe('post')
    })
  })

  describe('pull', () => {
    it('returns and removes value', async () => {
      await cache.set('key', 'value')

      const result = await cache.pull('key')

      expect(result).toBe('value')
      expect(await cache.get('key')).toBeUndefined()
    })

    it('returns undefined for missing key', async () => {
      const result = await cache.pull('missing')

      expect(result).toBeUndefined()
    })
  })

  describe('has', () => {
    it('returns true for existing key', async () => {
      await cache.set('key', 'value')

      expect(await cache.has('key')).toBe(true)
    })

    it('returns false for missing key', async () => {
      expect(await cache.has('missing')).toBe(false)
    })
  })

  describe('clear', () => {
    it('removes all entries', async () => {
      await cache.set('a', 1)
      await cache.set('b', 2)

      await cache.clear()

      expect(await cache.get('a')).toBeUndefined()
      expect(await cache.get('b')).toBeUndefined()
    })
  })

  describe('invalidateTags', () => {
    it('removes entries with matching tags', async () => {
      await cache.set('user:1', 'alice', { tags: ['users'] })
      await cache.set('user:2', 'bob', { tags: ['users'] })
      await cache.set('post:1', 'hello', { tags: ['posts'] })

      await cache.invalidateTags(['users'])

      expect(await cache.get('user:1')).toBeUndefined()
      expect(await cache.get('user:2')).toBeUndefined()
      expect(await cache.get('post:1')).toBe('hello')
    })
  })
})
