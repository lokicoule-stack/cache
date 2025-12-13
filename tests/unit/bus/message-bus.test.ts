import { afterEach, describe, expect, it, vi } from 'vitest'
import { MessageBus } from '@/core/bus/message-bus'
import type { Codec } from '@/contracts/codec'
import { FakeTransport } from '@test/doubles'
import { waitFor } from '@test/helpers'

describe('MessageBus', () => {
  let bus: MessageBus
  let transport: FakeTransport

  afterEach(async () => {
    await bus?.disconnect().catch(() => {})
  })

  function createBus(options: { codec?: 'json' | 'msgpack' | Codec; onHandlerError?: (channel: string, error: Error) => void } = {}) {
    transport = new FakeTransport()
    bus = new MessageBus({
      transport,
      codec: options.codec ?? 'json',
      onHandlerError: options.onHandlerError,
    })
    return bus
  }

  describe('message delivery', () => {
    it('encodes and decodes messages through codec pipeline', async () => {
      createBus()
      await bus.connect()
      const handler = vi.fn()
      const payload = { id: 1, nested: { value: true } }

      await bus.subscribe('orders', handler)
      await bus.publish('orders', payload)

      await waitFor(() => handler.mock.calls.length > 0)
      expect(handler).toHaveBeenCalledWith(payload)
    })

    it('fans out to all handlers on same channel', async () => {
      createBus()
      await bus.connect()
      const handlers = [vi.fn(), vi.fn(), vi.fn()]

      for (const h of handlers) await bus.subscribe('events', h)
      await bus.publish('events', 'broadcast')

      await waitFor(() => handlers.every((h) => h.mock.calls.length > 0))
      handlers.forEach((h) => expect(h).toHaveBeenCalledWith('broadcast'))
    })

    it('isolates channels - messages only reach correct subscribers', async () => {
      createBus()
      await bus.connect()
      const orderHandler = vi.fn()
      const eventHandler = vi.fn()

      await bus.subscribe('orders', orderHandler)
      await bus.subscribe('events', eventHandler)
      await bus.publish('orders', { type: 'order' })

      await waitFor(() => orderHandler.mock.calls.length > 0)
      expect(orderHandler).toHaveBeenCalledWith({ type: 'order' })
      expect(eventHandler).not.toHaveBeenCalled()
    })
  })

  describe('unsubscribe', () => {
    it('stops delivery to removed handler while others continue', async () => {
      createBus()
      await bus.connect()
      const removed = vi.fn()
      const kept = vi.fn()

      await bus.subscribe('ch', removed)
      await bus.subscribe('ch', kept)
      await bus.unsubscribe('ch', removed)
      await bus.publish('ch', 'after-unsub')

      await waitFor(() => kept.mock.calls.length > 0)
      expect(removed).not.toHaveBeenCalled()
      expect(kept).toHaveBeenCalledWith('after-unsub')
    })
  })

  describe('error handling', () => {
    it('isolates handler failures - other handlers still receive messages', async () => {
      const onError = vi.fn()
      createBus({ onHandlerError: onError })
      await bus.connect()

      const failing = vi.fn(() => {
        throw new Error('handler crashed')
      })
      const working = vi.fn()

      await bus.subscribe('ch', failing)
      await bus.subscribe('ch', working)
      await bus.publish('ch', 'test')

      await waitFor(() => working.mock.calls.length > 0)
      expect(working).toHaveBeenCalledWith('test')
      expect(onError).toHaveBeenCalledWith('ch', expect.any(Error))
    })

    it('handles codec decode errors gracefully', async () => {
      const onError = vi.fn()
      const brokenCodec: Codec = {
        name: 'broken',
        encode: () => new Uint8Array([1, 2, 3]),
        decode: () => {
          throw new Error('Decode failed')
        },
      }

      transport = new FakeTransport()
      bus = new MessageBus({ transport, codec: brokenCodec, onHandlerError: onError })
      await bus.connect()

      const handler = vi.fn()
      await bus.subscribe('ch', handler)
      transport.simulateMessage('ch', new Uint8Array([99]))

      await new Promise((r) => setTimeout(r, 50))
      expect(handler).not.toHaveBeenCalled()
      expect(onError).toHaveBeenCalledWith('ch', expect.any(Error))
    })
  })

  describe('reconnection', () => {
    it('re-subscribes all channels after transport reconnection', async () => {
      createBus()
      await bus.connect()

      const h1 = vi.fn()
      const h2 = vi.fn()

      await bus.subscribe('ch1', h1)
      await bus.subscribe('ch2', h2)

      // Verify initial delivery
      await bus.publish('ch1', 'before')
      await waitFor(() => h1.mock.calls.length === 1)

      // Simulate reconnection
      transport.triggerReconnect()

      // Should still work after reconnect
      await bus.publish('ch1', 'after')
      await bus.publish('ch2', 'after')

      await waitFor(() => h1.mock.calls.length === 2 && h2.mock.calls.length === 1)
      expect(h1).toHaveBeenNthCalledWith(2, 'after')
      expect(h2).toHaveBeenCalledWith('after')
    })

    it('skips re-subscription for channels with no remaining handlers', async () => {
      createBus()
      await bus.connect()

      const handler = vi.fn()
      await bus.subscribe('ch1', handler)
      await bus.subscribe('ch2', handler)
      await bus.unsubscribe('ch2', handler)

      const subscribeSpy = vi.spyOn(transport, 'subscribe')
      subscribeSpy.mockClear()

      transport.triggerReconnect()

      await new Promise((r) => setTimeout(r, 50))
      expect(subscribeSpy).toHaveBeenCalledTimes(1)
      expect(subscribeSpy).toHaveBeenCalledWith('ch1', expect.any(Function))
    })
  })

  describe('disconnect', () => {
    it('clears all subscriptions on disconnect', async () => {
      createBus()
      await bus.connect()
      const handler = vi.fn()

      await bus.subscribe('ch', handler)
      await bus.disconnect()
      await bus.connect()
      await bus.publish('ch', 'after-reconnect')

      await new Promise((r) => setTimeout(r, 50))
      expect(handler).not.toHaveBeenCalled()
    })
  })
})
