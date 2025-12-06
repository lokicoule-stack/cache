/**
 * Error codes for encryption operations.
 * @public
 */
export const EncryptionErrorCode = {
  /** Invalid encryption configuration */
  INVALID_CONFIG :'INVALID_CONFIG',
  
  /** Encryption operation failed */
  ENCRYPTION_FAILED :'ENCRYPTION_FAILED',
  
  /** Decryption operation failed */
  DECRYPTION_FAILED: 'DECRYPTION_FAILED',
  
  /** 
   * Cryptographic authentication failed.
   * Data integrity cannot be verified.
   */
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  
  /** Invalid data format or structure */
  INVALID_DATA :'INVALID_DATA',
} as const;

/** @public */
export type EncryptionErrorCode = typeof EncryptionErrorCode[keyof typeof EncryptionErrorCode];

/**
 * Non-sensitive context for encryption errors.
 * @public
 */
export interface EncryptionErrorContext {
  /** Additional non-sensitive metadata */
  [key: string]: unknown
  
  /** Component or field where error occurred */
  field?: string
  
  /** Cryptographic algorithm being used */
  algorithm?: string
  
  /** Type of operation being performed */
  operation?: 'encrypt' | 'decrypt' | 'verify' | 'derive'

}

/**
 * Base error for all encryption operations.
 *
 * @remarks
 * Extends native Error with structured error codes and optional context.
 * Use the `code` property for programmatic error handling.
 *
 * @public
 */
export class EncryptionError extends Error {
  /** Machine-readable error code */
  readonly code: EncryptionErrorCode;

  /** Additional error context */
  readonly context?: EncryptionErrorContext;

  constructor(
    message: string,
    code: EncryptionErrorCode = EncryptionErrorCode.ENCRYPTION_FAILED,
    options?: ErrorOptions & { context?: EncryptionErrorContext },
  ) {
    super(message, options);

    this.name = 'EncryptionError';
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
 * Configuration error for encryption operations.
 *
 * @remarks
 * Thrown when encryption setup is invalid (missing keys, wrong algorithm, etc).
 *
 * @public
 */
export class EncryptionConfigError extends EncryptionError {
  constructor(
    message: string,
    options?: ErrorOptions & { context?: EncryptionErrorContext },
  ) {
    super(message, EncryptionErrorCode.INVALID_CONFIG, options);
    this.name = 'EncryptionConfigError';
  }
}

/**
 * Security-critical error for encryption operations.
 *
 * @remarks
 * Thrown when cryptographic authentication fails (HMAC, GCM auth tag, etc).
 * Indicates data tampering or corruption. Should trigger alerts, never retry.
 *
 * @public
 */
export class EncryptionSecurityError extends EncryptionError {
  constructor(
    message: string,
    options?: ErrorOptions & { context?: EncryptionErrorContext },
  ) {
    super(message, EncryptionErrorCode.AUTHENTICATION_FAILED, options);
    this.name = 'EncryptionSecurityError';
  }
}