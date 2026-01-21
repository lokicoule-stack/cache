import type { AsyncDriver } from '@/contracts/driver'
import type { CacheEntry } from '@/entry'

type FailureMode = 'none' | 'always' | 'intermittent' | 'timeout' | 'slow'

export class FailingDriver implements AsyncDriver {
  readonly name = 'failing-driver'
  #failureMode: FailureMode = 'none'
  #failureRate = 0.5
  #latency = 0
  #callCount = 0
  #data = new Map<string, CacheEntry>()

  setFailureMode(mode: FailureMode, options?: { rate?: number; latency?: number }): void {
    this.#failureMode = mode
    this.#failureRate = options?.rate ?? 0.5
    this.#latency = options?.latency ?? 5000
    this.#callCount = 0
  }

  get callCount(): number {
    return this.#callCount
  }

  reset(): void {
    this.#data.clear()
    this.#callCount = 0
    this.#failureMode = 'none'
  }

  private async maybeFailOrDelay(): Promise<void> {
    this.#callCount++

    switch (this.#failureMode) {
      case 'always':
        throw new Error('Driver failure: always fail mode')

      case 'intermittent':
        if (Math.random() < this.#failureRate) {
          throw new Error('Driver failure: intermittent fail')
        }
        break

      case 'timeout':
        await new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Driver timeout')), this.#latency),
        )
        break

      case 'slow':
        await new Promise((resolve) => setTimeout(resolve, this.#latency))
        break

      case 'none':
      default:
        break
    }
  }

  async get(key: string): Promise<CacheEntry | undefined> {
    await this.maybeFailOrDelay()
    return this.#data.get(key)
  }

  async getMany(keys: string[]): Promise<Map<string, CacheEntry>> {
    await this.maybeFailOrDelay()
    const result = new Map<string, CacheEntry>()
    for (const key of keys) {
      const entry = this.#data.get(key)
      if (entry) result.set(key, entry)
    }
    return result
  }

  async set(key: string, entry: CacheEntry): Promise<void> {
    await this.maybeFailOrDelay()
    this.#data.set(key, entry)
  }

  async delete(key: string): Promise<boolean> {
    await this.maybeFailOrDelay()
    return this.#data.delete(key)
  }

  async deleteMany(keys: string[]): Promise<number> {
    await this.maybeFailOrDelay()
    let count = 0
    for (const key of keys) {
      if (this.#data.delete(key)) count++
    }
    return count
  }

  async has(key: string): Promise<boolean> {
    await this.maybeFailOrDelay()
    return this.#data.has(key)
  }

  async clear(): Promise<void> {
    await this.maybeFailOrDelay()
    this.#data.clear()
  }
}
