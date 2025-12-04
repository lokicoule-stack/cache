import { BatchProcessor } from './batch-processor'
import { MessageQueue } from './message-queue'
import { RetryManager } from './retry-manager'
import { ExponentialBackoffStrategy, FibonacciBackoffStrategy, LinearBackoffStrategy } from './retry-strategy'
import { Scheduler } from './scheduler'

import type { QueuedMessage } from './retry-queue.contract'
import type { RetryQueueOptions } from './retry-queue.types'
import type { IRetryStrategy } from './retry-strategy.contract'
import type { Transport } from '@/contracts/transport'
import type { TransportData } from '@/types'

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
    this.#scheduler = new Scheduler(() => this.#process(), intervalMs)
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

    await BatchProcessor.process(
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

  #resolveStrategy(
    backoff: 'exponential' | 'linear' | 'fibonacci' | IRetryStrategy,
  ): IRetryStrategy {
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
