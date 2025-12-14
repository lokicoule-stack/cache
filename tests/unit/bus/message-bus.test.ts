import { describe, expect, it, vi } from 'vitest'
import { MessageBus } from '@/core/bus/message-bus'
import type { Codec } from '@/contracts/codec'
import { BusBuilder } from '@test/builders'
import { FakeTransport } from '@test/doubles'
import { waitFor } from '@test/helpers'

describe('MessageBus', () => {
  describe('message delivery', () => {
    it('encodes and decodes messages through codec pipeline', async () => {
      const bus = BusBuilder.create().build()
      await bus.connect()

      const handler = vi.fn()
      await bus.subscribe('orders', handler)
      await bus.publish('orders', { id: 1, nested: { value: true } })

      await waitFor(() => handler.mock.calls.length > 0)
      expect(handler).toHaveBeenCalledWith({ id: 1, nested: { value: true } })

      await bus.disconnect()
    })

    it('fans out to all handlers on same channel', async () => {
      const bus = BusBuilder.create().build()
      await bus.connect()

      const handlers = [vi.fn(), vi.fn(), vi.fn()]
      for (const h of handlers) await bus.subscribe('events', h)
      await bus.publish('events', 'broadcast')

      await waitFor(() => handlers.every((h) => h.mock.calls.length > 0))
      handlers.forEach((h) => expect(h).toHaveBeenCalledWith('broadcast'))

      await bus.disconnect()
    })

    it('isolates channels - messages only reach correct subscribers', async () => {
      const bus = BusBuilder.create().build()
      await bus.connect()

      const orderHandler = vi.fn()
      const eventHandler = vi.fn()
      await bus.subscribe('orders', orderHandler)
      await bus.subscribe('events', eventHandler)
      await bus.publish('orders', { type: 'order' })

      await waitFor(() => orderHandler.mock.calls.length > 0)
      expect(orderHandler).toHaveBeenCalledWith({ type: 'order' })
      expect(eventHandler).not.toHaveBeenCalled()

      await bus.disconnect()
    })
  })

  describe('unsubscribe', () => {
    it('stops delivery to removed handler while others continue', async () => {
      const bus = BusBuilder.create().build()
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

      await bus.disconnect()
    })
  })

  describe('error handling', () => {
    it('isolates handler failures - other handlers still receive messages', async () => {
      const onError = vi.fn()
      const bus = BusBuilder.create().withErrorHandler(onError).build()
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

      await bus.disconnect()
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

      const transport = new FakeTransport()
      const bus = new MessageBus({ transport, codec: brokenCodec, onHandlerError: onError })
      await bus.connect()

      const handler = vi.fn()
      await bus.subscribe('ch', handler)
      transport.simulateMessage('ch', new Uint8Array([99]))

      await waitFor(() => onError.mock.calls.length > 0)
      expect(handler).not.toHaveBeenCalled()
      expect(onError).toHaveBeenCalledWith('ch', expect.any(Error))

      await bus.disconnect()
    })
  })

  describe('reconnection', () => {
    it('re-subscribes all channels after transport reconnection', async () => {
      const { bus, transport } = BusBuilder.create().buildWithTransport()
      await bus.connect()

      const h1 = vi.fn()
      const h2 = vi.fn()
      await bus.subscribe('ch1', h1)
      await bus.subscribe('ch2', h2)

      await bus.publish('ch1', 'before')
      await waitFor(() => h1.mock.calls.length === 1)

      transport.triggerReconnect()

      await bus.publish('ch1', 'after')
      await bus.publish('ch2', 'after')

      await waitFor(() => h1.mock.calls.length === 2 && h2.mock.calls.length === 1)
      expect(h1).toHaveBeenNthCalledWith(2, 'after')
      expect(h2).toHaveBeenCalledWith('after')

      await bus.disconnect()
    })

    it('skips re-subscription for channels with no remaining handlers', async () => {
      const { bus, transport } = BusBuilder.create().buildWithTransport()
      await bus.connect()

      const handler = vi.fn()
      await bus.subscribe('ch1', handler)
      await bus.subscribe('ch2', handler)
      await bus.unsubscribe('ch2', handler)

      const subscribeSpy = vi.spyOn(transport, 'subscribe')
      subscribeSpy.mockClear()

      transport.triggerReconnect()

      await waitFor(() => subscribeSpy.mock.calls.length > 0)
      expect(subscribeSpy).toHaveBeenCalledTimes(1)
      expect(subscribeSpy).toHaveBeenCalledWith('ch1', expect.any(Function))

      await bus.disconnect()
    })
  })

  describe('disconnect', () => {
    it('clears all subscriptions on disconnect', async () => {
      const bus = BusBuilder.create().build()
      await bus.connect()

      const handler = vi.fn()
      await bus.subscribe('ch', handler)
      await bus.disconnect()
      await bus.connect()
      await bus.publish('ch', 'after-reconnect')

      await new Promise((r) => setTimeout(r, 50))
      expect(handler).not.toHaveBeenCalled()

      await bus.disconnect()
    })
  })

  describe('autoConnect', () => {
    it('connects automatically on first publish or subscribe', async () => {
      const transport = new FakeTransport()
      const connectSpy = vi.spyOn(transport, 'connect')
      const bus = new MessageBus({ transport, autoConnect: true })

      await bus.subscribe('ch', vi.fn())
      await bus.publish('ch', 'data')

      expect(connectSpy).toHaveBeenCalledTimes(1)
      await bus.disconnect()
    })
  })
})
