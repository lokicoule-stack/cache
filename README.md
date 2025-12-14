# @lokiverse/bus

Type-safe message bus for TypeScript. It works.

[![npm](https://img.shields.io/npm/v/@lokiverse/bus)](https://www.npmjs.com/package/@lokiverse/bus)
[![Coverage](https://img.shields.io/badge/coverage-80%25-green)](./coverage)
[![Tests](https://img.shields.io/badge/tests-149%20passing-brightgreen)](./tests)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

## Philosophy: 退屈 (Taikutsu)

In Japanese culture, there exists a concept opposite to **改善 (Kaizen)** — the relentless pursuit
of continuous improvement. We embrace **退屈 (Taikutsu)**: boring, unchanging stability.

**Boring is a feature, not a bug.**

This library doesn't aim to revolutionize message buses. It doesn't compete with anything. It exists
in its own space, quietly doing one thing: reliable pub/sub with types.

No innovation. No disruption. No "10x better than X". Just predictable behavior that you can trust
at 3 AM when something breaks.

The best tools are the ones you forget exist because they never cause problems. That's our goal.

## Install

```bash
npm install @lokiverse/bus
npm install redis  # optional, for Redis transport
```

## Use It

```typescript
import { BusManager, redis } from '@lokiverse/bus'

type Messages = {
  'order:created': { id: string; total: number }
}

const bus = new BusManager<Messages>({
  default: 'main',
  transports: { main: { transport: redis() } },
})

await bus.subscribe('order:created', (order) => {
  console.log(order.id, order.total) // TypeScript knows these types
})

await bus.publish('order:created', { id: '123', total: 99.99 })
await bus.stop()
```

## Configuration

### Development

```typescript
const bus = new BusManager({
  default: 'main',
  transports: {
    main: { transport: memory() }, // in-memory, for tests
  },
})
```

### Production

```typescript
const bus = new BusManager({
  default: 'main',
  transports: {
    main: {
      transport: redis({ url: process.env.REDIS_URL }),
      codec: 'msgpack', // 17-47% smaller than JSON
      middleware: {
        retry: { maxAttempts: 3, backoff: 'exponential' },
        compression: { type: 'gzip', threshold: 1024 },
        integrity: { type: 'hmac', key: process.env.HMAC_SECRET },
      },
    },
  },
})
```

## Features

| Feature                       | Works |
| ----------------------------- | ----- |
| Pub/Sub across processes      | ✅    |
| TypeScript type safety        | ✅    |
| Redis transport               | ✅    |
| In-memory transport           | ✅    |
| Auto-reconnect + re-subscribe | ✅    |
| Retry with backoff            | ✅    |
| Gzip compression              | ✅    |
| HMAC integrity                | ✅    |
| OpenTelemetry tracing         | ✅    |

## Type Safety

Define your schema once:

```typescript
type AppMessages = {
  'user:created': { id: string; email: string }
  'order:placed': { orderId: string; total: number }
}

const bus = new BusManager<AppMessages>({
  /* ... */
})

// TypeScript catches mistakes
await bus.publish('user:created', { id: '123', email: 'a@b.com' }) // ✅
await bus.publish('user:created', { id: 123 }) // ❌ TypeScript error
await bus.publish('typo:channel', {}) // ❌ TypeScript error

await bus.subscribe('order:placed', (order) => {
  const id: string = order.orderId // ✅ inferred
  const amount: number = order.total // ✅ inferred
})
```

## Transports

### Redis (Production)

```typescript
import { redis } from '@lokiverse/bus'

// Standalone
redis({ url: 'redis://localhost:6379' })

// Cluster
redis({
  rootNodes: [
    { host: 'node1', port: 7000 },
    { host: 'node2', port: 7001 },
  ],
})

// With reconnect strategy
redis({
  url: process.env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 100, 5000),
  },
})
```

**Auto-reconnect:** When Redis reconnects, all channels are automatically re-subscribed. No messages
are lost.

### Memory (Testing)

```typescript
import { memory } from '@lokiverse/bus'

const bus = new MessageBus({ transport: memory() })
```

Synchronous delivery, same process only. Perfect for unit tests.

### Multiple Transports

```typescript
const manager = new BusManager({
  default: 'critical',
  transports: {
    critical: { transport: redis({ url: process.env.REDIS_URL }) },
    internal: { transport: memory() },
  },
})

await manager.publish('orders', data) // uses 'critical'
await manager.use('internal').publish('cache:clear', {}) // explicit
```

## Middleware

Applied in order: Tracing → Retry → Integrity → Compression → Transport

### Retry

```typescript
middleware: {
  retry: {
    maxAttempts: 5,
    backoff: 'exponential',  // or 'linear', 'fibonacci'
    onDeadLetter: (channel, data, error) => {
      logger.error('Message failed permanently', { channel, error })
    }
  }
}
```

### Compression

```typescript
middleware: {
  compression: {
    type: 'gzip',
    threshold: 1024  // only compress if > 1KB
  }
}
```

Only compresses when beneficial (compressed size < 90% of original).

### Integrity (HMAC)

```typescript
middleware: {
  integrity: {
    type: 'hmac',
    key: process.env.HMAC_SECRET,
    algorithm: 'sha256'  // or 'sha384', 'sha512'
  }
}
```

Signs messages to detect tampering. Uses timing-safe comparison.

### Tracing (OpenTelemetry)

```typescript
import { trace } from '@opentelemetry/api'

middleware: {
  tracing: {
    tracer: trace.getTracer('my-service'),
    recordPayloadSize: true
  }
}
```

Creates spans with W3C TraceContext propagation.

## Codecs

| Codec   | Size vs JSON   | Use Case             |
| ------- | -------------- | -------------------- |
| msgpack | 17-47% smaller | Production (default) |
| json    | baseline       | Debugging            |
| base64  | 33% larger     | Text-only transports |

```typescript
codec: 'msgpack' // default
codec: 'json' // human-readable
```

## Error Handling

```typescript
import { TransportError, CodecError, IntegrityError } from '@lokiverse/bus'

try {
  await bus.publish('channel', data)
} catch (error) {
  if (error instanceof TransportError) {
    // Redis down, connection failed, etc.
  }
  if (error instanceof IntegrityError) {
    // HMAC verification failed
  }
}
```

All errors have a `.code` property:

- `CONNECTION_FAILED`, `PUBLISH_FAILED` (TransportError)
- `PAYLOAD_TOO_LARGE`, `ENCODE_FAILED` (CodecError)
- `VERIFICATION_FAILED` (IntegrityError)

## Telemetry

```typescript
const manager = new BusManager({
  transports: { main: { transport: redis() } },
  telemetry: {
    onPublish: ({ channel, payloadSize, duration }) => {
      metrics.histogram('bus.publish.duration', duration, { channel })
    },
    onError: ({ operation, channel, error }) => {
      logger.error(`Bus ${operation} failed`, { channel, error })
    },
    onHandlerExecution: ({ channel, duration, success }) => {
      metrics.histogram('bus.handler.duration', duration, { channel, success })
    },
  },
})
```

Hooks: `onPublish`, `onSubscribe`, `onUnsubscribe`, `onError`, `onHandlerExecution`

## Documentation

See `/docs` folder for details:

- [Architecture](./docs/architecture.md) - Internal design
- [Middleware](./docs/middleware.md) - Retry, compression, integrity, tracing
- [Transports](./docs/transports.md) - Redis, Memory, custom implementations
- [Telemetry](./docs/telemetry.md) - Observability hooks

## Contributing

Pull requests welcome. Keep it boring.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for setup.

## License

MIT

## Final Note:

**退屈 (Taikutsu)** — Boring is not a limitation. It's a philosophy.

The software that ages well is the software that doesn't try to be clever.
