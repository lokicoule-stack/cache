/**
 * Cache configuration and options types
 *
 * @module types/options
 */

import type { Duration } from './duration'
import type { AsyncDriver, SyncDriver } from '../contracts/driver'
import type { EventEmitter } from '../observability/events'
import type { CachePlugin } from '@/contracts/plugin'
import type { BusOptions } from '@lokiverse/bus'

// ============================================================================
// Loader Types
// ============================================================================

export type Loader<T> = (signal: AbortSignal) => T | Promise<T>

// ============================================================================
// Cache Options
// ============================================================================

export interface GetOptions {
  /** Clone the returned value to prevent mutation */
  clone?: boolean
}

export interface SetOptions {
  /** Time until value becomes stale */
  staleTime?: Duration
  /** Time until value is garbage collected */
  gcTime?: Duration
  /** Tags for group invalidation */
  tags?: string[]
}

export interface GetSetOptions extends GetOptions, SetOptions {
  /** Timeout for loader function */
  timeout?: Duration
  /** Number of retry attempts for loader */
  retries?: number
  /** Force fresh fetch, ignoring cache */
  fresh?: boolean
  /** Abort loader on timeout (default: false, continues in background) */
  abortOnTimeout?: boolean
  /** Ratio of lifetime to trigger eager refresh (0-1) */
  eagerRefresh?: number
}

// ============================================================================
// Cache Configuration
// ============================================================================

export interface CacheConfig {
  /** L1 in-memory driver */
  l1?: SyncDriver
  /** L2 remote driver */
  l2?: AsyncDriver
  /** Key prefix for namespacing */
  prefix?: string
  /** Default stale time */
  staleTime?: Duration
  /** Default GC time */
  gcTime?: Duration
  /** Circuit breaker duration */
  circuitBreakerDuration?: Duration
  /** Message bus config for distributed sync */
  bus?: BusOptions
  /** Plugins for extending functionality */
  plugins?: CachePlugin[]
}

// ============================================================================
// Manager Configuration
// ============================================================================

export interface StoreConfig {
  /** Driver names to use */
  drivers: string[]
  /** Override global memory setting */
  memory?: boolean
}

export interface CacheManagerConfig {
  /** Available drivers by name */
  drivers?: Record<string, SyncDriver | AsyncDriver>
  /** Store configurations */
  stores?: Record<string, string[] | StoreConfig>
  /** Enable global L1 memory (default: true) */
  memory?: boolean
  /** Default stale time */
  staleTime?: Duration
  /** Default GC time */
  gcTime?: Duration
  /** Circuit breaker duration */
  circuitBreakerDuration?: Duration
  /** Message bus config */
  bus?: BusOptions
  /** Custom event emitter */
  emitter?: EventEmitter
  /** Plugins for extending functionality */
  plugins?: CachePlugin[]
}
