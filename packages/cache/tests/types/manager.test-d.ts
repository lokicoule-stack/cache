import { describe, it, expectTypeOf } from 'vitest'
import type { CacheManager, GenericCacheManager } from '@/contracts/manager'
import type { Cache, GenericCache } from '@/contracts/cache'
import { createCacheManager } from '@/manager'

type Schema = {
  'user:id': { id: number; name: string }
  count: number
} & Record<string, unknown>

describe('createCacheManager', () => {
  it('returns GenericCacheManager without type parameter', () => {
    const manager = createCacheManager()

    expectTypeOf(manager).toEqualTypeOf<GenericCacheManager>()
  })

  it('returns CacheManager<T> with type parameter', () => {
    const manager = createCacheManager<Schema>()

    expectTypeOf(manager).toEqualTypeOf<CacheManager<Schema>>()
  })
})

describe('GenericCacheManager - type inference', () => {
  it('use() returns GenericCache', () => {
    const manager = {} as GenericCacheManager

    expectTypeOf(manager.use()).toEqualTypeOf<GenericCache>()
    expectTypeOf(manager.use('store')).toEqualTypeOf<GenericCache>()
  })

  it('infers value type from explicit generic', () => {
    const manager = {} as GenericCacheManager

    expectTypeOf(manager.get<string>('key')).resolves.toEqualTypeOf<string | undefined>()
  })

  it('infers loader return type', () => {
    const manager = {} as GenericCacheManager

    expectTypeOf(manager.getOrSet('key', () => 'value')).resolves.toEqualTypeOf<string>()
    expectTypeOf(manager.getOrSet('key', () => Promise.resolve({ id: 1 }))).resolves.toEqualTypeOf<{
      id: number
    }>()
  })
})

describe('CacheManager<Schema>', () => {
  it('use() returns Cache<Schema>', () => {
    const manager = {} as CacheManager<Schema>

    expectTypeOf(manager.use()).toEqualTypeOf<Cache<Schema>>()
  })

  it('infers value type from schema key', () => {
    const manager = {} as CacheManager<Schema>

    expectTypeOf(manager.get('user:id')).resolves.toEqualTypeOf<
      { id: number; name: string } | undefined
    >()
    expectTypeOf(manager.get('count')).resolves.toEqualTypeOf<number | undefined>()
  })

  it('enforces value type on set', () => {
    const manager = {} as CacheManager<Schema>

    expectTypeOf(manager.set('user:id', { id: 1, name: 'test' })).resolves.toBeVoid()

    // @ts-expect-error - wrong type for user:id
    void manager.set('user:id', 'wrong')

    // @ts-expect-error - wrong type for count
    void manager.set('count', { id: 1 })
  })

  it('infers loader return type from schema', () => {
    const manager = {} as CacheManager<Schema>

    expectTypeOf(
      manager.getOrSet('user:id', () => ({ id: 1, name: 'test' })),
    ).resolves.toEqualTypeOf<{ id: number; name: string }>()

    expectTypeOf(manager.getOrSet('count', () => 42)).resolves.toEqualTypeOf<number>()
  })
})
