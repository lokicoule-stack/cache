import type { CacheEntry } from '../entry'

/**
 * Synchronous driver interface (for L1 in-memory caches)
 */
export interface SyncDriver {
  readonly name: string

  get(key: string): CacheEntry | undefined
  getMany?(keys: string[]): Map<string, CacheEntry>
  set(key: string, entry: CacheEntry): void
  delete(key: string): boolean
  deleteMany?(keys: string[]): number
  has(key: string): boolean
  clear(): void
}

/**
 * Asynchronous driver interface (for L2 remote caches like Redis)
 */
export interface AsyncDriver {
  readonly name: string

  get(key: string): Promise<CacheEntry | undefined>
  getMany?(keys: string[]): Promise<Map<string, CacheEntry>>
  set(key: string, entry: CacheEntry): Promise<void>
  delete(key: string): Promise<boolean>
  deleteMany?(keys: string[]): Promise<number>
  has(key: string): Promise<boolean>
  clear(): Promise<void>

  connect?(): Promise<void>
  disconnect?(): Promise<void>
}
