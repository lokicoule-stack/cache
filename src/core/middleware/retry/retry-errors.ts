/**
 * Non-sensitive context for retry errors.
 * @public
 */
export interface RetryErrorContext {
  /** Additional non-sensitive metadata */
  [key: string]: unknown

  /** Channel where error occurred */
  channel?: string

  /** Number of retry attempts made */
  attempts?: number

  /** Maximum retry attempts allowed */
  maxAttempts?: number

  /** Type of operation being performed */
  operation?: 'retry'
}

/**
 * Message exhausted all retries and moved to dead letter queue.
 *
 * @remarks
 * Indicates permanent failure requiring manual intervention.
 * These errors should trigger alerts and be logged for review.
 *
 * @public
 */
export class DeadLetterError extends Error {
  /** Additional error context */
  readonly context?: RetryErrorContext

  constructor(message: string, options?: ErrorOptions & { context?: RetryErrorContext }) {
    super(message, options)
    this.name = 'DeadLetterError'
    this.context = options?.context
    Error.captureStackTrace?.(this, this.constructor)
  }

  /** @internal */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      context: this.context,
      stack: this.stack,
    }
  }
}
