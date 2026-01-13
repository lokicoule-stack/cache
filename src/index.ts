// Core exports
export { createCache, InternalCache } from './cache'
export { createCacheManager, InternalCacheManager } from './manager'
export {
  CacheEntry,
  type CacheEntryData,
  type CacheEntryOptions,
  type SerializedEntry,
} from './entry'
export {
  CacheError,
  ERROR_CODES,
  type ErrorCode,
  type ErrorCategory,
  type ErrorSeverity,
} from './errors'

// Interfaces
export type { Cache, GenericCache } from './contracts/cache'
export type { CacheManager, GenericCacheManager } from './contracts/manager'

// Types
export type { AsyncDriver, SyncDriver } from './contracts/driver'
export type { CachePlugin } from './contracts/plugin'
export { parseDuration, parseOptionalDuration } from './types/duration'
export type {
  CacheConfig,
  CacheManagerConfig,
  GetOptions,
  GetSetOptions,
  Loader,
  SetOptions,
  StoreConfig,
} from './types/options'
export type { Duration } from './types/duration'

// Storage
export { memoryDriver } from './storage/drivers/memory'
export { redisDriver } from './storage/drivers/redis'
export { TieredStore, type StorageResult, type TieredStoreConfig } from './storage/tiered-store'

// Sync
export {
  DistributedSync,
  type CacheBusSchema,
  type DistributedSyncCallbacks,
} from './sync/distributed'
export { TagIndex } from './sync/tags'

// Resilience
export {
  createCircuitBreaker,
  type CircuitBreaker,
  type CircuitBreakerOptions,
} from './resilience/circuit-breaker'
export { createDedup, type DedupFn } from './resilience/dedup'
export { withRetry, type RetryOptions } from './resilience/retry'
export { withSwr, type SwrOptions, type SwrResult } from './resilience/swr'
export { delay } from './resilience/delay'

// Observability
export {
  createEventEmitter,
  type CacheEventMap,
  type CacheEventType,
  type CacheHitEvent,
  type CacheMissEvent,
  type CacheSetEvent,
  type CacheDeleteEvent,
  type CacheClearEvent,
  type CacheErrorEvent,
  type BusPublishedEvent,
  type BusReceivedEvent,
  type Emitter,
  type EventEmitter,
} from './observability/events'
export { createTimer, type Timer } from './observability/timer'
