import { TransportMiddleware } from '../base'

import {
  exponentialBackoff,
  fibonacciBackoff,
  linearBackoff,
  type RetryBackoff,
} from './retry-backoff'
import { type RetryConfig, type RetryConfigObject, DEFAULT_RETRY_CONFIG } from './retry-config'
import { DeadLetterError } from './retry-errors'

import type { Transport } from '@/contracts/transport'
import type { TransportData } from '@/types'

import { TransportError } from '@/infrastructure/transports/transport-errors'

export class RetryMiddleware extends TransportMiddleware {
  readonly #config: RetryConfigObject
  readonly #backoff: RetryBackoff

  constructor(transport: Transport, config: RetryConfig) {
    super(transport)

    this.#config = this.#normalizeConfig(config)
    this.#backoff = this.#resolveBackoff(this.#config.backoff ?? 'exponential')
  }

  override async publish(channel: string, data: TransportData): Promise<void> {
    const maxAttempts = this.#config.maxAttempts ?? 0

    if (maxAttempts === 0) {
      await this.transport.publish(channel, data)

      return
    }

    let lastError: Error | undefined

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        if (this.#config.onRetry && attempt > 1) {
          try {
            await this.#config.onRetry(channel, data, attempt)
          } catch {
            // Swallow callback errors
          }
        }

        await this.transport.publish(channel, data)

        return
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))

        if (!this.#shouldRetry(err)) {
          throw err
        }

        if (attempt < maxAttempts) {
          const delayMs = this.#backoff(attempt, this.#config.delay ?? 1000)

          await this.#sleep(delayMs)
        }
      }
    }

    const deadLetterError = new DeadLetterError(
      `Message exhausted all retry attempts: ${lastError?.message}`,
      {
        context: {
          channel,
          attempts: maxAttempts,
          maxAttempts,
          operation: 'retry',
        },
        cause: lastError,
      },
    )

    if (this.#config.onDeadLetter) {
      try {
        await this.#config.onDeadLetter(channel, data, deadLetterError, maxAttempts)
      } catch {
        // Swallow callback errors
      }
    }

    throw deadLetterError
  }

  #shouldRetry(err: unknown): boolean {
    if (err instanceof TransportError && err.context?.retryable !== undefined) {
      return err.context.retryable
    }

    return true
  }

  #sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  #normalizeConfig(config: RetryConfig): RetryConfigObject {
    if (config === false) {
      return { maxAttempts: 0 }
    }

    if (config === true) {
      return DEFAULT_RETRY_CONFIG
    }

    if (typeof config === 'number') {
      return { ...DEFAULT_RETRY_CONFIG, maxAttempts: config }
    }

    return {
      ...DEFAULT_RETRY_CONFIG,
      ...config,
    }
  }

  #resolveBackoff(backoff: 'exponential' | 'linear' | 'fibonacci' | RetryBackoff): RetryBackoff {
    if (typeof backoff === 'function') {
      return backoff
    }

    switch (backoff) {
      case 'exponential':
        return exponentialBackoff
      case 'linear':
        return linearBackoff
      case 'fibonacci':
        return fibonacciBackoff
    }
  }
}
