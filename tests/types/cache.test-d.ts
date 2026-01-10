/* eslint-disable @typescript-eslint/require-await */
import { expectTypeOf, assertType, test } from 'vitest'
import { createCache, type Cache, type GenericCache } from '../../src/index'

type User = { id: number; name: string; email?: string }
type Session = { token: string; expires: number }
type AppSchema = { user: User; session: Session }

// =============================================================================
// Factory Overloads
// =============================================================================

test('createCache() returns GenericCache', () => {
  expectTypeOf(createCache()).toEqualTypeOf<GenericCache>()
})

test('createCache<T>() returns Cache<T>', () => {
  expectTypeOf(createCache<AppSchema>()).toEqualTypeOf<Cache<AppSchema>>()
})

// =============================================================================
// GenericCache - Dynamic Typing
// =============================================================================

test('GenericCache supports dynamic typing per operation', () => {
  const generic = createCache()

  expectTypeOf(generic.get<User>('key')).toEqualTypeOf<Promise<User | undefined>>()
  expectTypeOf(generic.get<Session>('key')).toEqualTypeOf<Promise<Session | undefined>>()

  assertType(generic.set('k1', { id: 1, name: 'Alice' }))
  assertType(generic.set('k2', 'string'))
  assertType(generic.set('k3', 42))

  expectTypeOf(generic.getOrSet<User>('key', async () => ({ id: 1, name: 'Bob' }))).toEqualTypeOf<
    Promise<User>
  >()
  expectTypeOf(generic.pull<Session>('key')).toEqualTypeOf<Promise<Session | undefined>>()
  expectTypeOf(generic.namespace('ns')).toEqualTypeOf<GenericCache>()
})

// =============================================================================
// Cache<T> - Schema-Based Type Safety
// =============================================================================

test('Cache<T> enforces schema keys and types', () => {
  const typed = createCache<AppSchema>()

  expectTypeOf(typed.get('user')).toEqualTypeOf<Promise<User | undefined>>()
  expectTypeOf(typed.get('session')).toEqualTypeOf<Promise<Session | undefined>>()

  // @ts-expect-error invalid key not in schema
  assertType(typed.get('invalid'))

  assertType(typed.set('user', { id: 1, name: 'Alice' }))
  assertType(typed.set('user', { id: 2, name: 'Bob', email: 'bob@test.com' }))
  assertType(typed.set('session', { token: 'abc', expires: 123 }))

  // @ts-expect-error wrong type
  assertType(typed.set('user', { wrong: 'type' }))
  // @ts-expect-error user is not a string
  assertType(typed.set('user', 'string'))
  // @ts-expect-error session schema mismatch
  assertType(typed.set('session', { id: 1 }))

  // @ts-expect-error missing required field name
  assertType(typed.set('user', { id: 1 }))
  // @ts-expect-error missing required field id
  assertType(typed.set('user', { name: 'Alice' }))

  expectTypeOf(typed.getOrSet('user', async () => ({ id: 1, name: 'Alice' }))).toEqualTypeOf<
    Promise<User>
  >()
  expectTypeOf(typed.getOrSet('session', async () => ({ token: 'x', expires: 1 }))).toEqualTypeOf<
    Promise<Session>
  >()

  // @ts-expect-error wrong return type
  assertType(typed.getOrSet('user', async () => ({ wrong: 'type' })))
  // @ts-expect-error user is not a string
  assertType(typed.getOrSet('user', async () => 'string'))
  // @ts-expect-error session type mismatch
  assertType(typed.getOrSet('user', async () => ({ token: 'x', expires: 1 })))

  expectTypeOf(typed.pull('user')).toEqualTypeOf<Promise<User | undefined>>()
  // @ts-expect-error invalid key
  assertType(typed.pull('invalid'))

  expectTypeOf(typed.namespace('ns')).toEqualTypeOf<Cache<AppSchema>>()
})

// =============================================================================
// Loader AbortSignal
// =============================================================================

test('loader receives AbortSignal', () => {
  const generic = createCache()
  const typed = createCache<AppSchema>()

  assertType(
    generic.getOrSet('k', async (signal) => {
      expectTypeOf(signal).toEqualTypeOf<AbortSignal>()
      return 'value'
    }),
  )

  assertType(
    typed.getOrSet('user', async (signal) => {
      expectTypeOf(signal).toEqualTypeOf<AbortSignal>()
      return { id: 1, name: 'Test' }
    }),
  )
})

// =============================================================================
// Options
// =============================================================================

test('options work correctly', () => {
  const generic = createCache()
  const typed = createCache<AppSchema>()

  assertType(generic.get('k', { clone: true }))
  assertType(typed.get('user', { clone: true }))

  assertType(generic.set('k', 'v', { staleTime: 1000, gcTime: 2000, tags: ['tag'] }))
  assertType(typed.set('user', { id: 1, name: 'T' }, { staleTime: '5m', tags: ['user'] }))

  assertType(
    generic.getOrSet('k', async () => 'v', {
      staleTime: 1000,
      timeout: 5000,
      retries: 3,
      fresh: true,
      clone: true,
      eagerRefresh: 0.8,
    }),
  )

  assertType(
    typed.getOrSet('user', async () => ({ id: 1, name: 'T' }), {
      staleTime: '1m',
      gcTime: '5m',
      tags: ['user'],
      timeout: '30s',
      retries: 2,
      abortOnTimeout: true,
    }),
  )
})

// =============================================================================
// Other Methods
// =============================================================================

test('other methods have correct types', () => {
  const generic = createCache()

  expectTypeOf(generic.expire('k')).toEqualTypeOf<Promise<boolean>>()
  expectTypeOf(generic.delete('k1', 'k2')).toEqualTypeOf<Promise<number>>()
  expectTypeOf(generic.has('k')).toEqualTypeOf<Promise<boolean>>()
  expectTypeOf(generic.clear()).toEqualTypeOf<Promise<void>>()
  expectTypeOf(generic.invalidateTags(['tag'])).toEqualTypeOf<Promise<number>>()
  expectTypeOf(generic.connect()).toEqualTypeOf<Promise<void>>()
  expectTypeOf(generic.disconnect()).toEqualTypeOf<Promise<void>>()
})
