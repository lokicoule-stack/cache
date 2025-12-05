export interface IRetryStrategy {
  calculateDelay(attempt: number, baseDelayMs: number): number
}

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
 * Grows slower than exponential but faster than linear.
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
