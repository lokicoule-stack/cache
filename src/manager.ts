import { createCacheBus, type CacheBus, type CacheBusSchema } from './bus/cache-bus'
import { Cache } from './cache'
import { createDefaultMemory } from './drivers/memory'
import { parseOptionalDuration } from './duration'
import { CacheError } from './errors'
import { CacheStack } from './stack'
import { createDedup } from './utils/dedup'
import { createEventEmitter } from './utils/events'

import type { CacheManagerConfig, SyncDriver, AsyncDriver, StoreConfig } from './types'
import type { Bus } from '@lokiverse/bus'

const DEFAULT_STALE_TIME = 60_000

export class CacheManager {
  readonly #stores = new Map<string, Cache>()
  readonly #defaultStoreName: string
  readonly #bus?: CacheBus

  constructor(
    config: CacheManagerConfig & {
      stores?: Record<string, StoreConfig<string>>
      bus?: Bus<CacheBusSchema>
    } = {},
  ) {
    const globalMemory = config.memory !== false
    const staleTime = parseOptionalDuration(config.staleTime) ?? DEFAULT_STALE_TIME
    const gcTime = parseOptionalDuration(config.gcTime) ?? staleTime
    const memory = (config.drivers as Record<string, SyncDriver> | undefined)?.memory ?? createDefaultMemory()
    const drivers = (config.drivers ?? {}) as Record<string, AsyncDriver>

    // External drivers (excluding memory)
    const externalDrivers = Object.keys(drivers).filter((n) => n !== 'memory')

    if (externalDrivers.length === 0) {
      // Memory-only mode
      this.#defaultStoreName = 'default'
      this.#stores.set('default', this.#createCache('default', globalMemory ? memory : undefined, [], staleTime, gcTime))
    } else {
      // With external drivers
      const storeConfigs = config.stores ?? { default: externalDrivers }

      this.#defaultStoreName = Object.keys(storeConfigs)[0]

      for (const [name, storeConfig] of Object.entries(storeConfigs)) {
        const useMemory = Array.isArray(storeConfig) ? globalMemory : (storeConfig.memory ?? globalMemory)
        const driverNames = Array.isArray(storeConfig) ? storeConfig : storeConfig.drivers

        const l2 = driverNames.map((n) => {
          const driver = drivers[n]

          if (!driver) {
            throw new CacheError('INVALID_CONFIG', `Driver "${n}" not found`)
          }

          return driver
        })

        this.#stores.set(name, this.#createCache(name, useMemory ? memory : undefined, l2, staleTime, gcTime))
      }
    }

    // Setup bus if provided
    if (config.bus) {
      this.#bus = createCacheBus({
        bus: config.bus,
        onInvalidate: (keys) => this.#invalidateL1All(keys),
        onInvalidateTags: (tags) => this.#invalidateTagsAll(tags),
        onClear: () => this.#clearL1All(),
      })
    }
  }

  use(name?: string): Cache {
    const storeName = name ?? this.#defaultStoreName
    const cache = this.#stores.get(storeName)

    if (!cache) {
      throw new CacheError('INVALID_CONFIG', `Store "${storeName}" not found`)
    }

    return cache
  }

  async get<T>(key: string): Promise<T | undefined> {
    return this.use().get(key) as Promise<T | undefined>
  }

  async set<T>(key: string, value: T, options?: Parameters<Cache['set']>[2]): Promise<void> {
    return this.use().set(key, value as never, options)
  }

  async getOrSet<T>(
    key: string,
    loader: Parameters<Cache['getOrSet']>[1],
    options?: Parameters<Cache['getOrSet']>[2],
  ): Promise<T> {
    return this.use().getOrSet(key, loader as never, options) as Promise<T>
  }

  async has(key: string): Promise<boolean> {
    return this.use().has(key)
  }

  async delete(...keys: string[]): Promise<number> {
    const results = await Promise.all(
      Array.from(this.#stores.values()).map((cache) => cache.delete(...keys)),
    )

    await this.#bus?.publishInvalidate(keys)

    return Math.max(...results, 0)
  }

  async invalidateTags(tags: string[]): Promise<number> {
    const results = await Promise.all(
      Array.from(this.#stores.values()).map((cache) => cache.invalidateTags(tags)),
    )

    await this.#bus?.publishInvalidateTags(tags)

    return results.reduce((a, b) => a + b, 0)
  }

  async clear(): Promise<void> {
    await Promise.all(Array.from(this.#stores.values()).map((cache) => cache.clear()))
    await this.#bus?.publishClear()
  }

  async connect(): Promise<void> {
    await this.#bus?.connect()
    await Promise.all(Array.from(this.#stores.values()).map((cache) => cache.connect()))
  }

  async disconnect(): Promise<void> {
    await Promise.all(Array.from(this.#stores.values()).map((cache) => cache.disconnect()))
    await this.#bus?.disconnect()
  }

  #createCache(
    prefix: string,
    l1: SyncDriver | undefined,
    l2: AsyncDriver[],
    staleTime: number,
    gcTime: number,
  ): Cache {
    return new Cache(
      {
        stack: new CacheStack({ l1, l2, prefix }),
        events: createEventEmitter(),
        dedup: createDedup(),
        defaultStaleTime: staleTime,
        defaultGcTime: gcTime,
      },
      true,
    )
  }

  #invalidateL1All(keys: string[]): void {
    for (const cache of this.#stores.values()) {
      cache.deleteL1(...keys)
    }
  }

  #invalidateTagsAll(tags: string[]): void {
    for (const cache of this.#stores.values()) {
      void cache.invalidateTags(tags)
    }
  }

  #clearL1All(): void {
    for (const cache of this.#stores.values()) {
      cache.clearL1()
    }
  }
}

export function createCacheManager(
  config?: CacheManagerConfig & {
    stores?: Record<string, StoreConfig<string>>
    bus?: Bus<CacheBusSchema>
  },
): CacheManager {
  return new CacheManager(config)
}
