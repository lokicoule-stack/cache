/**
 * Error code catalog for programmatic error handling
 */
export const ERROR_CODES = {
  // Configuration Errors
  INVALID_CONFIG: 'INVALID_CONFIG',
  INVALID_DURATION: 'INVALID_DURATION',
  INVALID_KEY: 'INVALID_KEY',
  INVALID_OPTIONS: 'INVALID_OPTIONS',
  STORE_NOT_FOUND: 'STORE_NOT_FOUND',
  DRIVER_NOT_FOUND: 'DRIVER_NOT_FOUND',

  // Driver Errors
  DRIVER_ERROR: 'DRIVER_ERROR',
  DRIVER_TIMEOUT: 'DRIVER_TIMEOUT',
  DRIVER_CONNECTION_FAILED: 'DRIVER_CONNECTION_FAILED',
  DRIVER_DISCONNECTED: 'DRIVER_DISCONNECTED',
  NOT_CONNECTED: 'NOT_CONNECTED',

  // Serialization Errors
  SERIALIZATION_ERROR: 'SERIALIZATION_ERROR',
  DESERIALIZATION_ERROR: 'DESERIALIZATION_ERROR',

  // Loader Errors
  LOADER_ERROR: 'LOADER_ERROR',
  LOADER_TIMEOUT: 'LOADER_TIMEOUT',
  LOADER_ABORTED: 'LOADER_ABORTED',

  // Circuit Breaker Errors
  CIRCUIT_BREAKER_OPEN: 'CIRCUIT_BREAKER_OPEN',

  // Bus Errors
  BUS_ERROR: 'BUS_ERROR',
  BUS_CONNECTION_FAILED: 'BUS_CONNECTION_FAILED',

  // Internal Errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

export type ErrorSeverity = 'error' | 'warning'

export type ErrorCategory =
  | 'config'
  | 'driver'
  | 'serialization'
  | 'loader'
  | 'circuit-breaker'
  | 'bus'
  | 'internal'

interface ErrorMetadata {
  severity: ErrorSeverity
  category: ErrorCategory
  retryable: boolean
  description: string
}

const ERROR_METADATA: Record<ErrorCode, ErrorMetadata> = {
  [ERROR_CODES.INVALID_CONFIG]: {
    severity: 'error',
    category: 'config',
    retryable: false,
    description: 'Invalid cache configuration provided',
  },
  [ERROR_CODES.INVALID_DURATION]: {
    severity: 'error',
    category: 'config',
    retryable: false,
    description: 'Invalid duration format',
  },
  [ERROR_CODES.INVALID_KEY]: {
    severity: 'error',
    category: 'config',
    retryable: false,
    description: 'Invalid cache key provided',
  },
  [ERROR_CODES.INVALID_OPTIONS]: {
    severity: 'error',
    category: 'config',
    retryable: false,
    description: 'Invalid options provided',
  },
  [ERROR_CODES.STORE_NOT_FOUND]: {
    severity: 'error',
    category: 'config',
    retryable: false,
    description: 'Requested cache store does not exist',
  },
  [ERROR_CODES.DRIVER_NOT_FOUND]: {
    severity: 'error',
    category: 'config',
    retryable: false,
    description: 'Requested driver not registered',
  },
  [ERROR_CODES.DRIVER_ERROR]: {
    severity: 'error',
    category: 'driver',
    retryable: true,
    description: 'Driver operation failed',
  },
  [ERROR_CODES.DRIVER_TIMEOUT]: {
    severity: 'error',
    category: 'driver',
    retryable: true,
    description: 'Driver operation timed out',
  },
  [ERROR_CODES.DRIVER_CONNECTION_FAILED]: {
    severity: 'error',
    category: 'driver',
    retryable: true,
    description: 'Failed to connect to driver',
  },
  [ERROR_CODES.DRIVER_DISCONNECTED]: {
    severity: 'error',
    category: 'driver',
    retryable: true,
    description: 'Driver is disconnected',
  },
  [ERROR_CODES.NOT_CONNECTED]: {
    severity: 'error',
    category: 'driver',
    retryable: false,
    description: 'Driver not connected - call connect() first',
  },
  [ERROR_CODES.SERIALIZATION_ERROR]: {
    severity: 'error',
    category: 'serialization',
    retryable: false,
    description: 'Failed to serialize value',
  },
  [ERROR_CODES.DESERIALIZATION_ERROR]: {
    severity: 'error',
    category: 'serialization',
    retryable: false,
    description: 'Failed to deserialize value',
  },
  [ERROR_CODES.LOADER_ERROR]: {
    severity: 'error',
    category: 'loader',
    retryable: true,
    description: 'Loader function threw an error',
  },
  [ERROR_CODES.LOADER_TIMEOUT]: {
    severity: 'error',
    category: 'loader',
    retryable: true,
    description: 'Loader function timed out',
  },
  [ERROR_CODES.LOADER_ABORTED]: {
    severity: 'warning',
    category: 'loader',
    retryable: false,
    description: 'Loader function was aborted',
  },
  [ERROR_CODES.CIRCUIT_BREAKER_OPEN]: {
    severity: 'error',
    category: 'circuit-breaker',
    retryable: false,
    description: 'Circuit breaker is open',
  },
  [ERROR_CODES.BUS_ERROR]: {
    severity: 'error',
    category: 'bus',
    retryable: true,
    description: 'Message bus operation failed',
  },
  [ERROR_CODES.BUS_CONNECTION_FAILED]: {
    severity: 'error',
    category: 'bus',
    retryable: true,
    description: 'Failed to connect to message bus',
  },
  [ERROR_CODES.INTERNAL_ERROR]: {
    severity: 'error',
    category: 'internal',
    retryable: false,
    description: 'Internal cache error',
  },
}

export interface CacheErrorOptions {
  cause?: Error
  context?: Record<string, unknown>
}

/**
 * Custom error class for all cache-related errors
 */
export class CacheError extends Error {
  readonly code: ErrorCode
  override readonly cause?: Error
  readonly context?: Record<string, unknown>

  constructor(code: ErrorCode, message: string, options?: CacheErrorOptions) {
    super(message)
    this.name = 'CacheError'
    this.code = code
    this.cause = options?.cause
    this.context = options?.context

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CacheError)
    }
  }

  static from(error: unknown, fallbackCode: ErrorCode = ERROR_CODES.INTERNAL_ERROR): CacheError {
    if (error instanceof CacheError) {
      return error
    }

    if (error instanceof Error) {
      return new CacheError(fallbackCode, error.message, { cause: error })
    }

    return new CacheError(fallbackCode, String(error))
  }

  static driverError(message: string, cause?: Error): CacheError {
    return new CacheError(ERROR_CODES.DRIVER_ERROR, message, { cause })
  }

  static loaderError(message: string, cause?: Error): CacheError {
    return new CacheError(ERROR_CODES.LOADER_ERROR, message, { cause })
  }

  static configError(message: string, context?: Record<string, unknown>): CacheError {
    return new CacheError(ERROR_CODES.INVALID_CONFIG, message, { context })
  }

  static serializationError(message: string, cause?: Error): CacheError {
    return new CacheError(ERROR_CODES.SERIALIZATION_ERROR, message, { cause })
  }

  static deserializationError(message: string, cause?: Error): CacheError {
    return new CacheError(ERROR_CODES.DESERIALIZATION_ERROR, message, { cause })
  }

  isRetryable(): boolean {
    return ERROR_METADATA[this.code]?.retryable ?? false
  }

  getSeverity(): ErrorSeverity {
    return ERROR_METADATA[this.code]?.severity ?? 'error'
  }

  getCategory(): ErrorCategory {
    return ERROR_METADATA[this.code]?.category ?? 'internal'
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      severity: this.getSeverity(),
      category: this.getCategory(),
      retryable: this.isRetryable(),
      context: this.context,
      stack: this.stack,
      cause: this.cause
        ? {
            name: this.cause.name,
            message: this.cause.message,
            stack: this.cause.stack,
          }
        : undefined,
    }
  }
}
