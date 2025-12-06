/**
 * Message Bus - Concurrency Tests
 *
 * Focus: High throughput, concurrent operations, race conditions
 */

import { describe, expect, it, vi } from 'vitest'
import { setupBusTest } from '@test/test-setup'
import { waitForValue, delay } from '@test/helpers/async'
import { channels } from '@test/fixtures'

describe('MessageBus - Concurrency', () => {
  const { createBus } = setupBusTest()

  it('should handle concurrent subscribe/publish', async () => {
    const { bus } = await createBus()
    const handlers = Array.from({ length: 5 }, () => vi.fn())

    await Promise.all([
      ...handlers.map((h) => bus.subscribe(channels.standard, h)),
      bus.publish(channels.standard, 'concurrent'),
    ])

    await delay(100)
    handlers.forEach((h) => expect(h).toHaveBeenCalledWith('concurrent'))
  })

  it('should handle high-throughput bursts', async () => {
    const { bus, handler } = await createBus()
    await bus.subscribe(channels.standard, handler)

    const count = 100
    await Promise.all(Array.from({ length: count }, (_, i) => bus.publish(channels.standard, i)))

    await waitForValue(() => handler.mock.calls.length, count, { timeout: 3000 })
  })

  it('should handle concurrent unsubscribe', async () => {
    const { bus } = await createBus()
    const handlers = Array.from({ length: 5 }, () => vi.fn())

    await Promise.all(handlers.map((h) => bus.subscribe(channels.standard, h)))
    await delay(50)
    await Promise.all(handlers.map((h) => bus.unsubscribe(channels.standard, h)))
    await bus.publish(channels.standard, 'after-unsub')
    await delay(50)

    handlers.forEach((h) => expect(h).not.toHaveBeenCalledWith('after-unsub'))
  })
})
