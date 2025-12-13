import type { RetryBackoff, OnRetryCallback, OnDeadLetterCallback } from './retry-backoff'

/**
 * Retry configuration object.
 * @public
 */
export interface RetryConfigObject {
  /** Maximum retry attempts (default: 10) */
  maxAttempts?: number
  /** Initial delay in ms (default: 1000 = 1s) */
  delay?: number
  /** Backoff strategy (default: 'exponential') */
  backoff?: 'exponential' | 'linear' | 'fibonacci' | RetryBackoff
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
  delay: 1000,
  backoff: 'exponential',
}
