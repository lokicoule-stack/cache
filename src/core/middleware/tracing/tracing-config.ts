import type { Context, Span, SpanOptions, TextMapGetter, TextMapSetter, Tracer } from '@opentelemetry/api'

/**
 * OpenTelemetry API interface subset used by tracing middleware.
 *
 * @remarks
 * This interface abstracts the OpenTelemetry API to:
 * 1. Allow users to provide their configured tracer instance
 * 2. Enable testing without requiring the full OpenTelemetry SDK
 * 3. Support different OpenTelemetry implementations
 *
 * @public
 */
export interface TracingApi {
  /** Get the current active context */
  getActiveContext(): Context

  /** Execute callback within a specific context */
  withContext<T>(ctx: Context, fn: () => T): T

  /** Inject trace context into a carrier object */
  inject(context: Context, carrier: Record<string, string>): void

  /** Extract trace context from a carrier object */
  extract(context: Context, carrier: Record<string, string>): Context

  /** Create and start a new span */
  startSpan(name: string, options?: SpanOptions, context?: Context): Span

  /** Create a span and execute callback within it */
  startActiveSpan<T>(
    name: string,
    options: SpanOptions,
    context: Context,
    fn: (span: Span) => T,
  ): T
}

/**
 * Configuration for tracing middleware.
 *
 * @public
 */
export interface TracingConfig {
  /**
   * OpenTelemetry tracer instance or tracing API adapter.
   *
   * @remarks
   * You can provide either:
   * - A standard OpenTelemetry Tracer from `@opentelemetry/api`
   * - A custom TracingApi implementation for testing or alternative tracing systems
   */
  tracer: Tracer | TracingApi

  /**
   * Service name for span attributes.
   * @defaultValue 'bus'
   */
  serviceName?: string

  /**
   * Whether to include payload size in span attributes.
   * @defaultValue true
   */
  recordPayloadSize?: boolean

  /**
   * Custom getter for extracting trace context from carrier.
   * Uses W3C TraceContext format by default.
   */
  textMapGetter?: TextMapGetter<Record<string, string>>

  /**
   * Custom setter for injecting trace context into carrier.
   * Uses W3C TraceContext format by default.
   */
  textMapSetter?: TextMapSetter<Record<string, string>>
}

/**
 * Tracing configuration option - can be a config object or false to disable.
 *
 * @public
 */
export type TracingOption = TracingConfig | false

/**
 * Internal resolved tracing configuration with defaults applied.
 *
 * @internal
 */
export interface ResolvedTracingConfig {
  tracer: Tracer | TracingApi
  serviceName: string
  recordPayloadSize: boolean
  textMapGetter?: TextMapGetter<Record<string, string>>
  textMapSetter?: TextMapSetter<Record<string, string>>
}

const DEFAULT_SERVICE_NAME = 'bus'
const DEFAULT_RECORD_PAYLOAD_SIZE = true

/**
 * Resolve tracing configuration with defaults.
 *
 * @internal
 */
export function resolveTracingConfig(config: TracingConfig): ResolvedTracingConfig {
  return {
    tracer: config.tracer,
    serviceName: config.serviceName ?? DEFAULT_SERVICE_NAME,
    recordPayloadSize: config.recordPayloadSize ?? DEFAULT_RECORD_PAYLOAD_SIZE,
    textMapGetter: config.textMapGetter,
    textMapSetter: config.textMapSetter,
  }
}

/**
 * Type guard to check if the provided tracer is a TracingApi adapter.
 *
 * @internal
 */
export function isTracingApi(tracer: Tracer | TracingApi): tracer is TracingApi {
  return 'getActiveContext' in tracer && 'withContext' in tracer && 'inject' in tracer
}
