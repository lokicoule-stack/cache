/**
 * Integrity error codes
 * @public
 */
export enum IntegrityErrorCode {
  /** Signature verification failed - message has been tampered with */
  VERIFICATION_FAILED = 'VERIFICATION_FAILED',

  /** Invalid configuration (e.g., missing key, invalid algorithm) */
  INVALID_CONFIG = 'INVALID_CONFIG',

  /** Invalid input data format */
  INVALID_DATA = 'INVALID_DATA',

  /** Signing operation failed */
  SIGN_FAILED = 'SIGN_FAILED',
}

/**
 * Context data attached to integrity errors
 * @public
 */
export interface IntegrityErrorContext {
  [key: string]: unknown
  algorithm?: string
  operation?: 'sign' | 'verify'
}

/**
 * Base error for integrity operations
 * @public
 */
export class IntegrityError extends Error {
  readonly code: IntegrityErrorCode
  readonly context?: IntegrityErrorContext

  constructor(
    message: string,
    code: IntegrityErrorCode,
    options?: { context?: IntegrityErrorContext; cause?: Error },
  ) {
    super(message, { cause: options?.cause })
    this.name = 'IntegrityError'
    this.code = code
    this.context = options?.context
  }
}

/**
 * Security-specific integrity error (e.g., tampering detected)
 * @public
 */
export class IntegritySecurityError extends IntegrityError {
  constructor(message: string, options?: { context?: IntegrityErrorContext; cause?: Error }) {
    super(message, IntegrityErrorCode.VERIFICATION_FAILED, options)
    this.name = 'IntegritySecurityError'
  }
}

/**
 * Configuration error for integrity mechanisms
 * @public
 */
export class IntegrityConfigError extends IntegrityError {
  constructor(message: string, options?: { context?: IntegrityErrorContext; cause?: Error }) {
    super(message, IntegrityErrorCode.INVALID_CONFIG, options)
    this.name = 'IntegrityConfigError'
  }
}
