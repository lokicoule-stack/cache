export interface Timer {
  /** Duration in ms. Returns elapsed time even if end() not called yet. */
  readonly elapsed: number
  /** Finalize the timer. Multiple calls are safe. Returns final duration. */
  end(): number
}

/** @internal */
export function createTimer(): Timer {
  const start = performance.now()
  let final: number | null = null

  return {
    get elapsed() {
      return final ?? performance.now() - start
    },

    end() {
      final ??= performance.now() - start

      return final
    },
  }
}
