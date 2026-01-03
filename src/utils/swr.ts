export interface SwrResult<T> {
  value: T
  stale: boolean
}

export interface SwrOptions<T> {
  staleValue?: T
  timeout?: number
  /** If true, abort the fetch on timeout. If false (default), let it continue in background */
  abortOnTimeout?: boolean
  backgroundRefresh?: () => Promise<unknown>
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function withSwr<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  options: SwrOptions<T> = {},
): Promise<SwrResult<T>> {
  const { staleValue, timeout, abortOnTimeout = false, backgroundRefresh } = options
  const hasStale = 'staleValue' in options

  if (!hasStale) {
    return { value: await fn(new AbortController().signal), stale: false }
  }

  if (timeout === 0) {
    if (backgroundRefresh) {
      void backgroundRefresh().catch(() => {})
    }

    return { value: staleValue as T, stale: true }
  }

  if (timeout !== undefined && timeout > 0) {
    const controller = new AbortController()

    const fetchPromise = fn(controller.signal).then((v) => ({ type: 'fresh' as const, value: v }))

    const result = await Promise.race([
      fetchPromise,
      sleep(timeout).then(() => ({ type: 'timeout' as const })),
    ])

    if (result.type === 'fresh') {
      return { value: result.value, stale: false }
    }

    if (abortOnTimeout) {
      controller.abort()
      if (backgroundRefresh) {
        void backgroundRefresh().catch(() => {})
      }
    }

    return { value: staleValue as T, stale: true }
  }

  return { value: await fn(new AbortController().signal), stale: false }
}
