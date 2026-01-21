import { createClient, type RedisClientType } from 'redis'
import type { CacheAdapter, AdapterConfig } from './types.js'

export class RedisAdapter implements CacheAdapter {
  readonly name = 'Redis (direct)'
  readonly type = 'redis' as const

  #client: RedisClientType | null = null
  #config: AdapterConfig

  constructor(config: AdapterConfig) {
    this.#config = config
  }

  async connect(): Promise<void> {
    this.#client = createClient({ url: this.#config.redisUrl })
    await this.#client.connect()
  }

  async disconnect(): Promise<void> {
    if (!this.#client) return
    await this.#client.quit()
    this.#client = null
  }

  async clear(): Promise<void> {
    if (!this.#client) throw new Error('Client not connected')
    await this.#client.flushDb()
  }

  async get<T>(key: string): Promise<T | undefined> {
    if (!this.#client) throw new Error('Client not connected')
    const data = await this.#client.get(key)
    if (!data) return undefined
    return JSON.parse(data) as T
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    if (!this.#client) throw new Error('Client not connected')
    const data = JSON.stringify(value)
    if (ttlMs) {
      await this.#client.pSetEx(key, ttlMs, data)
    } else {
      await this.#client.set(key, data)
    }
  }

  async delete(key: string): Promise<boolean> {
    if (!this.#client) throw new Error('Client not connected')
    const deleted = await this.#client.del(key)
    return deleted > 0
  }

  async has(key: string): Promise<boolean> {
    if (!this.#client) throw new Error('Client not connected')
    const exists = await this.#client.exists(key)
    return exists > 0
  }

  async getMany<T>(keys: string[]): Promise<Map<string, T>> {
    if (!this.#client) throw new Error('Client not connected')
    const values = await this.#client.mGet(keys)
    const results = new Map<string, T>()

    for (let i = 0; i < keys.length; i++) {
      const value = values[i]
      if (value !== null) {
        results.set(keys[i], JSON.parse(value) as T)
      }
    }

    return results
  }

  async setMany<T>(entries: Array<{ key: string; value: T; ttlMs?: number }>): Promise<void> {
    if (!this.#client) throw new Error('Client not connected')

    // Redis doesn't have mSetEx, so we need to pipeline
    const pipeline = this.#client.multi()

    for (const entry of entries) {
      const data = JSON.stringify(entry.value)
      if (entry.ttlMs) {
        pipeline.pSetEx(entry.key, entry.ttlMs, data)
      } else {
        pipeline.set(entry.key, data)
      }
    }

    await pipeline.exec()
  }

  async deleteMany(keys: string[]): Promise<number> {
    if (!this.#client) throw new Error('Client not connected')
    return this.#client.del(keys)
  }

  // Note: Redis doesn't have native getOrSet
  // This implementation has a race condition - intentional to show the value of @lokiverse/cache
  async getOrSet<T>(key: string, factory: () => Promise<T>, ttlMs?: number): Promise<T> {
    if (!this.#client) throw new Error('Client not connected')

    const existing = await this.get<T>(key)
    if (existing !== undefined) {
      return existing
    }

    // Race condition: multiple concurrent calls will all invoke factory
    const value = await factory()
    await this.set(key, value, ttlMs)

    return value
  }

  async invalidateTags(_tags: string[]): Promise<number> {
    // Redis doesn't have native tag support
    // Would need to maintain a separate index
    throw new Error('Tag invalidation not supported by raw Redis adapter')
  }
}
