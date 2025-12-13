import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryTransport } from '@/infrastructure/transports/memory/memory-transport'
import { runTransportContractTests } from '@test/suites/transport-contract'
import { EventCollector, waitFor } from '@test/helpers'
import { TestData } from '@test/builders'

describe('MemoryTransport', () => {
  // Note: MemoryTransport is permissive and doesn't require connect() before operations
  runTransportContractTests(() => new MemoryTransport(), { skipDisconnectedTests: true })

  describe('single handler per channel (MemoryTransport-specific)', () => {
    let transport: MemoryTransport

    beforeEach(async () => {
      transport = new MemoryTransport()
      await transport.connect()
    })

    afterEach(async () => {
      await transport.disconnect()
    })

    it('replaces handler on re-subscribe (only last handler receives messages)', async () => {
      const handler1 = vi.fn()
      const handler2 = vi.fn()

      await transport.subscribe('ch', handler1)
      await transport.subscribe('ch', handler2)
      await transport.publish('ch', TestData.small)

      await waitFor(() => handler2.mock.calls.length > 0)

      expect(handler2).toHaveBeenCalledWith(TestData.small)
      expect(handler1).not.toHaveBeenCalled()
    })
  })

  describe('error isolation', () => {
    let transport: MemoryTransport

    beforeEach(async () => {
      transport = new MemoryTransport()
      await transport.connect()
    })

    afterEach(async () => {
      await transport.disconnect()
    })

    it('swallows handler errors without affecting publish', async () => {
      const errorHandler = vi.fn().mockRejectedValue(new Error('Handler error'))

      await transport.subscribe('ch', errorHandler)

      await expect(transport.publish('ch', TestData.small)).resolves.not.toThrow()

      await waitFor(() => errorHandler.mock.calls.length > 0)
      expect(errorHandler).toHaveBeenCalledWith(TestData.small)
    })
  })

  describe('concurrent operations', () => {
    let transport: MemoryTransport

    beforeEach(async () => {
      transport = new MemoryTransport()
      await transport.connect()
    })

    afterEach(async () => {
      await transport.disconnect()
    })

    it('handles concurrent publishes to multiple channels', async () => {
      const collectors = {
        ch1: new EventCollector<Uint8Array>(),
        ch2: new EventCollector<Uint8Array>(),
        ch3: new EventCollector<Uint8Array>(),
      }

      await transport.subscribe('ch1', (d) => collectors.ch1.add(d))
      await transport.subscribe('ch2', (d) => collectors.ch2.add(d))
      await transport.subscribe('ch3', (d) => collectors.ch3.add(d))

      await Promise.all([
        transport.publish('ch1', new Uint8Array([1])),
        transport.publish('ch2', new Uint8Array([2])),
        transport.publish('ch3', new Uint8Array([3])),
      ])

      await waitFor(
        () => collectors.ch1.count() + collectors.ch2.count() + collectors.ch3.count() === 3,
      )

      expect(collectors.ch1.getAll()[0]).toEqual(new Uint8Array([1]))
      expect(collectors.ch2.getAll()[0]).toEqual(new Uint8Array([2]))
      expect(collectors.ch3.getAll()[0]).toEqual(new Uint8Array([3]))
    })

    it('handles rapid sequential publishes without message loss', async () => {
      const collector = new EventCollector<number>()
      const messageCount = 100

      await transport.subscribe('ch', (data) => collector.add(data[0]))

      for (let i = 0; i < messageCount; i++) {
        await transport.publish('ch', new Uint8Array([i]))
      }

      await waitFor(() => collector.count() === messageCount, { timeout: 2000 })

      const received = collector.getAll()
      expect(received).toHaveLength(messageCount)
      // Verify monotonicity (order preserved)
      for (let i = 0; i < messageCount; i++) {
        expect(received[i]).toBe(i)
      }
    })
  })

  describe('resource cleanup', () => {
    it('cleans up all subscriptions on disconnect with many channels', async () => {
      const transport = new MemoryTransport()
      await transport.connect()

      const handlers = Array.from({ length: 50 }, () => vi.fn())
      for (let i = 0; i < handlers.length; i++) {
        await transport.subscribe(`ch${i}`, handlers[i])
      }

      await transport.disconnect()

      await transport.connect()
      for (let i = 0; i < handlers.length; i++) {
        await transport.publish(`ch${i}`, new Uint8Array([i]))
      }

      await new Promise((r) => setTimeout(r, 50))
      handlers.forEach((handler, i) => {
        expect(
          handler,
          `Handler ${i} should not have been called after disconnect`,
        ).not.toHaveBeenCalled()
      })

      await transport.disconnect()
    })
  })
})
