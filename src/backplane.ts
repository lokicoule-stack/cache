/* eslint-disable @typescript-eslint/no-floating-promises */
import type { InternalCache } from './cache'
import type { CacheBusSchema } from './manager'
import type { MessageBus } from '@lokiverse/bus'

/**
 * CacheBackplane wraps an InternalCache instance to add distributed synchronization
 * via MessageBus. It intercepts mutation operations (delete, invalidateTags, clear)
 * to publish events to other instances, and subscribes to sync L1 invalidations.
 *
 * Architecture:
 * - Read operations: delegate directly to .cache (no overhead)
 * - Write operations: execute locally + publish to bus for cross-instance sync
 * - L1 invalidation: handled via bus subscriptions (L2 is already shared)
 *
 * @internal This class is used internally by CacheManager
 */
export class CacheBackplane {
  readonly cache: InternalCache
  readonly name: string
  readonly #bus: MessageBus<CacheBusSchema>

  constructor(name: string, cache: InternalCache, bus: MessageBus<CacheBusSchema>) {
    this.name = name
    this.cache = cache
    this.#bus = bus
    this.#setupSync()
  }

  /**
   * Delete keys locally and publish invalidation event
   */
  async delete(...keys: string[]): Promise<number> {
    const count = await this.cache.delete(...keys)

    if (keys.length > 0) {
      await this.#bus.publish('cache:invalidate', {
        keys,
        store: this.name,
      })
    }

    return count
  }

  /**
   * Invalidate tags locally and publish invalidation event
   */
  async invalidateTags(tags: string[]): Promise<number> {
    const count = await this.cache.invalidateTags(tags)

    if (tags.length > 0) {
      await this.#bus.publish('cache:invalidate:tags', {
        tags,
        store: this.name,
      })
    }

    return count
  }

  /**
   * Clear cache locally and publish clear event
   */
  async clear(): Promise<void> {
    await this.cache.clear()

    await this.#bus.publish('cache:clear', {
      store: this.name,
    })
  }

  /**
   * Create namespaced backplane that shares the same bus
   */
  namespace(prefix: string): CacheBackplane {
    return new CacheBackplane(this.name, this.cache.namespace(prefix), this.#bus)
  }

  async connect(): Promise<void> {
    await this.cache.connect()
  }

  async disconnect(): Promise<void> {
    await this.cache.disconnect()
  }

  /**
   * Setup bus subscriptions for cross-instance L1 invalidation
   * L2 (Redis) is already shared, so we only need to invalidate L1
   */
  #setupSync(): void {
    this.#bus.subscribe('cache:invalidate', ({ keys, store }) => {
      if (store !== this.name) {
        return
      }

      this.cache.invalidateL1(...keys)
    })

    this.#bus.subscribe('cache:invalidate:tags', ({ tags, store }) => {
      if (store !== this.name) {
        return
      }

      void this.cache.invalidateTags(tags)
    })

    this.#bus.subscribe('cache:clear', ({ store }) => {
      if (store !== this.name) {
        return
      }

      this.cache.clearL1()
    })
  }
}
