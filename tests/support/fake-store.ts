import { CacheEntry, type SyncStore, type AsyncStore } from '@/index'

/**
 * In-memory L1 store for testing.
 */
export class FakeL1Store implements SyncStore {
  readonly name = 'fake-l1'
  #data = new Map<string, CacheEntry>()

  get(key: string): CacheEntry | undefined {
    return this.#data.get(key)
  }

  set(key: string, entry: CacheEntry): void {
    this.#data.set(key, entry)
  }

  clear(): void {
    this.#data.clear()
  }

  has(key: string): boolean {
    return this.#data.has(key)
  }

  getMany(...keys: string[]): Map<string, CacheEntry | undefined> {
    const results = new Map<string, CacheEntry | undefined>()
    for (const key of keys) {
      results.set(key, this.#data.get(key))
    }
    return results
  }

  setMany(...entries: [string, CacheEntry][]): void {
    for (const [key, entry] of entries) {
      this.#data.set(key, entry)
    }
  }

  delete(...keys: string[]): number {
    let count = 0
    for (const k of keys) {
      if (this.#data.delete(k)) count++
    }
    return count
  }

  // Test helpers
  get size(): number {
    return this.#data.size
  }

  keys(): string[] {
    return [...this.#data.keys()]
  }
}

/**
 * In-memory L2 store for testing with failure simulation.
 */
export class FakeL2Store implements AsyncStore {
  readonly name = 'fake-l2'
  #data = new Map<string, CacheEntry>()
  #shouldFail = false
  #failCount = 0
  #connected = false

  connect(): Promise<void> {
    this.#connected = true
    return Promise.resolve()
  }

  disconnect(): Promise<void> {
    this.#connected = false
    return Promise.resolve()
  }

  get(key: string): Promise<CacheEntry | undefined> {
    if (this.#shouldFail) {
      return this.#rejectWithFailure()
    }
    return Promise.resolve(this.#data.get(key))
  }

  set(key: string, entry: CacheEntry): Promise<void> {
    if (this.#shouldFail) {
      return this.#rejectWithFailure()
    }
    this.#data.set(key, entry)
    return Promise.resolve()
  }

  delete(...keys: string[]): Promise<number> {
    if (this.#shouldFail) {
      return this.#rejectWithFailure()
    }

    let count = 0
    for (const k of keys) {
      if (this.#data.delete(k)) count++
    }
    return Promise.resolve(count)
  }

  clear(): Promise<void> {
    if (this.#shouldFail) {
      return this.#rejectWithFailure()
    }
    this.#data.clear()
    return Promise.resolve()
  }

  has(key: string): Promise<boolean> {
    if (this.#shouldFail) {
      return this.#rejectWithFailure()
    }
    return Promise.resolve(this.#data.has(key))
  }

  getMany(...keys: string[]): Promise<Map<string, CacheEntry | undefined>> {
    if (this.#shouldFail) {
      return this.#rejectWithFailure()
    }
    const results = new Map<string, CacheEntry | undefined>()
    for (const key of keys) {
      results.set(key, this.#data.get(key))
    }
    return Promise.resolve(results)
  }

  setMany(...entries: [string, CacheEntry][]): Promise<void> {
    if (this.#shouldFail) {
      return this.#rejectWithFailure()
    }
    for (const [key, entry] of entries) {
      this.#data.set(key, entry)
    }
    return Promise.resolve()
  }


  // Test helpers
  simulateFailure(fail: boolean): void {
    this.#shouldFail = fail
  }

  get failCount(): number {
    return this.#failCount
  }

  get size(): number {
    return this.#data.size
  }

  get connected(): boolean {
    return this.#connected
  }

  keys(): string[] {
    return [...this.#data.keys()]
  }

  #rejectWithFailure<T>(): Promise<T> {
    this.#failCount++
    return Promise.reject(new Error('Simulated L2 failure'))
  }
}
