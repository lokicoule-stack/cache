import { CompressionMiddleware } from './compression/compression-middleware'
import { EncryptionMiddleware } from './encryption/encryption-middleware'
import { RetryMiddleware } from './retry/retry-middleware'

import type { CompressionOption } from './compression/compression-config'
import type { EncryptionOption } from './encryption/encryption-config'
import type { RetryConfig } from './retry/retry-config'
import type { Transport } from '@/contracts/transport'

/**
 * Middleware configuration.
 * @public
 */
export interface MiddlewareConfig {
  /** Compression middleware */
  compression?: CompressionOption

  /** Encryption middleware */
  encryption?: EncryptionOption

  /** Retry middleware configuration */
  retry?: RetryConfig
}

/** Middleware wrapper function type */
type MiddlewareWrapper = (transport: Transport) => Transport

/**
 * Compose middleware wrappers (right to left).
 * @public
 */
const compose =
  (...fns: MiddlewareWrapper[]): MiddlewareWrapper =>
  (transport: Transport) =>
    fns.reduceRight((acc, fn) => fn(acc), transport)

/**
 * Create compression middleware wrapper.
 * @public
 */
const withCompression =
  (compression: CompressionOption): MiddlewareWrapper =>
  (transport: Transport) =>
    new CompressionMiddleware(transport, { compression })

/**
 * Create encryption middleware wrapper.
 * @public
 */
const withEncryption =
  (encryption: EncryptionOption): MiddlewareWrapper =>
  (transport: Transport) =>
    new EncryptionMiddleware(transport, { encryption })

/**
 * Create retry middleware wrapper.
 * @public
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
 * Pipe operator for composing middleware in natural order (left to right).
 * @public
 */
export const pipe = <T>(value: T, ...fns: Array<(arg: T) => T>): T =>
  fns.reduce((acc, fn) => fn(acc), value)

/**
 * Compose middleware stack from configuration.
 * @public
 */
export const composeMiddleware = (
  baseTransport: Transport,
  config?: MiddlewareConfig,
): Transport => {
  if (!config) {
    return baseTransport
  }

  const middlewares: MiddlewareWrapper[] = []

  if (config.compression) {
    middlewares.push(withCompression(config.compression))
  }

  if (config.encryption) {
    middlewares.push(withEncryption(config.encryption))
  }

  if (!(config.retry === false)) {
    middlewares.push(withRetry(config.retry))
  }

  return compose(...middlewares)(baseTransport)
}

/** @public */
export { withCompression, withEncryption, withRetry, compose }
