// Core
export { Cache, createCache } from './cache'
export { CacheEntry } from './entry'
export { CacheError } from './errors'
export { CacheManager, createCacheManager } from './manager'

// Bus
export { createCacheBus, type CacheBus, type CacheBusConfig, type CacheBusSchema } from './bus/cache-bus'

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
  CacheHitEvent,
  CacheMissEvent,
  CacheSetEvent,
  CacheDeleteEvent,
  CacheErrorEvent,
} from './types'

// Duration parser (useful for custom drivers)
export { parseDuration, parseOptionalDuration } from './duration'
