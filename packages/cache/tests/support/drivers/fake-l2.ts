import { CacheEntry, type AsyncDriver } from '@/index'
import { sleep } from '../time'

export interface FakeL2Config {
  name?: string
  initialData?: Map<string, CacheEntry>
  latency?: number
}

export interface FailureConfig {
  enabled: boolean
  count?: number
  error?: Error
}

export class FakeL2Driver implements AsyncDriver {
  readonly name: string
  readonly #data: Map<string, CacheEntry>
  readonly #latency: number

  #connected = false
  #failure: FailureConfig = { enabled: false }
  #operationCount = 0

  readonly getCalls: string[] = []
  readonly setCalls: Array<{ key: string; entry: CacheEntry }> = []
  readonly deleteCalls: string[] = []

  constructor(config: FakeL2Config = {}) {
    this.name = config.name ?? 'fake-l2'
    this.#data = config.initialData ?? new Map<string, CacheEntry>()
    this.#latency = config.latency ?? 0
  }

  async connect(): Promise<void> {
    await this.#maybeDelay()
    this.#connected = true
  }

  async disconnect(): Promise<void> {
    await this.#maybeDelay()
    this.#connected = false
  }

  async get(key: string): Promise<CacheEntry | undefined> {
    await this.#maybeDelay()
    this.#maybeThrow()
    this.getCalls.push(key)
    return this.#data.get(key)
  }

  async getMany(keys: string[]): Promise<Map<string, CacheEntry>> {
    await this.#maybeDelay()
    this.#maybeThrow()
    const result = new Map<string, CacheEntry>()
    for (const key of keys) {
      this.getCalls.push(key)
      const entry = this.#data.get(key)
      if (entry) result.set(key, entry)
    }
    return result
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    await this.#maybeDelay()
    this.#maybeThrow()
    this.setCalls.push({ key, entry })
    this.#data.set(key, entry)
  }

  async delete(key: string): Promise<boolean> {
    await this.#maybeDelay()
    this.#maybeThrow()
    this.deleteCalls.push(key)
    return this.#data.delete(key)
  }

  async deleteMany(keys: string[]): Promise<number> {
    await this.#maybeDelay()
    this.#maybeThrow()
    let count = 0
    for (const key of keys) {
      this.deleteCalls.push(key)
      if (this.#data.delete(key)) count++
    }
    return count
  }

  async has(key: string): Promise<boolean> {
    await this.#maybeDelay()
    this.#maybeThrow()
    return this.#data.has(key)
  }

  async clear(): Promise<void> {
    await this.#maybeDelay()
    this.#maybeThrow()
    this.#data.clear()
  }

  simulateFailure(config: Partial<FailureConfig> = { enabled: true }): void {
    this.#failure = {
      enabled: config.enabled ?? true,
      count: config.count,
      error: config.error ?? new Error('Simulated L2 failure'),
    }
  }

  stopFailure(): void {
    this.#failure = { enabled: false }
  }

  get isConnected(): boolean {
    return this.#connected
  }

  get size(): number {
    return this.#data.size
  }

  get operationCount(): number {
    return this.#operationCount
  }

  keys(): string[] {
    return [...this.#data.keys()]
  }

  reset(): void {
    this.#data.clear()
    this.#failure = { enabled: false }
    this.#operationCount = 0
    this.getCalls.length = 0
    this.setCalls.length = 0
    this.deleteCalls.length = 0
  }

  async #maybeDelay(): Promise<void> {
    this.#operationCount++
    if (this.#latency > 0) {
      await sleep(this.#latency)
    }
  }

  #maybeThrow(): void {
    if (!this.#failure.enabled) return

    if (this.#failure.count !== undefined) {
      if (this.#failure.count <= 0) {
        this.#failure.enabled = false
        return
      }
      this.#failure.count--
    }

    throw this.#failure.error ?? new Error('Simulated failure')
  }
}
