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
// Factory Overloads
// =============================================================================

test('createCacheManager() returns GenericCacheManager', () => {
  expectTypeOf(createCacheManager()).toEqualTypeOf<GenericCacheManager>()
})

test('createCacheManager<T>() returns CacheManager<T>', () => {
  expectTypeOf(createCacheManager<AppSchema>()).toEqualTypeOf<CacheManager<AppSchema>>()
})

// =============================================================================
// GenericCacheManager - use() Returns GenericCache
// =============================================================================

test('GenericCacheManager.use() returns GenericCache', () => {
  const genericMgr = createCacheManager()

  expectTypeOf(genericMgr.use()).toEqualTypeOf<GenericCache>()
  expectTypeOf(genericMgr.use('store1')).toEqualTypeOf<GenericCache>()

  const genericStore = genericMgr.use()
  expectTypeOf(genericStore.get<User>('key')).toEqualTypeOf<Promise<User | undefined>>()
  assertType(genericStore.set('key', { id: 1, name: 'Alice' }))
})

// =============================================================================
// GenericCacheManager - Direct Methods
// =============================================================================

test('GenericCacheManager direct methods support dynamic typing', () => {
  const genericMgr = createCacheManager()

  expectTypeOf(genericMgr.get<User>('key')).toEqualTypeOf<Promise<User | undefined>>()
  expectTypeOf(genericMgr.get<Session>('key')).toEqualTypeOf<Promise<Session | undefined>>()

  assertType(genericMgr.set('k1', { id: 1, name: 'Alice' }))
  assertType(genericMgr.set('k2', 'string'))
  assertType(genericMgr.set('k3', 42))

  expectTypeOf(
    genericMgr.getOrSet<User>('key', async () => ({ id: 1, name: 'Bob' })),
  ).toEqualTypeOf<Promise<User>>()

  expectTypeOf(genericMgr.has('key')).toEqualTypeOf<Promise<boolean>>()
  expectTypeOf(genericMgr.delete('k1', 'k2')).toEqualTypeOf<Promise<number>>()
  expectTypeOf(genericMgr.invalidateTags(['tag'])).toEqualTypeOf<Promise<number>>()
  expectTypeOf(genericMgr.clear()).toEqualTypeOf<Promise<void>>()
  expectTypeOf(genericMgr.connect()).toEqualTypeOf<Promise<void>>()
  expectTypeOf(genericMgr.disconnect()).toEqualTypeOf<Promise<void>>()
})

// =============================================================================
// CacheManager<T> - use() Returns Cache<T>
// =============================================================================

test('CacheManager<T>.use() returns typed Cache<T>', () => {
  const typedMgr = createCacheManager<AppSchema>()

  expectTypeOf(typedMgr.use()).toEqualTypeOf<Cache<AppSchema>>()
  expectTypeOf(typedMgr.use<{ custom: string }>('custom')).toEqualTypeOf<
    Cache<{ custom: string }>
  >()

  const typedStore = typedMgr.use()
  expectTypeOf(typedStore.get('user')).toEqualTypeOf<Promise<User | undefined>>()
  assertType(typedStore.set('user', { id: 1, name: 'Alice' }))

  // @ts-expect-error invalid key
  assertType(typedStore.get('invalid'))
  // @ts-expect-error invalid key
  assertType(typedStore.set('invalid', 'value'))
})

// =============================================================================
// CacheManager<T> - Direct Typed Methods
// =============================================================================

test('CacheManager<T> direct methods enforce schema', () => {
  const typedMgr = createCacheManager<AppSchema>()

  expectTypeOf(typedMgr.get('user')).toEqualTypeOf<Promise<User | undefined>>()
  expectTypeOf(typedMgr.get('session')).toEqualTypeOf<Promise<Session | undefined>>()

  // @ts-expect-error invalid key
  assertType(typedMgr.get('invalid'))

  assertType(typedMgr.set('user', { id: 1, name: 'Alice' }))
  assertType(typedMgr.set('session', { token: 'abc', expires: 123 }))

  // @ts-expect-error wrong type
  assertType(typedMgr.set('user', { wrong: 'type' }))
  // @ts-expect-error user is not a string
  assertType(typedMgr.set('user', 'string'))
  // @ts-expect-error session schema mismatch
  assertType(typedMgr.set('session', { id: 1 }))

  expectTypeOf(typedMgr.getOrSet('user', async () => ({ id: 1, name: 'Alice' }))).toEqualTypeOf<
    Promise<User>
  >()

  // @ts-expect-error wrong return type
  assertType(typedMgr.getOrSet('user', async () => ({ wrong: 'type' })))
  // @ts-expect-error user is not a string
  assertType(typedMgr.getOrSet('user', async () => 'string'))

  expectTypeOf(typedMgr.has('key')).toEqualTypeOf<Promise<boolean>>()
  expectTypeOf(typedMgr.delete('user', 'session')).toEqualTypeOf<Promise<number>>()
  expectTypeOf(typedMgr.invalidateTags(['tag'])).toEqualTypeOf<Promise<number>>()
  expectTypeOf(typedMgr.clear()).toEqualTypeOf<Promise<void>>()
})

// =============================================================================
// Options
// =============================================================================

test('options work correctly', () => {
  const genericMgr = createCacheManager()
  const typedMgr = createCacheManager<AppSchema>()

  assertType(genericMgr.get('k', { clone: true }))
  assertType(typedMgr.get('user', { clone: true }))

  assertType(genericMgr.set('k', 'v', { staleTime: 1000, gcTime: 2000, tags: ['tag'] }))
  assertType(typedMgr.set('user', { id: 1, name: 'T' }, { staleTime: '5m', tags: ['user'] }))

  assertType(
    genericMgr.getOrSet('k', async () => 'v', {
      staleTime: 1000,
      timeout: 5000,
      retries: 3,
      fresh: true,
      clone: true,
    }),
  )

  assertType(
    typedMgr.getOrSet('user', async () => ({ id: 1, name: 'T' }), {
      staleTime: '1m',
      gcTime: '5m',
      tags: ['user'],
      timeout: '30s',
    }),
  )
})

// =============================================================================
// Multiple Stores with Different Schemas
// =============================================================================

test('multiple stores with different schemas', () => {
  type StoreA = { itemA: { value: string } }
  type StoreB = { itemB: { count: number } }

  const multiMgr = createCacheManager<StoreA>()

  const storeA = multiMgr.use()
  expectTypeOf(storeA).toEqualTypeOf<Cache<StoreA>>()
  expectTypeOf(storeA.get('itemA')).toEqualTypeOf<Promise<{ value: string } | undefined>>()

  const storeB = multiMgr.use<StoreB>('storeB')
  expectTypeOf(storeB).toEqualTypeOf<Cache<StoreB>>()
  expectTypeOf(storeB.get('itemB')).toEqualTypeOf<Promise<{ count: number } | undefined>>()

  // @ts-expect-error wrong key for storeA
  assertType(storeA.get('itemB'))
  // @ts-expect-error wrong key for storeB
  assertType(storeB.get('itemA'))
})

// =============================================================================
// EventEmitter
// =============================================================================

test('emitter is accessible', () => {
  const genericMgr = createCacheManager()
  const typedMgr = createCacheManager<AppSchema>()

  assertType(genericMgr.emitter.on('hit', () => {}))
  assertType(typedMgr.emitter.emit('miss', { key: 'k', store: 'default' }))
})
