import { vi } from 'vitest'

/**
 * Wait for a condition to become true.
 */
export async function waitFor(
  fn: () => boolean | Promise<boolean>,
  timeout = 1000,
  interval = 10,
): Promise<void> {
  const start = Date.now()

  while (Date.now() - start < timeout) {
    if (await fn()) return
    await new Promise((r) => setTimeout(r, interval))
  }

  throw new Error(`waitFor timed out after ${timeout}ms`)
}

/**
 * Sleep for a given duration.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Advance time by mocking Date.now() - for TTL tests.
 */
export function advanceTime(ms: number): void {
  const now = Date.now()
  vi.setSystemTime(now + ms)
}
