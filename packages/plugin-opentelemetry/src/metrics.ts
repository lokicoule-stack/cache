import { type Meter, type Counter, type Histogram, type UpDownCounter } from '@opentelemetry/api'
import type { OpenTelemetryPluginConfig } from './types.js'

/**
 * Manages OpenTelemetry metrics for cache operations
 */
export class CacheMetrics {
  private readonly prefix: string
  private readonly meter: Meter

  // Counters
  private readonly hitCounter: Counter
  private readonly missCounter: Counter
  private readonly errorCounter: Counter
  private readonly staleServedCounter: Counter
  private readonly dedupCounter: Counter
  private readonly busEventsCounter: Counter

  // Histograms
  private readonly operationDuration: Histogram

  // Gauges (UpDownCounters)
  private readonly entriesCount?: UpDownCounter
  private readonly circuitBreakerState?: UpDownCounter

  constructor(
    meter: Meter,
    config: OpenTelemetryPluginConfig['metrics'] = {}
  ) {
    this.meter = meter
    this.prefix = config.prefix ?? 'cache'

    // Initialize counters
    this.hitCounter = this.meter.createCounter(`${this.prefix}.hits`, {
      description: 'Total number of cache hits',
      unit: '1',
    })

    this.missCounter = this.meter.createCounter(`${this.prefix}.misses`, {
      description: 'Total number of cache misses',
      unit: '1',
    })

    this.errorCounter = this.meter.createCounter(`${this.prefix}.errors`, {
      description: 'Total number of cache operation errors',
      unit: '1',
    })

    this.staleServedCounter = this.meter.createCounter(`${this.prefix}.stale_served`, {
      description: 'Total number of stale values served (SWR)',
      unit: '1',
    })

    this.dedupCounter = this.meter.createCounter(`${this.prefix}.dedup_requests`, {
      description: 'Total number of deduplicated requests (stampede protection)',
      unit: '1',
    })

    this.busEventsCounter = this.meter.createCounter(`${this.prefix}.bus_events`, {
      description: 'Total number of distributed sync events',
      unit: '1',
    })

    // Initialize histograms
    const buckets = config.enableDetailedLatency
      ? [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
      : undefined

    this.operationDuration = this.meter.createHistogram(
      `${this.prefix}.operation.duration`,
      {
        description: 'Duration of cache operations in seconds',
        unit: 's',
        advice: {
          explicitBucketBoundaries: buckets,
        },
      }
    )

    // Initialize gauges (optional)
    if (config.enableCacheSize) {
      this.entriesCount = this.meter.createUpDownCounter(`${this.prefix}.entries`, {
        description: 'Current number of entries in cache',
        unit: '1',
      })
    }

    if (config.enableCircuitBreakerState) {
      this.circuitBreakerState = this.meter.createUpDownCounter(
        `${this.prefix}.circuit_breaker.state`,
        {
          description: 'Circuit breaker state (0=closed, 1=open)',
          unit: '1',
        }
      )
    }
  }

  /**
   * Record a cache hit
   */
  recordHit(attributes: {
    store: string
    driver: string
    graced: boolean
    duration: number
  }): void {
    this.hitCounter.add(1, {
      store: attributes.store,
      driver: attributes.driver,
      graced: String(attributes.graced),
    })

    this.operationDuration.record(attributes.duration / 1000, {
      operation: 'get',
      result: 'hit',
      store: attributes.store,
    })

    if (attributes.graced) {
      this.staleServedCounter.add(1, {
        store: attributes.store,
      })
    }
  }

  /**
   * Record a cache miss
   */
  recordMiss(attributes: { store: string; duration: number }): void {
    this.missCounter.add(1, {
      store: attributes.store,
    })

    this.operationDuration.record(attributes.duration / 1000, {
      operation: 'get',
      result: 'miss',
      store: attributes.store,
    })
  }

  /**
   * Record a set operation
   */
  recordSet(attributes: { store: string; duration: number }): void {
    this.operationDuration.record(attributes.duration / 1000, {
      operation: 'set',
      store: attributes.store,
    })
  }

  /**
   * Record a delete operation
   */
  recordDelete(attributes: { store: string; duration: number }): void {
    this.operationDuration.record(attributes.duration / 1000, {
      operation: 'delete',
      store: attributes.store,
    })
  }

  /**
   * Record a clear operation
   */
  recordClear(attributes: { store: string; duration: number }): void {
    this.operationDuration.record(attributes.duration / 1000, {
      operation: 'clear',
      store: attributes.store,
    })
  }

  /**
   * Record an error
   */
  recordError(attributes: { store: string; errorType: string; duration: number }): void {
    this.errorCounter.add(1, {
      store: attributes.store,
      error_type: attributes.errorType,
    })

    this.operationDuration.record(attributes.duration / 1000, {
      operation: 'error',
      store: attributes.store,
    })
  }

  /**
   * Record a deduplicated request
   */
  recordDedup(attributes: { store: string }): void {
    this.dedupCounter.add(1, {
      store: attributes.store,
    })
  }

  /**
   * Record a bus sync event
   */
  recordBusEvent(attributes: { channel: string; direction: 'published' | 'received' }): void {
    this.busEventsCounter.add(1, {
      channel: attributes.channel,
      direction: attributes.direction,
    })
  }

  /**
   * Update cache entry count (if enabled)
   */
  updateEntryCount(attributes: { store: string; layer: string; delta: number }): void {
    if (!this.entriesCount) return

    this.entriesCount.add(attributes.delta, {
      store: attributes.store,
      layer: attributes.layer,
    })
  }

  /**
   * Update circuit breaker state (if enabled)
   */
  updateCircuitBreakerState(attributes: {
    store: string
    driver: string
    state: 'open' | 'closed'
  }): void {
    if (!this.circuitBreakerState) return

    const value = attributes.state === 'open' ? 1 : 0
    this.circuitBreakerState.add(value, {
      store: attributes.store,
      driver: attributes.driver,
    })
  }
}
