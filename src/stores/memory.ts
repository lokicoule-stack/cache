import { LRUCache } from 'lru-cache'

import type { CacheEntry } from '../entry'
import type { SyncStore } from '../types'

export interface MemoryStoreConfig {
  maxItems?: number
  maxSize?: number
}

export class MemoryStore implements SyncStore {
  readonly name = 'memory'
  readonly #cache: LRUCache<string, CacheEntry>

  constructor(config: MemoryStoreConfig = {}) {
    this.#cache = new LRUCache<string, CacheEntry>({
      max: config.maxItems ?? 1000,
      maxSize: config.maxSize,
      sizeCalculation: config.maxSize ? (entry) => JSON.stringify(entry).length * 2 : undefined,
    })
  }

  get(key: string): CacheEntry | undefined {
    const entry = this.#cache.get(key)

    if (!entry || entry.isGced()) {
      return undefined
    }

    return entry
  }

  set(key: string, entry: CacheEntry): void {
    const ttl = entry.gcAt - Date.now()

    if (ttl <= 0) {
      return
    }

    this.#cache.set(key, entry, { ttl })
  }

  delete(...keys: string[]): number {
    let count = 0

    for (const key of keys) {
      if (this.#cache.delete(key)) {
        count++
      }
    }

    return count
  }

  has(key: string): boolean {
    const entry = this.#cache.get(key)

    return entry !== undefined && !entry.isGced()
  }

  clear(): void {
    this.#cache.clear()
  }
}

export function memoryStore(config?: MemoryStoreConfig): MemoryStore {
  return new MemoryStore(config)
}
