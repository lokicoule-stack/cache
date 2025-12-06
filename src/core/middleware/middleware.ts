import { CompressionMiddleware } from './compression/compression-middleware'
import { EncryptionMiddleware } from './encryption/encryption-middleware'
import { RetryMiddleware } from './retry/retry-middleware'

import type { CompressionOption } from './compression/compression-config'
import type { EncryptionOption } from './encryption/encryption-config'
import type { RetryConfig } from './retry/retry-config'
import type { Transport } from '@/contracts/transport'

/**
 * Middleware configuration
 */
export interface MiddlewareConfig {
  /**
   * Compression middleware
   *
   * - `'gzip'`: Default gzip compression
   * - `{ type: 'gzip', level?: number, threshold?: number }`: Gzip with custom options
   * - Custom Compression implementation
   */
  compression?: CompressionOption

  /**
   * Encryption middleware
   *
   * - `'base64'`: Base64 obfuscation (NOT secure)
   * - `{ type: 'hmac', key: string | Buffer }`: HMAC-SHA256 authentication
   * - Custom Encryption implementation
   */
  encryption?: EncryptionOption

  /**
   * Retry middleware configuration
   *
   * - `{ enabled: boolean }`: Enable/disable retry on publish failure
   *
   * @default { enabled: true }
   */
  retry?: RetryConfig
}

/**
 * Type for a middleware wrapper function
 */
type MiddlewareWrapper = (transport: Transport) => Transport

/**
 * Compose multiple middleware wrappers into a single function
 * Applies middleware from right to left (last to first in array)
 */
const compose = (...fns: MiddlewareWrapper[]): MiddlewareWrapper => 
  (transport: Transport) => 
    fns.reduceRight((acc, fn) => fn(acc), transport)

/**
 * Create compression middleware wrapper
 */
const withCompression = (compression: CompressionOption): MiddlewareWrapper =>
  (transport: Transport) => 
    new CompressionMiddleware(transport, { compression })

/**
 * Create encryption middleware wrapper
 */
const withEncryption = (encryption: EncryptionOption): MiddlewareWrapper =>
  (transport: Transport) => 
    new EncryptionMiddleware(transport, { encryption })

/**
 * Create retry middleware wrapper
 */
const withRetry = (config?: RetryConfig): MiddlewareWrapper => {
  return (transport: Transport) => {
    if (config === false) {
      return transport
    }

    return new RetryMiddleware(transport, config)
  }
}

/**
 * Pipe operator for composing middleware in natural order (top to bottom)
 *
 * Applies functions from left to right, opposite of compose().
 * More intuitive for imperative-style composition.
 *
 * @param value - Initial value (base transport)
 * @param fns - Transformation functions to apply in sequence
 * @returns Final transformed value
 *
 * @example
 * ```typescript
 * const transport = pipe(
 *   memory(),
 *   withCompression('gzip'),
 *   withEncryption({ type: 'hmac', key: 'secret' }),
 *   withRetry({ enabled: true })
 * )
 * ```
 */
export const pipe = <T>(value: T, ...fns: Array<(arg: T) => T>): T =>
  fns.reduce((acc, fn) => fn(acc), value)

/**
 * Compose middleware stack from configuration
 *
 * Applies middleware in the following order:
 * 1. Compression (closest to transport)
 * 2. Encryption
 * 3. Retry (outermost layer)
 *
 * @param baseTransport - The base transport implementation
 * @param config - Optional middleware configuration
 * @returns Transport wrapped with configured middleware layers
 *
 * @example
 * ```typescript
 * const transport = composeMiddleware(memory(), {
 *   compression: 'gzip',
 *   encryption: { type: 'hmac', key: 'secret' },
 *   retry: { enabled: true }
 * })
 * ```
 */
export const composeMiddleware = (
  baseTransport: Transport,
  config?: MiddlewareConfig,
): Transport => {
  if (!config) {
    return baseTransport
  }

  const middlewares: MiddlewareWrapper[] = []

  // Layer 1: Compression (closest to transport)
  if (config.compression) {
    middlewares.push(withCompression(config.compression))
  }

  // Layer 2: Encryption
  if (config.encryption) {
    middlewares.push(withEncryption(config.encryption))
  }

  // Layer 3: Retry (outermost layer)
  // Only skip if explicitly set to false
  if (!(config.retry === false)) {
    middlewares.push(withRetry(config.retry))
  }

  // Compose all middlewares (right to left)
  return compose(...middlewares)(baseTransport)
}

// Export individual middleware wrappers for manual composition
export { withCompression, withEncryption, withRetry, compose }
