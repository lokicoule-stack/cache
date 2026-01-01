# @lokiverse/cache

Multi-layer cache for TypeScript. It works.

> **退屈 (Taikutsu)** — In Japanese, the opposite of Kaizen (continuous improvement). While others
> chase innovation, we choose boring stability. This library won't revolutionize caching. It just
> works, quietly, so you can forget it exists.

## Install

```bash
npm install @lokiverse/cache
```

## Quick Start

```typescript
import { createCacheManager } from '@lokiverse/cache'

// Memory-only cache (10k LRU built-in)
const cache = createCacheManager()

const user = await cache.getOrSet('user:123', async () => {
  return db.users.findById('123')
})
```

## Multi-tier with Redis

```typescript
import { createCacheManager, redisDriver } from '@lokiverse/cache'

const cache = createCacheManager({
  drivers: {
    redis: redisDriver({ url: 'redis://localhost:6379' }),
  },
  staleTime: '5m',
  gcTime: '1h',
})

await cache.connect()

// Memory L1 (implicit) -> Redis L2 -> loader -> backfill L1
const user = await cache.getOrSet('user:123', () => fetchUser('123'))

await cache.disconnect()
```

## Named Stores

```typescript
import { createCacheManager, redisDriver } from '@lokiverse/cache'

const cache = createCacheManager({
  drivers: {
    redis: redisDriver({ url: 'redis://localhost:6379' }),
    postgres: postgresDriver({ connectionString: '...' }),
  },
  stores: {
    sessions: ['redis'],           // fast, volatile
    analytics: ['postgres'],       // persistent
    default: ['redis', 'postgres'], // multi-tier
  },
})

// Use specific stores
const sessions = cache.use('sessions')
await sessions.set('token:abc', { userId: '123' })

const analytics = cache.use('analytics')
await analytics.set('events:daily', aggregatedData)
```

## Store Configuration

```typescript
// Short form: driver names as array
stores: {
  sessions: ['redis'],
}

// Long form: with options
stores: {
  sessions: {
    drivers: ['redis'],
    memory: false,  // disable L1 memory for this store
  },
}
```

## Low-level API

```typescript
import { createCache, memoryDriver, redisDriver } from '@lokiverse/cache'

const cache = createCache({
  l1: memoryDriver({ maxItems: 10_000 }),
  l2: redisDriver({ url: 'redis://localhost:6379' }),
  staleTime: '5m',
})
```

## Patterns

### Stale-While-Revalidate

```typescript
// timeout: 0 -> return stale immediately, refresh in background
const user = await cache.getOrSet('user:123', fetchUser, { timeout: 0 })

// timeout: 100 -> wait up to 100ms for fresh, else return stale
const user = await cache.getOrSet('user:123', fetchUser, { timeout: 100 })
```

### Tags

```typescript
await cache.set('user:1', alice, { tags: ['users'] })
await cache.set('user:2', bob, { tags: ['users'] })
await cache.set('post:1', post, { tags: ['posts'] })

await cache.invalidateTags(['users']) // removes user:1, user:2
```

### Namespace

```typescript
const users = cache.namespace('users')

await users.set('123', alice) // key: users:123
await users.get('123') // key: users:123
await users.clear() // clears users:* only
```

## API

### CacheManager Config

| Option                   | Type                          | Default     | Description                   |
| ------------------------ | ----------------------------- | ----------- | ----------------------------- |
| `drivers`                | `Record<string, Driver>`      | -           | Named drivers (redis, etc.)   |
| `stores`                 | `Record<string, StoreConfig>` | -           | Named store compositions      |
| `memory`                 | `boolean`                     | `true`      | Enable built-in memory L1     |
| `staleTime`              | `Duration`                    | `'1m'`      | Time until stale              |
| `gcTime`                 | `Duration`                    | `staleTime` | Time until garbage collected  |
| `prefix`                 | `string`                      | -           | Key prefix                    |
| `circuitBreakerDuration` | `Duration`                    | `'30s'`     | L2 circuit breaker reset time |

### Cache Config (low-level)

| Option                   | Type          | Default     | Description                   |
| ------------------------ | ------------- | ----------- | ----------------------------- |
| `l1`                     | `SyncDriver`  | -           | L1 memory driver              |
| `l2`                     | `AsyncDriver` | -           | L2 driver (Redis, etc.)       |
| `staleTime`              | `Duration`    | `'1m'`      | Time until stale              |
| `gcTime`                 | `Duration`    | `staleTime` | Time until garbage collected  |
| `prefix`                 | `string`      | -           | Key prefix                    |
| `circuitBreakerDuration` | `Duration`    | `'30s'`     | L2 circuit breaker reset time |

### Methods

| Method                            | Description           |
| --------------------------------- | --------------------- |
| `get(key)`                        | Get value             |
| `set(key, value, options?)`       | Set value             |
| `getOrSet(key, loader, options?)` | Get or compute        |
| `delete(...keys)`                 | Delete keys           |
| `has(key)`                        | Check existence       |
| `clear()`                         | Clear all             |
| `invalidateTags(tags)`            | Delete by tags        |
| `namespace(prefix)`               | Create prefixed view  |
| `use(name?)`                      | Get named store       |
| `connect()`                       | Connect remote stores |
| `disconnect()`                    | Disconnect            |
| `on(event, fn)`                   | Subscribe to events   |

### Options

| Option      | Type       | Description                       |
| ----------- | ---------- | --------------------------------- |
| `staleTime` | `Duration` | Override default stale time       |
| `gcTime`    | `Duration` | Override default gc time          |
| `tags`      | `string[]` | Tags for invalidation             |
| `timeout`   | `Duration` | SWR timeout (0 = immediate stale) |
| `retries`   | `number`   | Loader retry count                |
| `fresh`     | `boolean`  | Skip cache, force loader          |

### Duration

`number` (ms) or string: `'100ms'`, `'5s'`, `'1m'`, `'1h'`, `'1d'`

## License

MIT
