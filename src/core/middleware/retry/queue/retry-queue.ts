import { MessageQueue } from './message-queue'
import { RetryManager } from './retry-manager'
import {
  ExponentialBackoffStrategy,
  FibonacciBackoffStrategy,
  LinearBackoffStrategy,
  type IRetryStrategy,
} from './retry-strategies'

import type { Transport } from '@/contracts/transport'
import type { TransportData } from '@/types'

import { processBatch } from '@/shared/utils/batch-processor'
import { createScheduler, type Scheduler } from '@/shared/utils/scheduler'

/**
 * Queued message metadata
 *
 * Represents a failed message awaiting retry. Tracks all state needed
 * for exponential backoff, dead letter handling, and debugging.
 *
 * @property id - Unique message identifier (hash or UUID)
 * @property channel - The channel the message was published to
 * @property data - The binary message payload
 * @property attempts - Number of retry attempts made so far
 * @property nextRetryAt - Timestamp when next retry should occur
 * @property createdAt - Timestamp when message was first enqueued
 * @property error - Last error message (optional, for debugging)
 */
export interface QueuedMessage {
  id: string
  channel: string
  data: TransportData
  attempts: number
  nextRetryAt: Date
  createdAt: Date
  error?: string
}

/**
 * Retry queue configuration options
 */
export interface RetryQueueOptions {
  /**
   * Base delay in milliseconds before first retry (default: 60000 = 1 minute)
   */
  baseDelayMs?: number

  /**
   * Processing interval in milliseconds (default: 5000 = 5 seconds)
   */
  intervalMs?: number

  /**
   * Maximum retry attempts before dead letter (default: 10)
   */
  maxAttempts?: number

  /**
   * Backoff strategy (default: 'exponential')
   *
   * - 'exponential': Doubles delay each attempt (2^n)
   * - 'linear': Fixed delay (constant)
   * - 'fibonacci': Fibonacci sequence growth
   * - Custom: Provide IRetryStrategy instance
   */
  backoff?: 'exponential' | 'linear' | 'fibonacci' | IRetryStrategy

  /**
   * Remove duplicate messages (default: true)
   */
  removeDuplicates?: boolean

  /**
   * Maximum queue size (default: 1000)
   */
  maxSize?: number

  /**
   * Maximum concurrent retry operations (default: 10)
   *
   * Controls how many messages are retried in parallel during each
   * processing cycle. Prevents overwhelming the transport or target system.
   */
  concurrency?: number

  /**
   * Callback when message is moved to dead letter queue
   */
  onDeadLetter?: (channel: string, data: TransportData, error: Error, attempts: number) => void | Promise<void>

  /**
   * Callback on retry attempt
   */
  onRetry?: (channel: string, data: TransportData, attempt: number) => void | Promise<void>
}

/**
 * Retry queue for handling failed message retries
 *
 * Provides configurable backoff strategies, dead letter handling,
 * and duplicate detection.
 */
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

    const strategy = this.#resolveStrategy(backoff)

    this.#messageQueue = new MessageQueue(maxSize, removeDuplicates)
    this.#retryManager = new RetryManager(
      transport,
      strategy,
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

  #resolveStrategy(backoff: 'exponential' | 'linear' | 'fibonacci' | IRetryStrategy): IRetryStrategy {
    if (typeof backoff === 'string') {
      switch (backoff) {
        case 'exponential':
          return new ExponentialBackoffStrategy()
        case 'linear':
          return new LinearBackoffStrategy()
        case 'fibonacci':
          return new FibonacciBackoffStrategy()
      }
    }

    return backoff
  }
}
