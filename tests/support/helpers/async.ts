/**
 * Wait for a condition to become true.
 *
 * @example
 * ```ts
 * await waitFor(() => handler.mock.calls.length > 0)
 * await waitFor(() => expect(value).toBe(5)) // Assertion-style
 * ```
 */
export async function waitFor(
  condition: () => boolean | void | Promise<boolean | void>,
  options: { timeout?: number; interval?: number } = {},
): Promise<void> {
  const { timeout = 1000, interval = 10 } = options
  const start = Date.now()

  while (Date.now() - start < timeout) {
    try {
      const result = await condition()
      // If condition returns true or doesn't throw (assertion-style), we're done
      if (result !== false) return
    } catch {
      // Assertion failed, continue waiting
    }
    await sleep(interval)
  }

  // Final attempt to get better error message
  await condition()
  throw new Error(`waitFor: condition not met within ${timeout}ms`)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Event collector for tracking async events in tests.
 *
 * @example
 * ```ts
 * const collector = new EventCollector<Uint8Array>()
 * transport.subscribe('ch', (data) => collector.add(data))
 * await transport.publish('ch', data)
 * const received = await collector.waitForEvent()
 * ```
 */
export class EventCollector<T> {
  private events: T[] = []
  private waiters: Array<(event: T) => void> = []

  /** Add an event to the collection */
  add(event: T): void {
    this.events.push(event)
    const waiter = this.waiters.shift()
    waiter?.(event)
  }

  /** Wait for an event (optionally matching a predicate) */
  async waitForEvent(predicate?: (event: T) => boolean, timeout = 1000): Promise<T> {
    // Check existing events first
    const existing = predicate ? this.events.find(predicate) : this.events[this.events.length - 1]

    if (existing !== undefined) return existing

    // Wait for new event
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`EventCollector: no event received within ${timeout}ms`))
      }, timeout)

      this.waiters.push((event) => {
        if (!predicate || predicate(event)) {
          clearTimeout(timer)
          resolve(event)
        }
      })
    })
  }

  /** Wait for N events */
  async waitForCount(count: number, timeout = 1000): Promise<T[]> {
    const start = Date.now()

    while (this.events.length < count) {
      if (Date.now() - start > timeout) {
        throw new Error(
          `EventCollector: expected ${count} events, got ${this.events.length} within ${timeout}ms`,
        )
      }
      await sleep(10)
    }

    return this.events.slice(0, count)
  }

  /** Get all collected events */
  getAll(): T[] {
    return [...this.events]
  }

  /** Get the count of events */
  count(): number {
    return this.events.length
  }

  /** Clear all events */
  reset(): void {
    this.events = []
    this.waiters = []
  }
}
