import { DeadLetterError } from '@/shared/errors'

import type { QueuedMessage } from './retry-queue.contract'
import type { IRetryStrategy } from './retry-strategy.contract'
import type { ITransport } from '@/core/transport'
import type { TransportData } from '@/core/types'

/**
 * Result of retry attempt processing
 *
 * @internal
 */
interface RetryResult {
  /** Whether message should be removed from queue */
  shouldRemove: boolean
  /** Next retry timestamp (if not removing) */
  nextRetryAt?: Date
  /** Error message (if failed) */
  error?: string
}

/**
 * Internal retry orchestration component
 *
 * Manages retry logic, strategy application, and callback invocation.
 * Coordinates between transport, strategy, and queue lifecycle.
 * Used internally by RetryQueue - not exposed as public API.
 *
 * Responsibilities:
 * - Execute retry attempts via transport
 * - Apply backoff strategy for delay calculation
 * - Invoke onRetry and onDeadLetter callbacks
 * - Determine when messages should be removed (success or max attempts)
 *
 * @internal
 */
export class RetryManager {
  #transport: ITransport
  #strategy: IRetryStrategy
  #maxAttempts: number
  #baseDelayMs: number
  #onRetry?: (channel: string, data: TransportData, attempt: number) => void | Promise<void>
  #onDeadLetter?: (channel: string, data: TransportData, error: Error, attempts: number) => void | Promise<void>

  /**
   * Create retry manager
   *
   * @param transport - Transport for publish attempts
   * @param strategy - Backoff strategy implementation
   * @param maxAttempts - Max retry attempts before dead letter
   * @param baseDelayMs - Base delay for strategy calculation
   * @param onRetry - Optional retry callback
   * @param onDeadLetter - Optional dead letter callback
   */
  constructor(
    transport: ITransport,
    strategy: IRetryStrategy,
    maxAttempts: number,
    baseDelayMs: number,
    onRetry?: (channel: string, data: TransportData, attempt: number) => void | Promise<void>,
    onDeadLetter?: (channel: string, data: TransportData, error: Error, attempts: number) => void | Promise<void>,
  ) {
    this.#transport = transport
    this.#strategy = strategy
    this.#maxAttempts = maxAttempts
    this.#baseDelayMs = baseDelayMs
    this.#onRetry = onRetry
    this.#onDeadLetter = onDeadLetter
  }

  /**
   * Process a retry attempt for a message
   *
   * Increments attempt counter, invokes callbacks, attempts publish.
   * Returns result indicating whether to remove message and next retry time.
   *
   * @param message - Message to retry
   * @returns Retry result with removal flag and next retry time
   */
  async retry(message: QueuedMessage): Promise<RetryResult> {
    message.attempts++

    // Invoke onRetry callback (swallow errors to prevent disruption)
    if (this.#onRetry) {
      try {
        await this.#onRetry(message.channel, message.data, message.attempts)
      } catch {
        // Swallow callback errors
      }
    }

    try {
      // Attempt to publish
      await this.#transport.publish(message.channel, message.data)

      // Success - remove from queue
      return { shouldRemove: true }
    } catch (error) {
      const errorMessage = (error as Error).message

      // Check if max attempts reached
      if (message.attempts >= this.#maxAttempts) {
        const deadLetterError = new DeadLetterError(message.channel, message.attempts, error as Error)

        // Invoke onDeadLetter callback (swallow errors)
        if (this.#onDeadLetter) {
          try {
            await this.#onDeadLetter(message.channel, message.data, deadLetterError, message.attempts)
          } catch {
            // Swallow callback errors
          }
        }

        // Dead letter - remove from queue
        return { shouldRemove: true }
      }

      // Calculate next retry delay using strategy
      const delayMs = this.#strategy.calculateDelay(message.attempts, this.#baseDelayMs)
      const nextRetryAt = new Date(Date.now() + delayMs)

      // Reschedule
      return {
        shouldRemove: false,
        nextRetryAt,
        error: errorMessage,
      }
    }
  }
}
