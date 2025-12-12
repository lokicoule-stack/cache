import { DeadLetterError } from '../retry-errors'

import type { OnDeadLetterCallback, OnRetryCallback, RetryBackoff } from '../retry-backoff'
import type { QueuedMessage } from './retry-queue'
import type { Transport } from '@/contracts/transport'

/** @internal */
interface RetryResult {
  shouldRemove: boolean
  nextRetryAt?: number
  error?: string
}

/** @internal */
export class RetryManager {
  #transport: Transport
  #backoff: RetryBackoff
  #maxAttempts: number
  #baseDelayMs: number
  #onRetry?: OnRetryCallback
  #onDeadLetter?: OnDeadLetterCallback

  constructor(
    transport: Transport,
    backoff: RetryBackoff,
    maxAttempts: number,
    baseDelayMs: number,
    onRetry?: OnRetryCallback,
    onDeadLetter?: OnDeadLetterCallback,
  ) {
    this.#transport = transport
    this.#backoff = backoff
    this.#maxAttempts = maxAttempts
    this.#baseDelayMs = baseDelayMs
    this.#onRetry = onRetry
    this.#onDeadLetter = onDeadLetter
  }

  async retry(message: QueuedMessage): Promise<RetryResult> {
    const currentAttempt = message.attempts + 1

    if (this.#onRetry) {
      try {
        await this.#onRetry(message.channel, message.data, currentAttempt)
      } catch {
        // Swallow callback errors
      }
    }

    try {
      await this.#transport.publish(message.channel, message.data)

      return { shouldRemove: true }
    } catch (error) {
      const errorMessage = (error as Error).message

      if (currentAttempt >= this.#maxAttempts) {
        const deadLetterError = new DeadLetterError(
          `Message exhausted all retry attempts: ${errorMessage}`,
          {
            context: {
              channel: message.channel,
              attempts: message.attempts,
              maxAttempts: this.#maxAttempts,
              operation: 'retry',
            },
            cause: error as Error,
          },
        )

        if (this.#onDeadLetter) {
          try {
            await this.#onDeadLetter(message.channel, message.data, deadLetterError, currentAttempt)
          } catch {
            // Swallow callback errors
          }
        }

        return { shouldRemove: true }
      }

      const delayMs = this.#backoff(currentAttempt, this.#baseDelayMs)
      const nextRetryAt = Date.now() + delayMs

      return {
        shouldRemove: false,
        nextRetryAt,
        error: errorMessage,
      }
    }
  }
}
