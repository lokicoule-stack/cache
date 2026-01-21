# @lokiverse/cache-plugin-opentelemetry

OpenTelemetry plugin for `@lokiverse/cache` - comprehensive observability with metrics, distributed tracing, and context propagation.

## Installation

```bash
npm install @lokiverse/cache-plugin-opentelemetry @opentelemetry/api
# or
pnpm add @lokiverse/cache-plugin-opentelemetry @opentelemetry/api
```

## Quick Start

```typescript
import { createCacheManager, memoryDriver } from '@lokiverse/cache'
import { OpenTelemetryPlugin } from '@lokiverse/cache-plugin-opentelemetry'

const cache = createCacheManager({
  stores: { default: { l1: memoryDriver() } },
  plugins: [
    new OpenTelemetryPlugin({
      metrics: {
        enableDetailedLatency: true,
        enableCacheSize: true,
        enableCircuitBreakerState: true,
      },
      tracing: {
        enableSpans: true,
        sampleRate: 1.0, // 100% sampling
      },
    }),
  ],
})
```

## Metrics Exposed

The plugin automatically exports the following metrics in Prometheus format:

### Counters

| Metric Name | Labels | Description |
|-------------|--------|-------------|
| `cache_hits_total` | `store`, `driver`, `graced` | Total cache hits |
| `cache_misses_total` | `store` | Total cache misses |
| `cache_errors_total` | `store`, `error_type` | Total errors |
| `cache_stale_served_total` | `store` | Stale values served (SWR) |
| `cache_dedup_requests_total` | `store` | Deduplicated requests |
| `cache_bus_events_total` | `channel`, `direction` | Bus sync events |

### Histograms

| Metric Name | Labels | Description |
|-------------|--------|-------------|
| `cache_operation_duration_seconds` | `operation`, `result`, `store` | Operation latency |

**Buckets (when `enableDetailedLatency: true`):**
- 1ms, 5ms, 10ms, 25ms, 50ms, 100ms, 250ms, 500ms, 1s, 2.5s, 5s, 10s

### Gauges (Optional)

| Metric Name | Labels | Description | Enabled By |
|-------------|--------|-------------|-----------|
| `cache_entries_count` | `store`, `layer` | Current entry count | `enableCacheSize` |
| `cache_circuit_breaker_state` | `store`, `driver` | CB state (0=closed, 1=open) | `enableCircuitBreakerState` |

## Distributed Tracing

The plugin creates spans for all cache operations:

### Span Operations

- `cache.get` - Cache read operations
- `cache.set` - Cache write operations
- `cache.delete` - Cache delete operations
- `cache.clear` - Cache clear operations
- `cache.loader` - Loader function executions
- `cache.invalidate_tags` - Tag-based invalidations

### Span Attributes

All spans include:
- `cache.key` - The cache key
- `cache.store` - Store name
- `cache.driver` - Driver name (memory, redis, etc.)
- `cache.result` - Operation result (hit, miss)
- `cache.graced` - Whether stale value was served

Error spans additionally include:
- `error.type` - Error class name
- `error.message` - Error message
- `exception.stacktrace` - Stack trace (if `captureStackTraces: true`)

## Configuration

### Metrics Options

```typescript
{
  metrics: {
    // Enable detailed latency buckets (p50, p75, p90, p95, p99)
    enableDetailedLatency: true,

    // Track cache entry counts per store/layer
    enableCacheSize: true,

    // Track circuit breaker states
    enableCircuitBreakerState: true,

    // Custom metric prefix (default: 'cache')
    prefix: 'myapp_cache',
  }
}
```

### Tracing Options

```typescript
{
  tracing: {
    // Enable distributed tracing
    enableSpans: true,

    // Sample rate (0.0 to 1.0)
    // 0.1 = 10% of operations traced
    sampleRate: 0.1,

    // Capture stack traces on errors
    captureStackTraces: true,
  }
}
```

### Custom Meter/Tracer Names

```typescript
{
  meterName: '@mycompany/cache',
  tracerName: '@mycompany/cache',
}
```

## Integration with Grafana

See the [Grafana setup guide](../../apps/grafana-dashboards/README.md) for:
- Docker Compose stack (Prometheus + Tempo + Loki + Grafana)
- Pre-built dashboards
- Alerting rules

## Example: Full Observability Stack

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node'
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { Resource } from '@opentelemetry/resources'
import { SEMRESATTRS_SERVICE_NAME } from '@opentelemetry/semantic-conventions'

// Configure OpenTelemetry SDK
const sdk = new NodeSDK({
  resource: new Resource({
    [SEMRESATTRS_SERVICE_NAME]: 'my-api',
  }),
  metricReader: new PrometheusExporter({
    port: 9464, // Metrics endpoint at http://localhost:9464/metrics
  }),
  traceExporter: new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces', // Grafana Tempo
  }),
})

sdk.start()

// Create cache with plugin
const cache = createCacheManager({
  stores: { default: { l1: memoryDriver() } },
  plugins: [new OpenTelemetryPlugin()],
})
```

## Querying Metrics in Grafana

### Cache Hit Rate

```promql
sum(rate(cache_hits_total[5m])) /
  (sum(rate(cache_hits_total[5m])) + sum(rate(cache_misses_total[5m])))
```

### P95 Latency

```promql
histogram_quantile(0.95,
  rate(cache_operation_duration_seconds_bucket[5m])
)
```

### Error Rate by Store

```promql
sum by (store, error_type) (rate(cache_errors_total[5m]))
```

### Stale-While-Revalidate Rate

```promql
rate(cache_stale_served_total[5m])
```

## License

MIT
