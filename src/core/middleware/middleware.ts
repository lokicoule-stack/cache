import { CompressionMiddleware } from './compression/compression-middleware'
import { EncryptionMiddleware } from './encryption/encryption-middleware'
import { RetryMiddleware } from './retry/retry-middleware'

import type { CompressionOption } from './compression/compression-config'
import type { EncryptionOption } from './encryption/encryption-config'
import type { RetryConfig } from './retry/retry-config'
import type { Transport } from '@/contracts/transport'

/**
 * Middleware configuration options.
 * @public
 */
export interface MiddlewareConfig {
  /**
   * Compression configuration. Default: `true` (gzip). Set to `false` to disable.
   */
  compression?: CompressionOption | false

  /**
   * Encryption configuration. Default: `false`. Provide config to enable.
   */
  encryption?: EncryptionOption | false

  /**
   * Retry configuration. Default: `true`. Set to `false` to disable.
   */
  retry?: RetryConfig | false
}

/**
 * @internal
 */
interface ResolvedMiddlewareConfig {
  compression: CompressionOption | false
  encryption: EncryptionOption | false
  retry: RetryConfig | false
}

/**
 * @internal
 */
const DEFAULT_MIDDLEWARE_CONFIG: Readonly<ResolvedMiddlewareConfig> = {
  compression: true,
  encryption: false,
  retry: true,
} as const

/**
 * @internal
 */
type MiddlewareWrapper = (transport: Transport) => Transport

/**
 * @internal
 */
const isDisabled = (value: unknown): value is false => value === false

/**
 * Resolves middleware configuration by applying defaults.
 * @public
 */
export const resolveMiddlewareConfig = (config?: MiddlewareConfig): ResolvedMiddlewareConfig => {
  if (!config) {
    return { ...DEFAULT_MIDDLEWARE_CONFIG }
  }

  return {
    compression: config.compression ?? DEFAULT_MIDDLEWARE_CONFIG.compression,
    encryption: config.encryption ?? DEFAULT_MIDDLEWARE_CONFIG.encryption,
    retry: config.retry ?? DEFAULT_MIDDLEWARE_CONFIG.retry,
  }
}

/**
 * Compose middleware wrappers (right to left).
 * @public
 */
export const compose =
  (...fns: MiddlewareWrapper[]): MiddlewareWrapper =>
  (transport: Transport) =>
    fns.reduceRight((acc, fn) => fn(acc), transport)

/**
 * Create compression middleware wrapper.
 * @public
 */
export const withCompression =
  (compression: CompressionOption): MiddlewareWrapper =>
  (transport: Transport) =>
    new CompressionMiddleware(transport, { compression })

/**
 * Create encryption middleware wrapper.
 * @public
 */
export const withEncryption =
  (encryption: EncryptionOption): MiddlewareWrapper =>
  (transport: Transport) =>
    new EncryptionMiddleware(transport, { encryption })

/**
 * Create retry middleware wrapper.
 * @public
 */
export const withRetry =
  (config: RetryConfig): MiddlewareWrapper =>
  (transport: Transport) =>
    new RetryMiddleware(transport, config)

/**
 * Pipe operator for composing middleware in natural order (left to right).
 * @public
 */
export const pipe = <T>(value: T, ...fns: Array<(arg: T) => T>): T =>
  fns.reduce((acc, fn) => fn(acc), value)

/**
 * Compose middleware stack from configuration.
 *
 * Application order: retry (outer) -> encryption -> compression (inner).
 * @public
 */
export const composeMiddleware = (
  baseTransport: Transport,
  config?: MiddlewareConfig,
): Transport => {
  const middlewares: MiddlewareWrapper[] = []
  const resolved = resolveMiddlewareConfig(config)

  if (!isDisabled(resolved.compression)) {
    middlewares.push(withCompression(resolved.compression))
  }

  if (!isDisabled(resolved.encryption)) {
    middlewares.push(withEncryption(resolved.encryption))
  }

  if (!isDisabled(resolved.retry)) {
    middlewares.push(withRetry(resolved.retry))
  }

  if (middlewares.length === 0) {
    return baseTransport
  }

  return compose(...middlewares)(baseTransport)
}
