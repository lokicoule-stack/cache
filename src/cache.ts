import { parseOptionalDuration } from './duration'
import { CacheEntry } from './entry'
import { CacheStack } from './stack'
import { createDedup } from './utils/dedup'
import { createEventEmitter, type EventEmitter } from './utils/events'
import { withRetry } from './utils/retry'
import { withSwr } from './utils/swr'

import type { CacheConfig, SetOptions, GetOptions, GetSetOptions, Loader } from './types'

const DEFAULT_STALE_TIME = 60_000

interface InternalConfig {
  stack: CacheStack
  emitter: EventEmitter
  dedup: ReturnType<typeof createDedup>
  defaultStaleTime: number
  defaultGcTime: number
  storeName: string
}

/**
 * Core cache instance with L1/L2 tiered storage.
 *
 * Features:
 * - Multi-layer caching (L1 sync memory + L2 async drivers)
 * - Stale-while-revalidate (SWR) pattern
 * - Request deduplication
 * - Tag-based invalidation
 * - Circuit breaker protection for L2 failures
 *
 * @example
 * ```ts
 * const cache = new Cache({
 *   l1: memoryDriver(),
 *   l2: redisDriver({ host: 'localhost' }),
 *   staleTime: '5m',
 *   gcTime: '1h'
 * })
 *
 * await cache.set('user:1', { name: 'Alice' })
 * const user = await cache.get('user:1')
 * ```
 */
export class Cache<T extends Record<string, unknown> = Record<string, unknown>> {
  readonly #stack: CacheStack
  readonly #emitter: EventEmitter
  readonly #dedup: ReturnType<typeof createDedup>
  readonly #defaultStaleTime: number
  readonly #defaultGcTime: number
  readonly #storeName: string

  constructor(config: CacheConfig)
  constructor(internal: InternalConfig, isInternal: true)
  constructor(config: CacheConfig | InternalConfig, isInternal?: true) {
    if (isInternal) {
      const internal = config as InternalConfig

      this.#stack = internal.stack
      this.#emitter = internal.emitter
      this.#dedup = internal.dedup
      this.#defaultStaleTime = internal.defaultStaleTime
      this.#defaultGcTime = internal.defaultGcTime
      this.#storeName = internal.storeName
    } else {
      const external = config as CacheConfig
      const staleTime = parseOptionalDuration(external.staleTime) ?? DEFAULT_STALE_TIME
      const gcTime = parseOptionalDuration(external.gcTime) ?? staleTime

      this.#stack = new CacheStack({
        l1: external.l1,
        l2: external.l2 ? [external.l2] : undefined,
        prefix: external.prefix,
        circuitBreakerDuration: parseOptionalDuration(external.circuitBreakerDuration),
      })
      this.#emitter = createEventEmitter()
      this.#dedup = createDedup()
      this.#defaultStaleTime = staleTime
      this.#defaultGcTime = gcTime
      this.#storeName = 'default'
    }
  }

  /**
   * Invalidate specific keys in L1 (memory) layer only.
   * Useful for immediate local invalidation without touching L2.
   *
   * @param keys - Keys to invalidate in L1
   */
  invalidateL1(...keys: string[]): void {
    this.#stack.invalidateL1(...keys)
  }

  /**
   * Clear entire L1 (memory) layer.
   * Useful for memory pressure or testing.
   */
  clearL1(): void {
    this.#stack.clearL1()
  }

  /**
   * Get value from cache.
   *
   * @param key - Cache key
   * @param options - Get options (clone)
   * @returns Cached value or undefined if not found/expired
   *
   * @example
   * ```ts
   * const user = await cache.get('user:1')
   * const clonedUser = await cache.get('user:1', { clone: true })
   * ```
   */
  async get<K extends keyof T & string>(key: K, options?: GetOptions): Promise<T[K] | undefined>
  async get<V>(key: string, options?: GetOptions): Promise<V | undefined>
  async get(key: string, options?: GetOptions): Promise<unknown> {
    const result = await this.#stack.get(key)

    if (!result.entry || result.entry.isGced()) {
      this.#emitter.emit('miss', { key, store: this.#storeName })

      return undefined
    }

    this.#emitter.emit('hit', {
      key,
      store: this.#storeName,
      driver: result.source ?? 'unknown',
      graced: result.entry.isStale(),
    })

    return this.#maybeClone(result.entry.value, options?.clone)
  }

  /**
   * Set value in cache.
   *
   * @param key - Cache key
   * @param value - Value to cache
   * @param options - Set options (staleTime, gcTime, tags)
   *
   * @example
   * ```ts
   * await cache.set('user:1', { name: 'Alice' })
   * await cache.set('user:1', user, { staleTime: '5m', tags: ['user'] })
   * ```
   */
  async set<K extends keyof T & string>(key: K, value: T[K], options?: SetOptions): Promise<void>
  async set<V>(key: string, value: V, options?: SetOptions): Promise<void>
  async set(key: string, value: unknown, options?: SetOptions): Promise<void> {
    const staleTime = parseOptionalDuration(options?.staleTime) ?? this.#defaultStaleTime
    const gcTime = parseOptionalDuration(options?.gcTime) ?? this.#defaultGcTime
    const entry = CacheEntry.create(value, { staleTime, gcTime, tags: options?.tags })

    await this.#stack.set(key, entry)
    this.#emitter.emit('set', { key, store: this.#storeName })
  }

  /**
   * Get value from cache or compute it via loader function.
   *
   * Implements stale-while-revalidate (SWR):
   * - Returns fresh value immediately if available
   * - Returns stale value while background refresh happens (if within gcTime)
   * - Deduplicates concurrent requests for same key
   *
   * @param key - Cache key
   * @param loader - Async function to compute value if not cached
   * @param options - GetSet options (staleTime, gcTime, tags, timeout, retries, fresh, eagerRefresh)
   * @returns Cached or computed value
   *
   * @example
   * ```ts
   * const user = await cache.getOrSet('user:1', async () => {
   *   return db.users.findById('1')
   * }, { staleTime: '5m', retries: 2 })
   * ```
   */
  async getOrSet<K extends keyof T & string>(
    key: K,
    loader: Loader<T[K]>,
    options?: GetSetOptions,
  ): Promise<T[K]>
  async getOrSet<V>(key: string, loader: Loader<V>, options?: GetSetOptions): Promise<V>
  async getOrSet(key: string, loader: Loader<unknown>, options?: GetSetOptions) {
    let value: unknown

    if (options?.fresh) {
      value = await this.#dedup(key, () => this.#loadAndStore(key, loader, options))
    } else {
      const result = await this.#stack.get(key)

      if (result.entry && !result.entry.isStale()) {
        if (options?.eagerRefresh && result.entry.isNearExpiration(options.eagerRefresh)) {
          void this.#dedup(key, () => this.#loadAndStore(key, loader, options)).catch(() => {})
        }

        this.#emitter.emit('hit', {
          key,
          store: this.#storeName,
          driver: result.source ?? 'unknown',
          graced: false,
        })

        value = result.entry.value
      } else if (result.entry && !result.entry.isGced()) {
        value = await this.#handleSwr(key, result.entry, loader, options)
      } else {
        value = await this.#dedup(key, () => this.#loadAndStore(key, loader, options))
      }
    }

    return this.#maybeClone(value, options?.clone)
  }

  /**
   * Get value and immediately delete it (atomic pull).
   *
   * @param key - Cache key
   * @returns Cached value or undefined
   *
   * @example
   * ```ts
   * const token = await cache.pull('one-time-token:abc')
   * ```
   */
  async pull<K extends keyof T & string>(key: K): Promise<T[K] | undefined>
  async pull<V>(key: string): Promise<V | undefined>
  async pull(key: string): Promise<unknown> {
    const value = await this.get(key)

    if (value !== undefined) {
      await this.delete(key)
    }

    return value
  }

  /**
   * Mark entry as immediately stale (but not garbage collected).
   * Next access will trigger background refresh via SWR.
   *
   * @param key - Cache key
   * @returns true if entry was found and expired
   */
  async expire(key: string): Promise<boolean> {
    const result = await this.#stack.get(key)

    if (!result.entry) {
      return false
    }

    await this.#stack.set(key, result.entry.expire())

    return true
  }

  /**
   * Delete keys from all cache layers.
   *
   * @param keys - Keys to delete
   * @returns Number of keys successfully deleted
   *
   * @example
   * ```ts
   * await cache.delete('user:1', 'user:2')
   * ```
   */
  async delete(...keys: string[]): Promise<number> {
    const count = await this.#stack.delete(...keys)

    for (const key of keys) {
      this.#emitter.emit('delete', { key, store: this.#storeName })
    }

    return count
  }

  /**
   * Check if key exists in cache (including stale entries).
   *
   * @param key - Cache key
   * @returns true if key exists (even if stale)
   */
  async has(key: string): Promise<boolean> {
    return this.#stack.has(key)
  }

  /**
   * Clear all entries from all cache layers.
   * Removes all keys and tags.
   */
  async clear(): Promise<void> {
    await this.#stack.clear()
    this.#emitter.emit('clear', { store: this.#storeName })
  }

  /**
   * Invalidate all entries with specified tags.
   *
   * @param tags - Tags to invalidate
   * @returns Number of keys deleted
   *
   * @example
   * ```ts
   * await cache.set('user:1', user, { tags: ['user', 'profile'] })
   * await cache.invalidateTags(['user']) // Deletes user:1
   * ```
   */
  async invalidateTags(tags: string[]): Promise<number> {
    return this.#stack.invalidateTags(tags)
  }

  /**
   * Create a namespaced cache that shares the same storage layers.
   * Keys are prefixed with the namespace to avoid collisions.
   *
   * @param prefix - Namespace prefix
   * @returns New Cache instance with prefixed keys
   *
   * @example
   * ```ts
   * const userCache = cache.namespace('users')
   * await userCache.set('1', { name: 'Alice' }) // Stored as 'users:1'
   * ```
   */
  namespace(prefix: string): Cache<T> {
    return new Cache<T>(
      {
        stack: this.#stack.namespace(prefix),
        emitter: this.#emitter,
        dedup: this.#dedup,
        defaultStaleTime: this.#defaultStaleTime,
        defaultGcTime: this.#defaultGcTime,
        storeName: this.#storeName,
      },
      true,
    )
  }

  /**
   * Connect to external storage drivers (L2 layers).
   * Should be called before using cache in production.
   */
  async connect(): Promise<void> {
    await this.#stack.connect()
  }

  /**
   * Disconnect from external storage drivers.
   * Should be called during graceful shutdown.
   */
  async disconnect(): Promise<void> {
    await this.#stack.disconnect()
  }

  async #handleSwr<V>(
    key: string,
    staleEntry: CacheEntry,
    loader: Loader<V>,
    options?: GetSetOptions,
  ): Promise<V> {
    const timeout = parseOptionalDuration(options?.timeout)

    const result = await withSwr((signal) => this.#loadAndStore(key, loader, options, signal), {
      staleValue: staleEntry.value as V,
      timeout,
      abortOnTimeout: options?.abortOnTimeout,
      backgroundRefresh: () => this.#dedup(key, () => this.#loadAndStore(key, loader, options)),
    })

    if (result.stale) {
      this.#emitter.emit('hit', { key, store: this.#storeName, driver: 'stale', graced: true })
    }

    return result.value
  }

  async #loadAndStore<V>(
    key: string,
    loader: Loader<V>,
    options?: GetSetOptions,
    signal?: AbortSignal,
  ): Promise<V> {
    const value = await this.#executeLoader(loader, options, signal)

    const staleTime = parseOptionalDuration(options?.staleTime) ?? this.#defaultStaleTime
    const gcTime = parseOptionalDuration(options?.gcTime) ?? this.#defaultGcTime
    const entry = CacheEntry.create(value, { staleTime, gcTime, tags: options?.tags })

    await this.#stack.set(key, entry)
    this.#emitter.emit('set', { key, store: this.#storeName })

    return value
  }

  async #executeLoader<V>(
    loader: Loader<V>,
    options?: GetSetOptions,
    signal?: AbortSignal,
  ): Promise<V> {
    const retries = options?.retries ?? 0
    const loaderSignal = signal ?? new AbortController().signal
    const fn = () => Promise.resolve(loader(loaderSignal))

    return retries > 0 ? withRetry(fn, retries) : fn()
  }

  #maybeClone<V>(value: V, clone?: boolean): V {
    if (!clone) {
      return value
    }
    try {
      return structuredClone(value)
    } catch {
      return value
    }
  }
}

export function createCache<T extends Record<string, unknown> = Record<string, unknown>>(
  config: CacheConfig = {},
): Cache<T> {
  return new Cache<T>(config)
}
