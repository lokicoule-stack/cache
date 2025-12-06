/**
 * Error codes for compression operations.
 * @public
 */
export const CompressionErrorCode = {
  /** Generic compression failure */
  COMPRESSION_FAILED: 'COMPRESSION_FAILED',
  
  /** Decompression operation failed */
  DECOMPRESSION_FAILED: 'DECOMPRESSION_FAILED',
  
  /** Invalid compressed data format or structure */
  INVALID_DATA: 'INVALID_DATA',
  
  /** Unknown or unsupported compression format/marker */
  UNKNOWN_FORMAT: 'UNKNOWN_FORMAT',
  
  /** Invalid compression configuration */
  INVALID_CONFIG: 'INVALID_CONFIG',
} as const;

/**
 * @public
 */
export type CompressionErrorCode = typeof CompressionErrorCode[keyof typeof CompressionErrorCode];

/**
 * Non-sensitive context for compression errors.
 * @public
 */
export interface CompressionErrorContext {
  /** Additional non-sensitive metadata */
  [key: string]: unknown
   
  /** Component or field where error occurred */
  field?: string
  
  /** Compression algorithm being used */
  algorithm?: string
  
  /** Type of operation being performed */
  operation?: 'compress' | 'decompress' | 'detect'
  
  /** Expected format or marker */
  expectedFormat?: string | number
  
  /** Actual format or marker received */
  actualFormat?: string | number
 
}

/**
 * Base error for all compression operations.
 *
 * @remarks
 * Extends native Error with structured error codes and optional context.
 * Use the `code` property for programmatic error handling.
 *
 * @public
 */
export class CompressionError extends Error {
  /** Machine-readable error code */
  readonly code: CompressionErrorCode;

  /** Additional error context */
  readonly context?: CompressionErrorContext;

  constructor(
    message: string,
    code: CompressionErrorCode = CompressionErrorCode.COMPRESSION_FAILED,
    options?: ErrorOptions & { context?: CompressionErrorContext },
  ) {
    super(message, options);

    this.name = 'CompressionError';
    this.code = code;
    this.context = options?.context;

    Error.captureStackTrace?.(this, this.constructor);
  }

  /** @internal */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * Configuration error for compression operations.
 *
 * @remarks
 * Thrown when compression setup is invalid (unsupported algorithm, invalid options, etc).
 *
 * @public
 */
export class CompressionConfigError extends CompressionError {
  constructor(
    message: string,
    options?: ErrorOptions & { context?: CompressionErrorContext },
  ) {
    super(message, CompressionErrorCode.INVALID_CONFIG, options);
    this.name = 'CompressionConfigError';
  }
}