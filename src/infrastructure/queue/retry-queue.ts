import { BatchProcessor } from './batch-processor'
import { MessageQueue } from './message-queue'
import { RetryManager } from './retry-manager'
import { ExponentialBackoffStrategy, FibonacciBackoffStrategy, LinearBackoffStrategy } from './retry-strategy'
import { Scheduler } from './scheduler'

import type { ITransport } from '../../core/transport'
import type { TransportData } from '../../core/types'
import type { QueuedMessage } from './retry-queue.contract'
import type { RetryQueueOptions } from './retry-queue.types'
import type { IRetryStrategy } from './retry-strategy.contract'

/**
 * Retry queue for handling failed message retries
 *
 * Manages a retry queue for messages that failed to publish. Provides
 * configurable backoff strategies, dead letter handling, and duplicate
 * detection. Works with RetryMiddleware to enable resilient message delivery.
 *
 * Architecture:
 * - Facade pattern composing MessageQueue, RetryManager, and Scheduler
 * - Strategy pattern for pluggable backoff algorithms
 * - Internal components handle storage, retry logic, and scheduling
 *
 * Features:
 * - Configurable retry attempts and backoff strategy
 * - Three built-in strategies: exponential, linear, fibonacci
 * - Custom strategy support via IRetryStrategy interface
 * - Automatic duplicate detection via content hashing
 * - Dead letter queue callbacks for max-retry handling
 * - Queue size limits to prevent memory exhaustion
 * - Periodic processing with configurable intervals
 * - Statistics API for monitoring
 *
 * Lifecycle:
 * 1. Create queue with transport and options
 * 2. Call start() to begin processing loop
 * 3. Enqueue messages via enqueue() (called by RetryMiddleware)
 * 4. Queue attempts retries automatically
 * 5. Call stop() to halt processing gracefully
 *
 * @example
 * ```typescript
 * import { RetryQueue } from '@lokiverse/bus'
 * import { redis } from '@lokiverse/bus/transports'
 *
 * // Using built-in strategy (string)
 * const queue = new RetryQueue(redis(), {
 *   maxAttempts: 10,
 *   baseDelayMs: 60000, // 1 minute
 *   backoff: 'exponential',
 *   concurrency: 5, // Max 5 concurrent retries per cycle
 *   onDeadLetter: (channel, data, error, attempts) => {
 *     console.error(`Message failed after ${attempts} attempts:`, error)
 *   },
 * })
 *
 * // Using custom strategy (IRetryStrategy)
 * class CustomStrategy implements IRetryStrategy {
 *   calculateDelay(attempt: number, baseDelayMs: number): number {
 *     return baseDelayMs * attempt * attempt // quadratic
 *   }
 * }
 *
 * const customQueue = new RetryQueue(redis(), {
 *   backoff: new CustomStrategy(),
 *   concurrency: 20, // Higher concurrency for high-throughput systems
 * })
 *
 * await queue.start()
 * ```
 */
export class RetryQueue {
  #messageQueue: MessageQueue
  #retryManager: RetryManager
  #scheduler: Scheduler
  #baseDelayMs: number
  #concurrency: number

  /**
   * Create a new RetryQueue
   *
   * @param transport - The transport to use for retry attempts
   * @param options - Queue configuration (optional, uses defaults if omitted)
   */
  constructor(transport: ITransport, options: RetryQueueOptions = {}) {
    // Resolve defaults
    const baseDelayMs = options.baseDelayMs ?? 60000
    const intervalMs = options.intervalMs ?? 5000
    const maxAttempts = options.maxAttempts ?? 10
    const backoff = options.backoff ?? 'exponential'
    const removeDuplicates = options.removeDuplicates ?? true
    const maxSize = options.maxSize ?? 1000
    const concurrency = options.concurrency ?? 10

    this.#baseDelayMs = baseDelayMs
    this.#concurrency = concurrency

    // Resolve strategy (string → instance)
    const strategy = this.#resolveStrategy(backoff)

    // Create internal components
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

  /**
   * Start the retry queue
   *
   * Begins the periodic processing loop. Messages will be retried according
   * to the configured interval. Idempotent - safe to call multiple times.
   *
   * @returns Promise that resolves immediately after scheduling first tick
   */
  async start(): Promise<void> {
    this.#scheduler.start()
  }

  /**
   * Stop the retry queue
   *
   * Halts the processing loop and clears the timer. Pending messages remain
   * in the queue and will be processed if start() is called again. Idempotent.
   *
   * @returns Promise that resolves immediately after stopping
   */
  async stop(): Promise<void> {
    this.#scheduler.stop()
  }

  /**
   * Enqueue a failed message for retry
   *
   * Adds a message to the retry queue. If duplicate detection is enabled,
   * identical messages (same channel + data hash) are deduplicated.
   * Messages are scheduled for first retry after baseDelayMs.
   *
   * @param channel - The channel the message failed to publish to
   * @param data - The binary message data
   * @param error - The error that caused the failure (optional, for logging)
   * @returns Message ID if enqueued, undefined if duplicate detected
   * @throws {QueueFullError} If queue has reached maxSize limit
   *
   * @example
   * ```typescript
   * try {
   *   await transport.publish(channel, data)
   * } catch (error) {
   *   await queue.enqueue(channel, data, error as Error)
   * }
   * ```
   */
  async enqueue(channel: string, data: TransportData, error?: Error): Promise<string | undefined> {
    return this.#messageQueue.enqueue(channel, data, this.#baseDelayMs, error?.message)
  }

  /**
   * Clear all queued messages
   *
   * Removes all messages from the queue immediately. Use with caution -
   * messages are permanently lost. Does not stop the processing loop.
   *
   * @example
   * ```typescript
   * // Clear failed messages after manual intervention
   * queue.clear()
   * ```
   */
  clear(): void {
    this.#messageQueue.clear()
  }

  /**
   * Resolve backoff strategy from string or instance
   *
   * Converts string literals to strategy instances.
   * Passes through custom IRetryStrategy instances unchanged.
   *
   * @param backoff - Strategy name or instance
   * @returns Strategy instance
   * @private
   */
  #resolveStrategy(
    backoff: 'exponential' | 'linear' | 'fibonacci' | 'fixed' | IRetryStrategy,
  ): IRetryStrategy {
    if (typeof backoff === 'string') {
      switch (backoff) {
        case 'exponential':
          return new ExponentialBackoffStrategy()
        case 'linear':
        case 'fixed': // Backwards compatibility: 'fixed' → 'linear'
          return new LinearBackoffStrategy()
        case 'fibonacci':
          return new FibonacciBackoffStrategy()
      }
    }
    return backoff
  }

  /**
   * Process all ready messages
   *
   * Filters messages whose nextRetryAt has passed and attempts to
   * process them via RetryManager. Uses BatchProcessor for controlled
   * concurrency to prevent overwhelming the transport.
   *
   * @private
   */
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

  /**
   * Process a single message retry attempt
   *
   * Delegates to RetryManager for retry logic, then updates or removes
   * the message based on the result.
   *
   * @param message - The queued message to process
   * @private
   */
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
}
