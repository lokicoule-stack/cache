import {
  createClient,
  createCluster,
  type RedisClientOptions,
  type RedisClusterOptions,
} from 'redis'

import { CacheEntry, type SerializedEntry } from '../entry'
import { CacheError } from '../errors'

import type { AsyncStore } from '../types'

export type RedisInstance = ReturnType<typeof createClient> | ReturnType<typeof createCluster>

export type RedisStoreConfig = (RedisClientOptions | RedisClusterOptions) & {
  name?: string
}

export interface RedisStoreExternalConfig {
  client: RedisInstance
  name?: string
}

function isClusterConfig(config: RedisStoreConfig): config is RedisClusterOptions {
  return 'rootNodes' in config
}

function isExternalConfig(
  config: RedisStoreConfig | RedisStoreExternalConfig,
): config is RedisStoreExternalConfig {
  return 'client' in config
}

export class RedisStore implements AsyncStore {
  readonly name: string
  #client?: RedisInstance
  readonly #config: RedisStoreConfig | RedisStoreExternalConfig

  constructor(config: RedisStoreConfig | RedisStoreExternalConfig = {}) {
    this.#config = config
    this.name = config.name ?? 'redis'
  }

  async connect(): Promise<void> {
    await this.#exec('connect', async () => {
      if (isExternalConfig(this.#config)) {
        this.#client = this.#config.client
        if (!this.#client.isOpen) {
          await this.#client.connect()
        }
      } else if (isClusterConfig(this.#config)) {
        this.#client = createCluster(this.#config)
        await this.#client.connect()
      } else {
        this.#client = createClient({
          ...this.#config,
          socket: {
            reconnectStrategy: (retries) => Math.min(retries * 100, 3000),
            ...this.#config.socket,
          },
        })
        await this.#client.connect()
      }
    })
  }

  async disconnect(): Promise<void> {
    await this.#exec('disconnect', async () => {
      await this.#client?.quit()
      this.#client = undefined
    })
  }

  async get(key: string): Promise<CacheEntry | undefined> {
    return this.#exec('get', async () => {
      const data = await this.#ensureClient().get(key)

      if (!data) {
        return undefined
      }

      const parsed = JSON.parse(data) as SerializedEntry
      const entry = CacheEntry.deserialize(parsed)

      if (entry.isGced()) {
        await this.#ensureClient().del(key)

        return undefined
      }

      return entry
    })
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    await this.#exec('set', async () => {
      const ttlMs = entry.gcAt - Date.now()

      if (ttlMs <= 0) {
        return
      }

      const data = JSON.stringify(entry.serialize())

      await this.#ensureClient().pSetEx(key, ttlMs, data)
    })
  }

  async delete(...keys: string[]): Promise<number> {
    if (keys.length === 0) {
      return 0
    }

    return this.#exec('delete', async () => {
      return await this.#ensureClient().del(keys)
    })
  }

  async has(key: string): Promise<boolean> {
    return this.#exec('has', async () => {
      const exists = await this.#ensureClient().exists(key)

      return exists > 0
    })
  }

  async clear(): Promise<void> {
    await this.#exec('clear', async () => {
      await this.#ensureClient().flushDb()
    })
  }

  #ensureClient(): RedisInstance {
    if (!this.#client) {
      throw new CacheError('NOT_CONNECTED', 'Store not connected. Call connect() first')
    }

    return this.#client
  }

  async #exec<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (err) {
      if (err instanceof CacheError) {
        throw err
      }
      throw new CacheError(
        'STORE_FAILED',
        `${operation} failed: ${(err as Error).message}`,
        err as Error,
      )
    }
  }
}

export function redisStore(config?: RedisStoreConfig | RedisStoreExternalConfig): RedisStore {
  return new RedisStore(config)
}
