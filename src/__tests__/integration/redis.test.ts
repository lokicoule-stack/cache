import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { Bus } from '@/core/bus'
import { BusManager } from '@/core/bus/bus-manager'
import { RedisTransport } from '@/infrastructure/transports/redis'
import { delay, setupTestEnvironment, waitFor } from '../utils/test-helpers'

setupTestEnvironment()

describe('Redis Integration Tests', () => {
  let container: StartedRedisContainer
  let redisUrl: string

  beforeAll(async () => {
    // Start Redis container
    container = await new RedisContainer('redis:7-alpine').start()
    redisUrl = container.getConnectionUrl()
    console.log(`Redis container started at ${redisUrl}`)
  }, 60000)

  afterAll(async () => {
    if (container) {
      await container.stop()
      console.log('Redis container stopped')
    }
  }, 30000)

  describe('RedisTransport basic operations', () => {
    let transport: RedisTransport

    beforeEach(() => {
      transport = new RedisTransport({ url: redisUrl })
    })

    afterEach(async () => {
      await transport.disconnect()
    })

    it('should connect to Redis', async () => {
      await expect(transport.connect()).resolves.not.toThrow()
    })

    it('should disconnect from Redis', async () => {
      await transport.connect()
      await expect(transport.disconnect()).resolves.not.toThrow()
    })

    it('should handle multiple connect/disconnect cycles', async () => {
      for (let i = 0; i < 3; i++) {
        await transport.connect()
        await transport.disconnect()
        transport = new RedisTransport({ url: redisUrl })
      }
    })

    it('should throw when publishing without connection', async () => {
      const data = new Uint8Array(Buffer.from('test'))
      await expect(transport.publish('test', data)).rejects.toThrow('Redis publisher not connected')
    })

    it('should throw when subscribing without connection', async () => {
      await expect(transport.subscribe('test', vi.fn())).rejects.toThrow(
        'Redis subscriber not connected',
      )
    })
  })

  describe('Bus with RedisTransport', () => {
    let bus1: Bus
    let bus2: Bus

    beforeEach(async () => {
      const transport1 = new RedisTransport({ url: redisUrl })
      const transport2 = new RedisTransport({ url: redisUrl })

      bus1 = new Bus({ transport: transport1, codec: 'json' })
      bus2 = new Bus({ transport: transport2, codec: 'json' })

      await bus1.connect()
      await bus2.connect()
    })

    afterEach(async () => {
      await bus1.disconnect()
      await bus2.disconnect()
    })

    it('should publish and receive messages between buses', async () => {
      const handler = vi.fn()
      await bus2.subscribe('test-channel', handler)

      await bus1.publish('test-channel', { message: 'hello from bus1' })

      await waitFor(() => handler.mock.calls.length > 0, 2000)
      expect(handler).toHaveBeenCalledWith({ message: 'hello from bus1' })
    })

    it('should handle multiple subscribers on same channel', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      await bus1.subscribe('multi-sub', handler1)
      await bus2.subscribe('multi-sub', handler2)

      await bus1.publish('multi-sub', { data: 'broadcast' })

      await waitFor(() => handler1.mock.calls.length > 0 && handler2.mock.calls.length > 0, 2000)

      expect(handler1).toHaveBeenCalledWith({ data: 'broadcast' })
      expect(handler2).toHaveBeenCalledWith({ data: 'broadcast' })
    })

    it('should handle different channels independently', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      await bus1.subscribe('channel-1', handler1)
      await bus2.subscribe('channel-2', handler2)

      await bus1.publish('channel-1', { data: 'message-1' })
      await bus1.publish('channel-2', { data: 'message-2' })

      await waitFor(() => handler1.mock.calls.length > 0 && handler2.mock.calls.length > 0, 2000)

      expect(handler1).toHaveBeenCalledWith({ data: 'message-1' })
      expect(handler1).toHaveBeenCalledTimes(1)
      expect(handler2).toHaveBeenCalledWith({ data: 'message-2' })
      expect(handler2).toHaveBeenCalledTimes(1)
    })

    it('should handle complex data types', async () => {
      const complexData = {
        user: { id: 1, name: 'Alice', roles: ['admin', 'user'] },
        items: [
          { id: 1, quantity: 2, price: 19.99 },
          { id: 2, quantity: 1, price: 39.99 },
        ],
        metadata: { timestamp: Date.now(), version: '1.0.0' },
      }

      const handler = vi.fn()
      await bus2.subscribe('complex-data', handler)

      await bus1.publish('complex-data', complexData)

      await waitFor(() => handler.mock.calls.length > 0, 2000)
      expect(handler).toHaveBeenCalledWith(complexData)
    })

    it('should handle rapid message bursts', async () => {
      const handler = vi.fn()
      await bus2.subscribe('burst-test', handler)

      const messageCount = 100
      await Promise.all(
        Array.from({ length: messageCount }, (_, i) => bus1.publish('burst-test', { id: i })),
      )

      await waitFor(() => handler.mock.calls.length === messageCount, 5000)
      expect(handler).toHaveBeenCalledTimes(messageCount)
    })

    it('should support unsubscribe', async () => {
      const handler = vi.fn()
      await bus1.subscribe('unsub-test', handler)

      await bus1.publish('unsub-test', { message: 'first' })
      await waitFor(() => handler.mock.calls.length === 1, 2000)

      await bus1.unsubscribe('unsub-test')
      await delay(100)

      handler.mockClear()
      await bus1.publish('unsub-test', { message: 'second' })
      await delay(200)

      expect(handler).not.toHaveBeenCalled()
    })
  })

  describe('MessagePack codec with Redis', () => {
    let bus1: Bus
    let bus2: Bus
    let transport1: RedisTransport
    let transport2: RedisTransport

    beforeEach(async () => {
      transport1 = new RedisTransport({ url: redisUrl })
      transport2 = new RedisTransport({ url: redisUrl })

      bus1 = new Bus({ transport: transport1, codec: 'msgpack' })
      bus2 = new Bus({ transport: transport2, codec: 'msgpack' })

      await bus1.connect()
      await bus2.connect()
      await delay(100) // Give time for connections to stabilize
    })

    afterEach(async () => {
      try {
        await bus1.disconnect()
      } catch {}
      try {
        await bus2.disconnect()
      } catch {}
    })

    it('should work with MessagePack codec', async () => {
      const handler = vi.fn()
      await bus2.subscribe('msgpack-test', handler)
      await delay(300)

      const testData = {
        users: Array.from({ length: 10 }, (_, i) => ({
          id: i,
          name: `User ${i}`,
          tags: ['tag1', 'tag2'],
        })),
      }

      await bus1.publish('msgpack-test', testData)

      await waitFor(() => handler.mock.calls.length > 0, 5000)
      expect(handler).toHaveBeenCalledWith(testData)
    }, 10000)

    it('should handle binary data efficiently', async () => {
      const handler = vi.fn()
      await bus2.subscribe('binary-test', handler)
      await delay(300)

      const largeData = {
        payload: 'x'.repeat(10000),
        metadata: { size: 10000 },
      }

      await bus1.publish('binary-test', largeData)

      await waitFor(() => handler.mock.calls.length > 0, 5000)
      expect(handler).toHaveBeenCalledWith(largeData)
    }, 10000)
  })

  describe('BusManager with Redis', () => {
    let manager: BusManager<{
      redis1: { transport: RedisTransport; codec: 'json' }
      redis2: { transport: RedisTransport; codec: 'msgpack' }
    }>

    beforeEach(() => {
      manager = new BusManager({
        default: 'redis1',
        transports: {
          redis1: {
            transport: new RedisTransport({ url: redisUrl }),
            codec: 'json',
          },
          redis2: {
            transport: new RedisTransport({ url: redisUrl }),
            codec: 'msgpack',
          },
        },
      })
    })

    afterEach(async () => {
      try {
        await manager.stop()
      } catch {
        // Ignore errors during cleanup
      }
    })

    it('should manage multiple Redis buses', async () => {
      // Pre-create both buses to ensure they're initialized
      const bus1 = manager.use('redis1')
      const bus2 = manager.use('redis2')

      await manager.start()
      await delay(1000) // Give time for both connections to stabilize

      const handler1 = vi.fn()
      const handler2 = vi.fn()

      await bus1.subscribe('bus1-channel', handler1)
      await delay(200)
      await bus2.subscribe('bus2-channel', handler2)
      await delay(500)

      await bus1.publish('bus1-channel', { from: 'bus1' })
      await bus2.publish('bus2-channel', { from: 'bus2' })

      await waitFor(() => handler1.mock.calls.length > 0 && handler2.mock.calls.length > 0, 5000)

      expect(handler1).toHaveBeenCalledWith({ from: 'bus1' })
      expect(handler2).toHaveBeenCalledWith({ from: 'bus2' })
    }, 20000)

    it('should use proxy methods with default bus', async () => {
      // Pre-create the default bus
      manager.use()
      await manager.start()
      await delay(300) // Give time for connections to stabilize

      const handler = vi.fn()
      await manager.subscribe('proxy-test', handler)
      await delay(200)

      await manager.publish('proxy-test', { message: 'via proxy' })

      await waitFor(() => handler.mock.calls.length > 0, 3000)
      expect(handler).toHaveBeenCalledWith({ message: 'via proxy' })
    })
  })

  describe('Real-world patterns with Redis', () => {
    let publisher: Bus
    let subscriber1: Bus
    let subscriber2: Bus

    beforeEach(async () => {
      publisher = new Bus({
        transport: new RedisTransport({ url: redisUrl }),
        codec: 'json',
      })
      subscriber1 = new Bus({
        transport: new RedisTransport({ url: redisUrl }),
        codec: 'json',
      })
      subscriber2 = new Bus({
        transport: new RedisTransport({ url: redisUrl }),
        codec: 'json',
      })

      await publisher.connect()
      await subscriber1.connect()
      await subscriber2.connect()
    })

    afterEach(async () => {
      await publisher.disconnect()
      await subscriber1.disconnect()
      await subscriber2.disconnect()
    })

    it('should implement fan-out pattern', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      await subscriber1.subscribe('fanout', handler1)
      await subscriber2.subscribe('fanout', handler2)

      const events = [
        { type: 'USER_CREATED', userId: 1 },
        { type: 'ORDER_PLACED', orderId: 100 },
        { type: 'PAYMENT_PROCESSED', paymentId: 500 },
      ]

      for (const event of events) {
        await publisher.publish('fanout', event)
      }

      await waitFor(
        () => handler1.mock.calls.length === 3 && handler2.mock.calls.length === 3,
        3000,
      )

      expect(handler1).toHaveBeenCalledTimes(3)
      expect(handler2).toHaveBeenCalledTimes(3)
    })

    it('should implement event filtering pattern', async () => {
      const userHandler = vi.fn()
      const orderHandler = vi.fn()
      const allHandler = vi.fn()

      await subscriber1.subscribe('events', (event: { type: string }) => {
        allHandler(event)
        if (event.type.startsWith('USER_')) {
          userHandler(event)
        } else if (event.type.startsWith('ORDER_')) {
          orderHandler(event)
        }
      })

      await publisher.publish('events', { type: 'USER_CREATED', id: 1 })
      await publisher.publish('events', { type: 'ORDER_PLACED', id: 100 })
      await publisher.publish('events', { type: 'USER_UPDATED', id: 1 })

      await waitFor(() => allHandler.mock.calls.length === 3, 3000)

      expect(allHandler).toHaveBeenCalledTimes(3)
      expect(userHandler).toHaveBeenCalledTimes(2)
      expect(orderHandler).toHaveBeenCalledTimes(1)
    })

    it('should handle distributed task queue pattern', async () => {
      const results: number[] = []

      // Multiple workers
      const worker1 = vi.fn(async (task: { id: number; value: number }) => {
        results.push(task.value * 2)
      })

      const worker2 = vi.fn(async (task: { id: number; value: number }) => {
        results.push(task.value * 2)
      })

      await subscriber1.subscribe('tasks', worker1)
      await subscriber2.subscribe('tasks', worker2)

      // Small delay to ensure subscriptions are ready
      await delay(100)

      // Enqueue tasks
      for (let i = 0; i < 10; i++) {
        await publisher.publish('tasks', { id: i, value: i })
      }

      // Both workers should receive all messages (Redis pubsub broadcasts)
      await waitFor(() => worker1.mock.calls.length + worker2.mock.calls.length >= 20, 3000)
      expect(worker1.mock.calls.length + worker2.mock.calls.length).toBeGreaterThanOrEqual(20)
    })

    it('should implement request-reply pattern', async () => {
      const requestId = `req-${Date.now()}`
      const replyChannel = `reply-${requestId}`

      // Set up responder
      await subscriber1.subscribe('requests', async (req: { id: string; data: number }) => {
        const result = req.data * 2
        await subscriber1.publish(replyChannel, { requestId: req.id, result })
      })

      // Set up reply handler
      const replyHandler = vi.fn()
      await publisher.subscribe(replyChannel, replyHandler)

      // Send request
      await publisher.publish('requests', { id: requestId, data: 42 })

      await waitFor(() => replyHandler.mock.calls.length > 0, 3000)
      expect(replyHandler).toHaveBeenCalledWith({
        requestId,
        result: 84,
      })
    })
  })

  describe('Error handling with Redis', () => {
    it('should handle connection failures gracefully', async () => {
      const badTransport = new RedisTransport({ url: 'redis://localhost:9999' })
      const bus = new Bus({ transport: badTransport, codec: 'json' })

      await expect(bus.connect()).rejects.toThrow()
    }, 10000)

    it('should handle reconnection scenarios', async () => {
      const transport = new RedisTransport({ url: redisUrl })
      const bus = new Bus({ transport, codec: 'json' })

      await bus.connect()
      await bus.disconnect()

      // After disconnect, transport is closed and needs a new instance
      // This is expected behavior - create new transport for reconnection
      const newTransport = new RedisTransport({ url: redisUrl })
      const newBus = new Bus({ transport: newTransport, codec: 'json' })
      await expect(newBus.connect()).resolves.not.toThrow()
      await newBus.disconnect()
    })

    it('should handle handler errors without affecting Redis', async () => {
      const transport = new RedisTransport({ url: redisUrl })
      const errorHandler = vi.fn()
      const bus = new Bus({
        transport,
        codec: 'json',
        onHandlerError: errorHandler,
      })

      await bus.connect()

      const failingHandler = vi.fn(() => {
        throw new Error('Handler failed')
      })

      await bus.subscribe('error-test', failingHandler)
      await bus.publish('error-test', { data: 'test' })

      await delay(200)

      expect(failingHandler).toHaveBeenCalled()
      expect(errorHandler).toHaveBeenCalled()

      await bus.disconnect()
    })
  })

  describe('Performance with Redis', () => {
    let bus1: Bus
    let bus2: Bus

    beforeEach(async () => {
      bus1 = new Bus({
        transport: new RedisTransport({ url: redisUrl }),
        codec: 'json',
      })
      bus2 = new Bus({
        transport: new RedisTransport({ url: redisUrl }),
        codec: 'json',
      })

      await bus1.connect()
      await bus2.connect()
    })

    afterEach(async () => {
      await bus1.disconnect()
      await bus2.disconnect()
    })

    it('should handle high throughput', async () => {
      const handler = vi.fn()
      await bus2.subscribe('perf-test', handler)

      const messageCount = 1000
      const start = Date.now()

      await Promise.all(
        Array.from({ length: messageCount }, (_, i) => bus1.publish('perf-test', { id: i })),
      )

      await waitFor(() => handler.mock.calls.length === messageCount, 10000)
      const elapsed = Date.now() - start

      console.log(`Redis throughput: ${(messageCount / (elapsed / 1000)).toFixed(0)} msg/s`)

      expect(handler).toHaveBeenCalledTimes(messageCount)
      expect(elapsed).toBeLessThan(10000)
    }, 15000)

    it('should measure latency', async () => {
      const latencies: number[] = []

      for (let i = 0; i < 100; i++) {
        const deferred = {
          resolve: null as unknown as () => void,
          promise: null as unknown as Promise<void>,
        }
        deferred.promise = new Promise<void>((resolve) => {
          deferred.resolve = resolve
        })

        const start = performance.now()
        const handler = vi.fn(() => {
          const elapsed = performance.now() - start
          latencies.push(elapsed)
          deferred.resolve()
        })

        await bus2.subscribe(`latency-${i}`, handler)
        await bus1.publish(`latency-${i}`, { id: i })
        await deferred.promise
        await bus2.unsubscribe(`latency-${i}`)
      }

      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length
      const p95 = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)]

      console.log(`Redis latency - avg: ${avg.toFixed(2)}ms, p95: ${p95.toFixed(2)}ms`)

      expect(avg).toBeLessThan(100)
      expect(p95).toBeLessThan(200)
    }, 30000)
  })
})
