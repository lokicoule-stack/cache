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

/**
 * Core Layer
 *
 * Essential building blocks for message bus functionality.
 * Includes bus interface, codec abstraction, transport contracts, and type definitions.
 */
export * from './core/bus'
export * from './core/codec'
export type * from './core/transport'
export type * from './core/types'

/**
 * Infrastructure Layer
 *
 * Concrete implementations of transports, codecs, compression, encryption, and queuing systems.
 * - MemoryTransport: In-process messaging for testing and development
 * - RedisTransport: Distributed messaging via Redis Pub/Sub
 * - JsonCodec, MsgPackCodec: Data serialization implementations
 * - GzipCompression: Gzip compression implementation
 * - Base64Encryption, HMACEncryption: Encryption/authentication implementations
 * - RetryQueue: Retry queue for failed message delivery with pluggable strategies
 */
export * from './infrastructure/transports'
export * from './infrastructure/codecs'
export * from './infrastructure/compression'
export * from './infrastructure/encryption'
export * from './infrastructure/queue'

/**
 * Features Layer
 *
 * Optional enhancements and middleware for advanced use cases.
 * - TransportBuilder: Fluent API for composing transport middleware
 * - RetryMiddleware: Automatic retry with exponential backoff
 * - CompressionMiddleware: Payload compression for bandwidth optimization
 * - EncryptionMiddleware: End-to-end encryption for secure messaging
 */
export * from './features/middleware'
export * from './features/builder'

/**
 * Shared Layer
 *
 * Common utilities and error classes used throughout the library.
 */
export * from './shared/errors'
