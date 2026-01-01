import { createCircuitBreaker, type CircuitBreaker } from './utils/circuit-breaker'
import { TagIndex } from './utils/tags'

import type { CacheEntry } from './entry'
import type { SyncStore, AsyncStore } from './types'

const DEFAULT_CIRCUIT_BREAK_DURATION = 30_000

export interface StackConfig {
  local?: SyncStore
  remotes?: AsyncStore[]
  prefix?: string
  circuitBreakerDuration?: number
}

interface Remote {
  store: AsyncStore
  cb: CircuitBreaker
}

interface InternalConfig {
  local?: SyncStore
  remotes: Remote[]
  prefix: string
  tags: TagIndex
  cbDuration: number
}

export interface LookupResult {
  entry?: CacheEntry
  source?: string
  graced?: boolean
}

export class CacheStack {
  readonly #local?: SyncStore
  readonly #remotes: Remote[]
  readonly #prefix: string
  readonly #tags: TagIndex
  readonly #cbDuration: number

  constructor(config: StackConfig)
  constructor(internal: InternalConfig, isInternal: true)
  constructor(config: StackConfig | InternalConfig, isInternal?: true) {
    if (isInternal) {
      const internal = config as InternalConfig

      this.#local = internal.local
      this.#remotes = internal.remotes
      this.#prefix = internal.prefix
      this.#tags = internal.tags
      this.#cbDuration = internal.cbDuration
    } else {
      const external = config as StackConfig

      this.#local = external.local
      this.#prefix = external.prefix ?? ''
      this.#tags = new TagIndex()
      this.#cbDuration = external.circuitBreakerDuration ?? DEFAULT_CIRCUIT_BREAK_DURATION
      this.#remotes = (external.remotes ?? []).map((store) => ({
        store,
        cb: createCircuitBreaker(this.#cbDuration),
      }))
    }
  }

  get storeNames(): { local?: string; remotes: string[] } {
    return {
      local: this.#local?.name,
      remotes: this.#remotes.map((r) => r.store.name),
    }
  }

  async get(key: string): Promise<LookupResult> {
    const k = this.#key(key)

    // Check local first (sync)
    if (this.#local) {
      const entry = this.#local.get(k)

      if (entry && !entry.isGced()) {
        return { entry, source: this.#local.name, graced: entry.isStale() }
      }
    }

    // Check remotes in order
    for (let i = 0; i < this.#remotes.length; i++) {
      const remote = this.#remotes[i]

      if (remote.cb.isOpen()) {
        continue
      }

      try {
        const entry = await remote.store.get(k)

        if (entry && !entry.isGced()) {
          // Backfill local and previous remotes
          this.#backfill(k, entry, i)

          return { entry, source: remote.store.name, graced: entry.isStale() }
        }
      } catch {
        remote.cb.open()
      }
    }

    return {}
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    const k = this.#key(key)

    // Register tags
    if (entry.tags.length > 0) {
      this.#tags.register(k, entry.tags)
    }

    // Set local (sync)
    this.#local?.set(k, entry)

    // Set all remotes in parallel
    await Promise.all(
      this.#remotes.map(async (remote) => {
        if (remote.cb.isOpen()) {
          return
        }
        try {
          await remote.store.set(k, entry)
        } catch {
          remote.cb.open()
        }
      }),
    )
  }

  async delete(...keys: string[]): Promise<number> {
    if (keys.length === 0) {
      return 0
    }

    const prefixedKeys = keys.map((k) => this.#key(k))

    // Unregister tags
    for (const k of prefixedKeys) {
      this.#tags.unregister(k)
    }

    // Delete from local
    let count = this.#local?.delete(...prefixedKeys) ?? 0

    // Delete from all remotes in parallel
    const results = await Promise.all(
      this.#remotes.map(async (remote) => {
        if (remote.cb.isOpen()) {
          return 0
        }
        try {
          return await remote.store.delete(...prefixedKeys)
        } catch {
          remote.cb.open()

          return 0
        }
      }),
    )

    // Return max count from any layer
    for (const r of results) {
      if (r > count) {
        count = r
      }
    }

    return count
  }

  async has(key: string): Promise<boolean> {
    const k = this.#key(key)

    if (this.#local?.has(k)) {
      return true
    }

    for (const remote of this.#remotes) {
      if (remote.cb.isOpen()) {
        continue
      }
      try {
        if (await remote.store.has(k)) {
          return true
        }
      } catch {
        remote.cb.open()
      }
    }

    return false
  }

  async clear(): Promise<void> {
    this.#tags.clear()
    this.#local?.clear()

    await Promise.all(
      this.#remotes.map(async (remote) => {
        if (remote.cb.isOpen()) {
          return
        }
        try {
          await remote.store.clear()
        } catch {
          remote.cb.open()
        }
      }),
    )
  }

  async invalidateTags(tags: string[]): Promise<number> {
    const keys = [...this.#tags.getKeysByTags(tags)]

    if (keys.length === 0) {
      return 0
    }

    // Keys are already prefixed in TagIndex
    // But delete() adds prefix, so we need to strip it
    const unprefixed = this.#prefix ? keys.map((k) => k.slice(this.#prefix.length + 1)) : keys

    return this.delete(...unprefixed)
  }

  deleteLocal(...keys: string[]): number {
    if (!this.#local || keys.length === 0) {
      return 0
    }

    const prefixedKeys = keys.map((k) => this.#key(k))

    return this.#local.delete(...prefixedKeys)
  }

  clearLocal(): void {
    this.#local?.clear()
  }

  namespace(prefix: string): CacheStack {
    const newPrefix = this.#prefix ? `${this.#prefix}:${prefix}` : prefix

    return new CacheStack(
      {
        local: this.#local,
        remotes: this.#remotes,
        prefix: newPrefix,
        tags: this.#tags,
        cbDuration: this.#cbDuration,
      },
      true,
    )
  }

  async connect(): Promise<void> {
    await Promise.all(this.#remotes.map((r) => r.store.connect?.()))
  }

  async disconnect(): Promise<void> {
    await Promise.all(this.#remotes.map((r) => r.store.disconnect?.()))
  }

  #backfill(key: string, entry: CacheEntry, sourceIndex: number): void {
    // Backfill local
    this.#local?.set(key, entry)

    // Backfill previous remotes (fire-and-forget)
    for (let i = 0; i < sourceIndex; i++) {
      const remote = this.#remotes[i]

      if (!remote.cb.isOpen()) {
        remote.store.set(key, entry).catch(() => remote.cb.open())
      }
    }
  }

  #key(key: string): string {
    return this.#prefix ? `${this.#prefix}:${key}` : key
  }
}
