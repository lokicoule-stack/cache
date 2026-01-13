/* eslint-disable @typescript-eslint/require-await */
import { expectTypeOf, assertType, test } from 'vitest'
import {
  createCacheManager,
  type CacheManager,
  type GenericCacheManager,
  type Cache,
  type GenericCache,
} from '../../src/index'

type User = { id: number; name: string }
type Session = { token: string; expires: number }
type AppSchema = { user: User; session: Session }

// =============================================================================
// CacheManager Factory Overloads
// =============================================================================

test('createCacheManager() returns GenericCacheManager', () => {
  expectTypeOf(createCacheManager()).toEqualTypeOf<GenericCacheManager>()
})

test('createCacheManager<T>() returns CacheManager<T> (typed mode)', () => {
  expectTypeOf(createCacheManager<AppSchema>()).toEqualTypeOf<CacheManager<AppSchema>>()
})

// =============================================================================
// GenericCacheManager - use() Returns GenericCache
// =============================================================================

test('GenericCacheManager.use() returns GenericCache', () => {
  const manager = createCacheManager()

  expectTypeOf(manager.use()).toEqualTypeOf<GenericCache>()
  expectTypeOf(manager.use('store1')).toEqualTypeOf<GenericCache>()

  const store = manager.use()
  expectTypeOf(store.get<User>('key')).toEqualTypeOf<Promise<User | undefined>>()
  assertType(store.set('key', { id: 1, name: 'Alice' }))
})

// =============================================================================
// GenericCacheManager - Direct Methods
// =============================================================================

test('GenericCacheManager direct methods support dynamic typing', () => {
  const manager = createCacheManager()

  expectTypeOf(manager.get<User>('key')).toEqualTypeOf<Promise<User | undefined>>()
  expectTypeOf(manager.get<Session>('key')).toEqualTypeOf<Promise<Session | undefined>>()

  assertType(manager.set('k1', { id: 1, name: 'Alice' }))
  assertType(manager.set('k2', 'string'))
  assertType(manager.set('k3', 42))

  expectTypeOf(manager.getOrSet<User>('key', async () => ({ id: 1, name: 'Bob' }))).toEqualTypeOf<
    Promise<User>
  >()

  expectTypeOf(manager.has('key')).toEqualTypeOf<Promise<boolean>>()
  expectTypeOf(manager.delete('k1', 'k2')).toEqualTypeOf<Promise<number>>()
  expectTypeOf(manager.invalidateTags(['tag'])).toEqualTypeOf<Promise<number>>()
  expectTypeOf(manager.clear()).toEqualTypeOf<Promise<void>>()
  expectTypeOf(manager.connect()).toEqualTypeOf<Promise<void>>()
  expectTypeOf(manager.disconnect()).toEqualTypeOf<Promise<void>>()
})

// =============================================================================
// CacheManager<T> - use() Returns Cache<T>
// =============================================================================

test('CacheManager<T>.use() returns typed Cache<T>', () => {
  const manager = createCacheManager<AppSchema>()

  expectTypeOf(manager.use()).toEqualTypeOf<Cache<AppSchema>>()
  expectTypeOf(manager.use('custom')).toEqualTypeOf<Cache<AppSchema>>()

  const store = manager.use()
  expectTypeOf(store.get('user')).toEqualTypeOf<Promise<User | undefined>>()
  assertType(store.set('user', { id: 1, name: 'Alice' }))

  // @ts-expect-error invalid key
  assertType(store.get('invalid'))
  // @ts-expect-error invalid key
  assertType(store.set('invalid', 'value'))
})

// =============================================================================
// CacheManager<T> - Direct Typed Methods
// =============================================================================

test('CacheManager<T> direct methods enforce schema', () => {
  const manager = createCacheManager<AppSchema>()

  expectTypeOf(manager.get('user')).toEqualTypeOf<Promise<User | undefined>>()
  expectTypeOf(manager.get('session')).toEqualTypeOf<Promise<Session | undefined>>()

  // @ts-expect-error invalid key
  assertType(manager.get('invalid'))

  assertType(manager.set('user', { id: 1, name: 'Alice' }))
  assertType(manager.set('session', { token: 'abc', expires: 123 }))

  // @ts-expect-error wrong type
  assertType(manager.set('user', { wrong: 'type' }))
  // @ts-expect-error user is not a string
  assertType(manager.set('user', 'string'))
  // @ts-expect-error session schema mismatch
  assertType(manager.set('session', { id: 1 }))

  expectTypeOf(manager.getOrSet('user', async () => ({ id: 1, name: 'Alice' }))).toEqualTypeOf<
    Promise<User>
  >()

  // @ts-expect-error wrong return type
  assertType(manager.getOrSet('user', async () => ({ wrong: 'type' })))
  // @ts-expect-error user is not a string
  assertType(manager.getOrSet('user', async () => 'string'))

  expectTypeOf(manager.has('key')).toEqualTypeOf<Promise<boolean>>()
  expectTypeOf(manager.delete('user', 'session')).toEqualTypeOf<Promise<number>>()
  expectTypeOf(manager.invalidateTags(['tag'])).toEqualTypeOf<Promise<number>>()
  expectTypeOf(manager.clear()).toEqualTypeOf<Promise<void>>()
})

// =============================================================================
// Options
// =============================================================================

test('options work correctly', () => {
  const generic = createCacheManager()
  const typed = createCacheManager<AppSchema>()

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
    }),
  )

  assertType(
    typed.getOrSet('user', async () => ({ id: 1, name: 'T' }), {
      staleTime: '1m',
      gcTime: '5m',
      tags: ['user'],
      timeout: '30s',
    }),
  )
})

// =============================================================================
// EventEmitter
// =============================================================================

test('emitter is accessible', () => {
  const generic = createCacheManager()
  const typed = createCacheManager<AppSchema>()

  assertType(generic.emitter.on('hit', () => {}))
  assertType(typed.emitter.emit('miss', { key: 'k', store: 'default', duration: 0 }))
})
