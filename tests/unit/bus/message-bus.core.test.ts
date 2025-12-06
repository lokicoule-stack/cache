/**
 * Message Bus - Core Functionality Tests
 *
 * Focus: Basic pub/sub, routing, subscription management
 * Max lines: ~80 per file (FAANG standard)
 */

import { channels, users } from '@test/fixtures'
import { waitFor } from '@test/helpers/async'
import { setupBusTest } from '@test/test-setup'
import { describe, expect, it, vi } from 'vitest'

describe('MessageBus - Core', () => {
  const { createBus } = setupBusTest()

  describe('pub/sub', () => {
    it('should deliver message to subscriber', async () => {
      const { bus, handler } = await createBus()

      await bus.subscribe(channels.standard, handler)
      await bus.publish(channels.standard, users.alice)

      await waitFor(() => handler.mock.calls.length > 0)
      expect(handler).toHaveBeenCalledWith(users.alice)
    })

    it('should broadcast to multiple handlers', async () => {
      const { bus } = await createBus()
      const handlers = [vi.fn(), vi.fn(), vi.fn()]

      for (const h of handlers) await bus.subscribe(channels.standard, h)
      await bus.publish(channels.standard, users.alice)

      await waitFor(() => handlers.every((h) => h.mock.calls.length > 0))
      handlers.forEach((h) => expect(h).toHaveBeenCalledWith(users.alice))
    })
  })

  describe('routing', () => {
    it('should route to correct channels', async () => {
      const { bus } = await createBus()
      const [h1, h2] = [vi.fn(), vi.fn()]

      await bus.subscribe('ch1', h1)
      await bus.subscribe('ch2', h2)
      await bus.publish('ch1', 'msg1')
      await bus.publish('ch2', 'msg2')

      await waitFor(() => h1.mock.calls.length > 0 && h2.mock.calls.length > 0)
      expect(h1).toHaveBeenCalledWith('msg1')
      expect(h2).toHaveBeenCalledWith('msg2')
    })

    it('should handle special channel names', async () => {
      const { bus, handler } = await createBus()

      await bus.subscribe(channels.withSlashes, handler)
      await bus.publish(channels.withSlashes, 'test')

      await waitFor(() => handler.mock.calls.length > 0)
      expect(handler).toHaveBeenCalled()
    })
  })

  describe('unsubscribe', () => {
    it('should stop receiving after unsubscribe', async () => {
      const { bus } = await createBus()
      const [h1, h2] = [vi.fn(), vi.fn()]

      await bus.subscribe(channels.standard, h1)
      await bus.subscribe(channels.standard, h2)
      await bus.unsubscribe(channels.standard, h1)
      await bus.publish(channels.standard, 'test')

      await waitFor(() => h2.mock.calls.length > 0)
      expect(h1).not.toHaveBeenCalled()
      expect(h2).toHaveBeenCalledWith('test')
    })
  })
})
