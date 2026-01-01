// Core
export { Cache, createCache } from './cache'
export { CacheEntry } from './entry'
export { CacheError } from './errors'
export { CacheManager, type CacheManagerConfig } from './manager'

// Bus
export { createCacheBus, type CacheBus, type CacheBusConfig, type CacheBusSchema } from './bus/cache-bus'

// Stores
export { MemoryStore, memoryStore, type MemoryStoreConfig } from './stores/memory'
export { RedisStore, redisStore, type RedisStoreConfig, type RedisStoreExternalConfig, type RedisInstance } from './stores/redis'

// Types
export type {
  Duration,
  SyncStore,
  AsyncStore,
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

// Duration parser (useful for custom stores)
export { parseDuration, parseOptionalDuration } from './duration'
