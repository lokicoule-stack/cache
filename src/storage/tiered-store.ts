// L1/L2 tiering with circuit breakers. Falls through layers on miss (L1 → L2₁ → L2₂...), backfills upper layers on hit.
// Circuit breakers prevent cascading failures when remote layers become unhealthy.

import { createCircuitBreaker, type CircuitBreaker } from '../resilience/circuit-breaker'
import { TagIndex } from '../sync/tags'

import { wrapAsyncDriver, type AsyncLayer } from './layers/async-layer'
import { wrapSyncDriver, type SyncLayer } from './layers/sync-layer'

import type { AsyncDriver, SyncDriver } from '../contracts/driver'
import type { CacheEntry } from '../entry'

const DEFAULT_CIRCUIT_BREAK_DURATION = 30_000
const DEFAULT_FAILURE_THRESHOLD = 3

export interface TieredStoreConfig {
  l1?: SyncDriver
  l2?: AsyncDriver[]
  prefix?: string
  circuitBreakerDuration?: number
  circuitBreakerThreshold?: number
}

export interface StorageResult {
  entry?: CacheEntry
  source?: string
  graced?: boolean
}

interface GuardedLayer {
  layer: AsyncLayer
  cb: CircuitBreaker
}

async function guardedCall<T>(cb: CircuitBreaker, fn: () => Promise<T>, fallback: T): Promise<T> {
  if (cb.isOpen()) {
    return fallback
  }

  try {
    const result = await fn()

    cb.recordSuccess()

    return result
  } catch {
    cb.recordFailure()

    return fallback
  }
}

function createBackfill(l1: SyncLayer | undefined, layers: GuardedLayer[]) {
  return (key: string, entry: CacheEntry, sourceIndex: number): void => {
    if (l1 && sourceIndex > 0) {
      l1.set(key, entry)
    }

    const l2StartIndex = l1 ? 1 : 0

    for (let i = l2StartIndex; i < sourceIndex; i++) {
      const guarded = layers[i - l2StartIndex]

      if (!guarded.cb.isOpen()) {
        void guardedCall(guarded.cb, () => guarded.layer.set(key, entry), undefined)
      }
    }
  }
}

interface InternalConfig {
  l1?: SyncLayer
  layers: GuardedLayer[]
  prefix: string
  tags: TagIndex
  cbDuration: number
  cbThreshold: number
}

export class TieredStore {
  readonly #l1?: SyncLayer
  readonly #layers: GuardedLayer[]
  readonly #prefix: string
  readonly #tags: TagIndex
  readonly #cbDuration: number
  readonly #cbThreshold: number
  readonly #backfill: ReturnType<typeof createBackfill>

  constructor(config: TieredStoreConfig)
  constructor(internal: InternalConfig, isInternal: true)
  constructor(config: TieredStoreConfig | InternalConfig, isInternal?: true) {
    if (isInternal) {
      const internal = config as InternalConfig

      this.#l1 = internal.l1
      this.#layers = internal.layers
      this.#prefix = internal.prefix
      this.#tags = internal.tags
      this.#cbDuration = internal.cbDuration
      this.#cbThreshold = internal.cbThreshold
    } else {
      const external = config as TieredStoreConfig
      const cbDuration = external.circuitBreakerDuration ?? DEFAULT_CIRCUIT_BREAK_DURATION
      const cbThreshold = external.circuitBreakerThreshold ?? DEFAULT_FAILURE_THRESHOLD

      this.#l1 = external.l1 ? wrapSyncDriver(external.l1) : undefined
      this.#layers = []

      for (const driver of external.l2 ?? []) {
        this.#layers.push({
          layer: wrapAsyncDriver(driver),
          cb: createCircuitBreaker({
            breakDuration: cbDuration,
            failureThreshold: cbThreshold,
          }),
        })
      }

      this.#prefix = external.prefix ?? ''
      this.#tags = new TagIndex()
      this.#cbDuration = cbDuration
      this.#cbThreshold = cbThreshold
    }

    this.#backfill = createBackfill(this.#l1, this.#layers)
  }

  get driverNames(): { l1?: string; l2: string[] } {
    return {
      l1: this.#l1?.name,
      l2: this.#layers.map((g) => g.layer.name),
    }
  }

  invalidateL1(...keys: string[]): void {
    if (!this.#l1 || keys.length === 0) {
      return
    }

    const prefixedKeys = keys.map((k) => this.#key(k))

    this.#l1.deleteMany(prefixedKeys)
  }

  clearL1(): void {
    if (this.#l1) {
      this.#l1.clear()
    }
  }

  async get(key: string): Promise<StorageResult> {
    const k = this.#key(key)

    if (this.#l1) {
      const entry = this.#l1.get(k)

      if (entry && !entry.isGced()) {
        return { entry, source: this.#l1.name, graced: entry.isStale() }
      }
    }

    for (let i = 0; i < this.#layers.length; i++) {
      const guarded = this.#layers[i]
      const entry = await guardedCall(guarded.cb, () => guarded.layer.get(k), undefined)

      if (entry && !entry.isGced()) {
        const sourceIndex = (this.#l1 ? 1 : 0) + i

        this.#backfill(k, entry, sourceIndex)

        return { entry, source: guarded.layer.name, graced: entry.isStale() }
      }
    }

    return {}
  }

  async getMany(keys: string[]): Promise<Map<string, StorageResult>> {
    const results = new Map<string, StorageResult>()

    if (keys.length === 0) {
      return results
    }

    const prefixedKeys = keys.map((k) => this.#key(k))
    const keyMap = new Map(keys.map((k, i) => [prefixedKeys[i], k]))
    let pending = [...prefixedKeys]

    if (this.#l1 && pending.length > 0) {
      const hits = this.#l1.getMany(pending)

      for (const [pk, entry] of hits) {
        if (!entry.isGced()) {
          const originalKey = keyMap.get(pk)

          if (originalKey) {
            results.set(originalKey, {
              entry,
              source: this.#l1.name,
              graced: entry.isStale(),
            })

            pending = pending.filter((k) => k !== pk)
          }
        }
      }
    }

    for (let i = 0; i < this.#layers.length && pending.length > 0; i++) {
      const guarded = this.#layers[i]
      const hits = await guardedCall(
        guarded.cb,
        () => guarded.layer.getMany(pending),
        new Map<string, CacheEntry>(),
      )

      for (const [pk, entry] of hits.entries()) {
        if (!entry.isGced()) {
          const originalKey = keyMap.get(pk)

          if (originalKey) {
            const sourceIndex = (this.#l1 ? 1 : 0) + i

            results.set(originalKey, {
              entry,
              source: guarded.layer.name,
              graced: entry.isStale(),
            })

            this.#backfill(pk, entry, sourceIndex)

            pending = pending.filter((k) => k !== pk)
          }
        }
      }
    }

    return results
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    const k = this.#key(key)

    if (entry.tags.length > 0) {
      this.#tags.register(k, entry.tags)
    }

    if (this.#l1) {
      this.#l1.set(k, entry)
    }

    await Promise.all(
      this.#layers.map((guarded) =>
        guardedCall(guarded.cb, () => guarded.layer.set(k, entry), undefined),
      ),
    )
  }

  async delete(...keys: string[]): Promise<number> {
    if (keys.length === 0) {
      return 0
    }

    const prefixedKeys = keys.map((k) => this.#key(k))

    for (const k of prefixedKeys) {
      this.#tags.unregister(k)
    }

    const counts: number[] = []

    if (this.#l1) {
      counts.push(this.#l1.deleteMany(prefixedKeys))
    }

    const l2Counts = await Promise.all(
      this.#layers.map((guarded) =>
        guardedCall(guarded.cb, () => guarded.layer.deleteMany(prefixedKeys), 0),
      ),
    )

    counts.push(...l2Counts)

    return Math.max(...counts, 0)
  }

  async has(key: string): Promise<boolean> {
    const k = this.#key(key)

    if (this.#l1 && this.#l1.has(k)) {
      return true
    }

    for (const guarded of this.#layers) {
      const exists = await guardedCall(guarded.cb, () => guarded.layer.has(k), false)

      if (exists) {
        return true
      }
    }

    return false
  }

  async clear(): Promise<void> {
    this.#tags.clear()

    if (this.#l1) {
      this.#l1.clear()
    }

    await Promise.all(
      this.#layers.map((guarded) =>
        guardedCall(guarded.cb, () => guarded.layer.clear(), undefined),
      ),
    )
  }

  async invalidateTags(tags: string[]): Promise<number> {
    const keys = [...this.#tags.invalidate(tags)]

    if (keys.length === 0) {
      return 0
    }

    const counts: number[] = []

    if (this.#l1) {
      counts.push(this.#l1.deleteMany(keys))
    }

    const l2Counts = await Promise.all(
      this.#layers.map((guarded) =>
        guardedCall(guarded.cb, () => guarded.layer.deleteMany(keys), 0),
      ),
    )

    counts.push(...l2Counts)

    return Math.max(...counts, 0)
  }

  namespace(prefix: string): TieredStore {
    const newPrefix = this.#prefix ? `${this.#prefix}:${prefix}` : prefix

    return new TieredStore(
      {
        l1: this.#l1,
        layers: this.#layers,
        prefix: newPrefix,
        tags: this.#tags,
        cbDuration: this.#cbDuration,
        cbThreshold: this.#cbThreshold,
      },
      true,
    )
  }

  async connect(): Promise<void> {
    await Promise.all(
      this.#layers
        .map((g) => g.layer.driver.connect?.())
        .filter((p): p is Promise<void> => p !== undefined),
    )
  }

  async disconnect(): Promise<void> {
    await Promise.all(
      this.#layers
        .map((g) => g.layer.driver.disconnect?.())
        .filter((p): p is Promise<void> => p !== undefined),
    )
  }

  #key(key: string): string {
    return this.#prefix ? `${this.#prefix}:${key}` : key
  }
}
