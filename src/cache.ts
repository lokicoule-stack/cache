import { parseOptionalDuration } from './duration'
import { CacheEntry } from './entry'
import { CacheStack } from './stack'
import { createDedup } from './utils/dedup'
import { createEventEmitter, type EventEmitter } from './utils/events'
import { withRetry } from './utils/retry'
import { withSwr } from './utils/swr'

import type { CacheConfig, SetOptions, GetSetOptions, Loader, CacheEventType } from './types'

const DEFAULT_STALE_TIME = 60_000 // 1 minute

interface InternalConfig {
  stack: CacheStack
  events: EventEmitter
  dedup: ReturnType<typeof createDedup>
  defaultStaleTime: number
  defaultGcTime: number
}

export class Cache<T extends Record<string, unknown> = Record<string, unknown>> {
  readonly #stack: CacheStack
  readonly #events: EventEmitter
  readonly #dedup: ReturnType<typeof createDedup>
  readonly #defaultStaleTime: number
  readonly #defaultGcTime: number

  constructor(config: CacheConfig)
  constructor(internal: InternalConfig, isInternal: true)
  constructor(config: CacheConfig | InternalConfig, isInternal?: true) {
    if (isInternal) {
      const internal = config as InternalConfig

      this.#stack = internal.stack
      this.#events = internal.events
      this.#dedup = internal.dedup
      this.#defaultStaleTime = internal.defaultStaleTime
      this.#defaultGcTime = internal.defaultGcTime
    } else {
      const external = config as CacheConfig
      const staleTime = parseOptionalDuration(external.staleTime) ?? DEFAULT_STALE_TIME
      const gcTime = parseOptionalDuration(external.gcTime) ?? staleTime

      this.#stack = new CacheStack({
        local: external.local,
        remotes: external.remotes,
        prefix: external.prefix,
        circuitBreakerDuration: parseOptionalDuration(external.circuitBreakerDuration),
      })
      this.#events = createEventEmitter()
      this.#dedup = createDedup()
      this.#defaultStaleTime = staleTime
      this.#defaultGcTime = gcTime
    }
  }

  get stores() {
    return this.#stack.storeNames
  }

  async get<K extends keyof T & string>(key: K): Promise<T[K] | undefined> {
    const result = await this.#stack.get(key)

    if (!result.entry || result.entry.isGced()) {
      this.#emit('miss', { key })

      return undefined
    }

    this.#emit('hit', {
      key,
      source: result.source ?? 'unknown',
      graced: result.entry.isStale(),
    })

    return result.entry.value as T[K]
  }

  async set<K extends keyof T & string>(key: K, value: T[K], options?: SetOptions): Promise<void> {
    const staleTime = parseOptionalDuration(options?.staleTime) ?? this.#defaultStaleTime
    const gcTime = parseOptionalDuration(options?.gcTime) ?? this.#defaultGcTime
    const entry = CacheEntry.create(value, { staleTime, gcTime, tags: options?.tags })

    await this.#stack.set(key, entry)
    this.#emit('set', { key, staleTime })
  }

  async getOrSet<K extends keyof T & string>(
    key: K,
    loader: Loader<T[K]>,
    options?: GetSetOptions,
  ): Promise<T[K]> {
    // Force fresh: skip cache entirely
    if (options?.fresh) {
      return this.#dedup(key, () => this.#loadAndStore(key, loader, options))
    }

    const result = await this.#stack.get(key)

    // Fresh hit (not stale)
    if (result.entry && !result.entry.isStale()) {
      this.#emit('hit', { key, source: result.source ?? 'unknown', graced: false })

      return result.entry.value as T[K]
    }

    // Stale hit with SWR
    if (result.entry && !result.entry.isGced()) {
      return this.#handleSwr(key, result.entry, loader, options)
    }

    // Miss: load fresh
    return this.#dedup(key, () => this.#loadAndStore(key, loader, options))
  }

  async pull<K extends keyof T & string>(key: K): Promise<T[K] | undefined> {
    const value = await this.get(key)

    if (value !== undefined) {
      await this.delete(key)
    }

    return value
  }

  async expire(key: string): Promise<boolean> {
    const result = await this.#stack.get(key)

    if (!result.entry) {
      return false
    }

    await this.#stack.set(key, result.entry.expire())

    return true
  }

  async delete(...keys: string[]): Promise<number> {
    const count = await this.#stack.delete(...keys)

    for (const key of keys) {
      this.#emit('delete', { key, count })
    }

    return count
  }

  async has(key: string): Promise<boolean> {
    return this.#stack.has(key)
  }

  async clear(): Promise<void> {
    await this.#stack.clear()
  }

  async invalidateTags(tags: string[]): Promise<number> {
    return this.#stack.invalidateTags(tags)
  }

  deleteLocal(...keys: string[]): number {
    return this.#stack.deleteLocal(...keys)
  }

  clearLocal(): void {
    this.#stack.clearLocal()
  }

  namespace(prefix: string): Cache<T> {
    return new Cache<T>(
      {
        stack: this.#stack.namespace(prefix),
        events: this.#events,
        dedup: this.#dedup,
        defaultStaleTime: this.#defaultStaleTime,
        defaultGcTime: this.#defaultGcTime,
      },
      true,
    )
  }

  async connect(): Promise<void> {
    await this.#stack.connect()
  }

  async disconnect(): Promise<void> {
    await this.#stack.disconnect()
  }

  on(event: CacheEventType, fn: (data: unknown) => void): void {
    this.#events.on(event, fn)
  }

  off(event: CacheEventType, fn: (data: unknown) => void): void {
    this.#events.off(event, fn)
  }

  #emit(event: CacheEventType, data: unknown): void {
    this.#events.emit(event, data)
  }

  async #handleSwr<K extends keyof T & string>(
    key: K,
    staleEntry: CacheEntry,
    loader: Loader<T[K]>,
    options?: GetSetOptions,
  ): Promise<T[K]> {
    const timeout = parseOptionalDuration(options?.timeout)

    const result = await withSwr(
      (signal) => this.#loadAndStore(key, loader, options, signal),
      { staleValue: staleEntry.value as T[K], timeout },
    )

    if (result.stale) {
      this.#emit('hit', { key, source: 'stale', graced: true })
    }

    return result.value
  }

  async #loadAndStore<K extends keyof T & string>(
    key: K,
    loader: Loader<T[K]>,
    options?: GetSetOptions,
    signal?: AbortSignal,
  ): Promise<T[K]> {
    const value = await this.#executeLoader(loader, options, signal)

    const staleTime = parseOptionalDuration(options?.staleTime) ?? this.#defaultStaleTime
    const gcTime = parseOptionalDuration(options?.gcTime) ?? this.#defaultGcTime
    const entry = CacheEntry.create(value, { staleTime, gcTime, tags: options?.tags })

    await this.#stack.set(key, entry)
    this.#emit('set', { key, staleTime })

    return value
  }

  async #executeLoader<V>(loader: Loader<V>, options?: GetSetOptions, signal?: AbortSignal): Promise<V> {
    const retries = options?.retries ?? 0
    const loaderSignal = signal ?? new AbortController().signal
    const fn = () => Promise.resolve(loader(loaderSignal))

    return retries > 0 ? withRetry(fn, retries) : fn()
  }
}

export function createCache<T extends Record<string, unknown> = Record<string, unknown>>(
  config: CacheConfig = {},
): Cache<T> {
  return new Cache<T>(config)
}
