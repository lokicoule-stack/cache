import type { CacheEntry } from './entry'

// Duration: milliseconds or string like "5m", "1h"
export type Duration = number | string

// Sync store (L1 - local/memory)
export interface SyncStore {
  readonly name: string
  get(key: string): CacheEntry | undefined
  set(key: string, entry: CacheEntry): void
  delete(...keys: string[]): number
  has(key: string): boolean
  clear(): void
}

// Async store (L2 - remote/redis)
export interface AsyncStore {
  readonly name: string
  get(key: string): Promise<CacheEntry | undefined>
  set(key: string, entry: CacheEntry): Promise<void>
  delete(...keys: string[]): Promise<number>
  has(key: string): Promise<boolean>
  clear(): Promise<void>
  connect?(): Promise<void>
  disconnect?(): Promise<void>
}

// Cache configuration
export interface CacheConfig {
  local?: SyncStore
  remotes?: AsyncStore[]
  staleTime?: Duration
  gcTime?: Duration
  prefix?: string
}

// Set options
export interface SetOptions {
  staleTime?: Duration
  gcTime?: Duration
  tags?: string[]
}

// GetOrSet options
export interface GetSetOptions extends SetOptions {
  timeout?: Duration
  retries?: number
  fresh?: boolean
}

// Loader function for getOrSet
export type Loader<T> = (signal: AbortSignal) => Promise<T> | T

// Cache event types
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

export type CacheEvent =
  | { type: 'hit'; data: CacheHitEvent }
  | { type: 'miss'; data: CacheMissEvent }
  | { type: 'set'; data: CacheSetEvent }
  | { type: 'delete'; data: CacheDeleteEvent }
  | { type: 'error'; data: CacheErrorEvent }
