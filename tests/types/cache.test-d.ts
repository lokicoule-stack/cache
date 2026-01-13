/* eslint-disable @typescript-eslint/require-await */
import { expectTypeOf, assertType, test } from 'vitest'
import { createCache, type Cache, type GenericCache } from '../../src/index'

type User = { id: number; name: string; email?: string }
type Session = { token: string; expires: number }
type AppSchema = { user: User; session: Session }

// =============================================================================
// Cache Factory Overloads
// =============================================================================

test('createCache() returns GenericCache', () => {
  expectTypeOf(createCache()).toEqualTypeOf<GenericCache>()
})

test('createCache<T>() returns Cache<T> (typed mode)', () => {
  expectTypeOf(createCache<AppSchema>()).toEqualTypeOf<Cache<AppSchema>>()
})

// =============================================================================
// GenericCache - Dynamic Typing
// =============================================================================

test('GenericCache supports dynamic typing per operation', () => {
  const cache = createCache()

  // Get with type parameter
  expectTypeOf(cache.get<User>('key')).toEqualTypeOf<Promise<User | undefined>>()
  expectTypeOf(cache.get<Session>('key')).toEqualTypeOf<Promise<Session | undefined>>()

  // Set with any value
  assertType(cache.set('k1', { id: 1, name: 'Alice' }))
  assertType(cache.set('k2', 'string'))
  assertType(cache.set('k3', 42))

  // GetOrSet with type parameter
  expectTypeOf(cache.getOrSet<User>('key', async () => ({ id: 1, name: 'Bob' }))).toEqualTypeOf<
    Promise<User>
  >()

  // Pull with type parameter
  expectTypeOf(cache.pull<Session>('key')).toEqualTypeOf<Promise<Session | undefined>>()

  // Namespace returns GenericCache
  expectTypeOf(cache.namespace('ns')).toEqualTypeOf<GenericCache>()
})

// =============================================================================
// Cache<T> - Schema-Based Type Safety
// =============================================================================

test('Cache<T> enforces schema keys and types', () => {
  const cache = createCache<AppSchema>()

  // Get - keys must be in schema
  expectTypeOf(cache.get('user')).toEqualTypeOf<Promise<User | undefined>>()
  expectTypeOf(cache.get('session')).toEqualTypeOf<Promise<Session | undefined>>()

  // @ts-expect-error invalid key not in schema
  assertType(cache.get('invalid'))

  // Set - correct types
  assertType(cache.set('user', { id: 1, name: 'Alice' }))
  assertType(cache.set('user', { id: 2, name: 'Bob', email: 'bob@test.com' }))
  assertType(cache.set('session', { token: 'abc', expires: 123 }))

  // @ts-expect-error wrong type
  assertType(cache.set('user', { wrong: 'type' }))
  // @ts-expect-error user is not a string
  assertType(cache.set('user', 'string'))
  // @ts-expect-error session schema mismatch
  assertType(cache.set('session', { id: 1 }))

  // @ts-expect-error missing required field name
  assertType(cache.set('user', { id: 1 }))
  // @ts-expect-error missing required field id
  assertType(cache.set('user', { name: 'Alice' }))

  // GetOrSet - loader must return correct type
  expectTypeOf(cache.getOrSet('user', async () => ({ id: 1, name: 'Alice' }))).toEqualTypeOf<
    Promise<User>
  >()
  expectTypeOf(cache.getOrSet('session', async () => ({ token: 'x', expires: 1 }))).toEqualTypeOf<
    Promise<Session>
  >()

  // @ts-expect-error wrong return type
  assertType(cache.getOrSet('user', async () => ({ wrong: 'type' })))
  // @ts-expect-error user is not a string
  assertType(cache.getOrSet('user', async () => 'string'))
  // @ts-expect-error session type mismatch
  assertType(cache.getOrSet('user', async () => ({ token: 'x', expires: 1 })))

  // Pull
  expectTypeOf(cache.pull('user')).toEqualTypeOf<Promise<User | undefined>>()
  // @ts-expect-error invalid key
  assertType(cache.pull('invalid'))

  // Namespace preserves schema type
  expectTypeOf(cache.namespace('ns')).toEqualTypeOf<Cache<AppSchema>>()
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
  const cache = createCache()

  expectTypeOf(cache.expire('k')).toEqualTypeOf<Promise<boolean>>()
  expectTypeOf(cache.delete('k1', 'k2')).toEqualTypeOf<Promise<number>>()
  expectTypeOf(cache.has('k')).toEqualTypeOf<Promise<boolean>>()
  expectTypeOf(cache.clear()).toEqualTypeOf<Promise<void>>()
  expectTypeOf(cache.invalidateTags(['tag'])).toEqualTypeOf<Promise<number>>()
  expectTypeOf(cache.connect()).toEqualTypeOf<Promise<void>>()
  expectTypeOf(cache.disconnect()).toEqualTypeOf<Promise<void>>()
})