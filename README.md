# @lokiverse/bus

Type-safe message bus for TypeScript with Redis pub/sub, middleware pipeline, and efficient
serialization.

[![npm](https://img.shields.io/npm/v/@lokiverse/bus)](https://www.npmjs.com/package/@lokiverse/bus)
[![Coverage](https://img.shields.io/badge/coverage-79%25-green)](./coverage)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

---

## Quick Start

```bash
npm install @lokiverse/bus redis
```

```typescript
import { MessageBus, redis } from '@lokiverse/bus'

const bus = new MessageBus({
  transport: redis({ url: 'redis://localhost:6379' }),
  codec: 'msgpack',
})

await bus.connect()
await bus.subscribe('orders', (order) => console.log(order))
await bus.publish('orders', { id: 1, total: 99.99 })
```

---

## Features

- **Type-safe pub/sub** — Generic handlers with compile-time validation
- **Transport-agnostic** — Redis, in-memory, or custom implementations
- **Efficient serialization** — MessagePack: 17-34% bandwidth reduction vs JSON
- **Middleware pipeline** — Retry, compression, encryption via config
- **Production-ready** — 79% coverage, 1 runtime dependency

---

## Performance

MacBook Pro 16,1 (x86_64), 16GB RAM, Node v23.3.0, Redis 7-alpine

| Payload | JSON (ops/s) | MessagePack (ops/s) | Overhead | Size Reduction |
| ------- | ------------ | ------------------- | -------- | -------------- |
| 30B     | 1,455        | 1,382               | 5.5%     | 26%            |
| 350B    | 1,432        | 1,368               | 6.8%     | 17%            |
| 15KB    | 1,110        | 879                 | 14.7%    | 26%            |

Overhead: Type safety + middleware cost. Use `'msgpack'` for production, `'json'` for development.

See [benchmarks/README.md](./benchmarks/README.md) for methodology.

---

## Usage

### Type Safety

```typescript
interface UserCreated {
  id: number
  email: string
}

await bus.subscribe<UserCreated>('user.created', (event) => {
  console.log(event.email) // Typed
})
```

### Middleware

```typescript
const bus = new MessageBus({
  transport: redis({ url: 'redis://localhost:6379' }),
  codec: 'msgpack',
  middleware: {
    retry: { maxAttempts: 10, backoff: 'exponential' },
    compression: { type: 'gzip', threshold: 5120 },
    encryption: { type: 'hmac', key: process.env.KEY },
  },
})
```

Shortcuts: `retry: true` (10 attempts, exponential), `retry: 5` (5 attempts), `compression: true`
(gzip, 5KB threshold)

### Multiple Transports

```typescript
import { BusManager } from '@lokiverse/bus'

const manager = new BusManager({
  default: 'events',
  transports: {
    events: { transport: redis({ url: 'redis://events:6379' }), codec: 'msgpack' },
    local: { transport: memory(), codec: 'json' },
  },
})

await manager.start()
await manager.use('events').publish('user.created', { id: 1 })
```

### Redis Cluster

```typescript
const bus = new MessageBus({
  transport: redis({
    rootNodes: [
      { host: 'localhost', port: 7000 },
      { host: 'localhost', port: 7001 },
    ],
  }),
})
```

---

## API Reference

### MessageBus

```typescript
class MessageBus {
  constructor(options: BusOptions)
  connect(): Promise<void>
  disconnect(): Promise<void>
  publish<T>(channel: string, data: T): Promise<void>
  subscribe<T>(channel: string, handler: (data: T) => void | Promise<void>): Promise<void>
  unsubscribe(channel: string, handler?: Function): Promise<void>
}
```

### BusOptions

```typescript
interface BusOptions {
  transport: Transport
  codec?: 'json' | 'msgpack' | Codec
  middleware?: {
    retry?: RetryConfig | boolean | number
    compression?: CompressionOption | boolean
    encryption?: EncryptionOption
  }
  onHandlerError?: (channel: string, error: Error) => void
}
```

### BusManager

```typescript
class BusManager<T extends Record<string, BusOptions>> {
  constructor(config: BusManagerConfig<T>)
  use<K extends keyof T>(name?: K): Bus
  start<K extends keyof T>(name?: K): Promise<void>
  stop<K extends keyof T>(name?: K): Promise<void>
  publish<D>(channel: string, data: D): Promise<void>
  subscribe<D>(channel: string, handler: (data: D) => void): Promise<void>
  unsubscribe(channel: string, handler?: Function): Promise<void>
}
```

Full API: [api-extractor.api.md](./etc/api-extractor.api.md)

---

## Extensibility

### Custom Codec

```typescript
const customCodec: Codec = {
  encode: (data) => new Uint8Array(Buffer.from(JSON.stringify(data))),
  decode: (bytes) => JSON.parse(Buffer.from(bytes).toString()),
}
```

### Custom Transport

```typescript
class CustomTransport implements Transport {
  readonly name = 'custom'
  async connect(): Promise<void> {
    /* ... */
  }
  async disconnect(): Promise<void> {
    /* ... */
  }
  async publish(channel: string, data: TransportData): Promise<void> {
    /* ... */
  }
  async subscribe(channel: string, handler: TransportMessageHandler): Promise<void> {
    /* ... */
  }
  async unsubscribe(channel: string): Promise<void> {
    /* ... */
  }
  onReconnect(callback: () => void): void {
    /* ... */
  }
}
```

---

## Testing

```bash
pnpm test           # All tests (testcontainers handles Redis automatically)
pnpm test:coverage  # With coverage report
```

## Roadmap

**Transports**: Kafka, NATS, RabbitMQ

**Middleware**: Rate limiting, circuit breaker, observability (metrics/tracing)

**Ecosystem**: Schema validation, persistent DLQ

---

## License

MIT — See [LICENSE](./LICENSE)
