// Middleware Configuration (Public)
export type { MiddlewareConfig } from './middleware'

// Composition Functions (Public)
export {
  composeMiddleware,
  pipe,
  withCompression,
  withIntegrity,
  withRetry,
  withTracing,
  compose,
} from './middleware'

// Retry Configuration & Errors (Public)
export type { RetryConfig } from './retry/retry-config'
export { DeadLetterError } from './retry/retry-errors'

// Compression Configuration (Public)
export type { CompressionOption, GzipConfig } from './compression/compression-config'

// Integrity Configuration (Public)
export type { IntegrityOption, HMACConfig } from './integrity/integrity-config'

// Tracing Configuration (Public)
export type { TracingOption, TracingConfig, TracingApi } from './tracing/tracing-config'

// NOTE: Middleware implementations (CompressionMiddleware, IntegrityMiddleware,
// RetryMiddleware, TracingMiddleware) are NOT exported - they are internal implementation details
