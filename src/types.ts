import type { CacheEntry } from './entry'

export type Duration = number | string

export interface SyncDriver {
  readonly name: string
  get(key: string): CacheEntry | undefined
  set(key: string, entry: CacheEntry): void
  delete(...keys: string[]): number
  has(key: string): boolean
  clear(): void
}

export interface AsyncDriver {
  readonly name: string
  get(key: string): Promise<CacheEntry | undefined>
  set(key: string, entry: CacheEntry): Promise<void>
  delete(...keys: string[]): Promise<number>
  has(key: string): Promise<boolean>
  clear(): Promise<void>
  connect?(): Promise<void>
  disconnect?(): Promise<void>
}

export type Driver = SyncDriver | AsyncDriver

export type StoreConfig<D extends string = string> = D[] | { drivers: D[]; memory?: boolean }

export interface CacheManagerConfig<D extends Record<string, Driver> = Record<string, Driver>> {
  drivers?: D & { memory?: SyncDriver }
  stores?: Record<string, StoreConfig<Exclude<keyof D, 'memory'> & string>>
  memory?: boolean
  staleTime?: Duration
  gcTime?: Duration
  prefix?: string
  circuitBreakerDuration?: Duration
}

export interface CacheConfig {
  l1?: SyncDriver
  l2?: AsyncDriver
  staleTime?: Duration
  gcTime?: Duration
  prefix?: string
  circuitBreakerDuration?: Duration
}

export interface SetOptions {
  staleTime?: Duration
  gcTime?: Duration
  tags?: string[]
}

export interface GetSetOptions extends SetOptions {
  /** SWR timeout in ms. 0 = return stale immediately, refresh in background */
  timeout?: Duration
  retries?: number
  fresh?: boolean
}

export type Loader<T> = (signal: AbortSignal) => Promise<T> | T

export type CacheEventType = 'hit' | 'miss' | 'set' | 'delete' | 'error'

export interface CacheHitEvent {
  key: string
  source: string
  graced: boolean
}

export interface CacheMissEvent {
  key: string
}

export interface CacheSetEvent {
  key: string
  staleTime: number
}

export interface CacheDeleteEvent {
  key: string
  count: number
}

export interface CacheErrorEvent {
  error: Error
  operation: string
}

export interface CacheEventMap {
  hit: CacheHitEvent
  miss: CacheMissEvent
  set: CacheSetEvent
  delete: CacheDeleteEvent
  error: CacheErrorEvent
}
