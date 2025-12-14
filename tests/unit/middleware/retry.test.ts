/* eslint-disable @typescript-eslint/require-await */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RetryMiddleware } from '@/core/middleware/retry/retry-middleware'
import { DeadLetterError } from '@/core/middleware/retry/retry-errors'
import { TransportError, TransportErrorCode } from '@/infrastructure/transports/transport-errors'
import { FakeTransport, ChaosTransport } from '@test/doubles'
import { TestData } from '@test/builders'

describe('RetryMiddleware', () => {
  let fake: FakeTransport
  let chaos: ChaosTransport
  let retry: RetryMiddleware

  beforeEach(async () => {
    fake = new FakeTransport()
    await fake.connect()
    chaos = new ChaosTransport(fake)
    retry = new RetryMiddleware(chaos, { maxAttempts: 3, delay: 10 })
  })

  describe('retry behavior', () => {
    const testCases = [
      {
        name: 'succeeds after transient failures',
        failCount: 2,
        maxAttempts: 3,
        expectSuccess: true,
        expectedFailures: 2,
      },
      {
        name: 'throws DeadLetterError when exhausted',
        failCount: Infinity,
        maxAttempts: 3,
        expectSuccess: false,
        expectedFailures: 3,
      },
    ]

    it.each(testCases)(
      '$name',
      async ({ failCount, maxAttempts, expectSuccess, expectedFailures }) => {
        chaos = new ChaosTransport(fake)
        retry = new RetryMiddleware(chaos, { maxAttempts, delay: 10 })

        if (failCount === Infinity) chaos.alwaysFail()
        else chaos.failNext(failCount)

        const promise = retry.publish('orders', TestData.small)

        if (expectSuccess) {
          await promise
          expect(fake.getPublishedMessages()).toHaveLength(1)
        } else {
          await expect(promise).rejects.toThrow(DeadLetterError)
        }

        expect(chaos.failures).toBe(expectedFailures)
      },
    )

    it('includes error context in DeadLetterError', async () => {
      chaos.alwaysFail()
      retry = new RetryMiddleware(chaos, { maxAttempts: 2, delay: 10 })

      try {
        await retry.publish('orders', TestData.small)
        expect.fail('Should have thrown')
      } catch (error) {
        const dlError = error as DeadLetterError
        expect(dlError.context).toMatchObject({
          channel: 'orders',
          attempts: 2,
          maxAttempts: 2,
        })
        expect(dlError.cause).toBeInstanceOf(Error)
      }
    })

    it('fails immediately on non-retryable errors', async () => {
      const nonRetryable = new TransportError('Fatal', TransportErrorCode.TRANSPORT_ERROR, {
        context: { retryable: false },
      })
      vi.spyOn(fake, 'publish').mockRejectedValue(nonRetryable)
      retry = new RetryMiddleware(fake, { maxAttempts: 5 })

      await expect(retry.publish('ch', TestData.small)).rejects.toThrow(nonRetryable)
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(fake.publish).toHaveBeenCalledTimes(1)
    })
  })

  describe('backoff timing', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('applies exponential backoff (100ms, 200ms, 400ms)', async () => {
      chaos.failNext(3)
      retry = new RetryMiddleware(chaos, { maxAttempts: 4, delay: 100 })

      const promise = retry.publish('ch', TestData.small)

      await vi.advanceTimersByTimeAsync(100)
      expect(chaos.failures).toBe(2)

      await vi.advanceTimersByTimeAsync(200)
      expect(chaos.failures).toBe(3)

      await vi.advanceTimersByTimeAsync(400)
      await promise
    })
  })

  describe('callbacks', () => {
    it('calls onRetry with monotonic attempt numbers', async () => {
      const onRetry = vi.fn()
      chaos.failNext(2)
      retry = new RetryMiddleware(chaos, { maxAttempts: 3, delay: 10, onRetry })

      await retry.publish('ch', TestData.small)

      expect(onRetry).toHaveBeenCalledTimes(2)
      expect(onRetry.mock.calls.map((c) => c[2])).toEqual([2, 3])
    })

    it('calls onDeadLetter when exhausted', async () => {
      const onDeadLetter = vi.fn()
      chaos.alwaysFail()
      retry = new RetryMiddleware(chaos, { maxAttempts: 2, delay: 10, onDeadLetter })

      await expect(retry.publish('orders', TestData.small)).rejects.toThrow(DeadLetterError)

      expect(onDeadLetter).toHaveBeenCalledOnce()
      expect(onDeadLetter).toHaveBeenCalledWith(
        'orders',
        TestData.small,
        expect.any(DeadLetterError),
        2,
      )
    })
  })

  describe('concurrent operations', () => {
    it('isolates retry state between channels', async () => {
      const ch1Attempts: number[] = []
      const ch2Attempts: number[] = []

      vi.spyOn(fake, 'publish').mockImplementation(async (channel) => {
        if (channel === 'ch1') {
          ch1Attempts.push(1)
          if (ch1Attempts.length < 3) throw new Error('fail')
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
    it('never exceeds maxAttempts', async () => {
      chaos.alwaysFail()
      retry = new RetryMiddleware(chaos, { maxAttempts: 5, delay: 10 })

      await expect(retry.publish('ch', TestData.small)).rejects.toThrow()

      expect(chaos.failures).toBe(5)
    })
  })
})
