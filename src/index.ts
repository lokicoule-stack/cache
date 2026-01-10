// Core - Public API (Type Projections)
export {
  createCache,
  type Cache,
  type GenericCache,
} from './cache'

export {
  createCacheManager,
  type CacheManager,
  type GenericCacheManager,
  type CacheBusSchema,
} from './manager'

export { CacheEntry } from './entry'
export { CacheError } from './errors'

// Internal classes (not exported)
// - InternalCache
// - InternalCacheManager
// - CacheBackplane

// Drivers
export {
  MemoryDriver,
  memoryDriver,
  createDefaultMemory,
  type MemoryDriverConfig,
} from './drivers/memory'
export {
  RedisDriver,
  redisDriver,
  type RedisDriverConfig,
  type RedisDriverExternalConfig,
  type RedisInstance,
} from './drivers/redis'

// Events
export { type Emitter, type EventEmitter } from './utils/events'

// Types
export type {
  Duration,
  SyncDriver,
  AsyncDriver,
  Driver,
  StoreConfig,
  CacheManagerConfig,
  CacheConfig,
  SetOptions,
  GetSetOptions,
  Loader,
  CacheEventType,
  CacheEventMap,
  CacheHitEvent,
  CacheMissEvent,
  CacheSetEvent,
  CacheDeleteEvent,
  CacheClearEvent,
  BusPublishedEvent,
  BusReceivedEvent,
} from './types'

// Duration parser (useful for custom drivers)
export { parseDuration, parseOptionalDuration } from './duration'
