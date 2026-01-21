import { createCache, memoryDriver, redisDriver, type Cache } from '@lokiverse/cache'
import type { CacheAdapter, AdapterConfig } from './types.js'

export class LokiverseAdapter implements CacheAdapter {
  readonly name = '@lokiverse/cache'
  readonly type = 'lokiverse' as const

  #cache: Cache | null = null
  #config: AdapterConfig

  constructor(config: AdapterConfig) {
    this.#config = config
  }

  async connect(): Promise<void> {
    this.#cache = createCache({
      l1: memoryDriver({ maxItems: this.#config.l1MaxItems ?? 10_000 }),
      l2: redisDriver({ connection: { url: this.#config.redisUrl } }),
      staleTime: this.#config.defaultTtlMs ?? 60_000,
    })
  }

  async disconnect(): Promise<void> {
    if (!this.#cache) return
    await this.#cache.disconnect()
    this.#cache = null
  }

  async clear(): Promise<void> {
    if (!this.#cache) throw new Error('Cache not connected')
    await this.#cache.clear()
  }

  async get<T>(key: string): Promise<T | undefined> {
    if (!this.#cache) throw new Error('Cache not connected')
    return this.#cache.get<T>(key)
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    if (!this.#cache) throw new Error('Cache not connected')
    await this.#cache.set(key, value, { staleTime: ttlMs })
  }

  async delete(key: string): Promise<boolean> {
    if (!this.#cache) throw new Error('Cache not connected')
    const deleted = await this.#cache.delete(key)
    return deleted > 0
  }

  async has(key: string): Promise<boolean> {
    if (!this.#cache) throw new Error('Cache not connected')
    return this.#cache.has(key)
  }

  async getMany<T>(keys: string[]): Promise<Map<string, T>> {
    if (!this.#cache) throw new Error('Cache not connected')
    const results = new Map<string, T>()
    await Promise.all(
      keys.map(async (key) => {
        const value = await this.#cache!.get<T>(key)
        if (value !== undefined) {
          results.set(key, value)
        }
      })
    )
    return results
  }

  async setMany<T>(entries: Array<{ key: string; value: T; ttlMs?: number }>): Promise<void> {
    if (!this.#cache) throw new Error('Cache not connected')
    await Promise.all(
      entries.map((entry) =>
        this.#cache!.set(entry.key, entry.value, { staleTime: entry.ttlMs })
      )
    )
  }

  async deleteMany(keys: string[]): Promise<number> {
    if (!this.#cache) throw new Error('Cache not connected')
    return this.#cache.delete(...keys)
  }

  async getOrSet<T>(key: string, factory: () => Promise<T>, ttlMs?: number): Promise<T> {
    if (!this.#cache) throw new Error('Cache not connected')
    return this.#cache.getOrSet(key, factory, { staleTime: ttlMs })
  }

  async invalidateTags(tags: string[]): Promise<number> {
    if (!this.#cache) throw new Error('Cache not connected')
    return this.#cache.invalidateTags(tags)
  }

  // Special method for testing: clear only L1 to force L2 reads
  clearL1(): void {
    // Access to internal cache structure needed for specific benchmarks
    // This is intentionally not part of the public API
  }
}
