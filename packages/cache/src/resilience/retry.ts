import { delay } from './delay'

export interface RetryOptions {
  /** Number of retry attempts (0 = no retries, just one attempt) */
  retries: number
  /** Base delay in ms (default: 100) */
  baseDelay?: number
}

/**
 * @internal
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions | number,
): Promise<T> {
  const opts = typeof options === 'number' ? { retries: options } : options
  const baseDelay = opts.baseDelay ?? 100
  const maxAttempts = opts.retries + 1

  let lastError: Error | undefined

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))

      if (attempt < maxAttempts - 1) {
        await delay(baseDelay * Math.pow(2, attempt))
      }
    }
  }

  throw lastError ?? new Error('Retry failed without error')
}
