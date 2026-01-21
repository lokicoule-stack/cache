export interface CircuitBreakerOptions {
  breakDuration: number
  failureThreshold?: number
}

export interface CircuitBreaker {
  isOpen(): boolean
  recordSuccess(): void
  recordFailure(): void
  reset(): void
}

/**
 * @internal
 */
export function createCircuitBreaker(options: CircuitBreakerOptions): CircuitBreaker {
  const threshold = options.failureThreshold ?? 1
  let consecutiveFailures = 0
  let openUntil: number | null = null

  return {
    isOpen() {
      if (openUntil !== null && Date.now() >= openUntil) {
        openUntil = null
        consecutiveFailures = 0
      }

      return openUntil !== null
    },

    recordSuccess() {
      consecutiveFailures = 0
    },

    recordFailure() {
      consecutiveFailures++
      if (consecutiveFailures >= threshold) {
        openUntil = Date.now() + options.breakDuration
      }
    },

    reset() {
      openUntil = null
      consecutiveFailures = 0
    },
  }
}
