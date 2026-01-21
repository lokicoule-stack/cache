import { CacheEntry, type SyncDriver } from '@/index'

export interface FakeL1Config {
  name?: string
  initialData?: Map<string, CacheEntry>
}

// Unlike naive Map wrapper, filters GC'd entries on read to match MemoryDriver TTL behavior
// Tracks method calls (getCalls, setCalls, deleteCalls) for test assertions
export class FakeL1Driver implements SyncDriver {
  readonly name: string
  readonly #data: Map<string, CacheEntry>

  readonly getCalls: string[] = []
  readonly setCalls: Array<{ key: string; entry: CacheEntry }> = []
  readonly deleteCalls: string[] = []

  constructor(config: FakeL1Config = {}) {
    this.name = config.name ?? 'fake-l1'
    this.#data = config.initialData ?? new Map<string, CacheEntry>()
  }

  get(key: string): CacheEntry | undefined {
    this.getCalls.push(key)
    const entry = this.#data.get(key)

    // Filter GC'd entries (mimics TTL eviction in real MemoryDriver)
    if (entry?.isGced()) {
      this.#data.delete(key)
      return undefined
    }

    return entry
  }

  getMany(keys: string[]): Map<string, CacheEntry> {
    const result = new Map<string, CacheEntry>()
    for (const key of keys) {
      const entry = this.get(key)
      if (entry) result.set(key, entry)
    }
    return result
  }

  set(key: string, entry: CacheEntry): void {
    this.setCalls.push({ key, entry })
    this.#data.set(key, entry)
  }

  delete(key: string): boolean {
    this.deleteCalls.push(key)
    return this.#data.delete(key)
  }

  deleteMany(keys: string[]): number {
    let count = 0
    for (const key of keys) {
      if (this.delete(key)) count++
    }
    return count
  }

  has(key: string): boolean {
    const entry = this.#data.get(key)

    // Filter GC'd entries (mimics TTL eviction)
    if (entry?.isGced()) {
      this.#data.delete(key)
      return false
    }

    return this.#data.has(key)
  }

  clear(): void {
    this.#data.clear()
  }

  get size(): number {
    return this.#data.size
  }

  keys(): string[] {
    return [...this.#data.keys()]
  }

  reset(): void {
    this.#data.clear()
    this.getCalls.length = 0
    this.setCalls.length = 0
    this.deleteCalls.length = 0
  }
}
