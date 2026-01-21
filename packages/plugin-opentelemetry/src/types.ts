/**
 * Configuration options for the OpenTelemetry plugin
 */
export interface OpenTelemetryPluginConfig {
  /**
   * Metrics configuration
   */
  metrics?: {
    /**
     * Enable detailed latency buckets (p50, p75, p90, p95, p99)
     * @default true
     */
    enableDetailedLatency?: boolean

    /**
     * Enable cache size gauges (tracks entry count per store/layer)
     * @default true
     */
    enableCacheSize?: boolean

    /**
     * Enable circuit breaker state tracking
     * @default true
     */
    enableCircuitBreakerState?: boolean

    /**
     * Custom metric prefix (default: 'cache')
     * @default 'cache'
     */
    prefix?: string
  }

  /**
   * Tracing configuration
   */
  tracing?: {
    /**
     * Enable distributed tracing spans
     * @default true
     */
    enableSpans?: boolean

    /**
     * Sample rate for traces (0.0 to 1.0)
     * @default 1.0
     */
    sampleRate?: number

    /**
     * Capture stack traces on errors
     * @default true
     */
    captureStackTraces?: boolean
  }

  /**
   * Custom meter name
   * @default '@lokiverse/cache'
   */
  meterName?: string

  /**
   * Custom tracer name
   * @default '@lokiverse/cache'
   */
  tracerName?: string
}

/**
 * Semantic attribute keys for cache operations
 */
export const CacheAttributes = {
  // Cache operation attributes
  KEY: 'cache.key',
  STORE: 'cache.store',
  DRIVER: 'cache.driver',
  LAYER: 'cache.layer',
  OPERATION: 'cache.operation',
  RESULT: 'cache.result',
  GRACED: 'cache.graced',
  TTL: 'cache.ttl',
  TAGS: 'cache.tags',

  // Error attributes
  ERROR_TYPE: 'error.type',
  ERROR_MESSAGE: 'error.message',

  // Circuit breaker attributes
  CB_STATE: 'cache.circuit_breaker.state',
  CB_FAILURE_COUNT: 'cache.circuit_breaker.failure_count',

  // Sync attributes
  BUS_CHANNEL: 'cache.bus.channel',
  BUS_DIRECTION: 'cache.bus.direction',
} as const

/**
 * Cache operation names
 */
export const CacheOperations = {
  GET: 'cache.get',
  SET: 'cache.set',
  DELETE: 'cache.delete',
  CLEAR: 'cache.clear',
  HAS: 'cache.has',
  GET_OR_SET: 'cache.get_or_set',
  LOADER: 'cache.loader',
  INVALIDATE_TAGS: 'cache.invalidate_tags',
} as const
