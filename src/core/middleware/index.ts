// Middleware Configuration (Public)
export type { MiddlewareConfig } from './middleware'

// Composition Functions (Public)
export {
  composeMiddleware,
  pipe,
  withCompression,
  withEncryption,
  withRetry,
  compose,
} from './middleware'

// Retry Configuration & Errors (Public)
export type { RetryConfig } from './retry/retry-config'
export {
  QueueError,
  QueueFullError,
  DeadLetterError,
} from './retry/retry-errors'

// Compression Configuration (Public)
export type {
  CompressionOption,
  GzipConfig,
} from './compression/compression-config'

// Encryption Configuration (Public)
export type {
  EncryptionOption,
  HMACConfig,
} from './encryption/encryption-config'

// NOTE: Middleware implementations (CompressionMiddleware, EncryptionMiddleware,
// RetryMiddleware) are NOT exported - they are internal implementation details
