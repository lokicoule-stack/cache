import { describe, it, expectTypeOf } from 'vitest'
import type { Cache, GenericCache } from '@/contracts/cache'

type Schema = {
  'user:id': { id: number; name: string }
  count: number
} & Record<string, unknown>

describe('GenericCache', () => {
  it('infers value type from explicit generic', () => {
    const cache = {} as GenericCache

    expectTypeOf(cache.get<string>('key')).resolves.toEqualTypeOf<string | undefined>()
    expectTypeOf(cache.get<{ id: number }>('key')).resolves.toEqualTypeOf<
      { id: number } | undefined
    >()
  })

  it('infers loader return type', () => {
    const cache = {} as GenericCache

    expectTypeOf(cache.getOrSet('key', () => 'value')).resolves.toEqualTypeOf<string>()
    expectTypeOf(cache.getOrSet('key', () => Promise.resolve({ id: 1 }))).resolves.toEqualTypeOf<{
      id: number
    }>()
  })

  it('preserves type through namespace', () => {
    const cache = {} as GenericCache

    expectTypeOf(cache.namespace('prefix')).toEqualTypeOf<GenericCache>()
  })

  it('loader receives AbortSignal', () => {
    const cache = {} as GenericCache

    void cache.getOrSet('key', (signal) => {
      expectTypeOf(signal).toEqualTypeOf<AbortSignal>()
      return 'value'
    })
  })
})

describe('Cache<Schema>', () => {
  it('infers value type from schema key', () => {
    const cache = {} as Cache<Schema>

    expectTypeOf(cache.get('user:id')).resolves.toEqualTypeOf<
      { id: number; name: string } | undefined
    >()
    expectTypeOf(cache.get('count')).resolves.toEqualTypeOf<number | undefined>()
  })

  it('enforces value type on set', () => {
    const cache = {} as Cache<Schema>

    expectTypeOf(cache.set('user:id', { id: 1, name: 'test' })).resolves.toBeVoid()

    // @ts-expect-error - wrong type for user:id
    void cache.set('user:id', 'wrong')

    // @ts-expect-error - wrong type for count
    void cache.set('count', 'wrong')
  })

  it('infers loader return type from schema', () => {
    const cache = {} as Cache<Schema>

    expectTypeOf(
      cache.getOrSet('user:id', () => ({ id: 1, name: 'test' })),
    ).resolves.toEqualTypeOf<{ id: number; name: string }>()

    expectTypeOf(cache.getOrSet('count', () => 42)).resolves.toEqualTypeOf<number>()
  })

  it('preserves schema type through namespace', () => {
    const cache = {} as Cache<Schema>

    expectTypeOf(cache.namespace('prefix')).toEqualTypeOf<Cache<Schema>>()
  })
})
