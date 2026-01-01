# @lokiverse/cache

Type-safe multi-layer cache for TypeScript. It works.

[![npm](https://img.shields.io/npm/v/@lokiverse/cache)](https://www.npmjs.com/package/@lokiverse/cache)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

## Philosophy: 退屈 (Taikutsu)

In Japanese culture, there exists a concept opposite to **改善 (Kaizen)** — the relentless pursuit
of continuous improvement. We embrace **退屈 (Taikutsu)**: boring, unchanging stability.

**Boring is a feature, not a bug.**

This library doesn't aim to revolutionize caching. It doesn't compete with anything. It exists
in its own space, quietly doing one thing: reliable multi-layer cache with types.

No innovation. No disruption. No "10x better than X". Just predictable behavior that you can trust
at 3 AM when something breaks.

The best tools are the ones you forget exist because they never cause problems. That's our goal.

## Install

```bash
npm install @lokiverse/cache
npm install redis          # optional, for Redis L2 store
npm install @lokiverse/bus # optional, for multi-instance sync
```

## Use It

```typescript
import { createCache, memoryStore, redisStore } from '@lokiverse/cache'

type CacheSchema = {
  'user:{id}': { id: string; name: string; email: string }
  'config:global': { theme: string; locale: string }
}

const cache = createCache<CacheSchema>({
  l1: memoryStore({ maxItems: 10_000 }),
  l2: redisStore({ url: 'redis://localhost:6379' }),
  ttl: '5m',
  grace: '1h',
})

await cache.connect()

const user = await cache.getOrSet(
  'user:123',
  async () => db.users.findById('123'), // Only called on cache miss
  { tags: ['users'] }
)

await cache.disconnect()
```

## Configuration

### Development

```typescript
const cache = createCache({
  l1: memoryStore({ maxItems: 1000 }),
  ttl: '1m',
})
```

### Production

```typescript
const cache = createCache({
  l1: memoryStore({ maxItems: 50_000 }),
  l2: redisStore({
    url: process.env.REDIS_URL,
    serializer: 'json', // default, debuggable
  }),
  ttl: '10m',
  grace: '6h',
  circuitBreaker: {
    failureThreshold: 3,
    resetTimeout: 30_000,
  },
})
```

## Features

| Feature                   | Works |
| ------------------------- | ----- |
| Multi-layer L1/L2         | ✅    |
| TypeScript type safety    | ✅    |
| Stale-While-Revalidate    | ✅    |
| Stampede protection       | ✅    |
| Tag-based invalidation    | ✅    |
| Namespaces                | ✅    |
| Circuit breaker (L2)      | ✅    |
| Grace periods             | ✅    |
| Soft/Hard timeouts        | ✅    |
| Adaptive TTL              | ✅    |
| OpenTelemetry tracing     | ✅    |
| Multi-instance sync (bus) | ✅    |

## Architecture

```
Request: cache.getOrSet('user:123', factory)
    │
    ▼
┌─────────────────────────────────────────┐
│  L1 (Memory)  ──  2000-5000x faster     │
│      │                                   │
│      ▼ (miss)                           │
│  L2 (Redis)   ──  with circuit breaker  │
│      │                                   │
│      ▼ (miss)                           │
│  Factory      ──  with deduplication    │
│      │                                   │
│      ▼                                   │
│  Bus notify   ──  sync other instances  │
└─────────────────────────────────────────┘
```

## Type Safety

Define your schema once:

```typescript
type AppCache = {
  'user:{id}': User
  'session:{token}': Session
  'config:global': AppConfig
}

const cache = createCache<AppCache>({ /* ... */ })

// TypeScript catches mistakes
await cache.set('user:123', { id: '123', name: 'John' })     // ✅
await cache.set('user:123', { invalid: true })               // ❌ TypeScript error
await cache.get('typo:key')                                  // ❌ TypeScript error

const user = await cache.get('user:123')
// user is typed as User | undefined
```

## Stores

### Memory L1 (Local)

```typescript
import { memoryStore } from '@lokiverse/cache'

memoryStore({
  maxItems: 10_000,           // LRU eviction
  maxSize: 50 * 1024 * 1024,  // 50MB max
})
```

Uses `lru-cache` under the hood. Synchronous operations for maximum performance.

### Redis L2 (Remote)

```typescript
import { redisStore } from '@lokiverse/cache'

// Standalone
redisStore({ url: 'redis://localhost:6379' })

// Cluster
redisStore({
  rootNodes: [
    { url: 'redis://node1:6379' },
    { url: 'redis://node2:6379' },
  ],
})

// External client (shared with bus)
import { createClient } from 'redis'
const redis = createClient({ url: process.env.REDIS_URL })
await redis.connect()

redisStore({ client: redis })
```

## Core Patterns

### Stale-While-Revalidate (SWR)

Return stale data immediately, refresh in background:

```typescript
const user = await cache.getOrSet(
  'user:123',
  async () => fetchUser('123'),
  {
    ttl: '5m',           // Fresh for 5 minutes
    grace: '1h',         // Stale but available for 1 hour
    softTimeout: '200ms' // Return stale if factory > 200ms
  }
)
```

### Stampede Protection

Multiple concurrent requests for the same key? Only one factory executes:

```typescript
// 1000 concurrent requests for 'user:123'
// → 1 database query
// → 999 requests wait and share the result
await Promise.all(
  Array.from({ length: 1000 }, () =>
    cache.getOrSet('user:123', () => db.users.findById('123'))
  )
)
```

### Tag-Based Invalidation

Group entries for bulk invalidation:

```typescript
await cache.set('user:1', user1, { tags: ['users', 'user:1'] })
await cache.set('user:2', user2, { tags: ['users', 'user:2'] })
await cache.set('post:1', post1, { tags: ['posts', 'user:1'] })

// Invalidate all users
await cache.deleteByTag('users')

// Invalidate everything for user:1
await cache.deleteByTag('user:1')
```

### Adaptive Caching

Set TTL and tags based on the fetched value:

```typescript
const token = await cache.getOrSet('oauth:token', async (ctx) => {
  const token = await fetchAccessToken()

  // Dynamic TTL based on token expiry
  ctx.setTtl(token.expiresIn - 60)
  ctx.setTags(['oauth', `user:${token.userId}`])

  // Skip caching if temporary
  if (token.isTemporary) {
    ctx.skip()
  }

  return token
})
```

### Namespaces

Prefix-based key grouping:

```typescript
const userCache = cache.namespace('users')

await userCache.set('123', user)      // Key: users:123
await userCache.get('123')            // Key: users:123
await userCache.clear()               // Clears only users:*
```

## Circuit Breaker

Protect against L2 failures:

```typescript
const cache = createCache({
  l1: memoryStore(),
  l2: redisStore({ url: process.env.REDIS_URL }),
  circuitBreaker: {
    failureThreshold: 3,   // Open after 3 failures
    resetTimeout: 30_000,  // Try again after 30s
    successThreshold: 1,   // Close after 1 success in half-open
  },
})
```

States: `CLOSED` → `OPEN` → `HALF_OPEN` → `CLOSED`

When open, L2 is bypassed — L1 + factory continue working.

## Multi-Instance Sync

Sync L1 caches across instances using `@lokiverse/bus`:

```typescript
import { createCache, memoryStore, redisStore, CacheBusAdapter } from '@lokiverse/cache'
import { MessageBus, redis } from '@lokiverse/bus'

const bus = new MessageBus({ transport: redis() })
const busAdapter = new CacheBusAdapter({ bus })

const cache = createCache({
  l1: memoryStore(),
  l2: redisStore(),
  bus: busAdapter,
})

await cache.connect()

// Instance A sets a value
await cache.set('user:123', user)
// → L1 updated on Instance A
// → L2 updated
// → Bus publishes 'SET user:123'
// → Instance B receives message, invalidates L1
```

## Serializers

| Serializer | Size      | Use Case            |
| ---------- | --------- | ------------------- |
| json       | baseline  | Default, debuggable |
| msgpack    | ~30% less | High-volume caches  |

```typescript
redisStore({ serializer: 'json' })    // default
redisStore({ serializer: 'msgpack' }) // compact
```

## Middleware

Apply cross-cutting concerns to stores:

```typescript
import {
  memoryStore,
  loggingMiddleware,
  tracingMiddleware,
  composeMiddleware,
} from '@lokiverse/cache'
import { trace } from '@opentelemetry/api'

const store = composeMiddleware(
  loggingMiddleware(),
  tracingMiddleware({ tracer: trace.getTracer('cache') }),
)(memoryStore())
```

## Error Handling

```typescript
import { CacheError, StoreError, FactoryTimeoutError } from '@lokiverse/cache'

try {
  await cache.getOrSet('key', factory, { hardTimeout: '5s' })
} catch (error) {
  if (error instanceof FactoryTimeoutError) {
    // Factory took too long
  }
  if (error instanceof StoreError) {
    // Redis down, connection failed, etc.
    console.log(error.code)    // 'CONNECTION_FAILED'
    console.log(error.context) // { store: 'redis', operation: 'get', retryable: true }
  }
}
```

## Telemetry

```typescript
const cache = createCache({
  l1: memoryStore(),
  telemetry: {
    onHit: ({ key, layer, graced, duration }) => {
      metrics.increment('cache.hit', { layer, graced })
    },
    onMiss: ({ key, duration }) => {
      metrics.increment('cache.miss')
    },
    onError: ({ operation, key, error }) => {
      logger.error(`Cache ${operation} failed`, { key, error })
    },
  },
})
```

Hooks: `onHit`, `onMiss`, `onSet`, `onDelete`, `onError`

## API Reference

### Cache Methods

```typescript
cache.get(key, options?)                    // Get value
cache.set(key, value, options?)             // Set value
cache.getOrSet(key, factory, options?)      // Get or compute
cache.has(key)                              // Check existence
cache.delete(key)                           // Delete key
cache.deleteMany(keys)                      // Delete multiple
cache.deleteByTag(tags)                     // Invalidate by tags
cache.expire(key)                           // Mark stale (grace period)
cache.pull(key)                             // Get and delete
cache.clear()                               // Clear all
cache.namespace(prefix)                     // Create namespaced view
cache.connect()                             // Connect L2 + bus
cache.disconnect()                          // Disconnect all
```

### Options

```typescript
// SetOptions
{ ttl?: '5m', tags?: ['users'] }

// GetSetOptions
{
  ttl?: '5m',
  grace?: '1h',
  tags?: ['users'],
  softTimeout?: '200ms',
  hardTimeout?: '5s',
  suppressL2Errors?: true,
}
```

## Contributing

Pull requests welcome. Keep it boring.

## License

MIT

## Final Note

**退屈 (Taikutsu)** — Boring is not a limitation. It's a philosophy.

The software that ages well is the software that doesn't try to be clever.
