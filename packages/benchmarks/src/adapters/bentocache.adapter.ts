import { BentoCache, bentostore } from 'bentocache'
import { memoryDriver } from 'bentocache/drivers/memory'
import { redisDriver } from 'bentocache/drivers/redis'
import type { CacheAdapter, AdapterConfig } from './types.js'

export class BentoCacheAdapter implements CacheAdapter {
  readonly name = 'BentoCache'
  readonly type = 'bentocache' as const

  #bento: BentoCache | null = null
  #config: AdapterConfig

  constructor(config: AdapterConfig) {
    this.#config = config
  }

  async connect(): Promise<void> {
    // Parse redis URL for ioredis format
    const url = new URL(this.#config.redisUrl)

    this.#bento = new BentoCache({
      default: 'cache',
      stores: {
        cache: bentostore()
          .useL1Layer(
            memoryDriver({
              maxItems: this.#config.l1MaxItems ?? 10_000,
              serialize: false, // Disable JSON serialization for fair comparison
            }),
          )
          .useL2Layer(
            redisDriver({
              connection: {
                host: url.hostname,
                port: Number.parseInt(url.port || '6379', 10),
              },
            }),
          ),
      },
    })
  }

  async disconnect(): Promise<void> {
    if (!this.#bento) return
    await this.#bento.disconnect()
    this.#bento = null
  }

  async clear(): Promise<void> {
    if (!this.#bento) throw new Error('Cache not connected')
    await this.#bento.clear()
  }

  async get<T>(key: string): Promise<T | undefined> {
    if (!this.#bento) throw new Error('Cache not connected')
    return this.#bento.get({ key })
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    if (!this.#bento) throw new Error('Cache not connected')
    if (!key) throw new Error(`Invalid key: ${key}`)
    if (value === undefined) throw new Error('Value cannot be undefined')
    const options = ttlMs ? { ttl: `${ttlMs}ms` } : {}
    await this.#bento.set({ key, value, ...options })
  }

  async delete(key: string): Promise<boolean> {
    if (!this.#bento) throw new Error('Cache not connected')
    await this.#bento.delete({ key })
    return true // BentoCache doesn't return deletion status
  }

  async has(key: string): Promise<boolean> {
    if (!this.#bento) throw new Error('Cache not connected')
    return this.#bento.has({ key })
  }

  async getMany<T>(keys: string[]): Promise<Map<string, T>> {
    if (!this.#bento) throw new Error('Cache not connected')
    const results = new Map<string, T>()

    // BentoCache doesn't have native getMany
    await Promise.all(
      keys.map(async (key) => {
        const value = await this.#bento!.get<T>({ key })
        if (value !== undefined) {
          results.set(key, value)
        }
      }),
    )

    return results
  }

  async setMany<T>(entries: Array<{ key: string; value: T; ttlMs?: number }>): Promise<void> {
    if (!this.#bento) throw new Error('Cache not connected')

    // BentoCache doesn't have native setMany
    await Promise.all(
      entries.map((entry) => {
        const options = entry.ttlMs ? { ttl: `${entry.ttlMs}ms` } : {}
        return this.#bento!.set({ key: entry.key, value: entry.value, ...options })
      }),
    )
  }

  async deleteMany(keys: string[]): Promise<number> {
    if (!this.#bento) throw new Error('Cache not connected')

    await Promise.all(keys.map((key) => this.#bento!.delete({ key })))

    return keys.length // BentoCache doesn't return deletion count
  }

  async getOrSet<T>(key: string, factory: () => Promise<T>, ttlMs?: number): Promise<T> {
    if (!this.#bento) throw new Error('Cache not connected')

    const options = ttlMs ? { ttl: `${ttlMs}ms` } : {}
    return this.#bento.getOrSet({ key, factory, ...options })
  }

  async invalidateTags(tags: string[]): Promise<number> {
    if (!this.#bento) throw new Error('Cache not connected')

    // BentoCache doesn't return count of invalidated keys
    await Promise.all(tags.map((tag) => this.#bento!.delete({ key: tag })))

    return tags.length
  }
}
