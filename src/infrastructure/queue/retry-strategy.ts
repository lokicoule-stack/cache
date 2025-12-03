import type { IRetryStrategy } from './retry-strategy.contract'

/**
 * Exponential backoff strategy (default)
 *
 * Doubles the delay with each attempt: baseDelay * 2^(attempt-1)
 * Suitable for most scenarios with external service failures.
 * Quickly backs off to reduce load on failing systems.
 *
 * Examples (baseDelay = 60s):
 * - Attempt 1: 60s
 * - Attempt 2: 120s (2min)
 * - Attempt 3: 240s (4min)
 * - Attempt 4: 480s (8min)
 * - Attempt 5: 960s (16min)
 *
 * @example
 * ```typescript
 * const strategy = new ExponentialBackoffStrategy()
 * const delay = strategy.calculateDelay(3, 60000) // 240000 (4 minutes)
 * ```
 */
export class ExponentialBackoffStrategy implements IRetryStrategy {
  /**
   * Calculate exponential backoff delay
   *
   * @param attempt - Current attempt number (1-indexed)
   * @param baseDelayMs - Base delay in milliseconds
   * @returns Exponentially increasing delay
   */
  calculateDelay(attempt: number, baseDelayMs: number): number {
    return baseDelayMs * Math.pow(2, attempt - 1)
  }
}

/**
 * Linear backoff strategy (fixed delay)
 *
 * Uses constant delay regardless of attempt count.
 * Suitable for scenarios where consistent retry intervals are needed,
 * such as polling or rate-limited APIs with fixed quotas.
 *
 * Examples (baseDelay = 60s):
 * - All attempts: 60s
 *
 * @example
 * ```typescript
 * const strategy = new LinearBackoffStrategy()
 * const delay = strategy.calculateDelay(5, 60000) // 60000 (always 1 minute)
 * ```
 */
export class LinearBackoffStrategy implements IRetryStrategy {
  /**
   * Calculate fixed delay
   *
   * @param _attempt - Unused (kept for interface compatibility)
   * @param baseDelayMs - Base delay in milliseconds
   * @returns Constant delay
   */
  calculateDelay(_attempt: number, baseDelayMs: number): number {
    return baseDelayMs
  }
}

/**
 * Fibonacci backoff strategy
 *
 * Increases delay following Fibonacci sequence: baseDelay * fib(attempt)
 * Grows slower than exponential but faster than linear.
 * Good balance between aggressive and conservative backoff.
 *
 * Examples (baseDelay = 60s):
 * - Attempt 1: 60s (fib 1)
 * - Attempt 2: 60s (fib 1)
 * - Attempt 3: 120s (fib 2)
 * - Attempt 4: 180s (fib 3)
 * - Attempt 5: 300s (fib 5)
 * - Attempt 6: 480s (fib 8)
 *
 * @example
 * ```typescript
 * const strategy = new FibonacciBackoffStrategy()
 * const delay = strategy.calculateDelay(5, 60000) // 300000 (5 minutes)
 * ```
 */
export class FibonacciBackoffStrategy implements IRetryStrategy {
  /**
   * Calculate Fibonacci backoff delay
   *
   * @param attempt - Current attempt number (1-indexed)
   * @param baseDelayMs - Base delay in milliseconds
   * @returns Delay based on Fibonacci sequence
   */
  calculateDelay(attempt: number, baseDelayMs: number): number {
    return baseDelayMs * this.#fibonacci(attempt)
  }

  /**
   * Calculate Fibonacci number iteratively
   *
   * Uses iterative approach to avoid recursion stack overhead.
   * Time complexity: O(n), Space complexity: O(1)
   *
   * @param n - Position in Fibonacci sequence (1-indexed)
   * @returns Fibonacci number at position n
   * @private
   */
  #fibonacci(n: number): number {
    if (n <= 1) {return 1}
    let prev = 1
    let curr = 1
    for (let i = 2; i < n; i++) {
      const next = prev + curr
      prev = curr
      curr = next
    }
    return curr
  }
}
