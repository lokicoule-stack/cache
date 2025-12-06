import type { TransportData } from '@/types'

/**
 * Retry backoff function.
 * @public
 */
export type RetryBackoff = (attempt: number, baseDelayMs: number) => number

/**
 * Callback invoked when a message is retried.
 * @public
 */
export type OnRetryCallback = (
  channel: string,
  data: TransportData,
  attempt: number,
) => void | Promise<void>

/**
 * Callback invoked when a message is moved to dead letter queue.
 * @public
 */
export type OnDeadLetterCallback = (
  channel: string,
  data: TransportData,
  error: Error,
  attempts: number,
) => void | Promise<void>

/**
 * Exponential backoff: delay = baseDelay * 2^(attempt-1)
 *
 * @remarks
 * Doubles the delay with each attempt.
 *
 * @example
 * ```typescript
 * exponentialBackoff(1, 100) // 100ms
 * exponentialBackoff(2, 100) // 200ms
 * exponentialBackoff(3, 100) // 400ms
 * ```
 *
 * @public
 */
export const exponentialBackoff: RetryBackoff = (attempt, baseDelayMs) =>
  baseDelayMs * Math.pow(2, attempt - 1)

/**
 * Linear backoff: delay = baseDelay (constant)
 *
 * @remarks
 * Uses constant delay between retries.
 *
 * @public
 */
export const linearBackoff: RetryBackoff = (_attempt, baseDelayMs) =>
  baseDelayMs

/**
 * Fibonacci backoff: delay = baseDelay * fibonacci(attempt)
 *
 * @remarks
 * Grows slower than exponential but faster than linear.
 *
 * @example
 * ```typescript
 * fibonacciBackoff(1, 100) // 100ms
 * fibonacciBackoff(2, 100) // 100ms
 * fibonacciBackoff(3, 100) // 200ms
 * fibonacciBackoff(4, 100) // 300ms
 * ```
 *
 * @public
 */
export const fibonacciBackoff: RetryBackoff = (attempt, baseDelayMs) =>
  baseDelayMs * fibonacci(attempt)

const fibonacci = (n: number): number => {
  if (n <= 1) {
    return 1
  }

  let prev = 1
  let curr = 1

  for (let i = 2; i < n; i++) {
    const next = prev + curr

    prev = curr
    curr = next
  }

  return curr
}

/**
 * Add maximum delay cap to any backoff function.
 *
 * @remarks
 * Prevents delays from growing indefinitely.
 *
 * @example
 * ```typescript
 * const capped = withMaxDelay(exponentialBackoff, 5000)
 * capped(10, 100) // 5000ms (capped)
 * ```
 *
 * @public
 */
export const withMaxDelay = (
  backoff: RetryBackoff,
  maxDelayMs: number,
): RetryBackoff => (attempt, baseDelayMs) =>
  Math.min(backoff(attempt, baseDelayMs), maxDelayMs)

/**
 * Add jitter (randomness) to any backoff function.
 *
 * @remarks
 * Adds random variation to prevent thundering herd problem.
 *
 * @example
 * ```typescript
 * const jittered = withJitter(linearBackoff, 0.1)
 * jittered(1, 1000) // ~900-1100ms (±10%)
 *
 * const strategy = withJitter(
 *   withMaxDelay(exponentialBackoff, 5000),
 *   0.2
 * )
 * ```
 *
 * @public
 */
export const withJitter = (
  backoff: RetryBackoff,
  jitterFactor = 0.1,
): RetryBackoff => (attempt, baseDelayMs) => {
  const delay = backoff(attempt, baseDelayMs)
  const jitter = delay * jitterFactor * (Math.random() * 2 - 1)

  return Math.max(0, delay + jitter)
}
