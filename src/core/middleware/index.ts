// Middleware Configuration (Public)
export type { MiddlewareConfig } from './middleware'

// Composition Functions (Public)
export {
  composeMiddleware,
  pipe,
  withCompression,
  withIntegrity,
  withRetry,
  compose,
} from './middleware'

// Retry Configuration & Errors (Public)
export type { RetryConfig } from './retry/retry-config'
export { QueueError, DeadLetterError } from './retry/retry-errors'

// Compression Configuration (Public)
export type { CompressionOption, GzipConfig } from './compression/compression-config'

// Integrity Configuration (Public)
export type { IntegrityOption, HMACConfig } from './integrity/integrity-config'

// NOTE: Middleware implementations (CompressionMiddleware, IntegrityMiddleware,
// RetryMiddleware) are NOT exported - they are internal implementation details
