import { CompressionMiddleware } from './compression/compression-middleware'
import { IntegrityMiddleware } from './integrity/integrity-middleware'
import { RetryMiddleware } from './retry/retry-middleware'
import { TracingMiddleware } from './tracing/tracing-middleware'

import type { CompressionOption } from './compression/compression-config'
import type { IntegrityOption } from './integrity/integrity-config'
import type { RetryConfig } from './retry/retry-config'
import type { TracingConfig, TracingOption } from './tracing/tracing-config'
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

  /**
   * OpenTelemetry tracing configuration. Default: `false`. Provide config to enable.
   *
   * @remarks
   * When enabled, trace context is propagated across message boundaries using W3C TraceContext.
   * This allows distributed tracing across publisher and subscriber services.
   *
   * Requires `@opentelemetry/api` as a peer dependency.
   */
  tracing?: TracingOption
}

interface ResolvedMiddlewareConfig {
  compression: CompressionOption | false
  integrity: IntegrityOption | false
  retry: RetryConfig | false
  tracing: TracingOption
}

const DEFAULT_MIDDLEWARE_CONFIG: Readonly<ResolvedMiddlewareConfig> = {
  compression: false,
  integrity: false,
  retry: false,
  tracing: false,
} as const

export type MiddlewareWrapper = (transport: Transport) => Transport

const isDisabled = (value: unknown): value is false => value === false

export const resolveMiddlewareConfig = (config?: MiddlewareConfig): ResolvedMiddlewareConfig => {
  if (!config) {
    return { ...DEFAULT_MIDDLEWARE_CONFIG }
  }

  return {
    compression: config.compression ?? DEFAULT_MIDDLEWARE_CONFIG.compression,
    integrity: config.integrity ?? DEFAULT_MIDDLEWARE_CONFIG.integrity,
    retry: config.retry ?? DEFAULT_MIDDLEWARE_CONFIG.retry,
    tracing: config.tracing ?? DEFAULT_MIDDLEWARE_CONFIG.tracing,
  }
}

export const compose =
  (...fns: MiddlewareWrapper[]): MiddlewareWrapper =>
  (transport: Transport) =>
    fns.reduceRight((acc, fn) => fn(acc), transport)

export const withCompression =
  (compression: CompressionOption): MiddlewareWrapper =>
  (transport: Transport) =>
    new CompressionMiddleware(transport, { compression })

export const withIntegrity =
  (integrity: IntegrityOption): MiddlewareWrapper =>
  (transport: Transport) =>
    new IntegrityMiddleware(transport, { integrity })

export const withRetry =
  (config: RetryConfig): MiddlewareWrapper =>
  (transport: Transport) =>
    new RetryMiddleware(transport, config)

export const withTracing =
  (config: TracingConfig): MiddlewareWrapper =>
  (transport: Transport) =>
    new TracingMiddleware(transport, config)

export const pipe = <T>(value: T, ...fns: Array<(arg: T) => T>): T =>
  fns.reduce((acc, fn) => fn(acc), value)

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

  // Tracing is outermost middleware to capture full request lifecycle
  if (!isDisabled(resolved.tracing)) {
    middlewares.push(withTracing(resolved.tracing))
  }

  if (middlewares.length === 0) {
    return baseTransport
  }

  return compose(...middlewares)(baseTransport)
}
