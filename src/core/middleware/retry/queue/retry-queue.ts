import {
  exponentialBackoff,
  fibonacciBackoff,
  linearBackoff,
  type OnDeadLetterCallback,
  type OnRetryCallback,
  type RetryBackoff,
} from '../retry-backoff'

import { MessageQueue } from './message-queue'
import { RetryManager } from './retry-manager'

import type { Transport } from '@/contracts/transport'
import type { TransportData } from '@/types'

import { processBatch } from '@/core/middleware/retry/queue/utils/batch'
import { createScheduler, type Scheduler } from '@/core/middleware/retry/queue/utils/scheduler'

/** @internal */
export interface QueuedMessage {
  /** Unique identifier (hash or UUID) */
  id: string
  /** Target channel */
  channel: string
  /** Binary payload */
  data: TransportData
  /** Retry attempts made */
  attempts: number
  /** Next retry timestamp */
  nextRetryAt: Date
  /** Creation timestamp */
  createdAt: Date
  /** Last error message */
  error?: string
}

/** @internal */
export interface RetryQueueOptions {
  /** Base delay in ms (default: 60000) */
  baseDelayMs?: number
  /** Processing interval in ms (default: 5000) */
  intervalMs?: number
  /** Max attempts before dead letter (default: 10) */
  maxAttempts?: number
  /** Backoff strategy (default: 'exponential') */
  backoff?: 'exponential' | 'linear' | 'fibonacci' | RetryBackoff
  /** Remove duplicates (default: true) */
  removeDuplicates?: boolean
  /** Max queue size (default: 1000) */
  maxSize?: number
  /** Max concurrent retries (default: 10) */
  concurrency?: number
  /** Dead letter callback */
  onDeadLetter?: OnDeadLetterCallback
  /** Retry callback */
  onRetry?: OnRetryCallback
}

/** @internal */
export class RetryQueue {
  #messageQueue: MessageQueue
  #retryManager: RetryManager
  #scheduler: Scheduler
  #baseDelayMs: number
  #concurrency: number

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

    const backoffFn = this.#resolveBackoff(backoff)

    this.#messageQueue = new MessageQueue(maxSize, removeDuplicates)
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
    return this.#messageQueue.enqueue(channel, data, this.#baseDelayMs, error?.message)
  }

  async flush(): Promise<void> {
    const all = this.#messageQueue.getAll()

    await processBatch(
      all,
      (msg) => this.#processMessage(msg),
      this.#concurrency,
      () => !this.#scheduler.isRunning(),
    )
  }

  clear(): void {
    this.#messageQueue.clear()
  }

  async #process(): Promise<void> {
    const now = new Date()
    const ready = this.#messageQueue.getAll().filter((msg) => msg.nextRetryAt <= now)

    await processBatch(
      ready,
      (msg) => this.#processMessage(msg),
      this.#concurrency,
      () => !this.#scheduler.isRunning(),
    )
  }

  async #processMessage(message: QueuedMessage): Promise<void> {
    const result = await this.#retryManager.retry(message)

    if (result.shouldRemove) {
      this.#messageQueue.remove(message.id)
    } else if (result.nextRetryAt) {
      message.nextRetryAt = result.nextRetryAt
      message.error = result.error
      this.#messageQueue.update(message)
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
