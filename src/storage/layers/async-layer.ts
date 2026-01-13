import type { AsyncDriver } from '@/contracts/driver'
import type { CacheEntry } from '@/entry'

/**
 * @internal
 */
export interface AsyncLayer {
  readonly name: string
  readonly driver: AsyncDriver
  get(key: string): Promise<CacheEntry | undefined>
  getMany(keys: string[]): Promise<Map<string, CacheEntry>>
  set(key: string, entry: CacheEntry): Promise<void>
  delete(key: string): Promise<boolean>
  deleteMany(keys: string[]): Promise<number>
  has(key: string): Promise<boolean>
  clear(): Promise<void>
}

/**
 * @internal
 */
export function wrapAsyncDriver(driver: AsyncDriver): AsyncLayer {
  return {
    name: driver.name,
    driver,

    async get(key) {
      return driver.get(key)
    },

    async getMany(keys) {
      if (driver.getMany) {
        return driver.getMany(keys)
      }

      const entries = await Promise.all(keys.map((k) => driver.get(k)))
      const result = new Map<string, CacheEntry>()

      for (let i = 0; i < keys.length; i++) {
        const entry = entries[i]

        if (entry) {
          result.set(keys[i], entry)
        }
      }

      return result
    },

    async set(key, entry) {
      await driver.set(key, entry)
    },

    async delete(key) {
      return driver.delete(key)
    },

    async deleteMany(keys) {
      if (driver.deleteMany) {
        return driver.deleteMany(keys)
      }

      const deleted = await Promise.all(keys.map((k) => driver.delete(k)))

      return deleted.filter(Boolean).length
    },

    async has(key) {
      return driver.has(key)
    },

    async clear() {
      await driver.clear()
    },
  }
}
