/**
 * Base error class for all bus-related errors
 */
export class BusError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'BUS_ERROR',
  ) {
    super(message)
    this.name = 'BusError'
    Error.captureStackTrace?.(this, this.constructor)
  }
}

/**
 * Error thrown when bus is not connected
 */
export class BusNotConnectedError extends BusError {
  constructor(operation: string) {
    super(`Cannot ${operation}: bus is not connected. Call connect() first.`, 'BUS_NOT_CONNECTED')
    this.name = 'BusNotConnectedError'
  }
}

/**
 * Error thrown when bus operation fails
 */
export class BusOperationError extends BusError {
  constructor(
    operation: string,
    cause: Error,
  ) {
    super(`Bus operation '${operation}' failed: ${cause.message}`, 'BUS_OPERATION_FAILED')
    this.name = 'BusOperationError'
    this.cause = cause
  }
}

/**
 * Error thrown when handler execution fails
 */
export class HandlerError extends BusError {
  constructor(
    public readonly channel: string,
    cause: Error,
  ) {
    super(`Handler failed for channel '${channel}': ${cause.message}`, 'HANDLER_ERROR')
    this.name = 'HandlerError'
    this.cause = cause
  }
}
