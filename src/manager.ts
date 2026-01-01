import { createCacheBus, type CacheBus, type CacheBusSchema } from './bus/cache-bus'
import { Cache } from './cache'
import { CacheError } from './errors'

import type { CacheConfig } from './types'
import type { Bus } from '@lokiverse/bus'

export interface CacheManagerConfig {
  default: string
  stores: Record<string, CacheConfig>
  bus?: Bus<CacheBusSchema>
}

export class CacheManager {
  readonly #caches = new Map<string, Cache>()
  readonly #defaultName: string
  readonly #bus?: CacheBus

  constructor(config: CacheManagerConfig) {
    if (!config.stores[config.default]) {
      throw new CacheError(
        'INVALID_CONFIG',
        `Default cache "${config.default}" not found in stores`,
      )
    }

    this.#defaultName = config.default

    for (const [name, storeConfig] of Object.entries(config.stores)) {
      this.#caches.set(name, new Cache({ ...storeConfig, prefix: name }))
    }

    if (config.bus) {
      this.#bus = createCacheBus({
        bus: config.bus,
        onInvalidate: (keys) => this.#invalidateLocalAll(keys),
        onInvalidateTags: (tags) => this.#invalidateTagsLocalAll(tags),
        onClear: () => this.#clearLocalAll(),
      })
    }
  }

  use(name?: string): Cache {
    const cacheName = name ?? this.#defaultName
    const cache = this.#caches.get(cacheName)

    if (!cache) {
      throw new CacheError('INVALID_CONFIG', `Cache "${cacheName}" not found`)
    }

    return cache
  }

  async delete(...keys: string[]): Promise<number> {
    const results = await Promise.all(
      Array.from(this.#caches.values()).map((cache) => cache.delete(...keys)),
    )

    await this.#bus?.publishInvalidate(keys)

    return Math.max(...results, 0)
  }

  async invalidateTags(tags: string[]): Promise<number> {
    const results = await Promise.all(
      Array.from(this.#caches.values()).map((cache) => cache.invalidateTags(tags)),
    )

    await this.#bus?.publishInvalidateTags(tags)

    return results.reduce((a, b) => a + b, 0)
  }

  async clear(): Promise<void> {
    await Promise.all(Array.from(this.#caches.values()).map((cache) => cache.clear()))
    await this.#bus?.publishClear()
  }

  async connect(): Promise<void> {
    await this.#bus?.connect()
    await Promise.all(Array.from(this.#caches.values()).map((cache) => cache.connect()))
  }

  async disconnect(): Promise<void> {
    await Promise.all(Array.from(this.#caches.values()).map((cache) => cache.disconnect()))
    await this.#bus?.disconnect()
  }

  #invalidateLocalAll(keys: string[]): void {
    for (const cache of this.#caches.values()) {
      cache.deleteLocal(...keys)
    }
  }

  #invalidateTagsLocalAll(tags: string[]): void {
    for (const cache of this.#caches.values()) {
      void cache.invalidateTags(tags)
    }
  }

  #clearLocalAll(): void {
    for (const cache of this.#caches.values()) {
      cache.clearLocal()
    }
  }
}
