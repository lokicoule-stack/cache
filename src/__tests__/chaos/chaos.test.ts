import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Bus } from '@/core/bus'
import { MemoryTransport } from '@/infrastructure/transports/memory'
import {
  FlakyTransport,
  MockTransport,
  SlowTransport,
  createDeferred,
  delay,
  setupTestEnvironment,
  waitFor,
} from '../utils/test-helpers'

setupTestEnvironment()

describe('Chaos Engineering Tests', () => {
  describe('network failures', () => {
    let transport: MockTransport
    let bus: Bus

    beforeEach(() => {
      transport = new MockTransport()
      bus = new Bus({ transport, codec: 'json' })
    })

    it('should handle publish failures gracefully', async () => {
      await bus.connect()
      transport.shouldFailPublish = true

      await expect(bus.publish('test', 'hello')).rejects.toThrow('Mock publish failed')
    })

    it('should handle subscribe failures gracefully', async () => {
      await bus.connect()
      transport.shouldFailSubscribe = true

      await expect(bus.subscribe('test', vi.fn())).rejects.toThrow('Mock subscribe failed')
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

    it('should recover after transient failures', async () => {
      await bus.connect()
      const handler = vi.fn()
      await bus.subscribe('test', handler)

      transport.shouldFailPublish = true
      await expect(bus.publish('test', 'fail')).rejects.toThrow()

      transport.shouldFailPublish = false
      await bus.publish('test', 'success')

      await waitFor(() => handler.mock.calls.length > 0)
      expect(handler).toHaveBeenCalledWith('success')
    })
  })

  describe('intermittent failures', () => {
    it('should handle flaky transport', async () => {
      const memoryTransport = new MemoryTransport()
      const flakyTransport = new FlakyTransport(memoryTransport, 0.3)
      const bus = new Bus({ transport: flakyTransport, codec: 'json' })

      let connectSucceeded = false
      for (let i = 0; i < 10 && !connectSucceeded; i++) {
        try {
          await bus.connect()
          connectSucceeded = true
        } catch {}
      }

      expect(connectSucceeded).toBe(true)
    })

    it('should handle sporadic message delivery failures', async () => {
      const memoryTransport = new MemoryTransport()
      const flakyTransport = new FlakyTransport(memoryTransport, 0.5)
      const bus = new Bus({ transport: flakyTransport, codec: 'json' })

      try {
        await bus.connect()
      } catch {}

      const handler = vi.fn()
      try {
        await bus.subscribe('test', handler)
      } catch {}

      const attempts = 20
      let successCount = 0

      for (let i = 0; i < attempts; i++) {
        try {
          await bus.publish('test', i)
          successCount++
        } catch {}
        await delay(10)
      }

      expect(successCount).toBeGreaterThan(0)
      expect(successCount).toBeLessThan(attempts)
    })
  })

  describe('latency and timeouts', () => {
    it('should handle slow transport operations', async () => {
      const memoryTransport = new MemoryTransport()
      const slowTransport = new SlowTransport(memoryTransport, 100)
      const bus = new Bus({ transport: slowTransport, codec: 'json' })

      const start = Date.now()
      await bus.connect()
      const elapsed = Date.now() - start

      expect(elapsed).toBeGreaterThanOrEqual(100)
    })

    it('should handle slow publish operations', async () => {
      const memoryTransport = new MemoryTransport()
      const slowTransport = new SlowTransport(memoryTransport, 50)
      const bus = new Bus({ transport: slowTransport, codec: 'json' })

      await bus.connect()

      const start = Date.now()
      await bus.publish('test', 'hello')
      const elapsed = Date.now() - start

      expect(elapsed).toBeGreaterThanOrEqual(50)
    })

    it('should handle concurrent slow operations', async () => {
      const memoryTransport = new MemoryTransport()
      const slowTransport = new SlowTransport(memoryTransport, 100)
      const bus = new Bus({ transport: slowTransport, codec: 'json' })

      await bus.connect()

      const start = Date.now()
      await Promise.all([
        bus.publish('test1', 'msg1'),
        bus.publish('test2', 'msg2'),
        bus.publish('test3', 'msg3'),
      ])
      const elapsed = Date.now() - start

      expect(elapsed).toBeGreaterThanOrEqual(100)
      expect(elapsed).toBeLessThan(400)
    })
  })

  describe('race conditions', () => {
    let transport: MemoryTransport
    let bus: Bus

    beforeEach(async () => {
      transport = new MemoryTransport()
      bus = new Bus({ transport, codec: 'json' })
      await bus.connect()
    })

    it('should handle rapid subscribe/unsubscribe cycles', async () => {
      const handler = vi.fn()

      for (let i = 0; i < 100; i++) {
        await bus.subscribe('test', handler)
        await bus.unsubscribe('test', handler)
      }

      expect(bus.channels).toEqual([])
    })

    it('should handle concurrent subscribes to same channel', async () => {
      const handlers = Array.from({ length: 10 }, () => vi.fn())

      await Promise.all(handlers.map((h) => bus.subscribe('test', h)))

      await bus.publish('test', 'hello')
      await waitFor(() => handlers.every((h) => h.mock.calls.length > 0))

      for (const handler of handlers) {
        expect(handler).toHaveBeenCalledWith('hello')
      }
    })

    it('should handle publish during subscribe', async () => {
      const handler = vi.fn()

      const [subscribePromise, publishPromise] = await Promise.all([
        bus.subscribe('test', handler),
        bus.publish('test', 'hello'),
      ])

      await delay(100)

      await bus.publish('test', 'world')
      await waitFor(() => handler.mock.calls.length > 0)

      expect(handler).toHaveBeenCalled()
    })

    it('should handle unsubscribe during message processing', async () => {
      const deferred = createDeferred<void>()
      const handler = vi.fn(async () => {
        await deferred.promise
      })

      await bus.subscribe('test', handler)
      await bus.publish('test', 'hello')

      await delay(10)
      await bus.unsubscribe('test', handler)

      deferred.resolve()
      await delay(50)

      expect(handler).toHaveBeenCalledWith('hello')
    })

    it('should handle disconnect during message processing', async () => {
      const deferred = createDeferred<void>()
      const handler = vi.fn(async () => {
        await deferred.promise
      })

      await bus.subscribe('test', handler)
      await bus.publish('test', 'hello')

      await delay(10)
      const disconnectPromise = bus.disconnect()

      deferred.resolve()
      await disconnectPromise

      expect(bus.channels).toEqual([])
    })

    it('should handle rapid channel switching', async () => {
      const handlers = new Map<string, ReturnType<typeof vi.fn>>()
      const channels = Array.from({ length: 10 }, (_, i) => `channel${i}`)

      for (const channel of channels) {
        const handler = vi.fn()
        handlers.set(channel, handler)
        await bus.subscribe(channel, handler)
      }

      await Promise.all(channels.map((ch, i) => bus.publish(ch, `msg${i}`)))

      await waitFor(() => Array.from(handlers.values()).every((h) => h.mock.calls.length > 0))

      channels.forEach((ch, i) => {
        expect(handlers.get(ch)).toHaveBeenCalledWith(`msg${i}`)
      })
    })
  })

  describe('memory pressure', () => {
    let transport: MemoryTransport
    let bus: Bus

    beforeEach(async () => {
      transport = new MemoryTransport()
      bus = new Bus({ transport, codec: 'json' })
      await bus.connect()
    })

    it('should handle large number of subscriptions', async () => {
      const handlers = Array.from({ length: 1000 }, () => vi.fn())

      await Promise.all(handlers.map((h) => bus.subscribe('test', h)))

      await bus.publish('test', 'hello')

      await waitFor(() => handlers.every((h) => h.mock.calls.length > 0), 5000)

      expect(handlers[0]).toHaveBeenCalledWith('hello')
      expect(handlers[999]).toHaveBeenCalledWith('hello')
    })

    it('should handle large number of channels', async () => {
      const channels = Array.from({ length: 1000 }, (_, i) => `channel${i}`)
      const handlers = new Map<string, ReturnType<typeof vi.fn>>()

      for (const channel of channels) {
        const handler = vi.fn()
        handlers.set(channel, handler)
        await bus.subscribe(channel, handler)
      }

      expect(bus.channels).toHaveLength(1000)

      const testChannels = [channels[0], channels[500], channels[999]]
      await Promise.all(testChannels.map((ch) => bus.publish(ch, 'hello')))

      await delay(100)

      for (const ch of testChannels) {
        expect(handlers.get(ch)).toHaveBeenCalledWith('hello')
      }
    })

    it('should handle large payloads', async () => {
      const handler = vi.fn()
      await bus.subscribe('test', handler)

      const largePayload = { data: 'x'.repeat(1000000) }
      await bus.publish('test', largePayload)

      await waitFor(() => handler.mock.calls.length > 0, 2000)
      expect(handler).toHaveBeenCalledWith(largePayload)
    })

    it('should handle rapid message bursts', async () => {
      const handler = vi.fn()
      await bus.subscribe('test', handler)

      const burstSize = 1000
      await Promise.all(Array.from({ length: burstSize }, (_, i) => bus.publish('test', i)))

      await waitFor(() => handler.mock.calls.length === burstSize, 5000)
      expect(handler).toHaveBeenCalledTimes(burstSize)
    })
  })

  describe('handler errors under stress', () => {
    let transport: MemoryTransport
    let bus: Bus
    let errorHandler: ReturnType<typeof vi.fn>

    beforeEach(async () => {
      transport = new MemoryTransport()
      errorHandler = vi.fn()
      bus = new Bus({
        transport,
        codec: 'json',
        onHandlerError: errorHandler,
      })
      await bus.connect()
    })

    it('should handle all handlers throwing', async () => {
      const handlers = Array.from({ length: 10 }, () =>
        vi.fn(() => {
          throw new Error('Handler error')
        }),
      )

      await Promise.all(handlers.map((h) => bus.subscribe('test', h)))
      await bus.publish('test', 'hello')

      await delay(200)
      expect(errorHandler).toHaveBeenCalledTimes(10)
    })

    it('should handle mix of successful and failing handlers', async () => {
      const successHandler = vi.fn()
      const failHandlers = Array.from({ length: 5 }, () =>
        vi.fn(() => {
          throw new Error('Fail')
        }),
      )

      await bus.subscribe('test', successHandler)
      await Promise.all(failHandlers.map((h) => bus.subscribe('test', h)))

      await bus.publish('test', 'hello')

      await delay(200)

      expect(successHandler).toHaveBeenCalledWith('hello')
      expect(errorHandler).toHaveBeenCalledTimes(5)
    })

    it('should handle async handlers timing out', async () => {
      const slowHandler = vi.fn(async () => {
        await delay(5000)
      })

      const fastHandler = vi.fn()

      await bus.subscribe('test', slowHandler)
      await bus.subscribe('test', fastHandler)

      await bus.publish('test', 'hello')

      await waitFor(() => fastHandler.mock.calls.length > 0)
      expect(fastHandler).toHaveBeenCalledWith('hello')
    })

    it('should handle errors in rapid succession', async () => {
      const failHandler = vi.fn(() => {
        throw new Error('Fail')
      })

      await bus.subscribe('test', failHandler)

      await Promise.all(Array.from({ length: 100 }, (_, i) => bus.publish('test', i)))

      await delay(300)
      expect(errorHandler).toHaveBeenCalledTimes(100)
    })
  })

  describe('resource exhaustion', () => {
    it('should handle memory growth from subscriptions', async () => {
      const transport = new MemoryTransport()
      const bus = new Bus({ transport, codec: 'json' })
      await bus.connect()

      const iterations = 100
      for (let i = 0; i < iterations; i++) {
        const handler = vi.fn()
        await bus.subscribe(`channel${i}`, handler)
      }

      expect(bus.channels).toHaveLength(iterations)

      for (let i = 0; i < iterations; i++) {
        await bus.unsubscribe(`channel${i}`)
      }

      expect(bus.channels).toHaveLength(0)
    })

    it('should handle repeated connect/disconnect cycles', async () => {
      const transport = new MemoryTransport()
      const bus = new Bus({ transport, codec: 'json' })

      for (let i = 0; i < 50; i++) {
        await bus.connect()
        const handler = vi.fn()
        await bus.subscribe('test', handler)
        await bus.publish('test', `msg${i}`)
        await bus.disconnect()
      }

      expect(bus.channels).toHaveLength(0)
    })

    it('should clean up after multiple bus instances', async () => {
      const buses = Array.from(
        { length: 10 },
        () =>
          new Bus({
            transport: new MemoryTransport(),
            codec: 'json',
          }),
      )

      for (const bus of buses) {
        await bus.connect()
        await bus.subscribe('test', vi.fn())
      }

      for (const bus of buses) {
        await bus.disconnect()
      }

      for (const bus of buses) {
        expect(bus.channels).toEqual([])
      }
    })
  })

  describe('codec failures under stress', () => {
    it('should handle codec errors gracefully', async () => {
      const faultyCodec = {
        name: 'faulty',
        encode: () => {
          throw new Error('Encode failed')
        },
        decode: () => null,
      }

      const transport = new MemoryTransport()
      const bus = new Bus({ transport, codec: faultyCodec })
      await bus.connect()

      await expect(bus.publish('test', 'hello')).rejects.toThrow('Encode failed')
    })

    it('should handle corrupted data gracefully', async () => {
      const transport = new MemoryTransport()
      const errorHandler = vi.fn()
      const bus = new Bus({
        transport,
        codec: 'json',
        onHandlerError: errorHandler,
      })

      await bus.connect()
      const handler = vi.fn()
      await bus.subscribe('test', handler)

      // Inject corrupted data directly into transport by calling transport's internal publish
      const corruptedData = new Uint8Array([0xff, 0xfe, 0xfd, 0xfc])
      await transport.publish('test', corruptedData)

      await delay(100)
      expect(handler).not.toHaveBeenCalled()
      expect(errorHandler).toHaveBeenCalled()
    })
  })

  describe('complex chaos scenarios', () => {
    it('should survive complete system chaos', async () => {
      const memoryTransport = new MemoryTransport()
      const flakyTransport = new FlakyTransport(memoryTransport, 0.2)
      const slowTransport = new SlowTransport(flakyTransport, 10)

      const errorHandler = vi.fn()
      const bus = new Bus({
        transport: slowTransport,
        codec: 'json',
        onHandlerError: errorHandler,
      })

      let connected = false
      for (let i = 0; i < 10 && !connected; i++) {
        try {
          await bus.connect()
          connected = true
        } catch {
          await delay(10)
        }
      }

      const handlers = Array.from({ length: 5 }, (_, i) =>
        i % 2 === 0
          ? vi.fn()
          : vi.fn(() => {
              throw new Error('Chaos error')
            }),
      )

      for (const handler of handlers) {
        let subscribed = false
        for (let i = 0; i < 10 && !subscribed; i++) {
          try {
            await bus.subscribe('chaos', handler)
            subscribed = true
          } catch {
            await delay(10)
          }
        }
      }

      let publishCount = 0
      for (let i = 0; i < 20; i++) {
        try {
          await bus.publish('chaos', `msg${i}`)
          publishCount++
        } catch {}
        await delay(5)
      }

      expect(publishCount).toBeGreaterThan(0)
      await delay(500)

      const successfulHandlers = handlers.filter((h) => h.mock.calls.length > 0)
      expect(successfulHandlers.length).toBeGreaterThan(0)
    })
  })
})
