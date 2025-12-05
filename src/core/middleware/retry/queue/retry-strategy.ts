import type { IRetryStrategy } from './retry-strategy.contract'

export class ExponentialBackoffStrategy implements IRetryStrategy {
  calculateDelay(attempt: number, baseDelayMs: number): number {
    return baseDelayMs * Math.pow(2, attempt - 1)
  }
}

export class LinearBackoffStrategy implements IRetryStrategy {
  calculateDelay(_attempt: number, baseDelayMs: number): number {
    return baseDelayMs
  }
}

/**
 * Increases delay following Fibonacci sequence: baseDelay * fib(attempt)
 * Grows slower than exponential but faster than linear.
 * Good balance between aggressive and conservative backoff.
 */
export class FibonacciBackoffStrategy implements IRetryStrategy {
  calculateDelay(attempt: number, baseDelayMs: number): number {
    return baseDelayMs * this.#fibonacci(attempt)
  }
 
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
