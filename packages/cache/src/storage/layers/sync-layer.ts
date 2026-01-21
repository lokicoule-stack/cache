import type { SyncDriver } from '@/contracts/driver'
import type { CacheEntry } from '@/entry'

/** @internal */
export interface SyncLayer {
  readonly name: string
  get(key: string): CacheEntry | undefined
  getMany(keys: string[]): Map<string, CacheEntry>
  set(key: string, entry: CacheEntry): void
  delete(key: string): boolean
  deleteMany(keys: string[]): number
  has(key: string): boolean
  clear(): void
}

/** @internal */
export function wrapSyncDriver(driver: SyncDriver): SyncLayer {
  return {
    name: driver.name,

    get(key) {
      return driver.get(key)
    },

    getMany(keys) {
      if (driver.getMany) {
        return driver.getMany(keys)
      }

      const result = new Map<string, CacheEntry>()

      for (const k of keys) {
        const entry = driver.get(k)

        if (entry) {
          result.set(k, entry)
        }
      }

      return result
    },

    set(key, entry) {
      driver.set(key, entry)
    },

    delete(key) {
      return driver.delete(key)
    },

    deleteMany(keys) {
      if (driver.deleteMany) {
        return driver.deleteMany(keys)
      }

      let count = 0

      for (const k of keys) {
        if (driver.delete(k)) {
          count++
        }
      }

      return count
    },

    has(key) {
      return driver.has(key)
    },

    clear() {
      driver.clear()
    },
  }
}
