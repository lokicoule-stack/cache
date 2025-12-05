/**
 * Base error class for all transport-related errors
 */
export class TransportError extends Error {
  constructor(
    message: string,
    public readonly transport: string,
    public readonly operation: 'connect' | 'disconnect' | 'publish' | 'subscribe' | 'unsubscribe',
    public readonly retryable: boolean = true,
    public readonly code: string = 'TRANSPORT_ERROR',
  ) {
    super(message)
    this.name = 'TransportError'
    Error.captureStackTrace?.(this, this.constructor)
  }
}

/**
 * Error thrown when transport connection fails
 */
export class TransportConnectionError extends TransportError {
  constructor(
    transport: string,
    cause: Error,
    retryable: boolean = true,
  ) {
    super(
      `Failed to connect to ${transport}: ${cause.message}`,
      transport,
      'connect',
      retryable,
      'TRANSPORT_CONNECTION_FAILED',
    )
    this.name = 'TransportConnectionError'
    this.cause = cause
  }
}

/**
 * Error thrown when transport is not ready
 */
export class TransportNotReadyError extends TransportError {
  constructor(transport: string, operation: 'publish' | 'subscribe' | 'unsubscribe') {
    super(
      `${transport} transport is not ready for ${operation}`,
      transport,
      operation,
      false,
      'TRANSPORT_NOT_READY',
    )
    this.name = 'TransportNotReadyError'
  }
}

/**
 * Error thrown when transport publish fails
 */
export class TransportPublishError extends TransportError {
  constructor(
    transport: string,
    public readonly channel: string,
    cause: Error,
    retryable: boolean = true,
  ) {
    super(
      `Failed to publish to channel '${channel}' on ${transport}: ${cause.message}`,
      transport,
      'publish',
      retryable,
      'TRANSPORT_PUBLISH_FAILED',
    )
    this.name = 'TransportPublishError'
    this.cause = cause
  }
}

/**
 * Error thrown when transport subscribe fails
 */
export class TransportSubscribeError extends TransportError {
  constructor(
    transport: string,
    public readonly channel: string,
    cause: Error,
  ) {
    super(
      `Failed to subscribe to channel '${channel}' on ${transport}: ${cause.message}`,
      transport,
      'subscribe',
      true,
      'TRANSPORT_SUBSCRIBE_FAILED',
    )
    this.name = 'TransportSubscribeError'
    this.cause = cause
  }
}
