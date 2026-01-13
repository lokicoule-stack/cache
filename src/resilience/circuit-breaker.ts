export interface CircuitBreakerOptions {
  /** Duration in ms the circuit stays open */
  breakDuration: number
  /** Number of consecutive failures before opening (default: 1) */
  failureThreshold?: number
}

export interface CircuitBreaker {
  /** Check if circuit is open (should skip calls) */
  isOpen(): boolean
  /** Record a successful call - resets failure counter */
  recordSuccess(): void
  /** Record a failed call - may open circuit if threshold reached */
  recordFailure(): void
  /** Force reset to closed state */
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
