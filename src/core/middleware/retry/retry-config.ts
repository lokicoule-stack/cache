import type {
  RetryBackoff,
  OnRetryCallback,
  OnDeadLetterCallback,
} from './retry-backoff'

/**
 * Advanced queue configuration (rarement modifié)
 */
export interface RetryQueueConfig {
  /** Maximum queue size (default: 1000) */
  maxSize?: number
  /** Maximum concurrent retry operations (default: 10) */
  concurrency?: number
  /** Remove duplicate messages (default: true) */
  removeDuplicates?: boolean
}

/**
 * Retry configuration object
 */
export interface RetryConfigObject {
  /** Maximum retry attempts (default: 10) */
  maxAttempts?: number
  /** Initial delay in ms before first retry (default: 60000 = 1min) */
  delay?: number
  /** Backoff strategy (default: 'exponential') */
  backoff?: 'exponential' | 'linear' | 'fibonacci' | RetryBackoff
  /** Advanced queue settings */
  queue?: RetryQueueConfig
  /** Callback on retry attempt */
  onRetry?: OnRetryCallback
  /** Callback when moved to dead letter */
  onDeadLetter?: OnDeadLetterCallback
}

/**
 * Retry configuration - KISS approach with union types
 *
 * Supports multiple formats:
 * - `false`: Completely disabled
 * - `true` or `undefined`: Enabled with defaults (10 retries, exponential backoff)
 * - `number`: Max attempts (e.g., `5` = 5 retries with default backoff)
 * - `RetryConfigObject`: Full control over all retry options
 *
 * @example
 * ```typescript
 * // Disabled
 * retry: false
 *
 * // 5 retries
 * retry: 5
 *
 * // Full control
 * retry: {
 *   maxAttempts: 10,
 *   delay: 30000,
 *   backoff: 'fibonacci',
 *   queue: { concurrency: 5 },
 *   onDeadLetter: (ch, data, err) => console.error(err)
 * }
 * ```
 */
export type RetryConfig = false | true | number | RetryConfigObject

export const DEFAULT_RETRY_CONFIG: Required<Omit<RetryConfigObject, 'onRetry' | 'onDeadLetter'>> = {
  maxAttempts: 10,
  delay: 60000,
  backoff: 'exponential',
  queue: {
    maxSize: 1000,
    concurrency: 10,
    removeDuplicates: true,
  },
}
