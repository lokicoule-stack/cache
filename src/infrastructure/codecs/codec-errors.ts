/**
 * Error codes for codec operations.
 * @public
 */
export const CodecErrorCode = {
  /** Generic codec error */
  CODEC_ERROR: 'CODEC_ERROR',
  /** Encoding operation failed */
  ENCODE_FAILED: 'ENCODE_FAILED',
  /** Decoding operation failed */
  DECODE_FAILED: 'DECODE_FAILED',
  /** Invalid or unsupported codec type */
  INVALID_CODEC: 'INVALID_CODEC',
} as const

/**
 * @public
 */
export type CodecErrorCode = (typeof CodecErrorCode)[keyof typeof CodecErrorCode]

/**
 * Non-sensitive context for codec errors.
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
 * Base error for all codec operations.
 *
 * @remarks
 * Extends native Error with structured error codes and optional context.
 * Use the `code` property for programmatic error handling.
 *
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
