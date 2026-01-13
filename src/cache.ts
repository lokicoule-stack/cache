/**
 * Main cache implementation
 *
 * @module cache
 */

import { MessageBus } from '@lokiverse/bus'

import { CacheEntry } from './entry'
import { CacheError, ERROR_CODES } from './errors'
import { createEventEmitter, type EventEmitter } from './observability/events'
import { createTimer, type Timer } from './observability/timer'
import { createDedup, type DedupFn } from './resilience/dedup'
import { withRetry } from './resilience/retry'
import { withSwr } from './resilience/swr'
import { TieredStore } from './storage/tiered-store'
import { DistributedSync } from './sync/distributed'
import { parseOptionalDuration } from './types/duration'

import type { GenericCache, Cache } from './contracts/cache'
import type { CacheConfig, GetOptions, GetSetOptions, Loader, SetOptions } from './types/options'

const DEFAULT_STALE_TIME = 60_000

// ============================================================================
// Internal Types
// ============================================================================

interface InternalConfig {
  store: TieredStore
  emitter: EventEmitter
  dedup: DedupFn
  defaultStaleTime: number
  defaultGcTime: number
  storeName: string
  sync?: DistributedSync | null
}

interface LoaderOptions {
  staleTime: number
  gcTime: number
  clone?: boolean
  timeout?: number
  retries?: number
  fresh?: boolean
}

// ============================================================================
// Cache Loader Helper
// ============================================================================

class CacheLoader {
  readonly #storage: TieredStore
  readonly #emitter: EventEmitter
  readonly #storeName: string
  readonly #dedup: DedupFn

  constructor(storage: TieredStore, emitter: EventEmitter, storeName: string, dedup: DedupFn) {
    this.#storage = storage
    this.#emitter = emitter
    this.#storeName = storeName
    this.#dedup = dedup
  }

  async handleSwr<V>(
    key: string,
    staleEntry: CacheEntry,
    loader: Loader<V>,
    options: LoaderOptions,
    originalOptions: GetSetOptions | undefined,
    metrics: Timer,
  ): Promise<V> {
    const result = await withSwr(
      (signal) => this.loadAndStore(key, loader, options, originalOptions?.tags, signal),
      {
        staleValue: staleEntry.value as V,
        timeout: options.timeout,
        abortOnTimeout: originalOptions?.abortOnTimeout,
        backgroundRefresh: () =>
          this.#dedup(key, () => this.loadAndStore(key, loader, options, originalOptions?.tags)),
      },
    )

    if (result.stale) {
      this.#emitter.emit('hit', {
        key,
        store: this.#storeName,
        driver: 'stale',
        graced: true,
        duration: metrics.elapsed,
      })
    }

    return result.value
  }

  async loadAndStore<V>(
    key: string,
    loader: Loader<V>,
    options: LoaderOptions,
    tags?: string[],
    signal?: AbortSignal,
  ): Promise<V> {
    const value = await this.#executeLoader(loader, options, signal)

    const entry = CacheEntry.create(value, {
      staleTime: options.staleTime,
      gcTime: options.gcTime,
      tags,
    })

    await this.#storage.set(key, entry)

    return value
  }

  refreshInBackground(
    key: string,
    loader: Loader<unknown>,
    options: LoaderOptions,
    tags?: string[],
  ): void {
    this.#dedup(key, () => this.loadAndStore(key, loader, options, tags)).catch((error) => {
      // Emit error event instead of silent failure
      this.#emitter.emit('error', {
        key,
        store: this.#storeName,
        error: error instanceof Error ? error : new Error(String(error)),
        duration: 0,
      })
    })
  }

  async #executeLoader<V>(
    loader: Loader<V>,
    options: LoaderOptions,
    signal?: AbortSignal,
  ): Promise<V> {
    const retries = options.retries ?? 0
    const loaderSignal = signal ?? new AbortController().signal
    const fn = () => Promise.resolve(loader(loaderSignal))

    try {
      return retries > 0 ? await withRetry(fn, retries) : await fn()
    } catch (error) {
      throw CacheError.loaderError('Loader function failed', error as Error)
    }
  }
}

// ============================================================================
// Main Cache Class
// ============================================================================

/**
 * Internal cache implementation
 * @internal
 */
export class InternalCache<T extends Record<string, unknown> = Record<string, unknown>> {
  readonly #store: TieredStore
  readonly #dedup: DedupFn
  readonly #defaultStaleTime: number
  readonly #defaultGcTime: number
  readonly #emitter: EventEmitter
  readonly #storeName: string
  readonly #loader: CacheLoader
  readonly #sync: DistributedSync | null

  constructor(config?: CacheConfig)
  constructor(internal: InternalConfig, isInternal: true)
  constructor(config?: CacheConfig | InternalConfig, isInternal?: true) {
    if (isInternal) {
      const internal = config as InternalConfig

      this.#store = internal.store
      this.#dedup = internal.dedup
      this.#defaultStaleTime = internal.defaultStaleTime
      this.#defaultGcTime = internal.defaultGcTime
      this.#emitter = internal.emitter
      this.#storeName = internal.storeName
      this.#loader = new CacheLoader(this.#store, this.#emitter, this.#storeName, internal.dedup)
      this.#sync = internal.sync ?? null
    } else {
      const external = (config as CacheConfig) ?? {}
      const staleTime = parseOptionalDuration(external.staleTime) ?? DEFAULT_STALE_TIME
      const gcTime = parseOptionalDuration(external.gcTime) ?? staleTime

      this.#store = new TieredStore({
        l1: external.l1,
        l2: external.l2 ? [external.l2] : undefined,
        prefix: external.prefix,
        circuitBreakerDuration: parseOptionalDuration(external.circuitBreakerDuration),
      })

      const emitter = createEventEmitter()
      const dedup = createDedup()

      this.#dedup = dedup
      this.#defaultStaleTime = staleTime
      this.#defaultGcTime = gcTime
      this.#emitter = emitter
      this.#storeName = 'default'
      this.#loader = new CacheLoader(this.#store, this.#emitter, this.#storeName, dedup)

      // Distributed sync setup
      this.#sync = external.bus
        ? new DistributedSync(new MessageBus(external.bus), 'default')
        : null

      if (this.#sync) {
        this.#sync.setup({
          onRemoteInvalidate: (keys) => this.#store.invalidateL1(...keys),
          onRemoteClear: () => this.#store.clearL1(),
          onRemoteInvalidateTags: (tags) => void this.#store.invalidateTags(tags),
        })
      }

      // Register plugins
      for (const plugin of external.plugins ?? []) {
        plugin.register(this.#emitter)
      }
    }
  }

  // ==========================================================================
  // Get
  // ==========================================================================

  get<V = unknown>(key: string, options?: GetOptions): Promise<V | undefined>
  get<K extends keyof T>(key: K, options?: GetOptions): Promise<T[K] | undefined>

  async get(key: string, options?: GetOptions): Promise<unknown> {
    return this.#withMetrics(async (metrics) => {
      try {
        const result = await this.#store.get(key)

        if (!result.entry || result.entry.isGced()) {
          this.#emitter.emit('miss', {
            key,
            store: this.#storeName,
            duration: metrics.elapsed,
          })

          return undefined
        }

        this.#emitter.emit('hit', {
          key,
          store: this.#storeName,
          driver: result.source ?? 'unknown',
          graced: result.entry.isStale(),
          duration: metrics.elapsed,
        })

        return this.#clone(result.entry.value, options?.clone)
      } catch (error) {
        throw CacheError.from(error)
      }
    })
  }

  // ==========================================================================
  // Set
  // ==========================================================================

  set<V = unknown>(key: string, value: V, options?: SetOptions): Promise<void>
  set<K extends keyof T>(key: K, value: T[K], options?: SetOptions): Promise<void>

  async set(key: string, value: unknown, options?: SetOptions): Promise<void> {
    await this.#withMetrics(async (metrics) => {
      try {
        const staleTime = parseOptionalDuration(options?.staleTime) ?? this.#defaultStaleTime
        const gcTime = parseOptionalDuration(options?.gcTime) ?? this.#defaultGcTime

        const entry = CacheEntry.create(value, { staleTime, gcTime, tags: options?.tags })

        await this.#store.set(key, entry)
        this.#emitter.emit('set', {
          key,
          store: this.#storeName,
          duration: metrics.elapsed,
        })
      } catch (error) {
        throw CacheError.from(error)
      }
    })
  }

  // ==========================================================================
  // GetOrSet
  // ==========================================================================

  getOrSet<V = unknown>(key: string, loader: Loader<V>, options?: GetSetOptions): Promise<V>
  getOrSet<K extends keyof T>(key: K, loader: Loader<T[K]>, options?: GetSetOptions): Promise<T[K]>

  async getOrSet(key: string, loader: Loader<unknown>, options?: GetSetOptions): Promise<unknown> {
    return this.#withMetrics(async (metrics) => {
      try {
        const loaderOpts = this.#buildLoaderOptions(options)

        // Force fresh fetch
        if (loaderOpts.fresh) {
          const value = await this.#dedup(key, () =>
            this.#loader.loadAndStore(key, loader, loaderOpts, options?.tags),
          )

          return this.#clone(value, loaderOpts.clone)
        }

        const result = await this.#store.get(key)

        // Fresh hit
        if (result.entry && !result.entry.isStale()) {
          // Eager refresh if near expiration
          if (options?.eagerRefresh && result.entry.isNearExpiration(options.eagerRefresh)) {
            this.#loader.refreshInBackground(key, loader, loaderOpts, options?.tags)
          }

          this.#emitter.emit('hit', {
            key,
            store: this.#storeName,
            driver: result.source ?? 'unknown',
            graced: false,
            duration: metrics.elapsed,
          })

          return this.#clone(result.entry.value, loaderOpts.clone)
        }

        // Stale hit - use SWR
        if (result.entry && !result.entry.isGced()) {
          const value = await this.#loader.handleSwr(
            key,
            result.entry,
            loader,
            loaderOpts,
            options,
            metrics,
          )

          return this.#clone(value, loaderOpts.clone)
        }

        // Miss - load fresh
        const value = await this.#dedup(key, () =>
          this.#loader.loadAndStore(key, loader, loaderOpts, options?.tags),
        )

        return this.#clone(value, loaderOpts.clone)
      } catch (error) {
        throw CacheError.from(error, ERROR_CODES.LOADER_ERROR)
      }
    })
  }

  // ==========================================================================
  // Delete
  // ==========================================================================

  delete(...keys: string[]): Promise<number>
  delete(...keys: (keyof T)[]): Promise<number>

  async delete(...keys: string[]): Promise<number> {
    return this.#withMetrics(async (metrics) => {
      try {
        const count = await this.#store.delete(...keys)

        for (const key of keys) {
          this.#emitter.emit('delete', {
            key,
            store: this.#storeName,
            duration: metrics.elapsed,
          })
        }

        if (this.#sync) {
          await this.#sync.onDelete(keys)
        }

        return count
      } catch (error) {
        throw CacheError.from(error)
      }
    })
  }

  // ==========================================================================
  // L1 Cache Control
  // ==========================================================================

  invalidateL1(...keys: string[]): void {
    this.#store.invalidateL1(...keys)
  }

  clearL1(): void {
    this.#store.clearL1()
  }

  // ==========================================================================
  // Other Operations
  // ==========================================================================

  async has(key: string): Promise<boolean> {
    return this.#store.has(key)
  }

  async clear(): Promise<void> {
    await this.#withMetrics(async (metrics) => {
      await this.#store.clear()
      this.#emitter.emit('clear', {
        store: this.#storeName,
        duration: metrics.elapsed,
      })

      if (this.#sync) {
        await this.#sync.onClear()
      }
    })
  }

  async invalidateTags(tags: string[]): Promise<number> {
    const count = await this.#store.invalidateTags(tags)

    if (this.#sync) {
      await this.#sync.onInvalidateTags(tags)
    }

    return count
  }

  pull<V = unknown>(key: string): Promise<V | undefined>
  pull<K extends keyof T>(key: K): Promise<T[K] | undefined>

  async pull(key: string): Promise<unknown> {
    const value = await this.get(key)

    if (value !== undefined) {
      await this.delete(key)
    }

    return value
  }

  async expire(key: string): Promise<boolean> {
    const result = await this.#store.get(key)

    if (!result.entry) {
      return false
    }

    await this.#store.set(key, result.entry.expire())

    return true
  }

  namespace(prefix: string): InternalCache<T> {
    const config: InternalConfig = {
      store: this.#store.namespace(prefix),
      emitter: this.#emitter,
      dedup: this.#dedup,
      defaultStaleTime: this.#defaultStaleTime,
      defaultGcTime: this.#defaultGcTime,
      storeName: this.#storeName,
      sync: this.#sync,
    }

    return new InternalCache<T>(config, true)
  }

  async connect(): Promise<void> {
    await this.#store.connect()
    if (this.#sync) {
      await this.#sync.connect()
    }
  }

  async disconnect(): Promise<void> {
    if (this.#sync) {
      await this.#sync.disconnect()
    }
    await this.#store.disconnect()
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  async #withMetrics<R>(operation: (timer: Timer) => Promise<R>): Promise<R> {
    const timer = createTimer()

    try {
      return await operation(timer)
    } finally {
      timer.end()
    }
  }

  #buildLoaderOptions(options?: GetSetOptions): LoaderOptions {
    return {
      staleTime: parseOptionalDuration(options?.staleTime) ?? this.#defaultStaleTime,
      gcTime: parseOptionalDuration(options?.gcTime) ?? this.#defaultGcTime,
      clone: options?.clone,
      timeout: parseOptionalDuration(options?.timeout),
      retries: options?.retries,
      fresh: options?.fresh,
    }
  }

  #clone<V>(value: V, shouldClone?: boolean): V {
    if (!shouldClone) {
      return value
    }
    try {
      return structuredClone(value)
    } catch {
      return value
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a generic cache with dynamic typing
 *
 * @example
 * ```ts
 * const cache = createCache({ staleTime: '5m' })
 * const user = await cache.get<User>('user:1')
 * await cache.set('user:1', { id: 1, name: 'Alice' })
 * ```
 */
export function createCache(config?: CacheConfig): GenericCache

/**
 * Create a schema-based cache with type-safe key-value mapping
 *
 * @example
 * ```ts
 * interface Schema {
 *   'user:1': User
 *   'session:abc': Session
 * }
 * const cache = createCache<Schema>({ staleTime: '5m' })
 * const user = await cache.get('user:1') // Type: User | undefined
 * ```
 */
export function createCache<T extends Record<string, unknown>>(config?: CacheConfig): Cache<T>

export function createCache<T extends Record<string, unknown> = Record<string, unknown>>(
  config?: CacheConfig,
): GenericCache | Cache<T> {
  return new InternalCache<T>(config) as GenericCache | Cache<T>
}
