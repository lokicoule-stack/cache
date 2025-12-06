/**
 * Message Bus - Error Handling Tests
 *
 * Focus: Handler errors, isolation, async errors
 */

import { describe, expect, it, vi } from 'vitest'
import { setupBusTest } from '@test/test-setup'
import { waitFor } from '@test/helpers/async'
import { channels } from '@test/fixtures'

describe('MessageBus - Error Handling', () => {
  const { createBus } = setupBusTest()

  it('should isolate handler errors', async () => {
    const errorCallback = vi.fn()
    const { bus } = await createBus({ onHandlerError: errorCallback })

    const failing = vi.fn(() => {
      throw new Error('Handler failed')
    })
    const success = vi.fn()

    await bus.subscribe(channels.standard, failing)
    await bus.subscribe(channels.standard, success)
    await bus.publish(channels.standard, 'test')

    await waitFor(() => success.mock.calls.length > 0)

    expect(success).toHaveBeenCalledWith('test')
    expect(errorCallback).toHaveBeenCalledWith(channels.standard, expect.any(Error))
  })

  it('should handle async handler errors', async () => {
    const errorCallback = vi.fn()
    const { bus } = await createBus({ onHandlerError: errorCallback })

    await bus.subscribe(channels.standard, () => {
      throw new Error('Async error')
    })
    await bus.publish(channels.standard, 'test')

    await waitFor(() => errorCallback.mock.calls.length > 0)
    expect(errorCallback).toHaveBeenCalled()
  })

  it('should not affect other handlers on error', async () => {
    const { bus } = await createBus()
    const handlers = [
      vi.fn(() => {
        throw new Error()
      }),
      vi.fn(),
      vi.fn(),
    ]

    for (const h of handlers) await bus.subscribe(channels.standard, h)
    await bus.publish(channels.standard, 'test')

    await waitFor(() => handlers[1].mock.calls.length > 0)
    expect(handlers[1]).toHaveBeenCalled()
    expect(handlers[2]).toHaveBeenCalled()
  })
})
