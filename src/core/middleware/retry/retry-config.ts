import type {
  RetryBackoff,
  OnRetryCallback,
  OnDeadLetterCallback,
} from './retry-backoff'

/**
 * Advanced queue configuration.
 * @public
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
 * Retry configuration object.
 * @public
 */
export interface RetryConfigObject {
  /** Maximum retry attempts (default: 10) */
  maxAttempts?: number
  /** Initial delay in ms (default: 60000 = 1min) */
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

/** @public */
export type RetryConfig = false | true | number | RetryConfigObject

/** @internal */
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
