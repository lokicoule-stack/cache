/**
 * Base error class for all codec-related errors
 */
export class CodecError extends Error {
  constructor(
    message: string,
    public readonly codec: string,
    public readonly operation: 'encode' | 'decode',
    public readonly code: string = 'CODEC_ERROR',
  ) {
    super(message)
    this.name = 'CodecError'
    Error.captureStackTrace?.(this, this.constructor)
  }
}

/**
 * Error thrown when encoding fails
 */
export class EncodeError extends CodecError {
  constructor(
    codec: string,
    cause: Error,
  ) {
    super(`Failed to encode data with ${codec}: ${cause.message}`, codec, 'encode', 'ENCODE_FAILED')
    this.name = 'EncodeError'
    this.cause = cause
  }
}

/**
 * Error thrown when decoding fails
 */
export class DecodeError extends CodecError {
  constructor(
    codec: string,
    cause: Error,
  ) {
    super(`Failed to decode data with ${codec}: ${cause.message}`, codec, 'decode', 'DECODE_FAILED')
    this.name = 'DecodeError'
    this.cause = cause
  }
}

/**
 * Error thrown when codec type is invalid
 */
export class InvalidCodecError extends CodecError {
  constructor(codecType: string) {
    super(`Invalid codec type: ${codecType}`, codecType, 'encode', 'INVALID_CODEC')
    this.name = 'InvalidCodecError'
  }
}
