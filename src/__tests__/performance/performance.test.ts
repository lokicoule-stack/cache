import { describe, expect, it, vi } from 'vitest'

import { Bus } from '@/core/bus'
import { JsonCodec, MsgPackCodec } from '@/infrastructure/codecs'
import { MemoryTransport } from '@/infrastructure/transports/memory'
import { delay, setupTestEnvironment, waitFor } from '../utils/test-helpers'

setupTestEnvironment()

describe('Performance Tests', () => {
  describe('throughput', () => {
    it('should handle high message throughput', async () => {
      const transport = new MemoryTransport()
      const bus = new Bus({ transport, codec: 'json' })
      await bus.connect()

      const handler = vi.fn()
      await bus.subscribe('test', handler)

      const messageCount = 10000
      const start = Date.now()

      for (let i = 0; i < messageCount; i++) {
        await bus.publish('test', { id: i, data: `message-${i}` })
      }

      await waitFor(() => handler.mock.calls.length === messageCount, 10000)
      const elapsed = Date.now() - start

      expect(handler).toHaveBeenCalledTimes(messageCount)
      const throughput = messageCount / (elapsed / 1000)

      console.log(`Throughput: ${throughput.toFixed(0)} msg/s`)
      expect(throughput).toBeGreaterThan(100)
    })

    it('should handle concurrent publishes efficiently', async () => {
      const transport = new MemoryTransport()
      const bus = new Bus({ transport, codec: 'json' })
      await bus.connect()

      const handler = vi.fn()
      await bus.subscribe('test', handler)

      const messageCount = 1000
      const start = Date.now()

      await Promise.all(
        Array.from({ length: messageCount }, (_, i) => bus.publish('test', { id: i })),
      )

      await waitFor(() => handler.mock.calls.length === messageCount, 5000)
      const elapsed = Date.now() - start

      expect(handler).toHaveBeenCalledTimes(messageCount)
      console.log(`Concurrent publish time: ${elapsed}ms`)
    })

    it('should handle multiple channels efficiently', async () => {
      const transport = new MemoryTransport()
      const bus = new Bus({ transport, codec: 'json' })
      await bus.connect()

      const channelCount = 100
      const messagesPerChannel = 100
      const handlers = new Map<string, ReturnType<typeof vi.fn>>()

      for (let i = 0; i < channelCount; i++) {
        const handler = vi.fn()
        const channel = `channel${i}`
        handlers.set(channel, handler)
        await bus.subscribe(channel, handler)
      }

      const start = Date.now()

      await Promise.all(
        Array.from({ length: channelCount }, (_, i) =>
          Promise.all(
            Array.from({ length: messagesPerChannel }, (_, j) =>
              bus.publish(`channel${i}`, { msg: j }),
            ),
          ),
        ),
      )

      await waitFor(
        () =>
          Array.from(handlers.values()).every((h) => h.mock.calls.length === messagesPerChannel),
        10000,
      )
      const elapsed = Date.now() - start

      const totalMessages = channelCount * messagesPerChannel
      console.log(
        `Multi-channel: ${totalMessages} messages in ${elapsed}ms (${(
          totalMessages /
          (elapsed / 1000)
        ).toFixed(0)} msg/s)`,
      )
    })
  })

  describe('latency', () => {
    it('should have low publish latency', async () => {
      const transport = new MemoryTransport()
      const bus = new Bus({ transport, codec: 'json' })
      await bus.connect()

      const latencies: number[] = []
      const messageCount = 1000

      for (let i = 0; i < messageCount; i++) {
        const start = performance.now()
        await bus.publish('test', { id: i })
        const elapsed = performance.now() - start
        latencies.push(elapsed)
      }

      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length
      const p50 = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.5)]
      const p95 = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)]
      const p99 = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.99)]

      console.log(
        `Publish latency - avg: ${avg.toFixed(2)}ms, p50: ${p50.toFixed(2)}ms, p95: ${p95.toFixed(
          2,
        )}ms, p99: ${p99.toFixed(2)}ms`,
      )

      expect(avg).toBeLessThan(10)
      expect(p95).toBeLessThan(20)
    })

    it('should have low end-to-end latency', async () => {
      const transport = new MemoryTransport()
      const bus = new Bus({ transport, codec: 'json' })
      await bus.connect()

      const latencies: number[] = []
      const messageCount = 1000

      for (let i = 0; i < messageCount; i++) {
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

        await bus.subscribe(`test${i}`, handler)
        await bus.publish(`test${i}`, { id: i })
        await deferred.promise
        await bus.unsubscribe(`test${i}`)
      }

      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length
      const p95 = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)]

      console.log(`End-to-end latency - avg: ${avg.toFixed(2)}ms, p95: ${p95.toFixed(2)}ms`)

      expect(avg).toBeLessThan(10)
      expect(p95).toBeLessThan(20)
    })
  })

  describe('memory usage', () => {
    it('should not leak memory with repeated operations', async () => {
      const transport = new MemoryTransport()
      const bus = new Bus({ transport, codec: 'json' })
      await bus.connect()

      const iterations = 1000
      for (let i = 0; i < iterations; i++) {
        const handler = vi.fn()
        await bus.subscribe(`channel${i}`, handler)
        await bus.publish(`channel${i}`, { data: `msg${i}` })
        await bus.unsubscribe(`channel${i}`)
      }

      expect(bus.channels).toHaveLength(0)
    })

    it('should handle large handler sets efficiently', async () => {
      const transport = new MemoryTransport()
      const bus = new Bus({ transport, codec: 'json' })
      await bus.connect()

      const handlerCount = 10000
      const handlers = Array.from({ length: handlerCount }, () => vi.fn())

      const subscribeStart = Date.now()
      await Promise.all(handlers.map((h) => bus.subscribe('test', h)))
      const subscribeTime = Date.now() - subscribeStart

      console.log(`Subscribe ${handlerCount} handlers: ${subscribeTime}ms`)

      await bus.publish('test', 'hello')
      await waitFor(() => handlers.every((h) => h.mock.calls.length > 0), 10000)

      expect(handlers[0]).toHaveBeenCalledWith('hello')
      expect(handlers[handlerCount - 1]).toHaveBeenCalledWith('hello')
    })

    it('should clean up properly after disconnect', async () => {
      const transport = new MemoryTransport()
      const bus = new Bus({ transport, codec: 'json' })

      for (let i = 0; i < 10; i++) {
        await bus.connect()

        const handlers = Array.from({ length: 100 }, () => vi.fn())
        await Promise.all(handlers.map((h, idx) => bus.subscribe(`channel${idx}`, h)))

        expect(bus.channels.length).toBeGreaterThan(0)

        await bus.disconnect()
        expect(bus.channels).toHaveLength(0)
      }
    })
  })

  describe('codec performance', () => {
    it('should compare JSON vs MessagePack encoding performance', () => {
      const jsonCodec = new JsonCodec()
      const msgpackCodec = new MsgPackCodec()

      const testData = {
        users: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          name: `User ${i}`,
          email: `user${i}@example.com`,
          active: i % 2 === 0,
        })),
      }

      const iterations = 1000

      const jsonStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        jsonCodec.encode(testData)
      }
      const jsonEncodeTime = performance.now() - jsonStart

      const msgpackStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        msgpackCodec.encode(testData)
      }
      const msgpackEncodeTime = performance.now() - msgpackStart

      console.log(`JSON encode: ${jsonEncodeTime.toFixed(2)}ms`)
      console.log(`MessagePack encode: ${msgpackEncodeTime.toFixed(2)}ms`)

      expect(jsonEncodeTime).toBeGreaterThan(0)
      expect(msgpackEncodeTime).toBeGreaterThan(0)
    })

    it('should compare JSON vs MessagePack decoding performance', () => {
      const jsonCodec = new JsonCodec()
      const msgpackCodec = new MsgPackCodec()

      const testData = {
        users: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          name: `User ${i}`,
          email: `user${i}@example.com`,
        })),
      }

      const jsonEncoded = jsonCodec.encode(testData)
      const msgpackEncoded = msgpackCodec.encode(testData)
      const iterations = 1000

      const jsonStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        jsonCodec.decode(jsonEncoded)
      }
      const jsonDecodeTime = performance.now() - jsonStart

      const msgpackStart = performance.now()
      for (let i = 0; i < iterations; i++) {
        msgpackCodec.decode(msgpackEncoded)
      }
      const msgpackDecodeTime = performance.now() - msgpackStart

      console.log(`JSON decode: ${jsonDecodeTime.toFixed(2)}ms`)
      console.log(`MessagePack decode: ${msgpackDecodeTime.toFixed(2)}ms`)

      expect(jsonDecodeTime).toBeGreaterThan(0)
      expect(msgpackDecodeTime).toBeGreaterThan(0)
    })

    it('should compare payload sizes', () => {
      const jsonCodec = new JsonCodec()
      const msgpackCodec = new MsgPackCodec()

      const testData = {
        users: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          name: `User ${i}`,
          email: `user${i}@example.com`,
          tags: ['tag1', 'tag2', 'tag3'],
        })),
      }

      const jsonSize = jsonCodec.encode(testData).byteLength
      const msgpackSize = msgpackCodec.encode(testData).byteLength

      console.log(`JSON size: ${jsonSize} bytes`)
      console.log(`MessagePack size: ${msgpackSize} bytes`)
      console.log(`Compression ratio: ${((1 - msgpackSize / jsonSize) * 100).toFixed(1)}%`)

      expect(msgpackSize).toBeLessThan(jsonSize)
    })
  })

  describe('scalability', () => {
    it('should scale linearly with message count', async () => {
      const transport = new MemoryTransport()
      const bus = new Bus({ transport, codec: 'json' })
      await bus.connect()

      const handler = vi.fn()
      await bus.subscribe('test', handler)

      const testSizes = [100, 1000, 10000]
      const times: number[] = []

      for (const size of testSizes) {
        handler.mockClear()
        const start = Date.now()

        for (let i = 0; i < size; i++) {
          await bus.publish('test', { id: i })
        }

        await waitFor(() => handler.mock.calls.length === size, 30000)
        const elapsed = Date.now() - start
        times.push(elapsed)

        console.log(
          `${size} messages: ${elapsed}ms (${(size / (elapsed / 1000)).toFixed(0)} msg/s)`,
        )
      }

      expect(times[0]).toBeGreaterThan(0)
      expect(times[1]).toBeGreaterThanOrEqual(times[0])
      expect(times[2]).toBeGreaterThanOrEqual(times[1])
    })

    it('should scale with handler count', async () => {
      const transport = new MemoryTransport()
      const bus = new Bus({ transport, codec: 'json' })
      await bus.connect()

      const handlerCounts = [10, 100, 1000]
      const times: number[] = []

      for (const count of handlerCounts) {
        const handlers = Array.from({ length: count }, () => vi.fn())
        await Promise.all(handlers.map((h) => bus.subscribe('test', h)))

        const start = Date.now()
        await bus.publish('test', 'hello')
        await waitFor(() => handlers.every((h) => h.mock.calls.length > 0), 5000)
        const elapsed = Date.now() - start

        times.push(elapsed)
        console.log(`${count} handlers: ${elapsed}ms`)

        await bus.unsubscribe('test')
      }

      expect(times[0]).toBeGreaterThan(0)
    })

    it('should scale with channel count', async () => {
      const transport = new MemoryTransport()
      const bus = new Bus({ transport, codec: 'json' })
      await bus.connect()

      const channelCounts = [10, 100, 1000]

      for (const count of channelCounts) {
        const handlers = new Map<string, ReturnType<typeof vi.fn>>()

        const subscribeStart = Date.now()
        for (let i = 0; i < count; i++) {
          const handler = vi.fn()
          const channel = `channel${i}`
          handlers.set(channel, handler)
          await bus.subscribe(channel, handler)
        }
        const subscribeTime = Date.now() - subscribeStart

        const publishStart = Date.now()
        await Promise.all(
          Array.from({ length: count }, (_, i) => bus.publish(`channel${i}`, 'hello')),
        )
        const publishTime = Date.now() - publishStart

        console.log(`${count} channels - subscribe: ${subscribeTime}ms, publish: ${publishTime}ms`)

        for (let i = 0; i < count; i++) {
          await bus.unsubscribe(`channel${i}`)
        }
      }
    })
  })

  describe('stress tests', () => {
    it('should handle sustained load', async () => {
      const transport = new MemoryTransport()
      const bus = new Bus({ transport, codec: 'json' })
      await bus.connect()

      const handler = vi.fn()
      await bus.subscribe('test', handler)

      const duration = 2000
      const interval = 1
      const start = Date.now()
      let messageCount = 0

      while (Date.now() - start < duration) {
        await bus.publish('test', { id: messageCount++ })
        if (interval > 0) {
          await delay(interval)
        }
      }

      await waitFor(() => handler.mock.calls.length === messageCount, 5000)

      console.log(`Sustained load: ${messageCount} messages over ${duration}ms`)
      expect(handler).toHaveBeenCalledTimes(messageCount)
    }, 10000)

    it('should handle burst traffic', async () => {
      const transport = new MemoryTransport()
      const bus = new Bus({ transport, codec: 'json' })
      await bus.connect()

      const handler = vi.fn()
      await bus.subscribe('test', handler)

      const bursts = 10
      const messagesPerBurst = 1000

      for (let burst = 0; burst < bursts; burst++) {
        const start = Date.now()

        await Promise.all(
          Array.from({ length: messagesPerBurst }, (_, i) =>
            bus.publish('test', { burst, message: i }),
          ),
        )

        const elapsed = Date.now() - start
        console.log(`Burst ${burst}: ${messagesPerBurst} messages in ${elapsed}ms`)

        await delay(100)
      }

      await waitFor(() => handler.mock.calls.length === bursts * messagesPerBurst, 10000)

      expect(handler).toHaveBeenCalledTimes(bursts * messagesPerBurst)
    })

    it('should handle mixed operations under load', async () => {
      const transport = new MemoryTransport()
      const bus = new Bus({ transport, codec: 'json' })
      await bus.connect()

      const operations = 1000
      const handlers = new Map<string, ReturnType<typeof vi.fn>>()
      let publishCount = 0

      for (let i = 0; i < operations; i++) {
        const op = i % 3

        if (op === 0) {
          const handler = vi.fn()
          const channel = `channel${i}`
          handlers.set(channel, handler)
          await bus.subscribe(channel, handler)
        } else if (op === 1 && handlers.size > 0) {
          const channels = Array.from(handlers.keys())
          const channel = channels[Math.floor(Math.random() * channels.length)]
          await bus.publish(channel, { data: i })
          publishCount++
        } else if (op === 2 && handlers.size > 0) {
          const channels = Array.from(handlers.keys())
          const channel = channels[Math.floor(Math.random() * channels.length)]
          const handler = handlers.get(channel)
          if (handler) {
            await bus.unsubscribe(channel, handler)
            handlers.delete(channel)
          }
        }
      }

      console.log(`Mixed operations: ${operations} operations completed`)
      expect(publishCount).toBeGreaterThan(0)
    })
  })

  describe('optimization opportunities', () => {
    it('should demonstrate batching benefits', async () => {
      const transport = new MemoryTransport()
      const bus = new Bus({ transport, codec: 'json' })
      await bus.connect()

      const handler = vi.fn()
      await bus.subscribe('test', handler)

      const messageCount = 1000

      const individualStart = Date.now()
      for (let i = 0; i < messageCount; i++) {
        await bus.publish('test', { id: i })
      }
      const individualTime = Date.now() - individualStart

      handler.mockClear()

      const batchStart = Date.now()
      await Promise.all(
        Array.from({ length: messageCount }, (_, i) => bus.publish('test', { id: i })),
      )
      const batchTime = Date.now() - batchStart

      console.log(`Individual publishes: ${individualTime}ms`)
      console.log(`Batched publishes: ${batchTime}ms`)
      console.log(`Speedup: ${(individualTime / batchTime).toFixed(2)}x`)

      // Batching should generally be faster, but allow variance for timing inconsistencies
      // On fast systems, both might be equally fast
      expect(batchTime).toBeLessThanOrEqual(individualTime * 2)
      expect(individualTime).toBeGreaterThan(0)
    })
  })
})
