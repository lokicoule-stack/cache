import { TransportMiddleware } from '../base'

import { RetryQueue } from './queue/retry-queue'
import {
  type RetryConfig,
  type RetryConfigObject,
  DEFAULT_RETRY_CONFIG,
} from './retry-config'

import type { Transport } from '@/contracts/transport'
import type { TransportData } from '@/types'

/**
 * Middleware that adds retry capabilities to a transport layer.
 * 
 * Automatically retries failed publish operations using a configurable
 * retry queue with support for exponential backoff, dead letter handling,
 * and duplicate detection.
 * 
 * @example
 * ```ts
 * // Basic usage with defaults
 * const transport = new RetryMiddleware(baseTransport)
 * 
 * // Custom retry attempts
 * const transport = new RetryMiddleware(baseTransport, 5)
 * 
 * // Full configuration
 * const transport = new RetryMiddleware(baseTransport, {
 *   maxAttempts: 3,
 *   backoff: 'exponential',
 *   delay: 1000,
 *   queue: {
 *     maxSize: 1000,
 *     concurrency: 5
 *   }
 * })
 * 
 * // Disabled retries
 * const transport = new RetryMiddleware(baseTransport, false)
 * ```
 */
export class RetryMiddleware extends TransportMiddleware {
  readonly #retryQueue: RetryQueue | null

  constructor(transport: Transport, config?: RetryConfig) {
    super(transport)

    const normalizedConfig = this.#normalizeConfig(config)

    this.#retryQueue = this.#initializeQueue(normalizedConfig)
  }

  public override async connect(): Promise<void> {
    await this.transport.connect()

    if (this.#retryQueue) {
      await this.#retryQueue.start()
    }
  }

  public override async disconnect(): Promise<void> {
    if (this.#retryQueue) {
      await this.#retryQueue.stop()
    }

    await this.transport.disconnect()
  }

  public override async publish(
    channel: string,
    data: TransportData
  ): Promise<void> {
    try {
      await this.transport.publish(channel, data)
    } catch (error) {
      if (!this.#retryQueue) {
        throw error
      }

      await this.#retryQueue.enqueue(
        channel,
        data,
        error instanceof Error ? error : new Error(String(error))
      )
    }
  }

  /**
   * Normalizes the retry configuration into a standard object format.
   * Supports multiple input formats for developer convenience:
   * - `undefined` or `true`: Uses default configuration
   * - `false`: Disables retries completely
   * - `number`: Sets maxAttempts, uses defaults for other options
   * - `object`: Deep merges with defaults
   */
  #normalizeConfig(config?: RetryConfig): RetryConfigObject {
    // Early return for disabled state
    if (config === false) {
      return { ...DEFAULT_RETRY_CONFIG, maxAttempts: 0 }
    }

    // Handle primitive types
    if (config === undefined || config === true) {
      return DEFAULT_RETRY_CONFIG
    }

    if (typeof config === 'number') {
      return { ...DEFAULT_RETRY_CONFIG, maxAttempts: config }
    }

    // Deep merge for object config
    return {
      ...DEFAULT_RETRY_CONFIG,
      ...config,
      queue: {
        ...DEFAULT_RETRY_CONFIG.queue,
        ...config.queue,
      },
    }
  }

  /**
   * Initializes the retry queue based on configuration.
   * Returns null if retries are disabled (maxAttempts === 0).
   */
  #initializeQueue(config: RetryConfigObject): RetryQueue | null {
    if (config.maxAttempts === 0) {
      return null
    }

    const queueConfig = config.queue ?? DEFAULT_RETRY_CONFIG.queue

    return new RetryQueue(this.transport, {
      baseDelayMs: config.delay,
      intervalMs: 5000, // Fixed processing interval
      maxAttempts: config.maxAttempts,
      backoff: config.backoff,
      maxSize: queueConfig.maxSize,
      concurrency: queueConfig.concurrency,
      removeDuplicates: queueConfig.removeDuplicates,
      onRetry: config.onRetry,
      onDeadLetter: config.onDeadLetter,
    })
  }
}