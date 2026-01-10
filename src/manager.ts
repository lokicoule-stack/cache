import { MessageBus, type BusSchema } from '@lokiverse/bus'

import { CacheBackplane } from './backplane'
import { InternalCache, type Cache, type GenericCache } from './cache'
import { createDefaultMemory } from './drivers/memory'
import { parseOptionalDuration } from './duration'
import { CacheError } from './errors'
import { CacheStack } from './stack'
import { createDedup } from './utils/dedup'
import { createEventEmitter, type EventEmitter } from './utils/events'

import type {
  CacheManagerConfig,
  AsyncDriver,
  SyncDriver,
  GetOptions,
  SetOptions,
  GetSetOptions,
  Loader,
} from './types'

const DEFAULT_STALE_TIME = 60_000

export interface CacheBusSchema extends BusSchema {
  'cache:invalidate': { keys: string[]; store: string }
  'cache:invalidate:tags': { tags: string[]; store: string }
  'cache:clear': { store: string }
}

interface SharedConfig {
  memory: SyncDriver
  globalMemory: boolean
  staleTime: number
  gcTime: number
  cbDuration: number | undefined
  drivers: Record<string, AsyncDriver>
  externalDrivers: string[]
}

/**
 * Internal cache manager implementation (runtime layer).
 *
 * This class is type-agnostic and manipulates `unknown` values only.
 * Type safety is provided via interface projection (CacheManager<T> / GenericCacheManager).
 *
 * @internal This class is not exported - use createCacheManager() factory instead.
 */
export class InternalCacheManager {
  readonly emitter: EventEmitter
  readonly #stores = new Map<string, InternalCache | CacheBackplane>()
  readonly #defaultStoreName: string
  readonly #sharedDedup = createDedup()
  readonly #bus?: MessageBus<CacheBusSchema>

  constructor(config: CacheManagerConfig = {}) {
    this.emitter = config.emitter ?? createEventEmitter()

    const shared = this.#buildSharedConfig(config)

    if (config.bus) {
      this.#bus = new MessageBus<CacheBusSchema>(config.bus)
    }

    // Determine default store name before initialization
    if (shared.externalDrivers.length === 0) {
      this.#defaultStoreName = 'default'
    } else {
      const storeConfigs = config.stores ?? { default: shared.externalDrivers }

      this.#defaultStoreName = Object.keys(storeConfigs)[0]
    }

    if (shared.externalDrivers.length === 0) {
      this.#initMemoryOnlyStore(shared)
    } else {
      this.#initMultiStores(config, shared)
    }
  }

  /**
   * Get a specific cache store by name.
   *
   * @param name - Store name (defaults to first configured store)
   * @returns InternalCache instance for the requested store
   * @throws {CacheError} If store name not found
   *
   * @example
   * ```ts
   * const usersCache = manager.use('users')
   * await usersCache.set('user:1', { name: 'Alice' })
   * ```
   */
  use(name?: string): InternalCache {
    const storeName = name ?? this.#defaultStoreName
    const store = this.#stores.get(storeName)

    if (!store) {
      throw new CacheError('INVALID_CONFIG', `Store "${storeName}" not found`)
    }

    // If backplane, return the underlying cache; otherwise return the cache directly
    const cache = store instanceof CacheBackplane ? store.cache : store

    return cache
  }

  /**
   * Get value from default store.
   * Convenience method that delegates to `use().get()`.
   */
  async get(key: string, options?: GetOptions): Promise<unknown> {
    return this.use().get(key, options)
  }

  /**
   * Set value in default store.
   * Convenience method that delegates to `use().set()`.
   */
  async set(key: string, value: unknown, options?: SetOptions): Promise<void> {
    return this.use().set(key, value, options)
  }

  /**
   * Get or compute value in default store.
   * Convenience method that delegates to `use().getOrSet()`.
   */
  async getOrSet(
    key: string,
    loader: Loader<unknown>,
    options?: GetSetOptions,
  ): Promise<unknown> {
    return this.use().getOrSet(key, loader, options)
  }

  /**
   * Check if key exists in default store.
   * Convenience method that delegates to `use().has()`.
   */
  async has(key: string): Promise<boolean> {
    return this.use().has(key)
  }

  /**
   * Delete keys from ALL stores.
   *
   * @param keys - Keys to delete
   * @returns Maximum deletion count across all stores
   *
   * @example
   * ```ts
   * await manager.delete('user:1', 'user:2')
   * ```
   */
  async delete(...keys: string[]): Promise<number> {
    const results = await Promise.all(
      Array.from(this.#stores.values()).map((store) => store.delete(...keys)),
    )

    return Math.max(...results, 0)
  }

  /**
   * Invalidate tags across ALL stores.
   *
   * @param tags - Tags to invalidate
   * @returns Total number of keys deleted across all stores
   *
   * @example
   * ```ts
   * await manager.invalidateTags(['user', 'profile'])
   * ```
   */
  async invalidateTags(tags: string[]): Promise<number> {
    const results = await Promise.all(
      Array.from(this.#stores.values()).map((store) => store.invalidateTags(tags)),
    )

    return results.reduce((a: number, b: number) => a + b, 0)
  }

  /**
   * Clear ALL stores.
   * Removes all entries from every configured store.
   */
  async clear(): Promise<void> {
    await Promise.all(Array.from(this.#stores.values()).map((store) => store.clear()))
  }

  /**
   * Connect to all external drivers (L2 layers) and message bus.
   * Should be called before using the cache in distributed environments.
   */
  async connect(): Promise<void> {
    if (this.#bus) {
      await this.#bus.connect()
    }

    await Promise.all(Array.from(this.#stores.values()).map((store) => store.connect()))
  }

  /**
   * Disconnect from all external drivers and message bus.
   * Should be called during graceful shutdown.
   */
  async disconnect(): Promise<void> {
    await Promise.all(Array.from(this.#stores.values()).map((store) => store.disconnect()))

    if (this.#bus) {
      await this.#bus.disconnect()
    }
  }

  /**
   * Builds shared configuration used across all stores
   */
  #buildSharedConfig(config: CacheManagerConfig): SharedConfig {
    const memory = config.drivers?.memory ?? createDefaultMemory()
    const globalMemory = config.memory !== false
    const staleTime = parseOptionalDuration(config.staleTime) ?? DEFAULT_STALE_TIME
    const gcTime = parseOptionalDuration(config.gcTime) ?? staleTime
    const cbDuration = parseOptionalDuration(config.circuitBreakerDuration)
    const drivers = (config.drivers ?? {}) as Record<string, AsyncDriver>
    const externalDrivers = Object.keys(drivers).filter((n) => n !== 'memory')

    return {
      memory,
      globalMemory,
      staleTime,
      gcTime,
      cbDuration,
      drivers,
      externalDrivers,
    }
  }

  /**
   * Initializes a single memory-only store (no external drivers)
   */
  #initMemoryOnlyStore(shared: SharedConfig): void {
    const stack = new CacheStack({
      l1: shared.globalMemory ? shared.memory : undefined,
      l2: [],
      circuitBreakerDuration: shared.cbDuration,
    })

    const cache = new InternalCache(
      {
        stack,
        emitter: this.emitter,
        dedup: this.#sharedDedup,
        defaultStaleTime: shared.staleTime,
        defaultGcTime: shared.gcTime,
        storeName: 'default',
      },
      true,
    )

    const store = this.#bus ? new CacheBackplane('default', cache, this.#bus) : cache

    this.#stores.set('default', store)
  }

  /**
   * Initializes multiple stores with external drivers
   */
  #initMultiStores(config: CacheManagerConfig, shared: SharedConfig): void {
    const storeConfigs = config.stores ?? { default: shared.externalDrivers }

    for (const [name, storeCfg] of Object.entries(storeConfigs)) {
      const useMemory = Array.isArray(storeCfg)
        ? shared.globalMemory
        : storeCfg.memory ?? shared.globalMemory
      const driverNames = Array.isArray(storeCfg) ? storeCfg : storeCfg.drivers

      const l2 = driverNames.map((n) => {
        const driver = shared.drivers[n]

        if (!driver) {
          throw new CacheError('INVALID_CONFIG', `Driver "${n}" not found`)
        }

        return driver
      })

      const stack = new CacheStack({
        l1: useMemory ? shared.memory : undefined,
        l2,
        prefix: name,
        circuitBreakerDuration: shared.cbDuration,
      })

      const cache = new InternalCache(
        {
          stack,
          emitter: this.emitter,
          dedup: this.#sharedDedup,
          defaultStaleTime: shared.staleTime,
          defaultGcTime: shared.gcTime,
          storeName: name,
        },
        true,
      )

      const store = this.#bus ? new CacheBackplane(name, cache, this.#bus) : cache

      this.#stores.set(name, store)
    }
  }
}

// ============================================================================
// PUBLIC API - Type Projections (Zero Runtime Cost)
// ============================================================================

/**
 * Typed cache manager interface with schema-based type safety.
 * Keys and values are typed based on the provided schema.
 */
export interface CacheManager<T extends Record<string, unknown>> {
  readonly emitter: EventEmitter

  use<S extends Record<string, unknown> = T>(name?: string): Cache<S>
  get<K extends keyof T & string>(key: K, options?: GetOptions): Promise<T[K] | undefined>
  set<K extends keyof T & string>(key: K, value: T[K], options?: SetOptions): Promise<void>
  getOrSet<K extends keyof T & string>(
    key: K,
    loader: Loader<T[K]>,
    options?: GetSetOptions,
  ): Promise<T[K]>
  has(key: string): Promise<boolean>

  delete(...keys: string[]): Promise<number>
  invalidateTags(tags: string[]): Promise<number>
  clear(): Promise<void>
  connect(): Promise<void>
  disconnect(): Promise<void>
}

/**
 * Generic cache manager interface with dynamic type parameters.
 * All keys are strings, values are typed per-operation.
 */
export interface GenericCacheManager {
  readonly emitter: EventEmitter

  use(name?: string): GenericCache
  get<V>(key: string, options?: GetOptions): Promise<V | undefined>
  set(key: string, value: unknown, options?: SetOptions): Promise<void>
  getOrSet<V>(key: string, loader: Loader<V>, options?: GetSetOptions): Promise<V>
  has(key: string): Promise<boolean>

  delete(...keys: string[]): Promise<number>
  invalidateTags(tags: string[]): Promise<number>
  clear(): Promise<void>
  connect(): Promise<void>
  disconnect(): Promise<void>
}

// ============================================================================
// FACTORY - Compile-time Mode Selection via Overloads
// ============================================================================

/**
 * Create a generic cache manager instance with dynamic typing.
 * @example
 * ```ts
 * const manager = createCacheManager()
 * const user = await manager.get<User>('user:1')
 * ```
 */
export function createCacheManager(config?: CacheManagerConfig): GenericCacheManager

/**
 * Create a typed cache manager instance with schema-based type safety.
 * @example
 * ```ts
 * const manager = createCacheManager<{ user: User; session: Session }>()
 * const user = await manager.get('user') // Type: User | undefined
 * ```
 */
export function createCacheManager<T extends Record<string, unknown>>(
  config?: CacheManagerConfig,
): CacheManager<T>

export function createCacheManager<T extends Record<string, unknown>>(
  config: CacheManagerConfig = {},
): CacheManager<T> | GenericCacheManager {
  // Pure type projection - zero runtime cost
  return new InternalCacheManager(config) as CacheManager<T> | GenericCacheManager
}
