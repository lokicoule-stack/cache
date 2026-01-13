import { LRUCache } from 'lru-cache'

import type { CacheEntry } from '../entry'
import type { SyncDriver } from '../types'

export interface MemoryDriverConfig {
  maxItems?: number
  maxSize?: number
}

const DEFAULT_MAX_ITEMS = 10_000

export class MemoryDriver implements SyncDriver {
  readonly name = 'memory'
  readonly #cache: LRUCache<string, CacheEntry>

  constructor(config: MemoryDriverConfig = {}) {
    this.#cache = new LRUCache<string, CacheEntry>({
      max: config.maxItems ?? DEFAULT_MAX_ITEMS,
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

  delete(key: string): boolean {
    return this.#cache.delete(key)
  }

  deleteMany(keys: string[]): number {
    let count = 0

    for (const key of keys) {
      if (this.#cache.delete(key)) {
        count++
      }
    }

    return count
  }

  getMany(keys: string[]): Map<string, CacheEntry> {
    const result = new Map<string, CacheEntry>()

    for (const key of keys) {
      const entry = this.get(key)

      if (entry) {
        result.set(key, entry)
      }
    }

    return result
  }

  has(key: string): boolean {
    const entry = this.#cache.get(key)

    return entry !== undefined && !entry.isGced()
  }

  clear(): void {
    this.#cache.clear()
  }
}

export function memoryDriver(config?: MemoryDriverConfig): MemoryDriver {
  return new MemoryDriver(config)
}

export function createDefaultMemory(): MemoryDriver {
  return new MemoryDriver()
}
