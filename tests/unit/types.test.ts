/* eslint-disable @typescript-eslint/no-floating-promises */
import { describe, it, expectTypeOf } from 'vitest'

import { createCache, createCacheManager } from '@/index'

type User = { id: number; name: string }
type Schema = { user: User }

describe('Type Safety', () => {
  describe('Cache', () => {
    it('schema key inference', () => {
      const cache = createCache<Schema>()
      expectTypeOf(cache.get('user')).toEqualTypeOf<Promise<User | undefined>>()
      expectTypeOf(cache.getOrSet('user', () => ({ id: 1, name: 'A' }))).toEqualTypeOf<
        Promise<User>
      >()
    })

    it('dynamic key with explicit generic', () => {
      const cache = createCache<Schema>()
      expectTypeOf(cache.get<number>('other')).toEqualTypeOf<Promise<number | undefined>>()
      expectTypeOf(cache.getOrSet<number>('other', () => 42)).toEqualTypeOf<Promise<number>>()
    })

    it('explicit type override on untyped cache', () => {
      const cache = createCache()
      expectTypeOf(cache.get<User>('key')).toEqualTypeOf<Promise<User | undefined>>()
      expectTypeOf(cache.getOrSet<User>('key', () => ({ id: 1, name: 'A' }))).toEqualTypeOf<
        Promise<User>
      >()
    })

    it('schema key enforces correct value type for set', () => {
      const cache = createCache<Schema>()
      cache.set('user', { id: 1, name: 'A' })
    })

    it('dynamic key with explicit generic for set', () => {
      const cache = createCache<Schema>()
      cache.set<{ x: number }>('other', { x: 1 })
    })
  })

  describe('CacheManager', () => {
    it('schema key inference via proxy', () => {
      const manager = createCacheManager<Schema>()
      expectTypeOf(manager.get('user')).toEqualTypeOf<Promise<User | undefined>>()
      expectTypeOf(manager.getOrSet('user', () => ({ id: 1, name: 'A' }))).toEqualTypeOf<
        Promise<User>
      >()
    })

    it('dynamic key with explicit generic', () => {
      const manager = createCacheManager<Schema>()
      expectTypeOf(manager.get<number>('other')).toEqualTypeOf<Promise<number | undefined>>()
      expectTypeOf(manager.getOrSet<number>('other', () => 42)).toEqualTypeOf<Promise<number>>()
    })

    it('explicit type override on untyped manager', () => {
      const manager = createCacheManager()
      expectTypeOf(manager.get<User>('key')).toEqualTypeOf<Promise<User | undefined>>()
      expectTypeOf(manager.getOrSet<User>('key', () => ({ id: 1, name: 'A' }))).toEqualTypeOf<
        Promise<User>
      >()
    })

    it('use() returns typed cache', () => {
      const manager = createCacheManager<Schema>()
      const cache = manager.use()
      expectTypeOf(cache.get('user')).toEqualTypeOf<Promise<User | undefined>>()
    })

    it('use<S>() overrides schema', () => {
      const manager = createCacheManager()
      type Other = { x: number }
      const cache = manager.use<Other>()
      expectTypeOf(cache.get('x')).toEqualTypeOf<Promise<number | undefined>>()
    })
  })
})
