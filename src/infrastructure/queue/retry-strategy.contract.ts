/**
 * Retry strategy interface for calculating backoff delays
 *
 * Defines the contract for retry delay calculation strategies.
 * Implementations control how retry intervals grow with attempt count.
 * Used by RetryManager to determine next retry timing.
 *
 * @example
 * ```typescript
 * class CustomStrategy implements IRetryStrategy {
 *   calculateDelay(attempt: number, baseDelayMs: number): number {
 *     return baseDelayMs * attempt * attempt // quadratic
 *   }
 * }
 * ```
 */
export interface IRetryStrategy {
  /**
   * Calculate delay for a retry attempt
   *
   * @param attempt - Current attempt number (1-indexed)
   * @param baseDelayMs - Base delay configured in options
   * @returns Delay in milliseconds before next retry
   */
  calculateDelay(attempt: number, baseDelayMs: number): number
}
