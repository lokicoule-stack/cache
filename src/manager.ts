
import { MessageBus } from '@lokiverse/bus'

import { InternalCache } from './cache'
import { CacheError, ERROR_CODES } from './errors'
import { createEventEmitter, type EventEmitter } from './observability/events'
import { createDedup } from './resilience/dedup'
import { memoryDriver } from './storage/drivers/memory'
import { TieredStore } from './storage/tiered-store'
import { DistributedSync, type CacheBusSchema } from './sync/distributed'
import { parseOptionalDuration } from './types/duration'

import type { SyncDriver, AsyncDriver } from './contracts/driver'
import type { GenericCacheManager, CacheManager } from './contracts/manager'
import type {
  CacheManagerConfig,
  GetOptions,
  GetSetOptions,
  Loader,
  SetOptions,
} from './types/options'

const DEFAULT_STALE_TIME = 60_000

interface SharedConfig {
  memory: SyncDriver
  globalMemory: boolean
  staleTime: number
  gcTime: number
  cbDuration: number | undefined
  drivers: Record<string, AsyncDriver>
  externalDrivers: string[]
}

interface InternalConfig {
  emitter: EventEmitter
  stores: Map<string, InternalCache<Record<string, unknown>>>
  defaultStoreName: string
  bus?: MessageBus<CacheBusSchema>
}

/**
 * @internal
 */
export class InternalCacheManager<T extends Record<string, unknown> = Record<string, unknown>> {
  readonly emitter: EventEmitter
  readonly #stores: Map<string, InternalCache<T>>
  readonly #defaultStoreName: string
  readonly #bus?: MessageBus<CacheBusSchema>

  constructor(config?: CacheManagerConfig)
  constructor(internal: InternalConfig, isInternal: true)
  constructor(config?: CacheManagerConfig | InternalConfig, isInternal?: true) {
    if (isInternal) {
      const internal = config as InternalConfig

      this.emitter = internal.emitter
      this.#stores = internal.stores as Map<string, InternalCache<T>>
      this.#defaultStoreName = internal.defaultStoreName
      this.#bus = internal.bus
    } else {
      const external = (config as CacheManagerConfig) ?? {}

      this.emitter = external.emitter ?? createEventEmitter()

      const shared = this.#buildSharedConfig(external)

      if (external.bus) {
        this.#bus = new MessageBus<CacheBusSchema>(external.bus)
      }

      this.#stores = new Map()

      if (shared.externalDrivers.length === 0) {
        this.#defaultStoreName = 'default'
        this.#initMemoryOnlyStore(shared)
      } else {
        const storeConfigs = external.stores ?? { default: shared.externalDrivers }
        const firstKey = Object.keys(storeConfigs)[0]

        this.#defaultStoreName = firstKey ?? 'default'
        this.#initMultiStores(external, shared)
      }

      // Register plugins
      for (const plugin of external.plugins ?? []) {
        plugin.register(this.emitter)
      }
    }
  }

  use(name?: string): InternalCache<T> {
    const storeName = name ?? this.#defaultStoreName
    const store = this.#stores.get(storeName)

    if (!store) {
      throw new CacheError(ERROR_CODES.STORE_NOT_FOUND, `Store "${storeName}" not found`, {
        context: { storeName, availableStores: Array.from(this.#stores.keys()) },
      })
    }

    return store
  }

  get<V = unknown>(key: string, options?: GetOptions): Promise<V | undefined>
  get<K extends keyof T>(key: K, options?: GetOptions): Promise<T[K] | undefined>

  async get(key: string, options?: GetOptions): Promise<unknown> {
    return this.use().get(key, options)
  }

  set<V = unknown>(key: string, value: V, options?: SetOptions): Promise<void>
  set<K extends keyof T>(key: K, value: T[K], options?: SetOptions): Promise<void>

  async set(key: string, value: unknown, options?: SetOptions): Promise<void> {
    return this.use().set(key, value, options)
  }

  getOrSet<V = unknown>(key: string, loader: Loader<V>, options?: GetSetOptions): Promise<V>
  getOrSet<K extends keyof T>(key: K, loader: Loader<T[K]>, options?: GetSetOptions): Promise<T[K]>

  async getOrSet(key: string, loader: Loader<unknown>, options?: GetSetOptions): Promise<unknown> {
    return this.use().getOrSet(key, loader, options)
  }

  async has(key: string): Promise<boolean> {
    return this.use().has(key)
  }

  async delete(...keys: string[]): Promise<number> {
    const results = await Promise.all(
      Array.from(this.#stores.values()).map((store) => store.delete(...keys)),
    )

    return Math.max(...results, 0)
  }

  async invalidateTags(tags: string[]): Promise<number> {
    const results = await Promise.all(
      Array.from(this.#stores.values()).map((store) => store.invalidateTags(tags)),
    )

    return results.reduce((a: number, b: number) => a + b, 0)
  }

  async clear(): Promise<void> {
    await Promise.all(Array.from(this.#stores.values()).map((store) => store.clear()))
  }

  async connect(): Promise<void> {
    if (this.#bus) {
      await this.#bus.connect()
    }

    await Promise.all(Array.from(this.#stores.values()).map((store) => store.connect()))
  }

  async disconnect(): Promise<void> {
    await Promise.all(Array.from(this.#stores.values()).map((store) => store.disconnect()))

    if (this.#bus) {
      await this.#bus.disconnect()
    }
  }

  #buildSharedConfig(config: CacheManagerConfig): SharedConfig {
    const memory = (config.drivers?.memory as SyncDriver) ?? memoryDriver()
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

  #initMemoryOnlyStore(shared: SharedConfig): void {
    const sharedDedup = createDedup()

    const store = new TieredStore({
      l1: shared.globalMemory ? shared.memory : undefined,
      l2: [],
      circuitBreakerDuration: shared.cbDuration,
    })

    const sync = this.#bus ? new DistributedSync(this.#bus, 'default') : null

    const cache = new InternalCache<T>(
      {
        store,
        emitter: this.emitter,
        dedup: sharedDedup,
        defaultStaleTime: shared.staleTime,
        defaultGcTime: shared.gcTime,
        storeName: 'default',
        sync,
      },
      true,
    )

    if (sync) {
      sync.setup({
        onRemoteInvalidate: (keys) => store.invalidateL1(...keys),
        onRemoteClear: () => store.clearL1(),
        onRemoteInvalidateTags: (tags) => void store.invalidateTags(tags),
      })
    }

    this.#stores.set('default', cache)
  }

  #initMultiStores(config: CacheManagerConfig, shared: SharedConfig): void {
    const storeConfigs = config.stores ?? { default: shared.externalDrivers }
    const sharedDedup = createDedup()

    for (const [name, storeCfg] of Object.entries(storeConfigs)) {
      const useMemory = Array.isArray(storeCfg)
        ? shared.globalMemory
        : storeCfg.memory ?? shared.globalMemory
      const driverNames = Array.isArray(storeCfg) ? storeCfg : storeCfg.drivers

      const l2 = driverNames.map((n) => {
        const driver = shared.drivers[n]

        if (!driver) {
          throw new CacheError(ERROR_CODES.DRIVER_NOT_FOUND, `Driver "${n}" not found`, {
            context: { driverName: n, availableDrivers: Object.keys(shared.drivers) },
          })
        }

        return driver
      })

      const store = new TieredStore({
        l1: useMemory ? shared.memory : undefined,
        l2,
        prefix: name,
        circuitBreakerDuration: shared.cbDuration,
      })

      const sync = this.#bus ? new DistributedSync(this.#bus, name) : null

      const cache = new InternalCache<T>(
        {
          store,
          emitter: this.emitter,
          dedup: sharedDedup,
          defaultStaleTime: shared.staleTime,
          defaultGcTime: shared.gcTime,
          storeName: name,
          sync,
        },
        true,
      )

      if (sync) {
        sync.setup({
          onRemoteInvalidate: (keys) => store.invalidateL1(...keys),
          onRemoteClear: () => store.clearL1(),
          onRemoteInvalidateTags: (tags) => void store.invalidateTags(tags),
        })
      }

      this.#stores.set(name, cache)
    }
  }
}

/**
 * Creates a cache manager with runtime-typed keys and values.
 * Use when schema is dynamic or unknown at compile time.
 * For compile-time type safety, use the generic overload.
 *
 * @example
 * ```ts
 * const manager = createCacheManager({
 *   drivers: { redis: redisDriver() },
 *   stores: { default: ['redis'] }
 * })
 * const user = await manager.get<User>('user:1') // Type asserted at call-site
 * ```
 */
export function createCacheManager(config?: CacheManagerConfig): GenericCacheManager

/**
 * Creates a schema-locked cache manager with compile-time key-value validation.
 * Use when schema is fixed and known at compile time.
 *
 * @example
 * ```ts
 * interface Schema {
 *   'user:1': User
 *   'session:abc': Session
 * }
 * const manager = createCacheManager<Schema>({ staleTime: '5m' })
 * const user = await manager.get('user:1') // Type: User | undefined (validated at compile-time)
 * ```
 */
export function createCacheManager<T extends Record<string, unknown>>(
  config?: CacheManagerConfig,
): CacheManager<T>

export function createCacheManager<T extends Record<string, unknown> = Record<string, unknown>>(
  config?: CacheManagerConfig,
): GenericCacheManager | CacheManager<T> {
  return new InternalCacheManager<T>(config) as GenericCacheManager | CacheManager<T>
}
