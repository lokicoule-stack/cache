// ============================================================================
// CORE BUS
// ============================================================================

// Bus Classes
export { MessageBus } from './core/bus/message-bus'
export { BusManager } from './core/bus/bus-manager'

// Bus Types
export type { BusOptions } from './core/bus/message-bus'
export type { BusManagerConfig } from './core/bus/bus-manager'

// Bus Errors
export {
  BusError,
  BusNotConnectedError,
  BusOperationError,
  HandlerError,
  BusConfigurationError,
} from './core/bus/bus-errors'

// ============================================================================
// TYPES
// ============================================================================

export type {
  Serializable,
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
export type { Encryption } from './contracts/encryption'
export type { Middleware } from './contracts/middleware'

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Middleware Configuration
export type { MiddlewareConfig } from './core/middleware/middleware'

// Middleware Composition Functions
export {
  composeMiddleware,
  pipe,
  withCompression,
  withEncryption,
  withRetry,
  compose,
} from './core/middleware/middleware'

// Retry Configuration & Errors
export type { RetryConfig } from './core/middleware/retry/retry-config'
export {
  QueueError,
  QueueFullError,
  DeadLetterError,
} from './core/middleware/retry/retry-errors'

// Compression Configuration
export type {
  CompressionOption,
  GzipConfig,
} from './core/middleware/compression/compression-config'

// Encryption Configuration
export type {
  EncryptionOption,
  HMACConfig,
} from './core/middleware/encryption/encryption-config'

// ============================================================================
// TRANSPORTS
// ============================================================================

// Memory Transport
export { MemoryTransport, memory } from './infrastructure/transports/memory/memory-transport'

// Redis Transport
export { RedisTransport, redis } from './infrastructure/transports/redis/redis-transport'
export type { RedisTransportConfig } from './infrastructure/transports/redis/redis-transport-config'

// Transport Errors
export {
  TransportError,
  TransportConnectionError,
  TransportNotReadyError,
  TransportPublishError,
  TransportSubscribeError,
} from './infrastructure/transports/transport-errors'

// ============================================================================
// CODECS
// ============================================================================

// Codec Errors (domain errors only)
export { CodecError } from './infrastructure/codecs/codec-errors'

// NOTE: JsonCodec, MsgPackCodec are NOT exported
// Users should use codec: 'json' | 'msgpack' in config
// For custom codecs, implement the Codec interface

// ============================================================================
// COMPRESSION
// ============================================================================

// Compression Errors (domain errors only)
export { CompressionError } from './infrastructure/compression/compression-errors'

// NOTE: GzipCompression is NOT exported
// Users should use compression: 'gzip' in config
// For custom compression, implement the Compression interface

// ============================================================================
// ENCRYPTION
// ============================================================================

// Encryption Errors (domain errors only)
export { EncryptionError } from './infrastructure/encryption/encryption-errors'

// NOTE: Base64Encryption, HMACEncryption are NOT exported
// Users should use encryption: 'base64' | { type: 'hmac', key } in config
// For custom encryption, implement the Encryption interface
