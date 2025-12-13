import { describe, expect, it, vi } from 'vitest'
import { MemoryTransport } from '@/infrastructure/transports/memory/memory-transport'
import { composeMiddleware } from '@/core/middleware/middleware'
import { MessageBus } from '@/core/bus/message-bus'
import { ChaosTransport } from '@test/doubles'
import { waitFor, EventCollector } from '@test/helpers'
import { TestData } from '@test/builders'

describe('Middleware Stack Integration', () => {
  const hmacKey = Buffer.from('0'.repeat(64), 'hex')

  describe('compression + integrity + retry', () => {
    it('end-to-end: compresses, signs, and retries messages through full pipeline', async () => {
      const transport = new MemoryTransport()
      const chaos = new ChaosTransport(transport)

      const stack = composeMiddleware(chaos, {
        compression: { type: 'gzip', threshold: 50 },
        integrity: { type: 'hmac', key: hmacKey },
        retry: { maxAttempts: 3, delay: 10 },
      })

      await stack.connect()

      const collector = new EventCollector<Uint8Array>()
      await stack.subscribe('orders', (data) => collector.add(data))

      // Fail first attempt, retry should succeed
      chaos.failNext(1)

      const largePayload = new TextEncoder().encode('x'.repeat(100))
      await stack.publish('orders', largePayload)

      const received = await collector.waitForEvent()
      expect(received).toEqual(largePayload)
      expect(chaos.failures).toBe(1)

      await stack.disconnect()
    })

    it('preserves message integrity through compression and signing', async () => {
      const transport = new MemoryTransport()
      const stack = composeMiddleware(transport, {
        compression: { type: 'gzip', threshold: 10 },
        integrity: { type: 'hmac', key: hmacKey },
        retry: false,
      })

      await stack.connect()

      const messages = [
        new TextEncoder().encode('small'),
        new TextEncoder().encode('x'.repeat(200)), // Will be compressed
        TestData.small,
      ]

      for (const msg of messages) {
        const collector = new EventCollector<Uint8Array>()
        await stack.subscribe('ch', (data) => collector.add(data))

        await stack.publish('ch', msg)

        const received = await collector.waitForEvent()
        expect(received).toEqual(msg)

        await stack.unsubscribe('ch')
        collector.reset()
      }

      await stack.disconnect()
    })
  })

  describe('MessageBus with middleware', () => {
    it('MessageBus works with composed middleware transport', async () => {
      const transport = new MemoryTransport()
      const stack = composeMiddleware(transport, {
        compression: { type: 'gzip', threshold: 50 },
        integrity: { type: 'hmac', key: hmacKey },
        retry: { maxAttempts: 2, delay: 10 },
      })

      const bus = new MessageBus({
        transport: stack,
        codec: 'json',
      })

      await bus.connect()

      const handler = vi.fn()
      await bus.subscribe('events', handler)

      const payload = { type: 'user.created', data: { id: 1, name: 'Alice' } }
      await bus.publish('events', payload)

      await waitFor(() => handler.mock.calls.length > 0)
      expect(handler).toHaveBeenCalledWith(payload)

      await bus.disconnect()
    })
  })

  describe('chaos scenarios', () => {
    it('recovers from transient failures with retry middleware', async () => {
      const transport = new MemoryTransport()
      const chaos = new ChaosTransport(transport)
      const stack = composeMiddleware(chaos, {
        retry: { maxAttempts: 5, delay: 10 },
      })

      await stack.connect()

      const collector = new EventCollector<Uint8Array>()
      await stack.subscribe('ch', (data) => collector.add(data))

      // Fail first 3 attempts
      chaos.failNext(3)

      await stack.publish('ch', TestData.small)

      const received = await collector.waitForEvent()
      expect(received).toEqual(TestData.small)
      expect(chaos.failures).toBe(3)

      await stack.disconnect()
    })

    it('handles concurrent operations with retries', async () => {
      const transport = new MemoryTransport()
      const chaos = new ChaosTransport(transport)
      const stack = composeMiddleware(chaos, {
        retry: { maxAttempts: 3, delay: 10 },
      })

      await stack.connect()

      const collectors = {
        ch1: new EventCollector<Uint8Array>(),
        ch2: new EventCollector<Uint8Array>(),
        ch3: new EventCollector<Uint8Array>(),
      }

      await stack.subscribe('ch1', (d) => collectors.ch1.add(d))
      await stack.subscribe('ch2', (d) => collectors.ch2.add(d))
      await stack.subscribe('ch3', (d) => collectors.ch3.add(d))

      // Random failures
      chaos.failNext(2)

      await Promise.all([
        stack.publish('ch1', new Uint8Array([1])),
        stack.publish('ch2', new Uint8Array([2])),
        stack.publish('ch3', new Uint8Array([3])),
      ])

      await waitFor(
        () => collectors.ch1.count() >= 1 && collectors.ch2.count() >= 1 && collectors.ch3.count() >= 1,
      )

      expect(collectors.ch1.getAll()[0]).toEqual(new Uint8Array([1]))
      expect(collectors.ch2.getAll()[0]).toEqual(new Uint8Array([2]))
      expect(collectors.ch3.getAll()[0]).toEqual(new Uint8Array([3]))

      await stack.disconnect()
    })
  })

  describe('edge cases', () => {
    it('handles empty messages through full stack', async () => {
      const transport = new MemoryTransport()
      const stack = composeMiddleware(transport, {
        compression: { type: 'gzip', threshold: 10 },
        integrity: { type: 'hmac', key: hmacKey },
        retry: false,
      })

      await stack.connect()

      const collector = new EventCollector<Uint8Array>()
      await stack.subscribe('ch', (data) => collector.add(data))

      await stack.publish('ch', TestData.empty)

      const received = await collector.waitForEvent()
      expect(received).toEqual(TestData.empty)

      await stack.disconnect()
    })

    it('handles large messages with compression', async () => {
      const transport = new MemoryTransport()
      const stack = composeMiddleware(transport, {
        compression: { type: 'gzip', threshold: 100 },
        integrity: { type: 'hmac', key: hmacKey },
        retry: false,
      })

      await stack.connect()

      const collector = new EventCollector<Uint8Array>()
      await stack.subscribe('ch', (data) => collector.add(data))

      const largeData = new Uint8Array(10 * 1024).fill(65) // 10KB
      await stack.publish('ch', largeData)

      const received = await collector.waitForEvent()
      expect(received).toEqual(largeData)

      await stack.disconnect()
    })
  })
})
