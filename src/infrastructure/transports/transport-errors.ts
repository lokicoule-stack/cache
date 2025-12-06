/**
 * Error codes for transport operations.
 * @public
 */
export const TransportErrorCode = {
  /** Generic transport error */
  TRANSPORT_ERROR: 'TRANSPORT_ERROR',

  /** Transport connection failed */
  CONNECTION_FAILED: 'CONNECTION_FAILED',

  /** Transport not ready for operation */
  NOT_READY: 'NOT_READY',

  /** Publish operation failed */
  PUBLISH_FAILED: 'PUBLISH_FAILED',

  /** Subscribe operation failed */
  SUBSCRIBE_FAILED: 'SUBSCRIBE_FAILED',

  /** Unsubscribe operation failed */
  UNSUBSCRIBE_FAILED: 'UNSUBSCRIBE_FAILED',
} as const

/**
 * @public
 */
export type TransportErrorCode = (typeof TransportErrorCode)[keyof typeof TransportErrorCode]

/**
 * Context for transport errors.
 * @public
 */
export interface TransportErrorContext {
  /** Additional non-sensitive metadata */
  [key: string]: unknown

  /** Transport name */
  transport?: string

  /** Channel name where error occurred */
  channel?: string

  /** Operation being performed */
  operation?: 'connect' | 'disconnect' | 'publish' | 'subscribe' | 'unsubscribe'

  /** Whether the operation is retryable */
  retryable?: boolean
}

/**
 * Base error for all transport operations.
 *
 * @remarks
 * Extends native Error with structured error codes and optional context.
 * Use the `code` property for programmatic error handling.
 *
 * @public
 */
export class TransportError extends Error {
  /** Machine-readable error code */
  readonly code: TransportErrorCode

  /** Additional error context */
  readonly context?: TransportErrorContext

  constructor(
    message: string,
    code: TransportErrorCode = TransportErrorCode.TRANSPORT_ERROR,
    options?: ErrorOptions & { context?: TransportErrorContext },
  ) {
    super(message, options)

    this.name = 'TransportError'
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
