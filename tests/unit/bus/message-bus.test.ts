import { afterEach, describe, expect, it, vi } from 'vitest'
import { MessageBus } from '@/core/bus/message-bus'
import { FakeTransport } from '@test/doubles/transports'
import { waitFor } from '@test/helpers/async'
import { Codec } from '@/index'

describe('MessageBus', () => {
  let bus: MessageBus
  let transport: FakeTransport

  afterEach(async () => {
    await bus?.disconnect().catch(() => {})
  })

  function createBus(
    options: {
      transport?: FakeTransport
      codec?: 'json' | 'msgpack'
      onHandlerError?: (channel: string, error: Error) => void
    } = {},
  ) {
    transport = (options.transport as FakeTransport) ?? new FakeTransport()
    bus = new MessageBus({
      transport,
      codec: options.codec ?? 'json',
      onHandlerError: options.onHandlerError,
    })
    return bus
  }

  describe('pub/sub', () => {
    it('delivers message through encode/decode pipeline', async () => {
      createBus()
      await bus.connect()
      const handler = vi.fn()
      const payload = { id: 1, name: 'test', nested: { value: true } }

      await bus.subscribe('ch', handler)
      await bus.publish('ch', payload)

      await waitFor(() => handler.mock.calls.length > 0)
      expect(handler).toHaveBeenCalledWith(payload)
    })

    it('fans out to multiple handlers on same channel', async () => {
      createBus()
      await bus.connect()
      const handlers = [vi.fn(), vi.fn(), vi.fn()]

      for (const h of handlers) await bus.subscribe('ch', h)
      await bus.publish('ch', 'msg')

      await waitFor(() => handlers.every((h) => h.mock.calls.length > 0))
      handlers.forEach((h) => expect(h).toHaveBeenCalledWith('msg'))
    })

    it('routes messages to correct channel only', async () => {
      createBus()
      await bus.connect()
      const h1 = vi.fn()
      const h2 = vi.fn()

      await bus.subscribe('ch1', h1)
      await bus.subscribe('ch2', h2)
      await bus.publish('ch1', 'only-ch1')

      await waitFor(() => h1.mock.calls.length > 0)
      expect(h1).toHaveBeenCalledWith('only-ch1')
      expect(h2).not.toHaveBeenCalled()
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

  describe('disconnect', () => {
    it('clears all subscriptions', async () => {
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

  describe('error handling', () => {
    it('isolates handler failures and continues delivery to others', async () => {
      const onError = vi.fn()
      createBus({ onHandlerError: onError })
      await bus.connect()

      const failing = vi.fn(() => {
        throw new Error('boom')
      })
      const working = vi.fn()

      await bus.subscribe('ch', failing)
      await bus.subscribe('ch', working)
      await bus.publish('ch', 'test')

      await waitFor(() => working.mock.calls.length > 0)
      expect(working).toHaveBeenCalledWith('test')
      expect(onError).toHaveBeenCalledWith('ch', expect.any(Error))
    })
  })

  describe('codec resolution', () => {
    it.each([
      ['json', { data: 'test' }],
      ['msgpack', { binary: true, value: 42 }],
    ] as const)('resolves %s codec and round-trips data', async (codec, payload) => {
      createBus({ codec })
      await bus.connect()
      const handler = vi.fn()

      await bus.subscribe('ch', handler)
      await bus.publish('ch', payload)

      await waitFor(() => handler.mock.calls.length > 0)
      expect(handler).toHaveBeenCalledWith(payload)
    })

    it('accepts custom codec instance', async () => {
      const customCodec = {
        encode: (data: unknown) => new TextEncoder().encode(JSON.stringify(data)),
        decode: (bytes: Uint8Array) => JSON.parse(new TextDecoder().decode(bytes)),
      } as Codec

      transport = new FakeTransport()
      bus = new MessageBus({ transport, codec: customCodec })
      await bus.connect()
      const handler = vi.fn()

      await bus.subscribe('ch', handler)
      await bus.publish('ch', { custom: true })

      await waitFor(() => handler.mock.calls.length > 0)
      expect(handler).toHaveBeenCalledWith({ custom: true })
    })
  })
})
