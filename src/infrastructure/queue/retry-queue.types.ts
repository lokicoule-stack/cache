import type { IRetryStrategy } from './retry-strategy.contract'
import type { TransportData } from '@/core/types'

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
  onDeadLetter?: (
    channel: string,
    data: TransportData,
    error: Error,
    attempts: number,
  ) => void | Promise<void>

  /**
   * Callback on retry attempt
   */
  onRetry?: (channel: string, data: TransportData, attempt: number) => void | Promise<void>
}
