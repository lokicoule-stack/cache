export interface CacheEntryData {
  value: unknown
  createdAt: number
  staleAt: number
  gcAt: number
  tags: string[]
}

export interface SerializedEntry {
  v: unknown
  c: number
  s: number // staleAt
  g: number // gcAt
  t: string[]
}

export class CacheEntry {
  readonly value: unknown
  readonly createdAt: number
  readonly staleAt: number
  readonly gcAt: number
  readonly tags: string[]

  private constructor(data: CacheEntryData) {
    this.value = data.value
    this.createdAt = data.createdAt
    this.staleAt = data.staleAt
    this.gcAt = data.gcAt
    this.tags = data.tags
  }

  static create(
    value: unknown,
    options: { staleTime: number; gcTime?: number; tags?: string[] },
  ): CacheEntry {
    const now = Date.now()

    return new CacheEntry({
      value,
      createdAt: now,
      staleAt: now + options.staleTime,
      gcAt: now + (options.gcTime ?? options.staleTime),
      tags: options.tags ?? [],
    })
  }

  static deserialize(data: SerializedEntry): CacheEntry {
    return new CacheEntry({
      value: data.v,
      createdAt: data.c,
      staleAt: data.s,
      gcAt: data.g,
      tags: data.t,
    })
  }

  isStale(): boolean {
    return Date.now() >= this.staleAt
  }

  isGced(): boolean {
    return Date.now() >= this.gcAt
  }

  /**
   * @param ratio 0-1, e.g. 0.8 = 80% of lifetime elapsed
   */
  isNearExpiration(ratio: number = 0.8): boolean {
    const lifetime = this.staleAt - this.createdAt
    const elapsed = Date.now() - this.createdAt

    return elapsed >= lifetime * ratio
  }

  serialize(): SerializedEntry {
    return {
      v: this.value,
      c: this.createdAt,
      s: this.staleAt,
      g: this.gcAt,
      t: this.tags,
    }
  }

  expire(): CacheEntry {
    return new CacheEntry({
      value: this.value,
      createdAt: this.createdAt,
      staleAt: Date.now() - 1,
      gcAt: this.gcAt,
      tags: this.tags,
    })
  }
}
