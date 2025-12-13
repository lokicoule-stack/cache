import { CompressionMiddleware } from './compression/compression-middleware'
import { IntegrityMiddleware } from './integrity/integrity-middleware'
import { RetryMiddleware } from './retry/retry-middleware'

import type { CompressionOption } from './compression/compression-config'
import type { IntegrityOption } from './integrity/integrity-config'
import type { RetryConfig } from './retry/retry-config'
import type { Transport } from '@/contracts/transport'

/**
 * Middleware configuration options.
 * @public
 */
export interface MiddlewareConfig {
  /**
   * Compression configuration. Default: `false`. Provide config to enable.
   */
  compression?: CompressionOption | false

  /**
   * Message integrity/authentication configuration. Default: `false`. Provide config to enable.
   *
   * Note: Integrity ensures message authenticity and detects tampering, but does NOT
   * provide confidentiality (data remains readable). Use encryption for data privacy.
   */
  integrity?: IntegrityOption | false

  /**
   * Retry configuration. Default: `false`. Provide config to enable.
   */
  retry?: RetryConfig | false
}

/**
 * @internal
 */
interface ResolvedMiddlewareConfig {
  compression: CompressionOption | false
  integrity: IntegrityOption | false
  retry: RetryConfig | false
}

/**
 * @internal
 */
const DEFAULT_MIDDLEWARE_CONFIG: Readonly<ResolvedMiddlewareConfig> = {
  compression: false,
  integrity: false,
  retry: false,
} as const

/**
 * Middleware wrapper function type.
 * @public
 */
export type MiddlewareWrapper = (transport: Transport) => Transport

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
    integrity: config.integrity ?? DEFAULT_MIDDLEWARE_CONFIG.integrity,
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
 * Create integrity middleware wrapper.
 * @public
 */
export const withIntegrity =
  (integrity: IntegrityOption): MiddlewareWrapper =>
  (transport: Transport) =>
    new IntegrityMiddleware(transport, { integrity })

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
 * Application order: retry (outer) -> integrity -> compression (inner).
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

  if (!isDisabled(resolved.integrity)) {
    middlewares.push(withIntegrity(resolved.integrity))
  }

  if (!isDisabled(resolved.retry)) {
    middlewares.push(withRetry(resolved.retry))
  }

  if (middlewares.length === 0) {
    return baseTransport
  }

  return compose(...middlewares)(baseTransport)
}
