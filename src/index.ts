/**
 * @lokiverse/bus - TypeScript-first message bus
 *
 * A type-safe, middleware-enabled message bus for Node.js applications.
 * Provides pub/sub messaging with pluggable transports (memory, Redis),
 * configurable codecs (JSON, MessagePack), and composable middleware
 * (retry, compression, encryption).
 *
 * @example Quick Start
 * ```typescript
 * import { Bus, memory } from '@lokiverse/bus'
 *
 * const bus = new Bus({ transport: memory() })
 * await bus.connect()
 *
 * await bus.subscribe('events', (data) => {
 *   console.log('Received:', data)
 * })
 *
 * await bus.publish('events', { type: 'test', timestamp: Date.now() })
 * ```
 *
 * @packageDocumentation
 */

// ============================================================================
// PUBLIC API - Core Abstractions
// ============================================================================

/**
 * Bus - Main message bus class and manager
 */
export { Bus, BusManager } from './core/bus'
export type { BusOptions } from './core/bus'

/**
 * Contracts - Type definitions for extensibility
 *
 * Use these to implement custom transports, codecs, compression, or encryption.
 */
export type { Transport } from './core/transport'
export type { Codec, CodecType, CodecOption } from './core/codec'
export type { Compression } from './core/compression'
export type { Encryption } from './core/encryption'

/**
 * Types - Core type definitions
 */
export type {
  Serializable,
  TransportData,
  MessageHandler,
  TransportMessageHandler,
} from './core/types'

// ============================================================================
// PUBLIC API - Transport Factories
// ============================================================================

/**
 * Transport Factories
 *
 * Use these functions to create transport instances:
 * - `memory()` - In-process messaging for testing/development
 * - `redis()` - Distributed messaging via Redis Pub/Sub
 */
export { memory } from './infrastructure/transports/memory'
export { redis } from './infrastructure/transports/redis'
export type { RedisTransportConfig } from './infrastructure/transports/redis'

// ============================================================================
// PUBLIC API - Transport Builder
// ============================================================================

/**
 * Transport Builder - Fluent API for middleware composition
 *
 * @example
 * ```typescript
 * const transport = new TransportBuilder(memory())
 *   .withRetry(retryQueue)
 *   .withCompression({ level: 6 })
 *   .withEncryption({ strategy: new HMACEncryption(key) })
 *   .build()
 * ```
 */
export { TransportBuilder } from './features/builder'

// ============================================================================
// PUBLIC API - Errors
// ============================================================================

/**
 * Error Classes - Structured errors for error handling
 */
export {
  BusError,
  BusNotConnectedError,
  BusOperationError,
  HandlerError,
  CodecError,
  EncodeError,
  DecodeError,
  InvalidCodecError,
  TransportError,
  TransportConnectionError,
  TransportPublishError,
  TransportSubscribeError,
} from './shared/errors'

// ============================================================================
// ADVANCED API - Available via subpath imports
// ============================================================================

/**
 * Advanced features available via subpath imports:
 *
 * ## Codec Implementations
 * ```typescript
 * import { JsonCodec, MsgPackCodec } from '@lokiverse/bus/infrastructure/codecs'
 * ```
 *
 * ## Compression Implementations
 * ```typescript
 * import { GzipCompression } from '@lokiverse/bus/infrastructure/compression'
 * ```
 *
 * ## Encryption Implementations
 * ```typescript
 * import { Base64Encryption, HMACEncryption } from '@lokiverse/bus/infrastructure/encryption'
 * ```
 *
 * ## Retry Queue (Advanced)
 * ```typescript
 * import { RetryQueue } from '@lokiverse/bus/features/middleware/retry/queue'
 * ```
 *
 * ## Middleware (Advanced)
 * ```typescript
 * import { RetryMiddleware, CompressionMiddleware, EncryptionMiddleware } from '@lokiverse/bus/features/middleware'
 * ```
 */
