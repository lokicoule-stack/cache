import { vi } from 'vitest'

export function advanceTime(ms: number): void {
  vi.setSystemTime(Date.now() + ms)
}

export function freezeTime(): number {
  const now = Date.now()
  vi.setSystemTime(now)
  return now
}

// Real async wait - use this instead of vi.advanceTimersByTime for actual delays
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Polls predicate every 10ms until true or timeout - useful for async state changes
export async function waitFor(
  predicate: () => boolean | Promise<boolean>,
  timeout = 1000,
  interval = 10,
): Promise<void> {
  const start = Date.now()

  while (Date.now() - start < timeout) {
    if (await predicate()) return
    await sleep(interval)
  }

  throw new Error(`waitFor timed out after ${timeout}ms`)
}
