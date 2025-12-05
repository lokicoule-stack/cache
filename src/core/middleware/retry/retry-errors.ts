/**
 * Base error class for all queue-related errors
 */
export class QueueError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'QUEUE_ERROR',
  ) {
    super(message)
    this.name = 'QueueError'
    Error.captureStackTrace?.(this, this.constructor)
  }
}

/**
 * Error thrown when queue is full
 */
export class QueueFullError extends QueueError {
  constructor(
    public readonly maxSize: number,
    public readonly channel: string,
  ) {
    super(
      `Queue is full (max size: ${maxSize}). Cannot enqueue message for channel '${channel}'.`,
      'QUEUE_FULL',
    )
    this.name = 'QueueFullError'
  }
}

/**
 * Error thrown when message reaches dead letter queue
 */
export class DeadLetterError extends QueueError {
  constructor(
    public readonly channel: string,
    public readonly attempts: number,
    cause: Error,
  ) {
    super(
      `Message for channel '${channel}' moved to dead letter queue ` +
        `after ${attempts} attempts: ${cause.message}`,
      'DEAD_LETTER',
    )
    this.name = 'DeadLetterError'
    this.cause = cause
  }
}
