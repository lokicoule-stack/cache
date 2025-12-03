import { type CompressionConfig, CompressionMiddleware } from '../middleware/compression'
import { type EncryptionConfig, EncryptionMiddleware } from '../middleware/encryption'
import { type RetryConfig, RetryMiddleware } from '../middleware/retry'

import type { ITransport } from '../../core/transport'
import type { RetryQueue } from '../../infrastructure/queue'

/**
 * Fluent builder for composing transport with middlewares
 *
 * Provides a chainable API to wrap base transports with middleware layers.
 * Middlewares are applied in the order they're added, forming a decorator chain.
 * The final transport combines all capabilities: base transport + retry +
 * compression + encryption.
 *
 * Order matters: typically retry → compression → encryption (innermost to outermost).
 * This ensures retries happen before compression, and encryption is the final layer.
 *
 * @example
 * ```typescript
 * import { memory } from './infrastructure/transports/memory'
 * import { RetryQueue } from './infrastructure/queue'
 *
 * const transport = memory()
 * const queue = new RetryQueue(transport, {
 *   maxAttempts: 3,
 *   backoff: 'exponential'
 * })
 * const finalTransport = new TransportBuilder(transport)
 *   .withRetry(queue, { maxRetries: 3 })
 *   .withCompression({ minSize: 1024 })
 *   .withEncryption({ encryption: new HMACEncryption(process.env.SECRET_KEY) })
 *   .build()
 *
 * const bus = new Bus({ transport: finalTransport })
 * ```
 */
export class TransportBuilder {
  #transport: ITransport

  /**
   * Create a new TransportBuilder
   *
   * @param transport - Base transport to wrap with middlewares
   */
  constructor(transport: ITransport) {
    this.#transport = transport
  }

  /**
   * Add retry middleware with retry queue
   *
   * Wraps the transport to automatically retry failed publish operations.
   * Failed messages are queued and retried with configurable backoff.
   * Requires a RetryQueue to persist retry state across restarts.
   *
   * @param retryQueue - Queue implementation for storing retry state
   * @param config - Retry configuration (optional, uses defaults if omitted)
   * @returns this for chaining
   *
   * @example
   * ```typescript
   * const queue = new RetryQueue(transport, {
   *   maxAttempts: 3,
   *   backoff: 'exponential'
   * })
   * builder.withRetry(queue, { maxRetries: 3, initialDelay: 1000 })
   * ```
   */
  withRetry(retryQueue: RetryQueue, config?: RetryConfig): this {
    this.#transport = new RetryMiddleware(this.#transport, retryQueue, config)
    return this
  }

  /**
   * Add compression middleware
   *
   * BREAKING CHANGE: Configuration format has changed.
   * Old: { minSize?: number }
   * New: { compression: ICompression }
   *
   * Wraps the transport to compress message payloads before publishing.
   * Pass an instance of GzipCompression or a custom ICompression implementation.
   *
   * If you don't need compression, simply don't call this method.
   *
   * @param config - Compression configuration with compression implementation
   * @returns this for chaining
   *
   * @example
   * ```typescript
   * import { GzipCompression } from '../../infrastructure/compression'
   *
   * // Gzip compression
   * builder.withCompression({
   *   compression: new GzipCompression({ level: 6, threshold: 1024 })
   * })
   * ```
   */
  withCompression(config: CompressionConfig): this {
    this.#transport = new CompressionMiddleware(this.#transport, config)
    return this
  }

  /**
   * Add encryption middleware
   *
   * BREAKING CHANGE: Configuration format has changed.
   * Old: { key: Buffer, algorithm?: 'aes-256-gcm' }
   * New: { encryption: IEncryption }
   *
   * Wraps the transport to provide message obfuscation or integrity verification.
   * Pass an instance of Base64Encryption or HMACEncryption.
   *
   * If you don't need encryption, simply don't call this method.
   *
   * @param config - Encryption configuration with encryption implementation
   * @returns this for chaining
   *
   * @example
   * ```typescript
   * import { randomBytes } from 'crypto'
   * import { Base64Encryption, HMACEncryption } from '../../infrastructure/encryption'
   *
   * // Base64 obfuscation
   * builder.withEncryption({ encryption: new Base64Encryption() })
   *
   * // HMAC integrity verification
   * const key = randomBytes(32)
   * builder.withEncryption({ encryption: new HMACEncryption(key) })
   * ```
   */
  withEncryption(config: EncryptionConfig): this {
    this.#transport = new EncryptionMiddleware(this.#transport, config)
    return this
  }

  /**
   * Build and return the composed transport
   *
   * Finalizes the middleware chain and returns the wrapped transport.
   * The returned transport implements ITransport and can be used directly
   * with Bus or BusManager.
   *
   * @returns The fully composed transport with all middlewares applied
   *
   * @example
   * ```typescript
   * const transport = builder
   *   .withRetry(queue)
   *   .withCompression()
   *   .build()
   *
   * const bus = new Bus({ transport })
   * ```
   */
  build(): ITransport {
    return this.#transport
  }
}
