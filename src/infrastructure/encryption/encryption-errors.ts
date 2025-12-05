/**
 * Base error class for encryption-related errors.
 */
export class EncryptionError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'ENCRYPTION_ERROR',
  ) {
    super(message)
    this.name = 'EncryptionError'
    Error.captureStackTrace?.(this, this.constructor)
  }
}

/**
 * Error thrown when encrypted data has an invalid format.
 */
export class InvalidEncryptionDataError extends EncryptionError {
  constructor(message: string) {
    super(message, 'INVALID_ENCRYPTION_DATA')
    this.name = 'InvalidEncryptionDataError'
  }
}

/**
 * Error thrown when HMAC verification fails.
 */
export class HMACVerificationError extends EncryptionError {
  constructor() {
    super('HMAC verification failed', 'HMAC_VERIFICATION_FAILED')
    this.name = 'HMACVerificationError'
  }
}

/**
 * Error thrown when encryption configuration is invalid.
 */
export class InvalidEncryptionConfigError extends EncryptionError {
  constructor(message: string) {
    super(message, 'INVALID_ENCRYPTION_CONFIG')
    this.name = 'InvalidEncryptionConfigError'
  }
}
