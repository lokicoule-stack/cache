import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Transport } from '@/contracts/transport'
import { waitFor, EventCollector } from '../helpers/async'
import { TestData } from '../builders/message-builder'

/**
 * Contract tests that ANY Transport implementation must pass.
 *
 * @example
 * ```ts
 * describe('MemoryTransport', () => {
 *   runTransportContractTests(() => new MemoryTransport())
 * })
 *
 * describe('RedisTransport', () => {
 *   runTransportContractTests(() => new RedisTransport(config))
 * })
 * ```
 */
export function runTransportContractTests(
  createTransport: () => Transport | Promise<Transport>,
  options: { skipDisconnectedTests?: boolean } = {},
) {
  describe('Transport Contract', () => {
    let transport: Transport

    beforeEach(async () => {
      transport = await createTransport()
    })

    afterEach(async () => {
      await transport.disconnect().catch(() => {})
    })

    describe('publish/subscribe', () => {
      it('delivers messages to subscribers', async () => {
        await transport.connect()
        const collector = new EventCollector<Uint8Array>()
        const data = TestData.small

        await transport.subscribe('ch', (d) => collector.add(d))
        await transport.publish('ch', data)

        const received = await collector.waitForEvent()
        expect(received).toEqual(data)
      })

      it('isolates messages to correct channel', async () => {
        await transport.connect()
        const handler1 = vi.fn()
        const handler2 = vi.fn()

        await transport.subscribe('ch1', handler1)
        await transport.subscribe('ch2', handler2)
        await transport.publish('ch1', TestData.small)

        await waitFor(() => handler1.mock.calls.length > 0)
        expect(handler1).toHaveBeenCalledWith(TestData.small)
        expect(handler2).not.toHaveBeenCalled()
      })

      it('preserves message order for same channel', async () => {
        await transport.connect()
        const received: number[] = []

        await transport.subscribe('ch', (data) => {
          received.push(data[0])
        })
        await transport.publish('ch', new Uint8Array([1]))
        await transport.publish('ch', new Uint8Array([2]))
        await transport.publish('ch', new Uint8Array([3]))

        await waitFor(() => received.length === 3)
        expect(received).toEqual([1, 2, 3])
      })

      it('handles publish to channel with no subscribers gracefully', async () => {
        await transport.connect()

        await expect(transport.publish('no-subscriber', TestData.small)).resolves.not.toThrow()
      })
    })

    describe('unsubscribe', () => {
      it('stops delivery after unsubscribe', async () => {
        await transport.connect()
        const handler = vi.fn()

        await transport.subscribe('ch', handler)
        await transport.unsubscribe('ch')
        await transport.publish('ch', TestData.small)

        // Wait a bit to ensure no delivery
        await new Promise((r) => setTimeout(r, 50))
        expect(handler).not.toHaveBeenCalled()
      })
    })

    describe('disconnect', () => {
      it('clears subscriptions on disconnect', async () => {
        await transport.connect()
        const handler = vi.fn()

        await transport.subscribe('ch', handler)
        await transport.disconnect()
        await transport.connect()
        await transport.publish('ch', TestData.small)

        await new Promise((r) => setTimeout(r, 50))
        expect(handler).not.toHaveBeenCalled()
      })
    })

    if (!options.skipDisconnectedTests) {
      describe('disconnected state', () => {
        it('rejects publish when disconnected', async () => {
          // Don't connect

          await expect(transport.publish('ch', TestData.small)).rejects.toThrow()
        })

        it('rejects subscribe when disconnected', async () => {
          await expect(transport.subscribe('ch', vi.fn())).rejects.toThrow()
        })
      })
    }
  })
}
