import type { CacheEntry } from './entry'
import type { BusOptions } from '@lokiverse/bus'
import type EventEmitter from 'events'

export type Duration = number | string

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

export type Driver = SyncDriver | AsyncDriver

export type StoreConfig<D extends string = string> = D[] | { drivers: D[]; memory?: boolean }

export interface CacheManagerConfig<D extends Record<string, Driver> = Record<string, Driver>> {
  bus?: BusOptions
  emitter?: EventEmitter
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

export type CacheEventType = keyof CacheEventMap

export interface CacheHitEvent {
  key: string
  store: string
  driver: string
  graced: boolean
}

export interface CacheMissEvent {
  key: string
  store: string
}

export interface CacheSetEvent {
  key: string
  store: string
}

export interface CacheDeleteEvent {
  key: string
  store: string
}

export interface CacheClearEvent {
  store: string
}

export interface BusPublishedEvent {
  channel: string
}

export interface BusReceivedEvent {
  channel: string
}

export interface CacheEventMap {
  hit: CacheHitEvent
  miss: CacheMissEvent
  set: CacheSetEvent
  delete: CacheDeleteEvent
  clear: CacheClearEvent
  'bus:published': BusPublishedEvent
  'bus:received': BusReceivedEvent
}
