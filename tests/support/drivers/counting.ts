import type { AsyncDriver } from '@/contracts/driver'
import type { CacheEntry } from '@/entry'

export class CountingDriver implements AsyncDriver {
  readonly name = 'counting'
  #data = new Map<string, CacheEntry>()
  #getCalls = 0
  #setCalls = 0
  #concurrentGets = 0
  #maxConcurrentGets = 0

  get stats() {
    return {
      getCalls: this.#getCalls,
      setCalls: this.#setCalls,
      maxConcurrentGets: this.#maxConcurrentGets,
    }
  }

  reset(): void {
    this.#data.clear()
    this.#getCalls = 0
    this.#setCalls = 0
    this.#concurrentGets = 0
    this.#maxConcurrentGets = 0
  }

  async get(key: string): Promise<CacheEntry | undefined> {
    this.#getCalls++
    this.#concurrentGets++
    this.#maxConcurrentGets = Math.max(this.#maxConcurrentGets, this.#concurrentGets)

    await new Promise((r) => setTimeout(r, 1))

    this.#concurrentGets--
    return this.#data.get(key)
  }

  async getMany(keys: string[]): Promise<Map<string, CacheEntry>> {
    const result = new Map<string, CacheEntry>()
    for (const key of keys) {
      const entry = await this.get(key)
      if (entry) result.set(key, entry)
    }
    return result
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    this.#setCalls++
    await new Promise((r) => setTimeout(r, 1))
    this.#data.set(key, entry)
  }

  async delete(key: string): Promise<boolean> {
    return this.#data.delete(key)
  }

  async deleteMany(keys: string[]): Promise<number> {
    let count = 0
    for (const key of keys) {
      if (this.#data.delete(key)) count++
    }
    return count
  }

  async has(key: string): Promise<boolean> {
    return this.#data.has(key)
  }

  async clear(): Promise<void> {
    this.#data.clear()
  }
}
