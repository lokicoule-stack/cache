/**
 * RetryMiddleware under chaotic network conditions.
 *
 * Integration tests validating retry behavior with transport failures,
 * intermittent issues, queue resilience, and dead letter handling.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { RetryMiddleware } from '@/core/middleware/retry/retry-middleware'
import { TransportError, TransportErrorCode } from '@/infrastructure/transports/transport-errors'
import { FakeTransport } from '@test/doubles/transports'
import { ChaosTransport } from '@test/doubles/chaos-transport'

describe('RetryMiddleware Chaos Integration', () => {
  let chaos: ChaosTransport
  let middleware: RetryMiddleware

  afterEach(async () => {
    await middleware?.disconnect().catch(() => {})
  })

  it('queues failed messages and retries when transport recovers', async () => {
    chaos = new ChaosTransport(new FakeTransport())
    middleware = new RetryMiddleware(chaos, {
      maxAttempts: 3,
      delay: 10,
      queue: { intervalMs: 50 },
    })

    await middleware.connect()
    const handler = vi.fn()
    await middleware.subscribe('ch', handler)

    chaos.alwaysFail()
    await middleware.publish('ch', new Uint8Array([1, 2, 3]))

    expect(handler).not.toHaveBeenCalled()

    chaos.recover()

    await vi.waitFor(() => expect(handler).toHaveBeenCalled(), { timeout: 100 })
  })

  it('calls onDeadLetter after max attempts exhausted', async () => {
    chaos = new ChaosTransport(new FakeTransport())

    const onDeadLetter = vi.fn()
    middleware = new RetryMiddleware(chaos, {
      maxAttempts: 2,
      delay: 10,
      queue: { intervalMs: 20 },
      onDeadLetter,
    })

    await middleware.connect()

    chaos.alwaysFail()
    await middleware.publish('ch', new Uint8Array([1]))

    await vi.waitFor(() => expect(onDeadLetter).toHaveBeenCalled(), { timeout: 500 })
    expect(onDeadLetter).toHaveBeenCalledWith('ch', expect.any(Uint8Array), expect.any(Error), 2)
  })

  it('propagates error when retry disabled', async () => {
    chaos = new ChaosTransport(new FakeTransport())
    middleware = new RetryMiddleware(chaos, false)

    await middleware.connect()
    chaos.alwaysFail()

    await expect(middleware.publish('ch', new Uint8Array([1]))).rejects.toThrow('Chaos failure')
  })

  it('delivers all queued messages after intermittent failure', async () => {
    chaos = new ChaosTransport(new FakeTransport())
    middleware = new RetryMiddleware(chaos, {
      maxAttempts: 5,
      delay: 10,
      queue: { intervalMs: 30 },
    })

    await middleware.connect()
    const received: number[] = []
    await middleware.subscribe('ch', (data: Uint8Array) => {
      received.push(data[0])
    })

    chaos.alwaysFail()
    await middleware.publish('ch', new Uint8Array([1]))
    await middleware.publish('ch', new Uint8Array([2]))
    await middleware.publish('ch', new Uint8Array([3]))

    expect(received).toHaveLength(0)

    chaos.recover()

    await vi.waitFor(() => expect(received).toHaveLength(3), { timeout: 100 })
    expect(received.sort()).toEqual([1, 2, 3])
  })

  it('handles flaky transport with intermittent failures', async () => {
    chaos = new ChaosTransport(new FakeTransport())
    middleware = new RetryMiddleware(chaos, {
      maxAttempts: 5,
      delay: 10,
      queue: { intervalMs: 30 },
    })

    await middleware.connect()
    const handler = vi.fn()
    await middleware.subscribe('ch', handler)

    chaos.failNext(2)
    await middleware.publish('ch', new Uint8Array([42]))

    await vi.waitFor(() => expect(handler).toHaveBeenCalled(), { timeout: 500 })
    expect(chaos.failures).toBe(2)
  })

  it('does not retry non-retryable errors', async () => {
    const transport = new FakeTransport()
    middleware = new RetryMiddleware(transport, {
      maxAttempts: 3,
      delay: 10,
      queue: { intervalMs: 30 },
    })

    await middleware.connect()

    transport.publish = () => {
      throw new TransportError('Invalid payload', TransportErrorCode.PUBLISH_FAILED, {
        context: { retryable: false },
      })
    }

    await expect(middleware.publish('ch', new Uint8Array([1]))).rejects.toThrow('Invalid payload')
  })
})
