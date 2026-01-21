export interface CacheAdapter {
  readonly name: string
  readonly type: 'lokiverse' | 'redis' | 'bentocache'

  // Lifecycle
  connect(): Promise<void>
  disconnect(): Promise<void>
  clear(): Promise<void>

  // Core operations
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, value: T, ttlMs?: number): Promise<void>
  delete(key: string): Promise<boolean>
  has(key: string): Promise<boolean>

  // Batch operations
  getMany<T>(keys: string[]): Promise<Map<string, T>>
  setMany<T>(entries: Array<{ key: string; value: T; ttlMs?: number }>): Promise<void>
  deleteMany(keys: string[]): Promise<number>

  // Advanced (may not be supported by all)
  getOrSet?<T>(key: string, factory: () => Promise<T>, ttlMs?: number): Promise<T>
  invalidateTags?(tags: string[]): Promise<number>
}

export interface AdapterConfig {
  redisUrl: string
  l1MaxItems?: number
  defaultTtlMs?: number
  serializer?: 'json' | 'msgpack'
}
