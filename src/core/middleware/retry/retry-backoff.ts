import type { TransportData } from '@/types'

/**
 * Type for a retry backoff function
 *
 * @param attempt - Current retry attempt (1-indexed)
 * @param baseDelayMs - Base delay in milliseconds
 * @returns Calculated delay in milliseconds
 */
export type RetryBackoff = (attempt: number, baseDelayMs: number) => number

/**
 * Callback invoked when a message is retried
 *
 * @param channel - The channel name
 * @param data - The message data
 * @param attempt - Current attempt number (1-indexed)
 */
export type OnRetryCallback = (
  channel: string,
  data: TransportData,
  attempt: number,
) => void | Promise<void>

/**
 * Callback invoked when a message is moved to dead letter queue
 *
 * @param channel - The channel name
 * @param data - The message data
 * @param error - The error that caused the message to be dead lettered
 * @param attempts - Total number of attempts made
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
 * Doubles the delay with each attempt. Useful for scenarios where you want
 * to back off aggressively to avoid overwhelming a failing service.
 *
 * @example
 * ```typescript
 * exponentialBackoff(1, 100) // 100ms
 * exponentialBackoff(2, 100) // 200ms
 * exponentialBackoff(3, 100) // 400ms
 * exponentialBackoff(4, 100) // 800ms
 * ```
 */
export const exponentialBackoff: RetryBackoff = (attempt, baseDelayMs) =>
  baseDelayMs * Math.pow(2, attempt - 1)

/**
 * Linear backoff: delay = baseDelay (constant)
 *
 * Uses a constant delay between retries. Useful when you want consistent
 * retry intervals regardless of attempt count.
 *
 * @example
 * ```typescript
 * linearBackoff(1, 100) // 100ms
 * linearBackoff(2, 100) // 100ms
 * linearBackoff(3, 100) // 100ms
 * ```
 */
export const linearBackoff: RetryBackoff = (_attempt, baseDelayMs) =>
  baseDelayMs

/**
 * Fibonacci backoff: delay = baseDelay * fibonacci(attempt)
 *
 * Grows slower than exponential but faster than linear. Provides a balanced
 * approach between aggressive and conservative backoff strategies.
 *
 * @example
 * ```typescript
 * fibonacciBackoff(1, 100) // 100ms
 * fibonacciBackoff(2, 100) // 100ms
 * fibonacciBackoff(3, 100) // 200ms
 * fibonacciBackoff(4, 100) // 300ms
 * fibonacciBackoff(5, 100) // 500ms
 * ```
 */
export const fibonacciBackoff: RetryBackoff = (attempt, baseDelayMs) =>
  baseDelayMs * fibonacci(attempt)

/**
 * Calculate the nth Fibonacci number (1-indexed)
 *
 * @param n - Position in Fibonacci sequence (1-indexed)
 * @returns The nth Fibonacci number
 */
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
 * Add a maximum delay cap to any backoff function
 *
 * Prevents delays from growing indefinitely by capping them at a maximum value.
 * Useful when combined with exponential or fibonacci backoff.
 *
 * @param backoff - The base backoff function to wrap
 * @param maxDelayMs - Maximum delay in milliseconds
 * @returns A new backoff function with delay capped at maxDelayMs
 *
 * @example
 * ```typescript
 * const capped = withMaxDelay(exponentialBackoff, 5000)
 * capped(1, 100) // 100ms
 * capped(10, 100) // 5000ms (would be 51200ms without cap)
 * ```
 */
export const withMaxDelay = (
  backoff: RetryBackoff,
  maxDelayMs: number,
): RetryBackoff => (attempt, baseDelayMs) =>
  Math.min(backoff(attempt, baseDelayMs), maxDelayMs)

/**
 * Add jitter (randomness) to any backoff function
 *
 * Adds random variation to delays to prevent thundering herd problem when
 * multiple clients retry simultaneously. The jitter is proportional to the
 * calculated delay.
 *
 * @param backoff - The base backoff function to wrap
 * @param jitterFactor - Factor controlling jitter amount (default: 0.1 = ±10%)
 * @returns A new backoff function with randomized delays
 *
 * @example
 * ```typescript
 * const jittered = withJitter(linearBackoff, 0.1)
 * jittered(1, 1000) // ~900-1100ms (±10% of 1000ms)
 *
 * // Combine with other backoff strategies
 * const strategy = withJitter(
 *   withMaxDelay(exponentialBackoff, 5000),
 *   0.2
 * )
 * ```
 */
export const withJitter = (
  backoff: RetryBackoff,
  jitterFactor = 0.1,
): RetryBackoff => (attempt, baseDelayMs) => {
  const delay = backoff(attempt, baseDelayMs)
  const jitter = delay * jitterFactor * (Math.random() * 2 - 1)

  return Math.max(0, delay + jitter)
}
