export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: {
    timeout?: number
    interval?: number
    message?: string
  } = {},
): Promise<void> {
  const { timeout = 1000, interval = 10, message } = options
  const start = Date.now()

  while (true) {
    const result = await condition()
    if (result) return

    if (Date.now() - start > timeout) {
      throw new Error(message || `Timeout after ${timeout}ms waiting for condition`)
    }

    await new Promise((resolve) => setTimeout(resolve, interval))
  }
}

export async function waitForValue<T>(
  getValue: () => T | Promise<T>,
  expected: T,
  options?: {
    timeout?: number
    interval?: number
    compare?: (a: T, b: T) => boolean
  },
): Promise<void> {
  const compare = options?.compare ?? ((a, b) => a === b)

  await waitFor(
    async () => {
      const value = await getValue()
      return compare(value, expected)
    },
    {
      timeout: options?.timeout,
      interval: options?.interval,
      message: `Timeout waiting for value to match ${expected}`,
    },
  )
}

/**
 * Add timeout wrapper to any promise
 * Critical for preventing test hangs
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message?: string,
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(message || `Operation timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    // Clean up timer if original promise resolves
    promise.finally(() => clearTimeout(timer))
  })

  return Promise.race([promise, timeoutPromise])
}

export interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: Error) => void
  settled: boolean
}

export function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  let settled = false

  const promise = new Promise<T>((res, rej) => {
    resolve = (value: T) => {
      settled = true
      res(value)
    }
    reject = (error: Error) => {
      settled = true
      rej(error)
    }
  })

  return { promise, resolve, reject, settled }
}

/**
 * Simple delay utility
 * Prefer waitFor for polling, use this only for explicit pauses
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Execute callback after delay
 */
export async function after<T>(ms: number, fn: () => T | Promise<T>): Promise<T> {
  await delay(ms)
  return fn()
}
