# @lokiverse/cache

Multi-layer cache for TypeScript. It works.

> **退屈 (Taikutsu)** — In Japanese, the opposite of Kaizen (continuous improvement). While others
> chase innovation, we choose boring stability. This library won't revolutionize caching. It just
> works, quietly, so you can forget it exists.

## Installation

```bash
npm install @lokiverse/cache
# or
pnpm add @lokiverse/cache
```

## Quick Start

```typescript
import { createCacheManager, memoryDriver } from '@lokiverse/cache'

// Memory-only cache (explicit L1)
const cache = createCacheManager({
  stores: {
    default: {
      l1: memoryDriver({ maxItems: 10_000 }),
    },
  },
})

const user = await cache.getOrSet('user:123', async () => {
  return db.users.findById('123')
})
```

## Documentation

See the [root README](../../README.md) for full documentation.

## Observability

Want metrics and distributed tracing? Check out our plugins:

- [`@lokiverse/cache-plugin-opentelemetry`](../plugin-opentelemetry) - Full OpenTelemetry integration
- [`@lokiverse/cache-plugin-prometheus`](../plugin-prometheus) - Native Prometheus metrics
- [`@lokiverse/cache-plugin-loki`](../plugin-loki) - Structured logging to Grafana Loki

## License

MIT
