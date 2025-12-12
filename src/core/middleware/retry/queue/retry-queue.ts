import {
  exponentialBackoff,
  fibonacciBackoff,
  linearBackoff,
  type OnDeadLetterCallback,
  type OnRetryCallback,
  type RetryBackoff,
} from '../retry-backoff'

import { RetryManager } from './retry-manager'

import type { Transport } from '@/contracts/transport'
import type { TransportData } from '@/types'

import { createScheduler, type Scheduler } from '@/core/middleware/retry/queue/utils/scheduler'

/** @internal */
export interface QueuedMessage {
  channel: string
  data: TransportData
  attempts: number
  nextRetryAt: number
  createdAt: number
  error?: string
}

/** @internal */
interface MessageEntry {
  hash: string
  message: QueuedMessage
}

/** @public */
export interface RetryQueueOptions {
  baseDelayMs?: number
  intervalMs?: number
  maxAttempts?: number
  backoff?: 'exponential' | 'linear' | 'fibonacci' | RetryBackoff
  removeDuplicates?: boolean
  maxSize?: number
  concurrency?: number
  onDeadLetter?: OnDeadLetterCallback
  onRetry?: OnRetryCallback
}

/** @internal */
class MinHeap {
  #items: string[] = []
  #compare: (a: string, b: string) => number
  #messages: Map<string, MessageEntry>

  constructor(messages: Map<string, MessageEntry>) {
    this.#messages = messages
    this.#compare = (a, b) => {
      const entryA = this.#messages.get(a)
      const entryB = this.#messages.get(b)

      if (!entryA || !entryB) {
        return 0
      }

      return entryA.message.nextRetryAt - entryB.message.nextRetryAt
    }
  }

  push(hash: string): void {
    this.#items.push(hash)
    this.#bubbleUp(this.#items.length - 1)
  }

  pop(): string | undefined {
    if (this.#items.length === 0) {
      return undefined
    }
    if (this.#items.length === 1) {
      return this.#items.pop()
    }

    const top = this.#items[0]

    this.#items[0] = this.#items.pop() as string
    this.#bubbleDown(0)

    return top
  }

  peek(): string | undefined {
    return this.#items[0]
  }

  isEmpty(): boolean {
    return this.#items.length === 0
  }

  clear(): void {
    this.#items = []
  }

  #bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2)

      if (this.#compare(this.#items[index], this.#items[parentIndex]) >= 0) {
        break
      }
      ;[this.#items[index], this.#items[parentIndex]] = [
        this.#items[parentIndex],
        this.#items[index],
      ]
      index = parentIndex
    }
  }

  #bubbleDown(index: number): void {
    const length = this.#items.length

    while (true) {
      const leftChild = 2 * index + 1
      const rightChild = 2 * index + 2
      let smallest = index

      if (leftChild < length && this.#compare(this.#items[leftChild], this.#items[smallest]) < 0) {
        smallest = leftChild
      }

      if (
        rightChild < length &&
        this.#compare(this.#items[rightChild], this.#items[smallest]) < 0
      ) {
        smallest = rightChild
      }

      if (smallest === index) {
        break
      }
      ;[this.#items[index], this.#items[smallest]] = [this.#items[smallest], this.#items[index]]
      index = smallest
    }
  }
}

/** @public */
export class RetryQueue {
  #messages: Map<string, MessageEntry>
  #readyHeap: MinHeap
  #hashCache: WeakMap<Uint8Array, string>
  #retryManager: RetryManager
  #scheduler: Scheduler
  #baseDelayMs: number
  #concurrency: number
  #maxSize: number
  #removeDuplicates: boolean

  constructor(transport: Transport, options: RetryQueueOptions = {}) {
    const baseDelayMs = options.baseDelayMs ?? 60000
    const intervalMs = options.intervalMs ?? 5000
    const maxAttempts = options.maxAttempts ?? 10
    const backoff = options.backoff ?? 'exponential'
    const removeDuplicates = options.removeDuplicates ?? true
    const maxSize = options.maxSize ?? 1000
    const concurrency = options.concurrency ?? 10

    this.#baseDelayMs = baseDelayMs
    this.#concurrency = concurrency
    this.#maxSize = maxSize
    this.#removeDuplicates = removeDuplicates

    const backoffFn = this.#resolveBackoff(backoff)

    this.#messages = new Map()
    this.#readyHeap = new MinHeap(this.#messages)
    this.#hashCache = new WeakMap()

    this.#retryManager = new RetryManager(
      transport,
      backoffFn,
      maxAttempts,
      baseDelayMs,
      options.onRetry,
      options.onDeadLetter,
    )

    this.#scheduler = createScheduler(() => this.#process(), intervalMs)
  }

  async start(): Promise<void> {
    this.#scheduler.start()
  }

  async stop(): Promise<void> {
    this.#scheduler.stop()
  }

  async enqueue(channel: string, data: TransportData, error?: Error): Promise<string | undefined> {
    const hash = this.#removeDuplicates ? this.#getOrComputeHash(channel, data) : this.#randomId()

    if (this.#messages.has(hash)) {
      return hash
    }

    if (this.#messages.size >= this.#maxSize) {
      this.#evictOldest()
    }

    const now = Date.now()
    const message: QueuedMessage = {
      channel,
      data,
      attempts: 0,
      nextRetryAt: now + this.#baseDelayMs,
      createdAt: now,
      error: error?.message,
    }

    const entry: MessageEntry = { hash, message }

    this.#messages.set(hash, entry)
    this.#readyHeap.push(hash)

    return hash
  }

  async flush(): Promise<void> {
    const allHashes = Array.from(this.#messages.keys())

    for (let i = 0; i < allHashes.length; i += this.#concurrency) {
      const chunk = allHashes
        .slice(i, i + this.#concurrency)
        .map((hash) => this.#messages.get(hash))
        .filter((entry): entry is MessageEntry => entry !== undefined)

      await Promise.allSettled(chunk.map((entry) => this.#processMessage(entry)))

      if (!this.#scheduler.isRunning()) {
        break
      }
    }
  }

  clear(): void {
    this.#messages.clear()
    this.#readyHeap.clear()
  }

  async #process(): Promise<void> {
    const now = Date.now()
    const batch: MessageEntry[] = []

    while (!this.#readyHeap.isEmpty() && batch.length < this.#concurrency) {
      const hash = this.#readyHeap.peek()

      if (!hash) {
        break
      }

      const entry = this.#messages.get(hash)

      if (!entry) {
        this.#readyHeap.pop()
        continue
      }

      if (entry.message.nextRetryAt > now) {
        break
      }

      this.#readyHeap.pop()
      batch.push(entry)
    }

    if (batch.length === 0) {
      return
    }

    await Promise.allSettled(batch.map((entry) => this.#processMessage(entry)))
  }

  async #processMessage(entry: MessageEntry): Promise<void> {
    const result = await this.#retryManager.retry(entry.message)

    if (result.shouldRemove) {
      this.#messages.delete(entry.hash)
    } else if (result.nextRetryAt !== undefined) {
      const nextRetryAt = result.nextRetryAt

      entry.message.nextRetryAt = nextRetryAt
      entry.message.error = result.error
      entry.message.attempts++
      this.#readyHeap.push(entry.hash)
    }
  }

  #getOrComputeHash(channel: string, data: TransportData): string {
    const cached = this.#hashCache.get(data)

    if (cached) {
      return cached
    }

    const hash = this.#computeHash(channel, data)

    this.#hashCache.set(data, hash)

    return hash
  }

  #computeHash(channel: string, data: TransportData): string {
    return `${channel}:${this.#hashUint8Array(data)}`
  }

  #hashUint8Array(data: Uint8Array): string {
    let hash = 0

    for (let i = 0; i < data.length; i++) {
      hash = (hash << 5) - hash + data[i]
      hash = hash & hash
    }

    return hash.toString(36)
  }

  #randomId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
  }

  #evictOldest(): void {
    let oldestHash: string | undefined
    let oldestTime = Infinity

    for (const [hash, entry] of this.#messages) {
      if (entry.message.createdAt < oldestTime) {
        oldestTime = entry.message.createdAt
        oldestHash = hash
      }
    }

    if (oldestHash) {
      this.#messages.delete(oldestHash)
    }
  }

  #resolveBackoff(backoff: 'exponential' | 'linear' | 'fibonacci' | RetryBackoff): RetryBackoff {
    if (typeof backoff === 'function') {
      return backoff
    }

    switch (backoff) {
      case 'exponential':
        return exponentialBackoff
      case 'linear':
        return linearBackoff
      case 'fibonacci':
        return fibonacciBackoff
    }
  }
}
