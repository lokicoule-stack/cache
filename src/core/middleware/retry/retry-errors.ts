/**
 * Error codes for queue and retry operations.
 * @public
 */
export const QueueErrorCode = {
  /** Generic queue operation error */
  QUEUE_ERROR: 'QUEUE_ERROR',

  /** Queue has reached maximum capacity */
  QUEUE_FULL: 'QUEUE_FULL',

  /** Message exhausted all retry attempts */
  DEAD_LETTER: 'DEAD_LETTER',

  /** Invalid queue or retry configuration */
  INVALID_CONFIG: 'INVALID_CONFIG',

  /** Message processing exceeded timeout limit */
  PROCESSING_TIMEOUT: 'PROCESSING_TIMEOUT',
} as const

/**
 * @public
 */
export type QueueErrorCode = (typeof QueueErrorCode)[keyof typeof QueueErrorCode]

/**
 * Non-sensitive context for queue and retry errors.
 * @public
 */
export interface QueueErrorContext {
  /** Additional non-sensitive metadata */
  [key: string]: unknown

  /** Channel or queue name where error occurred */
  channel?: string

  /** Current queue size at time of error */
  currentSize?: number

  /** Maximum allowed queue size */
  maxSize?: number

  /** Number of retry attempts made */
  attempts?: number

  /** Maximum retry attempts allowed */
  maxAttempts?: number

  /** Type of operation being performed */
  operation?: 'enqueue' | 'dequeue' | 'process' | 'retry'
}

/**
 * Base error for all queue and retry operations.
 *
 * @remarks
 * Extends native Error with structured error codes and optional context.
 * Use the `code` property for programmatic error handling.
 *
 * @public
 */
export class QueueError extends Error {
  /** Machine-readable error code */
  readonly code: QueueErrorCode

  /** Additional error context */
  readonly context?: QueueErrorContext

  constructor(
    message: string,
    code: QueueErrorCode = QueueErrorCode.QUEUE_ERROR,
    options?: ErrorOptions & { context?: QueueErrorContext },
  ) {
    super(message, options)
    this.name = 'QueueError'
    this.code = code
    this.context = options?.context
    Error.captureStackTrace?.(this, this.constructor)
  }

  /** @internal */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      stack: this.stack,
    }
  }
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
export class DeadLetterError extends QueueError {
  constructor(message: string, options?: ErrorOptions & { context?: QueueErrorContext }) {
    super(message, QueueErrorCode.DEAD_LETTER, options)
    this.name = 'DeadLetterError'
  }
}
