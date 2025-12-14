// ============================================================================
// CORE BUS
// ============================================================================

// Bus Classes
export { MessageBus } from './core/bus/message-bus'
export { BusManager } from './core/bus/bus-manager'

// Bus Types
export type { BusOptions } from './core/bus/message-bus'
export type { BusManagerConfig } from './core/bus/bus-manager'

// ============================================================================
// TYPES
// ============================================================================

export type {
  Serializable,
  SerializablePrimitive,
  SerializableObject,
  MessageHandler,
  TransportData,
  TransportMessageHandler,
} from './types'

// ============================================================================
// CONTRACTS (Interfaces)
// ============================================================================

export type { Bus } from './contracts/bus'
export type { Transport } from './contracts/transport'
export type { Codec, CodecType, CodecOption } from './contracts/codec'
export type { Compression } from './contracts/compression'
export type { Integrity } from './contracts/integrity'
export type { Middleware } from './contracts/middleware'

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Middleware Configuration
export type { MiddlewareConfig } from './core/middleware/middleware'

// Retry Configuration & Errors
export type { RetryConfig, RetryConfigObject } from './core/middleware/retry/retry-config'
export { DeadLetterError } from './core/middleware/retry/retry-errors'
export type { RetryErrorContext } from './core/middleware/retry/retry-errors'

// Retry Backoff Functions & Types
export type {
  RetryBackoff,
  OnRetryCallback,
  OnDeadLetterCallback,
} from './core/middleware/retry/retry-backoff'

export {
  exponentialBackoff,
  linearBackoff,
  fibonacciBackoff,
  withMaxDelay,
  withJitter,
} from './core/middleware/retry/retry-backoff'

// Compression Configuration
export type {
  CompressionOption,
  CompressionType,
  GzipConfig,
} from './core/middleware/compression/compression-config'

// Integrity Configuration
export type {
  IntegrityOption,
  IntegrityType,
  HMACConfig,
} from './core/middleware/integrity/integrity-config'

// ============================================================================
// TRANSPORTS
// ============================================================================

// Memory Transport
export { MemoryTransport, memory } from './infrastructure/transports/memory/memory-transport'

// Redis Transport
export { RedisTransport, redis } from './infrastructure/transports/redis/redis-transport'
export type {
  RedisTransportConfig,
  RedisTransportExternalConfig,
  RedisInstance,
} from './infrastructure/transports/redis/redis-transport-config'

// Transport Errors
export {
  TransportError,
  TransportErrorCode,
  TransportOperation,
} from './infrastructure/transports/transport-errors'
export type { TransportErrorContext } from './infrastructure/transports/transport-errors'

// ============================================================================
// CODECS
// ============================================================================

// Codec Errors (domain errors only)
export { CodecError, CodecErrorCode } from './infrastructure/codecs/codec-errors'
export type { CodecErrorContext } from './infrastructure/codecs/codec-errors'

// NOTE: JsonCodec, MsgPackCodec are NOT exported
// Users should use codec: 'json' | 'msgpack' in config
// For custom codecs, implement the Codec interface

// ============================================================================
// COMPRESSION
// ============================================================================

// Compression Errors (domain errors only)
export {
  CompressionError,
  CompressionErrorCode,
} from './infrastructure/compression/compression-errors'
export type { CompressionErrorContext } from './infrastructure/compression/compression-errors'

// NOTE: GzipCompression is NOT exported
// Users should use compression: 'gzip' in config
// For custom compression, implement the Compression interface

// ============================================================================
// INTEGRITY
// ============================================================================

// Integrity Errors (domain errors only)
export {
  IntegrityError,
  IntegrityErrorCode,
  IntegritySecurityError,
  IntegrityConfigError,
} from './infrastructure/integrity/integrity-errors'
export type { IntegrityErrorContext } from './infrastructure/integrity/integrity-errors'

// NOTE: HMACIntegrity is NOT exported
// Users should use integrity: { type: 'hmac', key } in config
// For custom integrity mechanisms, implement the Integrity interface
