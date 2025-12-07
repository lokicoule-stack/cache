/**
 * Error codes for transport operations.
 *
 * @public
 */
export const TransportErrorCode = {
  TRANSPORT_ERROR: 'TRANSPORT_ERROR',
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  NOT_READY: 'NOT_READY',
  PUBLISH_FAILED: 'PUBLISH_FAILED',
  SUBSCRIBE_FAILED: 'SUBSCRIBE_FAILED',
  UNSUBSCRIBE_FAILED: 'UNSUBSCRIBE_FAILED',
} as const

/**
 * @public
 */
export type TransportErrorCode = (typeof TransportErrorCode)[keyof typeof TransportErrorCode]

/**
 * Transport operations that can fail.
 *
 * @public
 */
export const TransportOperation = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  PUBLISH: 'publish',
  SUBSCRIBE: 'subscribe',
  UNSUBSCRIBE: 'unsubscribe',
} as const

/**
 * @public
 */
export type TransportOperation = (typeof TransportOperation)[keyof typeof TransportOperation]

/**
 * Context for transport errors.
 *
 * @public
 */
export interface TransportErrorContext {
  [key: string]: unknown
  transport?: string
  channel?: string
  operation?: TransportOperation
  retryable?: boolean
}

/**
 * Base error for all transport operations.
 *
 * @public
 */
export class TransportError extends Error {
  readonly code: TransportErrorCode
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
