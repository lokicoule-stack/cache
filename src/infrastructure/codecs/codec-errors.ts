/**
 * Error codes for codec-related failures.
 * @public
 */
export const CodecErrorCode = {
  CODEC_ERROR: 'CODEC_ERROR',
  ENCODE_FAILED: 'ENCODE_FAILED',
  DECODE_FAILED: 'DECODE_FAILED',
  INVALID_CODEC: 'INVALID_CODEC',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
} as const

/**
 * Type representing all possible codec error codes.
 * @public
 */
export type CodecErrorCode = (typeof CodecErrorCode)[keyof typeof CodecErrorCode]

/**
 * Contextual information for codec errors.
 * @public
 */
export interface CodecErrorContext {
  /** Additional non-sensitive metadata */
  [key: string]: unknown
  /** Codec name or type */
  codec?: string
  /** Type of operation being performed */
  operation?: 'encode' | 'decode'
}

/**
 * Error thrown during encoding or decoding operations.
 * @public
 */
export class CodecError extends Error {
  /** Machine-readable error code */
  readonly code: CodecErrorCode

  /** Additional error context */
  readonly context?: CodecErrorContext

  constructor(
    message: string,
    code: CodecErrorCode = CodecErrorCode.CODEC_ERROR,
    options?: ErrorOptions & { context?: CodecErrorContext },
  ) {
    super(message, options)
    this.name = 'CodecError'
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
