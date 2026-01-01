export interface CircuitBreaker {
  isOpen(): boolean
  open(): void
  close(): void
}

export function createCircuitBreaker(breakDuration: number): CircuitBreaker {
  let willCloseAt: number | null = null

  return {
    isOpen: () => {
      if (willCloseAt !== null && Date.now() >= willCloseAt) {
        willCloseAt = null
      }

      return willCloseAt !== null
    },
    open: () => {
      willCloseAt = Date.now() + breakDuration
    },
    close: () => {
      willCloseAt = null
    },
  }
}
