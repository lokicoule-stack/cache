export interface SwrResult<T> {
  value: T
  stale: boolean
}

export interface SwrOptions<T> {
  staleValue?: T
  timeout?: number
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function withSwr<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  options: SwrOptions<T> = {},
): Promise<SwrResult<T>> {
  const { staleValue, timeout } = options
  const hasStale = 'staleValue' in options

  // No stale value: just execute
  if (!hasStale) {
    return { value: await fn(new AbortController().signal), stale: false }
  }

  // timeout: 0 → immediate SWR (return stale, refresh in background)
  if (timeout === 0) {
    void fn(new AbortController().signal).catch(() => {})

    return { value: staleValue as T, stale: true }
  }

  // timeout > 0 → race between fn and timeout
  if (timeout !== undefined && timeout > 0) {
    const result = await Promise.race([
      fn(new AbortController().signal).then((v) => ({ type: 'fresh' as const, value: v })),
      sleep(timeout).then(() => ({ type: 'timeout' as const })),
    ])

    if (result.type === 'fresh') {
      return { value: result.value, stale: false }
    }

    // Timeout: return stale, continue in background
    void fn(new AbortController().signal).catch(() => {})

    return { value: staleValue as T, stale: true }
  }

  // No timeout specified: just execute (no SWR behavior)
  return { value: await fn(new AbortController().signal), stale: false }
}
