import { createCircuitBreaker, type CircuitBreaker } from './utils/circuit-breaker'
import { TagIndex } from './utils/tags'

import type { CacheEntry } from './entry'
import type { SyncDriver, AsyncDriver } from './types'

const DEFAULT_CIRCUIT_BREAK_DURATION = 30_000

export interface StackConfig {
  l1?: SyncDriver
  l2?: AsyncDriver[]
  prefix?: string
  circuitBreakerDuration?: number
}

interface Remote {
  driver: AsyncDriver
  cb: CircuitBreaker
}

interface InternalConfig {
  l1?: SyncDriver
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
  readonly #l1?: SyncDriver
  readonly #remotes: Remote[]
  readonly #prefix: string
  readonly #tags: TagIndex
  readonly #cbDuration: number

  constructor(config: StackConfig)
  constructor(internal: InternalConfig, isInternal: true)
  constructor(config: StackConfig | InternalConfig, isInternal?: true) {
    if (isInternal) {
      const internal = config as InternalConfig

      this.#l1 = internal.l1
      this.#remotes = internal.remotes
      this.#prefix = internal.prefix
      this.#tags = internal.tags
      this.#cbDuration = internal.cbDuration
    } else {
      const external = config as StackConfig

      this.#l1 = external.l1
      this.#prefix = external.prefix ?? ''
      this.#tags = new TagIndex()
      this.#cbDuration = external.circuitBreakerDuration ?? DEFAULT_CIRCUIT_BREAK_DURATION
      this.#remotes = (external.l2 ?? []).map((driver) => ({
        driver,
        cb: createCircuitBreaker(this.#cbDuration),
      }))
    }
  }

  get driverNames(): { l1?: string; l2: string[] } {
    return {
      l1: this.#l1?.name,
      l2: this.#remotes.map((r) => r.driver.name),
    }
  }

  get l1(): SyncDriver | undefined {
    return this.#l1
  }

  invalidateL1(...keys: string[]): void {
    if (!this.#l1 || keys.length === 0) {
      return
    }

    const prefixedKeys = keys.map((k) => this.#key(k))

    this.#l1.delete(...prefixedKeys)
  }

  clearL1(): void {
    this.#l1?.clear()
  }

  async get(key: string): Promise<LookupResult> {
    const k = this.#key(key)

    if (this.#l1) {
      const entry = this.#l1.get(k)

      if (entry && !entry.isGced()) {
        return { entry, source: this.#l1.name, graced: entry.isStale() }
      }
    }

    for (let i = 0; i < this.#remotes.length; i++) {
      const remote = this.#remotes[i]

      if (remote.cb.isOpen()) {
        continue
      }

      try {
        const entry = await remote.driver.get(k)

        if (entry && !entry.isGced()) {
          this.#backfill(k, entry, i)

          return { entry, source: remote.driver.name, graced: entry.isStale() }
        }
      } catch {
        remote.cb.open()
      }
    }

    return {}
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    const k = this.#key(key)

    if (entry.tags.length > 0) {
      this.#tags.register(k, entry.tags)
    }

    this.#l1?.set(k, entry)

    await Promise.all(
      this.#remotes.map(async (remote) => {
        if (remote.cb.isOpen()) {
          return
        }
        try {
          await remote.driver.set(k, entry)
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

    for (const k of prefixedKeys) {
      this.#tags.unregister(k)
    }

    let count = this.#l1?.delete(...prefixedKeys) ?? 0

    const results = await Promise.all(
      this.#remotes.map(async (remote) => {
        if (remote.cb.isOpen()) {
          return 0
        }
        try {
          return await remote.driver.delete(...prefixedKeys)
        } catch {
          remote.cb.open()

          return 0
        }
      }),
    )

    for (const r of results) {
      if (r > count) {
        count = r
      }
    }

    return count
  }

  async has(key: string): Promise<boolean> {
    const k = this.#key(key)

    if (this.#l1?.has(k)) {
      return true
    }

    for (const remote of this.#remotes) {
      if (remote.cb.isOpen()) {
        continue
      }
      try {
        if (await remote.driver.has(k)) {
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
    this.#l1?.clear()

    await Promise.all(
      this.#remotes.map(async (remote) => {
        if (remote.cb.isOpen()) {
          return
        }
        try {
          await remote.driver.clear()
        } catch {
          remote.cb.open()
        }
      }),
    )
  }

  async invalidateTags(tags: string[]): Promise<number> {
    const keys = [...this.#tags.invalidate(tags)]

    if (keys.length === 0) {
      return 0
    }

    return this.#deleteKeys(keys)
  }

  namespace(prefix: string): CacheStack {
    const newPrefix = this.#prefix ? `${this.#prefix}:${prefix}` : prefix

    return new CacheStack(
      {
        l1: this.#l1,
        remotes: this.#remotes,
        prefix: newPrefix,
        tags: this.#tags,
        cbDuration: this.#cbDuration,
      },
      true,
    )
  }

  async connect(): Promise<void> {
    await Promise.all(
      this.#remotes
        .map((r) => r.driver.connect?.())
        .filter((p): p is Promise<void> => p !== undefined),
    )
  }

  async disconnect(): Promise<void> {
    await Promise.all(
      this.#remotes
        .map((r) => r.driver.disconnect?.())
        .filter((p): p is Promise<void> => p !== undefined),
    )
  }

  #backfill(key: string, entry: CacheEntry, sourceIndex: number): void {
    this.#l1?.set(key, entry)

    for (let i = 0; i < sourceIndex; i++) {
      const remote = this.#remotes[i]

      if (!remote.cb.isOpen()) {
        remote.driver.set(key, entry).catch(() => remote.cb.open())
      }
    }
  }

  #key(key: string): string {
    return this.#prefix ? `${this.#prefix}:${key}` : key
  }

  async #deleteKeys(prefixedKeys: string[]): Promise<number> {
    let count = this.#l1?.delete(...prefixedKeys) ?? 0

    const results = await Promise.all(
      this.#remotes.map(async (remote) => {
        if (remote.cb.isOpen()) {
          return 0
        }
        try {
          return await remote.driver.delete(...prefixedKeys)
        } catch {
          remote.cb.open()

          return 0
        }
      }),
    )

    for (const r of results) {
      if (r > count) {
        count = r
      }
    }

    return count
  }
}
