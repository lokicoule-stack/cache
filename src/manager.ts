import { MessageBus, type BusSchema } from '@lokiverse/bus'

import { CacheBackplane } from './backplane'
import { Cache } from './cache'
import { createDefaultMemory } from './drivers/memory'
import { parseOptionalDuration } from './duration'
import { CacheError } from './errors'
import { CacheStack } from './stack'
import { createDedup } from './utils/dedup'
import { createEventEmitter, type EventEmitter } from './utils/events'

import type { CacheManagerConfig, AsyncDriver, SyncDriver } from './types'

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
 * Central cache manager that orchestrates multiple cache stores.
 *
 * Supports:
 * - Multiple named stores with different driver configurations
 * - Distributed cache synchronization via MessageBus
 * - Shared L1 memory layer across stores (optional)
 * - Circuit breaker protection for L2 drivers
 *
 * @example
 * ```ts
 * const manager = new CacheManager({
 *   drivers: {
 *     redis: redisDriver({ host: 'localhost' })
 *   },
 *   stores: {
 *     users: ['redis'],
 *     sessions: { drivers: ['redis'], memory: false }
 *   }
 * })
 *
 * await manager.use('users').set('user:1', { name: 'Alice' })
 * ```
 */
export class CacheManager<T extends Record<string, unknown> = Record<string, unknown>> {
  readonly emitter: EventEmitter
  readonly #stores = new Map<string, Cache<T> | CacheBackplane<T>>()
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
   * @returns Cache instance for the requested store
   * @throws {CacheError} If store name not found
   *
   * @example
   * ```ts
   * const usersCache = manager.use('users')
   * await usersCache.set('user:1', { name: 'Alice' })
   * ```
   */
  use<S extends Record<string, unknown> = T>(name?: string): Cache<S> {
    const storeName = name ?? this.#defaultStoreName
    const store = this.#stores.get(storeName)

    if (!store) {
      throw new CacheError('INVALID_CONFIG', `Store "${storeName}" not found`)
    }

    // If backplane, return the underlying cache; otherwise return the cache directly
    const cache = store instanceof CacheBackplane ? store.cache : store

    return cache as unknown as Cache<S>
  }

  /**
   * Get value from default store.
   * Convenience method that delegates to `use().get()`.
   */
  async get<T>(key: string, options?: Parameters<Cache['get']>[1]): Promise<T | undefined> {
    return this.use().get(key, options) as Promise<T | undefined>
  }

  /**
   * Set value in default store.
   * Convenience method that delegates to `use().set()`.
   */
  async set<T>(key: string, value: T, options?: Parameters<Cache['set']>[2]): Promise<void> {
    return this.use().set(key, value as never, options)
  }

  /**
   * Get or compute value in default store.
   * Convenience method that delegates to `use().getOrSet()`.
   */
  async getOrSet<T>(
    key: string,
    loader: Parameters<Cache['getOrSet']>[1],
    options?: Parameters<Cache['getOrSet']>[2],
  ): Promise<T> {
    return this.use().getOrSet(key, loader as never, options) as Promise<T>
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

    return results.reduce((a, b) => a + b, 0)
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

    const cache = new Cache<T>(
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

      const cache = new Cache<T>(
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

export function createCacheManager<T extends Record<string, unknown> = Record<string, unknown>>(
  config?: CacheManagerConfig,
): CacheManager<T> {
  return new CacheManager<T>(config)
}
