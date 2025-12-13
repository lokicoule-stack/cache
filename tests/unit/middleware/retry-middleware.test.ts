/* eslint-disable @typescript-eslint/require-await */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RetryMiddleware } from '@/core/middleware/retry/retry-middleware'
import { DeadLetterError } from '@/core/middleware/retry/retry-errors'
import { TransportError, TransportErrorCode } from '@/infrastructure/transports/transport-errors'
import { FakeTransport, ChaosTransport } from '@test/doubles'
import { TestData } from '@test/builders'

describe('RetryMiddleware', () => {
  let cleanup: Array<() => Promise<void>> = []

  afterEach(async () => {
    await Promise.all(cleanup.map((fn) => fn()))
    cleanup = []
  })

  async function createRetry(
    config: { maxAttempts?: number; delay?: number } = {},
  ): Promise<{ retry: RetryMiddleware; chaos: ChaosTransport; fake: FakeTransport }> {
    const fake = new FakeTransport()
    await fake.connect()
    const chaos = new ChaosTransport(fake)
    const retry = new RetryMiddleware(chaos, {
      maxAttempts: config.maxAttempts ?? 3,
      delay: config.delay ?? 10,
    })
    cleanup.push(() => retry.disconnect())
    return { retry, chaos, fake }
  }

  describe('retry behavior', () => {
    it('retries on transient failures and succeeds when recovered', async () => {
      const { retry, chaos, fake } = await createRetry()
      chaos.failNext(2) // Fail first 2 attempts

      await retry.publish('orders', TestData.small)

      expect(chaos.failures).toBe(2)
      expect(fake.getPublishedMessages()).toHaveLength(1)
    })

    it('throws DeadLetterError after exhausting all attempts', async () => {
      const { retry, chaos } = await createRetry({ maxAttempts: 3 })
      chaos.alwaysFail()

      await expect(retry.publish('orders', TestData.small)).rejects.toThrow(DeadLetterError)
      expect(chaos.failures).toBe(3)
    })

    it('includes error context in DeadLetterError for debugging', async () => {
      const { retry, chaos } = await createRetry({ maxAttempts: 2 })
      chaos.alwaysFail()

      try {
        await retry.publish('orders', TestData.small)
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(DeadLetterError)
        const dlError = error as DeadLetterError
        expect(dlError.context).toMatchObject({
          channel: 'orders',
          attempts: 2,
          maxAttempts: 2,
        })
        expect(dlError.cause).toBeInstanceOf(Error)
      }
    })

    it('respects non-retryable errors and fails immediately', async () => {
      const fake = new FakeTransport()
      await fake.connect()
      const nonRetryableError = new TransportError('Fatal', TransportErrorCode.TRANSPORT_ERROR, {
        context: { retryable: false },
      })
      vi.spyOn(fake, 'publish').mockRejectedValue(nonRetryableError)
      const retry = new RetryMiddleware(fake, { maxAttempts: 5 })

      await expect(retry.publish('ch', TestData.small)).rejects.toThrow(nonRetryableError)
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(fake.publish).toHaveBeenCalledTimes(1)
    })
  })

  describe('backoff timing', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('applies exponential backoff between retry attempts', async () => {
      const { retry, chaos } = await createRetry({
        maxAttempts: 4,
        delay: 100,
      })
      chaos.failNext(3)

      const promise = retry.publish('ch', TestData.small)

      // First retry after 100ms (attempt 2)
      await vi.advanceTimersByTimeAsync(100)
      expect(chaos.failures).toBe(2)

      // Second retry after 200ms (attempt 3)
      await vi.advanceTimersByTimeAsync(200)
      expect(chaos.failures).toBe(3)

      // Third retry after 400ms (attempt 4) - should succeed
      await vi.advanceTimersByTimeAsync(400)
      await promise

      expect(chaos.failures).toBe(3)
    })
  })

  describe('callbacks', () => {
    it('calls onRetry with attempt number on each retry', async () => {
      const onRetry = vi.fn()
      const fake = new FakeTransport()
      await fake.connect()
      const chaos = new ChaosTransport(fake)
      chaos.failNext(2)
      const retry = new RetryMiddleware(chaos, { maxAttempts: 3, delay: 10, onRetry })
      cleanup.push(() => retry.disconnect())

      await retry.publish('ch', TestData.small)

      expect(onRetry).toHaveBeenCalledTimes(2)
      // Verify attempt numbers are monotonically increasing
      const attempts = onRetry.mock.calls.map((call) => call[2])
      expect(attempts).toEqual([2, 3])
    })

    it('calls onDeadLetter when message exhausts retries', async () => {
      const onDeadLetter = vi.fn()
      const fake2 = new FakeTransport()
      await fake2.connect()
      const chaos2 = new ChaosTransport(fake2)
      chaos2.alwaysFail()
      const retry2 = new RetryMiddleware(chaos2, { maxAttempts: 2, delay: 10, onDeadLetter })
      cleanup.push(() => retry2.disconnect())

      await expect(retry2.publish('orders', TestData.small)).rejects.toThrow(DeadLetterError)

      expect(onDeadLetter).toHaveBeenCalledTimes(1)
      expect(onDeadLetter).toHaveBeenCalledWith(
        'orders',
        TestData.small,
        expect.any(DeadLetterError),
        2,
      )
    })
  })

  describe('concurrent operations', () => {
    it('isolates retry state between concurrent publishes', async () => {
      const { retry, fake } = await createRetry({ maxAttempts: 3, delay: 10 })

      const ch1Attempts: number[] = []
      const ch2Attempts: number[] = []

      vi.spyOn(fake, 'publish').mockImplementation(async (channel) => {
        if (channel === 'ch1') {
          ch1Attempts.push(1)
          if (ch1Attempts.length < 3) throw new Error('fail ch1')
        } else {
          ch2Attempts.push(1)
        }
      })

      await Promise.all([
        retry.publish('ch1', TestData.small),
        retry.publish('ch2', TestData.small),
      ])

      expect(ch1Attempts).toHaveLength(3)
      expect(ch2Attempts).toHaveLength(1)
    })
  })

  describe('invariants', () => {
    it('attempt counter is strictly monotonic', async () => {
      const attempts: number[] = []
      const onRetry = vi.fn((_channel: string, _data: Uint8Array, attempt: number) => {
        attempts.push(attempt)
      })
      const fake = new FakeTransport()
      await fake.connect()
      const chaos = new ChaosTransport(fake)
      chaos.failNext(4)
      const retry = new RetryMiddleware(chaos, { maxAttempts: 5, delay: 10, onRetry })
      cleanup.push(() => retry.disconnect())

      await retry.publish('ch', TestData.small)

      for (let i = 1; i < attempts.length; i++) {
        expect(attempts[i]).toBeGreaterThan(attempts[i - 1])
      }
    })

    it('never exceeds maxAttempts under any failure pattern', async () => {
      const { retry, chaos } = await createRetry({ maxAttempts: 5 })
      chaos.alwaysFail()

      await expect(retry.publish('ch', TestData.small)).rejects.toThrow(DeadLetterError)

      expect(chaos.failures).toBe(5)
      expect(chaos.failures).toBeLessThanOrEqual(5)
    })
  })
})
