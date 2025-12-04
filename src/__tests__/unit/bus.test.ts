import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  MockTransport,
  createDeferred,
  delay,
  setupTestEnvironment,
  waitFor,
} from '../utils/test-helpers'

import { Bus } from '@/core/bus'

setupTestEnvironment()

describe('Bus', () => {
  let transport: MockTransport
  let bus: Bus

  beforeEach(() => {
    transport = new MockTransport()
    bus = new Bus({
      transport,
      codec: 'json',
    })
  })

  describe('constructor', () => {
    it('should create bus instance with json codec', () => {
      expect(bus).toBeInstanceOf(Bus)
      expect(bus.channels).toEqual([])
    })

    it('should create bus instance with msgpack codec', () => {
      const msgpackBus = new Bus({
        transport,
        codec: 'msgpack',
      })
      expect(msgpackBus).toBeInstanceOf(Bus)
    })

    it('should create bus instance with custom codec', () => {
      const customCodec = {
        name: 'custom',
        encode: (data: unknown) => new Uint8Array(Buffer.from(JSON.stringify(data))),
        decode: (data: Uint8Array) => JSON.parse(Buffer.from(data).toString()),
      }
      const customBus = new Bus({
        transport,
        codec: customCodec,
      })
      expect(customBus).toBeInstanceOf(Bus)
    })

    it('should accept onHandlerError callback', () => {
      const onHandlerError = vi.fn()
      const errorBus = new Bus({
        transport,
        codec: 'json',
        onHandlerError,
      })
      expect(errorBus).toBeInstanceOf(Bus)
    })
  })

  describe('connect/disconnect', () => {
    it('should connect transport', async () => {
      await bus.connect()
      expect(transport.connected).toBe(true)
    })

    it('should disconnect transport', async () => {
      await bus.connect()
      await bus.disconnect()
      expect(transport.connected).toBe(false)
    })

    it('should unsubscribe all channels on disconnect', async () => {
      await bus.connect()
      await bus.subscribe('test', vi.fn())
      expect(bus.channels).toEqual(['test'])
      await bus.disconnect()
      expect(bus.channels).toEqual([])
    })

    it('should handle connect failures', async () => {
      transport.shouldFailConnect = true
      await expect(bus.connect()).rejects.toThrow('Mock connect failed')
    })

    it('should handle disconnect failures', async () => {
      await bus.connect()
      transport.shouldFailDisconnect = true
      await expect(bus.disconnect()).rejects.toThrow('Mock disconnect failed')
    })
  })

  describe('publish', () => {
    beforeEach(async () => {
      await bus.connect()
    })

    it('should publish string message', async () => {
      await bus.publish('test', 'hello')
      expect(transport.publishedMessages).toHaveLength(1)
      expect(transport.publishedMessages[0].channel).toBe('test')
    })

    it('should publish number message', async () => {
      await bus.publish('test', 42)
      expect(transport.publishedMessages).toHaveLength(1)
    })

    it('should publish boolean message', async () => {
      await bus.publish('test', true)
      expect(transport.publishedMessages).toHaveLength(1)
    })

    it('should publish null message', async () => {
      await bus.publish('test', null)
      expect(transport.publishedMessages).toHaveLength(1)
    })

    it('should publish object message', async () => {
      await bus.publish('test', { foo: 'bar', num: 123 })
      expect(transport.publishedMessages).toHaveLength(1)
    })

    it('should publish array message', async () => {
      await bus.publish('test', [1, 2, 3])
      expect(transport.publishedMessages).toHaveLength(1)
    })

    it('should publish nested object', async () => {
      const nested = {
        user: { id: 1, name: 'Alice' },
        items: [{ id: 1 }, { id: 2 }],
      }
      await bus.publish('test', nested)
      expect(transport.publishedMessages).toHaveLength(1)
    })

    it('should handle publish failures', async () => {
      transport.shouldFailPublish = true
      await expect(bus.publish('test', 'hello')).rejects.toThrow('Mock publish failed')
    })

    it('should publish to multiple channels', async () => {
      await bus.publish('channel1', 'msg1')
      await bus.publish('channel2', 'msg2')
      expect(transport.publishedMessages).toHaveLength(2)
      expect(transport.publishedMessages[0].channel).toBe('channel1')
      expect(transport.publishedMessages[1].channel).toBe('channel2')
    })
  })

  describe('subscribe', () => {
    beforeEach(async () => {
      await bus.connect()
    })

    it('should subscribe to channel', async () => {
      const handler = vi.fn()
      await bus.subscribe('test', handler)
      expect(bus.channels).toEqual(['test'])
    })

    it('should receive published messages', async () => {
      const handler = vi.fn()
      await bus.subscribe('test', handler)
      await bus.publish('test', 'hello')
      await waitFor(() => handler.mock.calls.length > 0)
      expect(handler).toHaveBeenCalledWith('hello')
    })

    it('should support multiple handlers on same channel', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      await bus.subscribe('test', handler1)
      await bus.subscribe('test', handler2)
      await bus.publish('test', 'hello')
      await waitFor(() => handler1.mock.calls.length > 0 && handler2.mock.calls.length > 0)
      expect(handler1).toHaveBeenCalledWith('hello')
      expect(handler2).toHaveBeenCalledWith('hello')
    })

    it('should support multiple channels', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      await bus.subscribe('channel1', handler1)
      await bus.subscribe('channel2', handler2)
      expect(bus.channels).toContain('channel1')
      expect(bus.channels).toContain('channel2')
    })

    it('should not call handler for different channel', async () => {
      const handler = vi.fn()
      await bus.subscribe('test', handler)
      await bus.publish('other', 'hello')
      await delay(50)
      expect(handler).not.toHaveBeenCalled()
    })

    it('should handle async handlers', async () => {
      const handler = vi.fn(async (data: string) => {
        await delay(10)
        return data.toUpperCase()
      })
      await bus.subscribe('test', handler)
      await bus.publish('test', 'hello')
      await waitFor(() => handler.mock.calls.length > 0)
      expect(handler).toHaveBeenCalledWith('hello')
    })

    it('should handle subscribe failures', async () => {
      transport.shouldFailSubscribe = true
      await expect(bus.subscribe('test', vi.fn())).rejects.toThrow('Mock subscribe failed')
    })

    it('should reuse transport subscription for same channel', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      await bus.subscribe('test', handler1)
      const subscribeCount = transport.subscribers.size
      await bus.subscribe('test', handler2)
      expect(transport.subscribers.size).toBe(subscribeCount)
    })
  })

  describe('unsubscribe', () => {
    beforeEach(async () => {
      await bus.connect()
    })

    it('should unsubscribe specific handler', async () => {
      const handler = vi.fn()
      await bus.subscribe('test', handler)
      await bus.unsubscribe('test', handler)
      expect(bus.channels).toEqual([])
    })

    it('should unsubscribe all handlers from channel', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      await bus.subscribe('test', handler1)
      await bus.subscribe('test', handler2)
      await bus.unsubscribe('test')
      expect(bus.channels).toEqual([])
    })

    it('should keep other handlers when unsubscribing specific handler', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      await bus.subscribe('test', handler1)
      await bus.subscribe('test', handler2)
      await bus.unsubscribe('test', handler1)
      await bus.publish('test', 'hello')
      await waitFor(() => handler2.mock.calls.length > 0)
      expect(handler1).not.toHaveBeenCalled()
      expect(handler2).toHaveBeenCalledWith('hello')
    })

    it('should handle unsubscribe from non-existent channel', async () => {
      await expect(bus.unsubscribe('nonexistent')).resolves.not.toThrow()
    })

    it('should handle unsubscribe with non-existent handler', async () => {
      const handler = vi.fn()
      await bus.subscribe('test', handler)
      await expect(bus.unsubscribe('test', vi.fn())).resolves.not.toThrow()
      expect(bus.channels).toEqual(['test'])
    })

    it('should remove channel after last handler unsubscribed', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()
      await bus.subscribe('test', handler1)
      await bus.subscribe('test', handler2)
      await bus.unsubscribe('test', handler1)
      expect(bus.channels).toEqual(['test'])
      await bus.unsubscribe('test', handler2)
      expect(bus.channels).toEqual([])
    })
  })

  describe('error handling', () => {
    beforeEach(async () => {
      await bus.connect()
    })

    it('should call onHandlerError when handler throws', async () => {
      const onHandlerError = vi.fn()
      const errorBus = new Bus({
        transport,
        codec: 'json',
        onHandlerError,
      })

      const error = new Error('Handler error')
      const handler = vi.fn(() => {
        throw error
      })

      await errorBus.connect()
      await errorBus.subscribe('test', handler)
      await errorBus.publish('test', 'hello')

      await delay(100)
      expect(handler).toHaveBeenCalled()
      expect(onHandlerError).toHaveBeenCalledWith('test', error)
    })

    it('should call onHandlerError when async handler rejects', async () => {
      const onHandlerError = vi.fn()
      const errorBus = new Bus({
        transport,
        codec: 'json',
        onHandlerError,
      })

      const error = new Error('Async handler error')
      const handler = vi.fn(async () => {
        throw error
      })

      await errorBus.connect()
      await errorBus.subscribe('test', handler)
      await errorBus.publish('test', 'hello')

      await waitFor(() => onHandlerError.mock.calls.length > 0)
      expect(onHandlerError).toHaveBeenCalledWith('test', error)
    })

    it('should continue executing other handlers after one fails', async () => {
      const onHandlerError = vi.fn()
      const errorBus = new Bus({
        transport,
        codec: 'json',
        onHandlerError,
      })

      const handler1 = vi.fn(() => {
        throw new Error('Handler 1 error')
      })
      const handler2 = vi.fn()

      await errorBus.connect()
      await errorBus.subscribe('test', handler1)
      await errorBus.subscribe('test', handler2)
      await errorBus.publish('test', 'hello')

      await delay(100)
      expect(handler1).toHaveBeenCalled()
      expect(handler2).toHaveBeenCalledWith('hello')
      expect(onHandlerError).toHaveBeenCalled()
    })

    it('should not throw when onHandlerError is not provided', async () => {
      const handler = vi.fn(() => {
        throw new Error('Handler error')
      })

      await bus.subscribe('test', handler)
      await expect(bus.publish('test', 'hello')).resolves.not.toThrow()
    })
  })

  describe('edge cases', () => {
    beforeEach(async () => {
      await bus.connect()
    })

    it('should handle empty string channel', async () => {
      const handler = vi.fn()
      await bus.subscribe('', handler)
      await bus.publish('', 'hello')
      await waitFor(() => handler.mock.calls.length > 0)
      expect(handler).toHaveBeenCalledWith('hello')
    })

    it('should handle special characters in channel name', async () => {
      const handler = vi.fn()
      const specialChannel = 'channel:with:colons/and/slashes.and.dots'
      await bus.subscribe(specialChannel, handler)
      await bus.publish(specialChannel, 'hello')
      await waitFor(() => handler.mock.calls.length > 0)
      expect(handler).toHaveBeenCalledWith('hello')
    })

    it('should handle very long channel names', async () => {
      const handler = vi.fn()
      const longChannel = 'a'.repeat(1000)
      await bus.subscribe(longChannel, handler)
      await bus.publish(longChannel, 'hello')
      await waitFor(() => handler.mock.calls.length > 0)
      expect(handler).toHaveBeenCalledWith('hello')
    })

    it('should handle large payloads', async () => {
      const handler = vi.fn()
      const largePayload = { data: 'x'.repeat(10000) }
      await bus.subscribe('test', handler)
      await bus.publish('test', largePayload)
      await waitFor(() => handler.mock.calls.length > 0)
      expect(handler).toHaveBeenCalledWith(largePayload)
    })

    it('should handle rapid publish/subscribe cycles', async () => {
      const handler = vi.fn()
      await bus.subscribe('test', handler)

      for (let i = 0; i < 100; i++) {
        await bus.publish('test', i)
      }

      await waitFor(() => handler.mock.calls.length === 100, 2000)
      expect(handler).toHaveBeenCalledTimes(100)
    })

    it('should handle subscribing same handler multiple times', async () => {
      const handler = vi.fn()
      await bus.subscribe('test', handler)
      await bus.subscribe('test', handler)
      await bus.publish('test', 'hello')
      await waitFor(() => handler.mock.calls.length > 0)
      expect(handler).toHaveBeenCalledTimes(1)
    })

    it('should handle undefined in nested objects', async () => {
      const handler = vi.fn()
      await bus.subscribe('test', handler)
      const data = { foo: 'bar', baz: undefined }
      await bus.publish('test', data)
      await waitFor(() => handler.mock.calls.length > 0)
      expect(handler).toHaveBeenCalledWith({ foo: 'bar' })
    })

    it('should handle empty arrays and objects', async () => {
      const handler = vi.fn()
      await bus.subscribe('test', handler)
      await bus.publish('test', [])
      await bus.publish('test', {})
      await waitFor(() => handler.mock.calls.length === 2)
      expect(handler).toHaveBeenNthCalledWith(1, [])
      expect(handler).toHaveBeenNthCalledWith(2, {})
    })
  })

  describe('concurrency', () => {
    beforeEach(async () => {
      await bus.connect()
    })

    it('should handle concurrent publishes', async () => {
      const promises = Array.from({ length: 100 }, (_, i) => bus.publish('test', i))
      await expect(Promise.all(promises)).resolves.not.toThrow()
      expect(transport.publishedMessages).toHaveLength(100)
    })

    it('should handle concurrent subscribes', async () => {
      const promises = Array.from({ length: 10 }, (_, i) => bus.subscribe(`channel-${i}`, vi.fn()))
      await expect(Promise.all(promises)).resolves.not.toThrow()
      expect(bus.channels).toHaveLength(10)
    })

    it('should handle concurrent unsubscribes', async () => {
      const handlers = Array.from({ length: 10 }, () => vi.fn())
      await Promise.all(handlers.map((h) => bus.subscribe('test', h)))

      const promises = handlers.map((h) => bus.unsubscribe('test', h))
      await expect(Promise.all(promises)).resolves.not.toThrow()
      expect(bus.channels).toEqual([])
    })

    it('should handle publish during subscribe', async () => {
      const deferred = createDeferred<void>()
      const handler = vi.fn()

      const subscribePromise = bus.subscribe('test', handler)
      const publishPromise = bus.publish('test', 'hello')

      await Promise.all([subscribePromise, publishPromise])
      deferred.resolve()

      await waitFor(() => handler.mock.calls.length > 0, 1000)
    })
  })

  describe('channels property', () => {
    beforeEach(async () => {
      await bus.connect()
    })

    it('should return empty array initially', () => {
      expect(bus.channels).toEqual([])
    })

    it('should return subscribed channels', async () => {
      await bus.subscribe('channel1', vi.fn())
      await bus.subscribe('channel2', vi.fn())
      expect(bus.channels).toContain('channel1')
      expect(bus.channels).toContain('channel2')
      expect(bus.channels).toHaveLength(2)
    })

    it('should update after unsubscribe', async () => {
      await bus.subscribe('test', vi.fn())
      expect(bus.channels).toEqual(['test'])
      await bus.unsubscribe('test')
      expect(bus.channels).toEqual([])
    })

    it('should return a copy of channels array', async () => {
      await bus.subscribe('test', vi.fn())
      const channels1 = bus.channels
      const channels2 = bus.channels
      expect(channels1).not.toBe(channels2)
    })
  })
})
