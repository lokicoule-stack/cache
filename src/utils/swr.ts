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

  if (!hasStale) {
    return { value: await fn(new AbortController().signal), stale: false }
  }

  if (timeout === 0) {
    void fn(new AbortController().signal).catch(() => {})

    return { value: staleValue as T, stale: true }
  }

  if (timeout !== undefined && timeout > 0) {
    const result = await Promise.race([
      fn(new AbortController().signal).then((v) => ({ type: 'fresh' as const, value: v })),
      sleep(timeout).then(() => ({ type: 'timeout' as const })),
    ])

    if (result.type === 'fresh') {
      return { value: result.value, stale: false }
    }

    void fn(new AbortController().signal).catch(() => {})

    return { value: staleValue as T, stale: true }
  }

  return { value: await fn(new AbortController().signal), stale: false }
}
