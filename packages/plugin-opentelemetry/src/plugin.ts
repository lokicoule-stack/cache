import { metrics, trace } from '@opentelemetry/api'
import type {
  CachePlugin,
  EventEmitter,
  CacheHitEvent,
  CacheMissEvent,
  CacheSetEvent,
  CacheDeleteEvent,
  CacheClearEvent,
  CacheErrorEvent,
  BusPublishedEvent,
  BusReceivedEvent,
} from '@lokiverse/cache'
import { CacheMetrics } from './metrics.js'
import { CacheTracing } from './tracing.js'
import type { OpenTelemetryPluginConfig } from './types.js'

/**
 * OpenTelemetry plugin for @lokiverse/cache
 *
 * Provides comprehensive observability through:
 * - Metrics (Prometheus-compatible counters, histograms, gauges)
 * - Distributed tracing (Jaeger, Tempo, etc.)
 * - Context propagation
 *
 * @example
 * ```typescript
 * import { createCacheManager, memoryDriver } from '@lokiverse/cache'
 * import { OpenTelemetryPlugin } from '@lokiverse/cache-plugin-opentelemetry'
 *
 * const cache = createCacheManager({
 *   stores: { default: { l1: memoryDriver() } },
 *   plugins: [
 *     new OpenTelemetryPlugin({
 *       metrics: { enableDetailedLatency: true },
 *       tracing: { sampleRate: 1.0 },
 *     }),
 *   ],
 * })
 * ```
 */
export class OpenTelemetryPlugin implements CachePlugin {
  name = 'opentelemetry'

  private readonly metrics: CacheMetrics
  private readonly tracing: CacheTracing

  constructor(config: OpenTelemetryPluginConfig = {}) {
    const meterName = config.meterName ?? '@lokiverse/cache'
    const tracerName = config.tracerName ?? '@lokiverse/cache'

    const meter = metrics.getMeter(meterName)
    const tracer = trace.getTracer(tracerName)

    this.metrics = new CacheMetrics(meter, config.metrics)
    this.tracing = new CacheTracing(tracer, config.tracing)
  }

  register(emitter: EventEmitter): void {
    emitter.on('hit', (event: CacheHitEvent) => {
      this.metrics.recordHit({
        store: event.store,
        driver: event.driver,
        graced: event.graced,
        duration: event.duration,
      })

      const span = this.tracing.recordHit({
        key: event.key,
        store: event.store,
        driver: event.driver,
        graced: event.graced,
      })
      span.end()
    })

    emitter.on('miss', (event: CacheMissEvent) => {
      this.metrics.recordMiss({
        store: event.store,
        duration: event.duration,
      })

      const span = this.tracing.recordMiss({
        key: event.key,
        store: event.store,
      })
      span.end()
    })

    emitter.on('set', (event: CacheSetEvent) => {
      this.metrics.recordSet({
        store: event.store,
        duration: event.duration,
      })

      const span = this.tracing.recordSet({
        key: event.key,
        store: event.store,
      })
      span.end()
    })

    emitter.on('delete', (event: CacheDeleteEvent) => {
      this.metrics.recordDelete({
        store: event.store,
        duration: event.duration,
      })

      const span = this.tracing.recordDelete({
        key: event.key,
        store: event.store,
      })
      span.end()
    })

    emitter.on('clear', (event: CacheClearEvent) => {
      this.metrics.recordClear({
        store: event.store,
        duration: event.duration,
      })

      const span = this.tracing.recordClear({
        store: event.store,
      })
      span.end()
    })

    emitter.on('error', (event: CacheErrorEvent) => {
      this.metrics.recordError({
        store: event.store,
        errorType: event.error.constructor.name,
        duration: event.duration,
      })

      const span = this.tracing.recordError({
        key: event.key,
        store: event.store,
        error: event.error,
      })
      span.end()
    })

    emitter.on('bus:published', (event: BusPublishedEvent) => {
      this.metrics.recordBusEvent({
        channel: event.channel,
        direction: 'published',
      })
    })

    emitter.on('bus:received', (event: BusReceivedEvent) => {
      this.metrics.recordBusEvent({
        channel: event.channel,
        direction: 'received',
      })
    })
  }
}
