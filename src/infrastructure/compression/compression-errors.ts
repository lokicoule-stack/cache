/**
 * Base error class for compression-related errors.
 */
export class CompressionError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'COMPRESSION_ERROR',
  ) {
    super(message)
    this.name = 'CompressionError'
    Error.captureStackTrace?.(this, this.constructor)
  }
}

/**
 * Error thrown when compressed data has an invalid format.
 */
export class InvalidCompressionDataError extends CompressionError {
  constructor(message: string) {
    super(message, 'INVALID_COMPRESSION_DATA')
    this.name = 'InvalidCompressionDataError'
  }
}

/**
 * Error thrown when an unknown compression marker is encountered.
 */
export class UnknownCompressionMarkerError extends CompressionError {
  constructor(marker: number) {
    super(`Unknown compression marker: ${marker}`, 'UNKNOWN_COMPRESSION_MARKER')
    this.name = 'UnknownCompressionMarkerError'
  }
}
